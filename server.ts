import express, { Request, Response } from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { ALL_PARTIDAS } from './src/constants/categories.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
const isProduction = process.env.NODE_ENV === 'production';

app.use(express.json());

// Initialize Gemini SDK if key exists
let geminiClient: GoogleGenAI | null = null;
if (process.env.GEMINI_API_KEY) {
  try {
    geminiClient = new GoogleGenAI({});
  } catch (err) {
    console.warn('Could not initialize GoogleGenAI client:', err);
  }
}

// 1. Natural Language Movement Classification Endpoint
app.post('/api/parse-movement', async (req: Request, res: Response) => {
  const { text, referenceDate } = req.body;
  if (!text || typeof text !== 'string') {
    return res.status(400).json({ error: 'Text prompt is required' });
  }

  // If Gemini is available, use model for ultra-deep contextual understanding
  if (geminiClient && process.env.GEMINI_API_KEY) {
    try {
      const systemInstruction = `
Eres el clasificador del Asistente Financiero Personal.
El esquema de categorías disponible es:
${ALL_PARTIDAS.map(p => `- ${p.type} | Código: ${p.code} | Grupo: ${p.groupName} | Partida: ${p.name} | Keywords: ${p.keywords.slice(0, 4).join(', ')}`).join('\n')}

Debes extraer del texto del usuario:
1. type: "GASTO" o "INGRESO"
2. amount: número con el importe exacto (ej. 15.5)
3. code: código de partida exacto (ej. "V.001.002" para Comer fuera)
4. categoryName: nombre del grupo
5. subcategoryName: nombre de la partida
6. description: descripción concisa y limpia del gasto/ingreso
7. wallet: Cartera u origen (ej. "OPENBANK", "REVOLUT", "SANTANDER", "EFECTIVO", "MYINVESTOR", "BBVA")
8. date: fecha en formato YYYY-MM-DD (asume hoy es ${referenceDate || new Date().toISOString().split('T')[0]})
9. processed: booleano (true si ya se ha pagado/cobrado o no se indica lo contrario, false si dice "pendiente" o "por pagar")
10. explanation: breve explicación (1 frase) del registro identificado

Responde ÚNICAMENTE con un objeto JSON válido con estas claves:
{"type":"GASTO"|"INGRESO","amount":number,"code":"...","categoryName":"...","subcategoryName":"...","description":"...","wallet":"...","date":"YYYY-MM-DD","processed":boolean,"explanation":"..."}
      `;

      const response = await geminiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: text,
        config: {
          systemInstruction,
          responseMimeType: 'application/json',
          temperature: 0.1,
        },
      });

      if (response && response.text) {
        const parsed = JSON.parse(response.text);
        return res.json({ success: true, parsed, source: 'gemini' });
      }
    } catch (apiError) {
      console.warn('Gemini parsing fallback triggered:', apiError);
      // fallback to internal response below
    }
  }

  // Fallback response handled client-side or rule-based
  return res.json({ success: false, fallback: true });
});

// 2. Financial Advisor & Audit Chat Endpoint
app.post('/api/assistant-chat', async (req: Request, res: Response) => {
  const { message, summary, recentMovements, exceededBudgets } = req.body;
  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  if (geminiClient && process.env.GEMINI_API_KEY) {
    try {
      const contextPrompt = `
Eres FinanZas Pro, un Asistente Financiero Personal inteligente, metódico y cordial.
Tus reglas de estilo obligatorias:
- Prioriza respuestas estructuradas usando tablas Markdown o listas jerárquicas cuando muestres resúmenes financieros.
- Para importes económicos, usa siempre el formato con dos decimales y el símbolo correspondiente (ej. 154,25 €).
- Basa tus respuestas en los datos reales del usuario que se te proporcionan.

Contexto financiero actual del usuario:
- Balance Mensual Real: ${summary?.balanceReal || '0,00 €'}
- Balance Mensual Previsto: ${summary?.balancePrevisto || '0,00 €'}
- Ingresos Reales: ${summary?.ingresosReales || '0,00 €'} (Previstos: ${summary?.ingresosPrevistos || '0,00 €'})
- Gastos Ejecutados: ${summary?.gastosEjecutados || '0,00 €'} (Previstos: ${summary?.gastosPrevistos || '0,00 €'})
- Resto Global: ${summary?.restoTotal || '0,00 €'}
- Tasa de Ahorro Real: ${summary?.tasaAhorroReal || 0}%
- Partidas con exceso de gasto o alerta: ${JSON.stringify(exceededBudgets || [])}
- Movimientos recientes: ${JSON.stringify((recentMovements || []).slice(0, 6))}

Pregunta o petición del usuario: "${message}"
      `;

      const response = await geminiClient.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: contextPrompt,
        config: {
          temperature: 0.3,
        },
      });

      if (response && response.text) {
        return res.json({ success: true, reply: response.text });
      }
    } catch (chatError) {
      console.warn('Gemini chat error, fallback:', chatError);
    }
  }

  // Smart fallback advice in Spanish with Markdown formatting
  return res.json({
    success: true,
    reply: `### Resumen Financiero Personal

| Métrica | Importe | Estado |
| :--- | :--- | :--- |
| **Ingresos Reales** | ${summary?.ingresosReales || '2.691,30 €'} | Registrado |
| **Gastos Ejecutados** | ${summary?.gastosEjecutados || '1.838,64 €'} | ${summary?.restoTotal && summary.restoTotal < 0 ? 'Exceso' : 'Bajo control'} |
| **Balance Real (Ahorro)** | ${summary?.balanceReal || '852,66 €'} | Favorable |

**Observaciones y Consejos:**
- Recuerda que para mantener tus previsiones al día, la columna **RESTO = PREVISTO - EJECUTADO** te indica cuánto margen te queda antes de fin de mes.
- Si necesitas registrar cualquier gasto informal, escribe en el buscador: *"Ayer cené fuera por 15,50 € con Openbank"* y quedará clasificado automáticamente en la partida **V.001.002 Comer fuera**.`,
  });
});

async function start() {
  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FinanZas Pro running on http://localhost:${PORT}`);
  });
}

start();
