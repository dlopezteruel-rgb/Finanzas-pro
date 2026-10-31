import { ALL_PARTIDAS, DEFAULT_WALLETS } from '../constants/categories';
import { MovementType, ParsedMovement } from '../types/finance';

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
export function parseFinancialInput(text: string, referenceDate: Date = new Date()): ParsedMovement | null {
  if (!text || !text.trim()) return null;

  const raw = text.trim();
  const lower = raw.toLowerCase();

  // 1. EXTRACT AMOUNT
  // Patterns like: "15,50 €", "15.50€", "15,50 euros", "15 euros", "15€", "por 15,50", "de 15,50"
  let amount = 0;
  const amountMatch = raw.match(/(\d+(?:[.,]\d{1,2})?)\s*(?:€|euros?|eur\b)?/i);

  if (amountMatch) {
    const rawNum = amountMatch[1].replace(',', '.');
    amount = parseFloat(rawNum);
  }

  // 2. EXTRACT DATE
  let targetDate = new Date(referenceDate);
  if (lower.includes('anteayer') || lower.includes('antes de ayer')) {
    targetDate.setDate(targetDate.getDate() - 2);
  } else if (lower.includes('ayer')) {
    targetDate.setDate(targetDate.getDate() - 1);
  } else if (lower.includes('hoy')) {
    // keep today
  } else {
    // Check for "el día XX" or "el XX/XX"
    const dayMatch = lower.match(/(?:el\s+(?:día\s+)?)(\d{1,2})(?:\/(\d{1,2}))?/);
    if (dayMatch) {
      const day = parseInt(dayMatch[1], 10);
      const month = dayMatch[2] ? parseInt(dayMatch[2], 10) - 1 : targetDate.getMonth();
      if (day >= 1 && day <= 31) {
        targetDate.setMonth(month);
        targetDate.setDate(day);
      }
    }
  }
  const dateStr = targetDate.toISOString().split('T')[0];

  // 3. EXTRACT WALLET / CARTERA
  let wallet = 'OPENBANK'; // sensible default
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
  const type: MovementType = isIncome ? 'INGRESO' : 'GASTO';

  // 5. EXTRACT PROCESSING STATE (Tramitado: SÍ / NO)
  const pendingKeywords = ['pendiente', 'sin tramitar', 'no tramitado', 'por tramitar', 'aún no pagado', 'no pagado'];
  const isPending = pendingKeywords.some(kw => lower.includes(kw));
  const processed = !isPending;

  // 6. MATCH CATEGORY & PARTIDA
  // Filter candidates by type
  const candidatePartidas = ALL_PARTIDAS.filter(p => p.type === type);

  let bestPartida = candidatePartidas[0];
  let maxScore = 0;

  for (const partida of candidatePartidas) {
    let score = 0;
    // Check keywords
    for (const kw of partida.keywords) {
      if (lower.includes(kw.toLowerCase())) {
        score += kw.length * 3; // longer match has higher weight
      }
    }
    // Check name and group name
    if (lower.includes(partida.name.toLowerCase())) {
      score += 20;
    }
    if (score > maxScore) {
      maxScore = score;
      bestPartida = partida;
    }
  }

  // Fallbacks if no direct match:
  if (maxScore === 0) {
    if (type === 'GASTO') {
      if (lower.includes('cen') || lower.includes('comid') || lower.includes('restaurante') || lower.includes('tapa')) {
        bestPartida = candidatePartidas.find(p => p.code === 'V.001.002') || bestPartida;
      } else if (lower.includes('compra') || lower.includes('super')) {
        bestPartida = candidatePartidas.find(p => p.code === 'V.001.001') || bestPartida;
      } else if (lower.includes('gasolina') || lower.includes('coche') || lower.includes('viaje')) {
        bestPartida = candidatePartidas.find(p => p.code === 'V.002.001') || bestPartida;
      } else {
        // default variable expense
        bestPartida = candidatePartidas.find(p => p.code === 'V.001.002') || bestPartida;
      }
    } else {
      bestPartida = candidatePartidas.find(p => p.code === 'L.001.001') || bestPartida;
    }
  }

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
    if (!description) description = bestPartida.name;
  }

  return {
    type,
    amount: Math.max(0, amount),
    code: bestPartida.code,
    categoryName: bestPartida.groupName,
    subcategoryName: bestPartida.name,
    description,
    wallet,
    date: dateStr,
    processed,
    confidence: maxScore > 0 ? 0.95 : 0.7,
    explanation: `Detectado movimiento de ${type} en partida [${bestPartida.code}] ${bestPartida.name} por importe ${amount.toFixed(2)} € pagado con ${wallet}.`,
  };
}
