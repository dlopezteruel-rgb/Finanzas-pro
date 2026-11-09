import type { FinanceData } from './backup';
import type { BudgetPlan, PlanningLine, PlanningMonth, PlanningTotals } from '../types/finance';

import { assertMonth, safeCents, planCents } from './planningMoney';
export * from './planningMoney';
import { carryLines, combineLines, effectiveBudgetPlans, planningContent, emptyAutomation, planningCatalog } from './planningBasis';
import { calculateMonthlySummary } from './finance';
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
  return JSON.stringify({ plans: data.budgetPlans.filter(p => p.monthYear === month).slice().sort((a,b) => planningKey(a).localeCompare(planningKey(b))), meta: data.planningMonths?.find(m => m.monthYear === month), ...(carryLines(data,month).length ? { carryovers: planningContent(data,month).carryovers } : {}) });
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
    const baseLines = planningLines(data.budgetPlans, monthYear), adjustments = carryLines(data,monthYear);
    const totals = planningTotals(combineLines(baseLines,adjustments), data.planningMonths?.find(m=>m.monthYear===monthYear)?.savingsCents ?? 0);
    const executed = calculateMonthlySummary(monthYear,data.transactions,effectiveBudgetPlans(data),planningCatalog(data,data.budgetGroups.flatMap(g=>g.partidas)));
    const monthOrigins=data.planningAutomation?.origins.filter(o=>o.monthYear===monthYear) ?? [];
    const origins = [...new Set([...monthOrigins.map(o=>o.kind),...(baseLines.some(l=>!monthOrigins.some(o=>o.target===l.type&&o.code===l.code)) || ((data.planningMonths?.find(m=>m.monthYear===monthYear)?.savingsCents ?? 0)>0&&!monthOrigins.some(o=>o.target==='SAVINGS'))?['manual' as const]:[])])];
    return { monthYear, status, totals, baseExpenses: baseLines.filter(l=>l.type==='GASTO').reduce((n,l)=>safeCents(n+l.amountCents),0), carryoverCents: adjustments.reduce((n,l)=>safeCents(n+l.amountCents),0), executed: executed.gastosEjecutados, origins };

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
    const changed = old && (old.savingsCents !== meta.savingsCents || JSON.stringify(planningContent(previous,meta.monthYear)) !== JSON.stringify(planningContent(candidate,meta.monthYear)));
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
    if (old && meta.revision === old.revision && (old.savingsCents !== meta.savingsCents || JSON.stringify(planningContent(previous,meta.monthYear)) !== JSON.stringify(planningContent(candidate,meta.monthYear)))) {
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
  const baseLines = planningLines(plans, month), adjustments = carryLines(data,month);
  const lines = combineLines(baseLines, adjustments), totals = planningTotals(lines, savingsCents);
  if (approve && (totals.margin < 0 || savingsCents > totals.income) && !acceptsDeficit) throw new Error('Debes aceptar expresamente el déficit antes de aprobar.');
  const old = data.planningMonths?.find(m => m.monthYear === month);
  const changed = old && (old.savingsCents !== savingsCents || JSON.stringify(planningContent(data,month)) !== JSON.stringify(planningContent({...data,budgetPlans:plans},month)));
  const meta: PlanningMonth = { monthYear: month, savingsCents, revision: old ? old.revision + (changed ? 1 : 0) : 1, ...(old?.approval ? { approval: old.approval } : {}) };
  let automation = data.planningAutomation;
  if (approve) {
    meta.approval = { number: (old?.approval?.number ?? 0) + 1, revision: meta.revision, approvedAt: new Date().toISOString(), lines, totals, ...(adjustments.length ? { baseLines, carryLines: adjustments } : {}) };
    if (old?.approval) {
      const current = automation ?? emptyAutomation();
      const history = current.history.find(h=>h.monthYear===month)?.approvals ?? [];
      automation = { ...current, history: [...current.history.filter(h=>h.monthYear!==month), { monthYear: month, approvals: [...history, old.approval] }] };
    }
  }
  return { ...data, budgetPlans: plans, planningMonths: [...(data.planningMonths ?? []).filter(m => m.monthYear !== month), meta], ...(automation ? { planningAutomation: automation } : {}) };
}
