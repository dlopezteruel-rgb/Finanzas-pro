import type { SharedDistribution } from '../types/finance';

function totalCents(total: number) {
  if (!Number.isSafeInteger(total) || total <= 0) throw new Error('El total debe ser positivo y expresado en céntimos exactos.');
}
function units(weight: number): bigint {
  const scaled = Math.round(weight * 1_000_000);
  if (!Number.isFinite(weight) || weight < 0 || weight > 1_000_000 || scaled / 1_000_000 !== weight) {
    throw new Error('Los pesos deben ser no negativos, como máximo 1.000.000 y tener hasta seis decimales.');
  }
  return BigInt(scaled);
}
/** Largest remainder apportionment. Ties use stable order: owner, then selection order. */
export function weightedCents(total: number, weights: number[]): number[] {
  totalCents(total);
  if (weights.length < 2) throw new Error('Selecciona al menos otro contacto.');
  const values = weights.map(units), sum = values.reduce((a, b) => a + b, 0n);
  if (sum === 0n) throw new Error('La suma de los pesos debe ser mayor que cero.');
  const products = values.map(w => BigInt(total) * w), shares = products.map(p => Number(p / sum));
  let rest = total - shares.reduce((a, b) => a + b, 0);
  const order = products.map((p, i) => ({ i, remainder: p % sum })).sort((a, b) => a.remainder === b.remainder ? a.i - b.i : a.remainder > b.remainder ? -1 : 1);
  for (const { i } of order) { if (!rest) break; shares[i]++; rest--; }
  return shares;
}
export function amountCents(total: number, fixed: number[]): number[] {
  totalCents(total);
  if (!fixed.length) throw new Error('Selecciona al menos otro contacto.');
  if (fixed.some(n => !Number.isSafeInteger(n) || n < 0)) throw new Error('Los importes individuales deben ser no negativos y tener como máximo dos decimales.');
  const assigned = fixed.reduce((a, b) => a + b, 0);
  if (!Number.isSafeInteger(assigned) || assigned > total) throw new Error('Los importes asignados superan el total pagado.');
  return [...fixed, total - assigned];
}
/** Check exact metadata shape as well as its consistency with authoritative stored shares. */
export function validateDistribution(value: unknown, ids: string[], total: number, shares: number[]): asserts value is SharedDistribution {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Modalidad de reparto inválida.');
  const d = value as Record<string, unknown>;
  const keys = d.method === 'weighted' ? ['method', 'ownWeight', 'contactWeights'] : ['method'];
  if (!['equal', 'weighted', 'amounts'].includes(d.method as string) || Object.keys(d).some(k => !keys.includes(k)) || keys.some(k => !Object.hasOwn(d, k))) throw new Error('Metadatos de reparto no reconocidos o incompletos.');
  let expected: number[] | undefined;
  if (d.method === 'equal') expected = weightedCents(total, Array(ids.length + 1).fill(1));
  if (d.method === 'weighted') {
    if (typeof d.ownWeight !== 'number' || !Array.isArray(d.contactWeights) || d.contactWeights.length !== ids.length) throw new Error('Faltan pesos de participantes.');
    const weights = d.contactWeights.map((item: unknown, i) => {
      if (!item || typeof item !== 'object' || Array.isArray(item)) throw new Error('Peso de contacto inválido.');
      const w = item as Record<string, unknown>;
      if (Object.keys(w).length !== 2 || !Object.hasOwn(w, 'contactId') || !Object.hasOwn(w, 'weight') || w.contactId !== ids[i] || typeof w.weight !== 'number') throw new Error('Los pesos deben corresponder a los contactos y su orden estable.');
      return w.weight;
    });
    expected = weightedCents(total, [d.ownWeight, ...weights]);
  }
  if (expected && (expected.length !== shares.length || expected.some((n, i) => n !== shares[i]))) throw new Error('La modalidad y los importes guardados no coinciden.');
}
