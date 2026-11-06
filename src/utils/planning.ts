import type { FinanceData } from './backup';
import type { BudgetPlan, PlanningLine, PlanningMonth, PlanningTotals } from '../types/finance';

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
export const planningKey = (line: { type: string; code: string }) => `${line.type}:${line.code}`;
export function planningLines(plans: BudgetPlan[], month: string): PlanningLine[] {
  return plans.filter(p => p.monthYear === month).map(p => ({ type: p.type, code: p.code, amountCents: planCents(p.plannedAmount) }))
    .filter(p => p.amountCents !== 0).sort((a, b) => planningKey(a).localeCompare(planningKey(b)));
}
export function planningTotals(lines: PlanningLine[], savings: number): PlanningTotals {
  safeCents(savings);
  const sum = (type: string) => lines.filter(l => l.type === type).reduce((n, l) => safeCents(n + safeCents(l.amountCents)), 0);
  const income = sum('INGRESO'), expenses = sum('GASTO');
  const available = safeCents(income - savings, false);
  return { income, expenses, savings, available, margin: safeCents(available - expenses, false), balance: safeCents(income - expenses, false) };
}
export function planningScope(data: FinanceData, month: string): string {
  return JSON.stringify({ plans: data.budgetPlans.filter(p => p.monthYear === month).slice().sort((a,b) => planningKey(a).localeCompare(planningKey(b))), meta: data.planningMonths?.find(m => m.monthYear === month) });
}
export function planningStatus(data: FinanceData, month: string) {
  const meta = data.planningMonths?.find(m => m.monthYear === month);
  if (!meta) return data.budgetPlans.some(p => p.monthYear === month) ? 'Borrador' : 'Sin plan';
  if (!meta.approval) return 'Borrador';
  return meta.approval.revision === meta.revision ? 'Aprobado' : 'Modificada desde la última aprobación';
}
export function annualPlanning(data: FinanceData, year: string) {
  assertMonth(`${year}-01`);
  return Array.from({ length: 12 }, (_, i) => {
    const monthYear = `${year}-${String(i + 1).padStart(2, '0')}`;
    const status = planningStatus(data, monthYear);
    return { monthYear, status, totals: planningTotals(planningLines(data.budgetPlans, monthYear), data.planningMonths?.find(m => m.monthYear === monthYear)?.savingsCents ?? 0) };
  });
}
/** Runs inside FinanceStore: every UI edit advances the revision, preserving approval. */
export function reconcilePlanning(previous: FinanceData, candidate: FinanceData): FinanceData {
  if (!candidate.planningMonths?.length) {
    if (previous.planningMonths?.length) throw new Error('Los metadatos de planificación solo pueden retirarse mediante el borrado de presupuestos o una restauración.');
    return candidate;
  }
  const planningMonths = candidate.planningMonths.map(meta => {
    const old = previous.planningMonths?.find(m => m.monthYear === meta.monthYear);
    const changed = old && (old.savingsCents !== meta.savingsCents || JSON.stringify(planningLines(previous.budgetPlans, meta.monthYear)) !== JSON.stringify(planningLines(candidate.budgetPlans, meta.monthYear)));
    const revision = old ? old.revision + (changed ? 1 : 0) : 1;
    if (meta.revision !== revision) throw new Error('Revisión de planificación inválida.');
    if (JSON.stringify(old?.approval) !== JSON.stringify(meta.approval)) {
      if (!meta.approval || meta.approval.number !== (old?.approval?.number ?? 0) + 1 || meta.approval.revision !== revision) throw new Error('La fotografía aprobada requiere una nueva aprobación explícita.');
    }
    return meta;
  });
  if (previous.planningMonths?.some(old => !planningMonths.some(m => m.monthYear === old.monthYear))) throw new Error('No se puede eliminar la última aprobación desde un editor.');
  return { ...candidate, planningMonths };
}
/** Legacy editors need no knowledge of approvals: invalidate them at the store boundary. */
export function invalidatePlanning(previous: FinanceData, candidate: FinanceData): FinanceData {
  if (!candidate.planningMonths) return candidate;
  return { ...candidate, planningMonths: candidate.planningMonths.map(meta => {
    const old = previous.planningMonths?.find(m => m.monthYear === meta.monthYear);
    if (old && meta.revision === old.revision && (old.savingsCents !== meta.savingsCents || JSON.stringify(planningLines(previous.budgetPlans, meta.monthYear)) !== JSON.stringify(planningLines(candidate.budgetPlans, meta.monthYear)))) {
      return { ...meta, revision: old.revision + 1 };
    }
    return meta;
  }) };
}
export function savePlanning(data: FinanceData, month: string, edits: PlanningLine[], savingsCents: number, expectedScope: string, approve = false, acceptsDeficit = false): FinanceData {
  assertMonth(month);
  if (planningScope(data, month) !== expectedScope) throw new Error('La previsión ha cambiado. Descarta el borrador local y revisa los datos actualizados.');
  const keys = new Set<string>();
  for (const line of edits) {
    if (!line.code.trim() || !['INGRESO', 'GASTO'].includes(line.type) || keys.has(planningKey(line))) throw new Error('Partidas inválidas o duplicadas.');
    keys.add(planningKey(line)); safeCents(line.amountCents);
    if (planCents(line.amountCents / 100) !== line.amountCents) throw new Error('El importe no puede representarse exactamente en budgetPlans. Reduce su magnitud.');
  }
  const plans = [...data.budgetPlans.filter(p => p.monthYear !== month || !keys.has(planningKey(p))), ...edits.filter(l => l.amountCents > 0).map(l => ({ monthYear: month, type: l.type, code: l.code, plannedAmount: l.amountCents / 100 }))];
  const lines = planningLines(plans, month), totals = planningTotals(lines, savingsCents);
  if (approve && (totals.margin < 0 || savingsCents > totals.income) && !acceptsDeficit) throw new Error('Debes aceptar expresamente el déficit antes de aprobar.');
  const old = data.planningMonths?.find(m => m.monthYear === month);
  const changed = old && (old.savingsCents !== savingsCents || JSON.stringify(planningLines(data.budgetPlans, month)) !== JSON.stringify(lines));
  const meta: PlanningMonth = { monthYear: month, savingsCents, revision: old ? old.revision + (changed ? 1 : 0) : 1, ...(old?.approval ? { approval: old.approval } : {}) };
  if (approve) meta.approval = { number: (old?.approval?.number ?? 0) + 1, revision: meta.revision, approvedAt: new Date().toISOString(), lines, totals };
  return { ...data, budgetPlans: plans, planningMonths: [...(data.planningMonths ?? []).filter(m => m.monthYear !== month), meta] };
}
