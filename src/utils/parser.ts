import {readNaturalInput} from './naturalInput';
import {normalizeSearch} from './partidaSearch';
import { MovementType, ParsedMovement, BudgetPartida } from '../types/finance';

/**
 * Natural Language Parser for Spanish financial statements:
 * e.g. "Ayer cené fuera por 15,50 € con Openbank" ->
 * {
 *   amount: 15.50,
 *   type: 'GASTO',
 *   code: 'V.001.002',
 *   subcategoryName: 'Alimentación: Comer fuera / cafeterías',
 *   wallet: 'OPENBANK',
 *   date: '2026-10-29',
 *   processed: true
 * }
 */
export function parseFinancialInput(text: string, referenceDate: Date = new Date(), catalog:BudgetPartida[] = [],forcedType?:MovementType): ParsedMovement | null {
  if (!text || !text.trim()) return null;

  const raw = text.trim();
  const lower = raw.toLowerCase();

  const input=readNaturalInput(raw,referenceDate);
  if(!input.ok)return null;
  const {amount,date:dateStr}=input;

  // 3. EXTRACT WALLET / CARTERA
  let wallet = ''; // No implicit bank: the application resolves its actual wallet preference.
  const knownWallets = [
    { name: 'OPENBANK', triggers: ['openbank', 'open bank'] },
    { name: 'REVOLUT', triggers: ['revolut'] },
    { name: 'SANTANDER', triggers: ['santander'] },
    { name: 'EFECTIVO', triggers: ['efectivo', 'metalico', 'metálico', 'en mano', 'en cash', 'cash'] },
    { name: 'MYINVESTOR', triggers: ['myinvestor', 'my investor'] },
    { name: 'BBVA', triggers: ['bbva'] },
    { name: 'CAIXABANK', triggers: ['caixa', 'caixabank'] },
    { name: 'BIZUM', triggers: ['bizum'] },
  ];

  for (const w of knownWallets) {
    if (w.triggers.some(t => lower.includes(t))) {
      wallet = w.name;
      break;
    }
  }

  // 4. DETECT TYPE (INGRESO vs GASTO)
  const incomeKeywords = [
    'nómina', 'nomina', 'sueldo', 'salario', 'cobré', 'cobre', 'he cobrado', 'ingreso', 'ingresado',
    'paga', 'bonus', 'dividendo', 'alquiler recibido', 'reembolso', 'devolución', 'me devuelven',
    'me pagaron', 'me paga', 'premio', 'subvención', 'beca', 'factura cobrada', 'honorarios'
  ];

  let isIncome = incomeKeywords.some(kw => lower.includes(kw));
  // If explicitly says "gasto" or "pago", prioritize GASTO
  if (lower.includes('gasté') || lower.includes('gaste') || lower.includes('pagué') || lower.includes('pague') || lower.includes('compré') || lower.includes('compre') || lower.includes('cené') || lower.includes('comí')) {
    isIncome = false;
  }
  const type: MovementType = forcedType ?? (isIncome ? 'INGRESO' : 'GASTO');

  // 5. EXTRACT PROCESSING STATE (Tramitado: SÍ / NO)
  const pendingKeywords = ['pendiente', 'sin tramitar', 'no tramitado', 'por tramitar', 'aún no pagado', 'no pagado'];
  const isPending = pendingKeywords.some(kw => lower.includes(kw));
  const processed = !isPending;

  // Match only the supplied, active user catalog. Ties and missing evidence require a choice.
  const normalize=(value:string)=>normalizeSearch(value).replace(/[^a-z0-9]+/g,' ').trim();
  const haystack=` ${normalize(raw)} `;
  const ranked=catalog.filter(p=>p.type===type&&!p.archived&&!p.deleted).map(partida=>({partida,score:
    [...new Set(partida.keywords.map(normalize))].reduce((n,term)=>n+(term&&haystack.includes(` ${term} `)?term.length*3:0),0)
    +(normalize(partida.name)&&haystack.includes(` ${normalize(partida.name)} `)?20+partida.name.length:0)
  })).sort((a,b)=>b.score-a.score);
  const bestPartida=ranked[0]?.score>0&&ranked[0].score!==(ranked[1]?.score??0)?ranked[0].partida:undefined;
  const maxScore=bestPartida?ranked[0].score:0;

  // 7. EXTRACT CLEAN DESCRIPTION
  // e.g. "Ayer cené fuera por 15,50 € con Openbank" -> "Cena fuera"
  let description = raw;
  if (lower.includes('cené fuera') || lower.includes('cene fuera') || lower.includes('comer fuera')) {
    description = 'Cena fuera / Restaurante';
  } else if (lower.includes('supermercado') || lower.includes('mercadona') || lower.includes('compra')) {
    description = 'Compra supermercado';
  } else if (lower.includes('gasolina') || lower.includes('repsol')) {
    description = 'Combustible / Gasolina';
  } else if (lower.includes('nómina') || lower.includes('nomina')) {
    description = 'Nómina mensual';
  } else if (lower.includes('libros') || lower.includes('libro')) {
    description = 'Libros y formación';
  } else {
    // Trim extra words like "por 15,50 €", "con openbank", etc.
    description = raw
      .replace(/(?:por|de)\s+\d+(?:[.,]\d+)?\s*(?:€|euros?)?/gi, '')
      .replace(/con\s+(?:openbank|revolut|santander|efectivo|bbva)/gi, '')
      .replace(/\b(?:ayer|hoy|anteayer)\b/gi, '')
      .trim();
    if (!description) description = bestPartida?.name ?? 'Movimiento pendiente de clasificar';
  }

  return {
    type,
    amount: Math.max(0, amount),
    code: bestPartida?.code ?? '',
    categoryName: bestPartida?.groupName ?? '',
    subcategoryName: bestPartida?.name ?? 'Selecciona una partida',
    description,
    wallet,
    date: dateStr,
    processed,
    confidence: maxScore > 0 ? 0.95 : 0,
    explanation: bestPartida?`Propuesta de ${type}: ${bestPartida.name}, ${amount.toFixed(2)} €. Revisa antes de registrar.`:'No hay una coincidencia inequívoca en tu catálogo activo. Selecciona una partida.',
  };
}
