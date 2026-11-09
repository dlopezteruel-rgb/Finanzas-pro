export function assertMonth(month: string) {
  if (!/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error('Periodo inválido; usa AAAA-MM entre 0001 y 9999.');
}
export function safeCents(value: number, nonnegative = true): number {
  if (!Number.isSafeInteger(value) || (nonnegative && value < 0)) throw new Error('Importe inválido o fuera del rango seguro de céntimos.');
  return value;
}
/** No parseFloat, rounding, exponent notation, or ambiguous thousands-only notation. */
export function parsePlanningMoney(input: string): number {
  let text = input.trim();
  if (/^\d{1,3}(?:\.\d{3})+,\d{1,2}$/.test(text)) text = text.replaceAll('.', '');
  if (!/^\d+(?:[.,]\d{1,2})?$/.test(text)) throw new Error('Usa un importe no negativo con hasta dos decimales (15,50 o 15.50).');
  const [units, decimals = ''] = text.replace(',', '.').split('.');
  const result = BigInt(units) * 100n + BigInt(decimals.padEnd(2, '0'));
  if (result > BigInt(Number.MAX_SAFE_INTEGER)) throw new Error('Importe fuera del rango seguro de céntimos.');
  return Number(result);
}
/** Format cents directly, avoiding a second floating-point conversion in the UI. */
export function planningMoneyInput(cents: number): string {
  safeCents(cents);
  const amount = BigInt(cents), fraction = amount % 100n;
  return `${amount / 100n}${fraction ? `.${String(fraction).padStart(2, '0')}` : ''}`;
}
export function formatPlanningCents(cents: number): string {
  safeCents(cents, false);
  const amount = BigInt(cents < 0 ? -cents : cents);
  return `${cents < 0 ? '-' : ''}${String(amount / 100n).replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${String(amount % 100n).padStart(2, '0')} €`;
}
export function planCents(amount: number): number {
  if (!Number.isFinite(amount) || amount < 0) throw new Error('Previsión monetaria inválida.');
  // Decimal representation avoids accepting hidden fractions through rounding.
  return parsePlanningMoney(String(amount));
}
