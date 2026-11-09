import type { FinanceData } from './backup';
import type { BudgetPartida, Transaction } from '../types/finance';
import { isISODate } from './backup';
import { calculateMonthlyBudgetRows, calculateMonthlySummary, calculateWalletBalances } from './finance';
import { economicTransactions, legacyTransferReport, transferWalletName } from './transfers';
import { isLegacyShared, sharedWalletName } from './sharedExpenses';
import { annualPlanning, planningKey } from './planning';

export type ChartRow = { id: string; label: string; values: Record<string, number | null>; note?: string; ids?: string[]; from?: string; to?: string };
export type ChartSeries = { key: string; label: string };
export type ChartRange = { from: string; to: string; granularity: 'month' | 'week' };
export type EconomicFilter = ChartRange & { type: 'all' | 'INGRESO' | 'GASTO'; family: string; processed: boolean };
const round = (value: number) => Math.round(value * 100) / 100;
export const economicSeries: ChartSeries[] = [{ key: 'income', label: 'Ingresos económicos' }, { key: 'expenses', label: 'Gastos económicos' }, { key: 'balance', label: 'Balance económico' }];
export function monthEnd(month: string) {
  const [year, m] = month.split('-').map(Number);
  const date = new Date(0); date.setUTCFullYear(year, m, 0);
  return date.toISOString().slice(0, 10);
}
export function rangeBuckets(range: ChartRange) {
  if (!isISODate(range.from) || !isISODate(range.to) || range.from > range.to) throw new Error('Selecciona un rango de fechas válido, con inicio anterior al final.');
  const start = new Date(`${range.from}T00:00:00Z`), end = new Date(`${range.to}T00:00:00Z`);
  if (range.granularity === 'month') start.setUTCDate(1);
  else start.setUTCDate(start.getUTCDate() - (start.getUTCDay() + 6) % 7);
  const buckets: { id: string; label: string; from: string; to: string }[] = [];
  while (start <= end) {
    if (buckets.length >= (range.granularity === 'month' ? 120 : 520)) throw new Error('Acota el rango a 120 meses o 520 semanas para visualizarlo.');
    const from = start.toISOString().slice(0, 10), next = new Date(start);
    if (range.granularity === 'month') next.setUTCMonth(next.getUTCMonth() + 1); else next.setUTCDate(next.getUTCDate() + 7);
    const to = new Date(next.getTime() - 86400000).toISOString().slice(0, 10);
    buckets.push({ id: from, label: range.granularity === 'month' ? from.slice(0, 7) : `Semana ${from}`, from: from < range.from ? range.from : from, to: to > range.to ? range.to : to });
    start.setTime(next.getTime());
  }
  return buckets;
}
/** Add orphaned keys to the catalog given to the existing monthly domain functions. */
export function chartCatalog(data: FinanceData): BudgetPartida[] {
  const catalog = data.budgetGroups.flatMap(g => g.partidas), keys = new Set(catalog.map(planningKey));
  const extra: BudgetPartida[] = [];
  for (const item of [...data.budgetPlans, ...data.transactions]) if (!keys.has(planningKey(item))) {
    keys.add(planningKey(item));
    extra.push({ code: item.code, type: item.type, name: 'subcategoryName' in item ? item.subcategoryName : `Partida ${item.code}`, groupCode: 'historical', groupName: 'Fuera del catálogo', keywords: [] });
  }
  return [...catalog, ...extra];
}
export function familyIndex(data: FinanceData) {
  const index = new Map<string, { id: string; label: string }>();
  for (const g of data.budgetGroups) for (const p of g.partidas) index.set(planningKey(p), { id: `${g.type}:${g.code}`, label: g.name });
  return (t: Transaction) => index.get(planningKey(t)) ?? { id: `historical:${t.type}:${t.categoryName}`, label: `Fuera del catálogo · ${t.categoryName}` };
}
export function chartFamilies(data: FinanceData) {
  const family = familyIndex(data), values = new Map<string, string>();
  for (const t of economicTransactions(data.transactions)) { const f = family(t); values.set(f.id, f.label); }
  for (const g of data.budgetGroups) values.set(`${g.type}:${g.code}`, g.name);
  return [...values].map(([id, label]) => ({ id, label })).sort((a,b) => a.label.localeCompare(b.label));
}
export function economicChartData(data: FinanceData, filter: EconomicFilter) {
  const buckets = rangeBuckets(filter), family = familyIndex(data);
  // Classify on the entire ledger BEFORE filtering: transfers/reimbursements can cross filters.
  const transactions = economicTransactions(data.transactions).filter(t => t.processed === filter.processed && t.date >= filter.from && t.date <= filter.to
    && (filter.type === 'all' || t.type === filter.type) && (filter.family === 'all' || family(t).id === filter.family));
  const bucketsMap = new Map(buckets.map(b => [b.id, { ...b, values: { income: 0, expenses: 0, balance: 0 }, ids: [] as string[] }]));
  const keyOf = (date: string) => {
    if (filter.granularity === 'month') return date.slice(0, 7) + '-01';
    const day = new Date(`${date}T00:00:00Z`); day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7); return day.toISOString().slice(0,10);
  };
  const distributions = new Map<string, ChartRow>();
  for (const t of transactions) {
    const row = bucketsMap.get(keyOf(t.date))!;
    row.values[t.type === 'INGRESO' ? 'income' : 'expenses'] += t.amount; row.ids.push(t.id);
    if (t.type === 'GASTO') {
      const f = family(t), slice = distributions.get(f.id) ?? { id: f.id, label: f.label, values: { amount: 0, percent: 0 }, ids: [] };
      slice.values.amount! += t.amount; slice.ids!.push(t.id); distributions.set(f.id, slice);
    }
  }
  const periods: ChartRow[] = [...bucketsMap.values()].map(row => ({ ...row, values: { income: round(row.values.income), expenses: round(row.values.expenses), balance: round(row.values.income - row.values.expenses) } }));
  const expenseTotal = [...distributions.values()].reduce((n,r) => n + r.values.amount!, 0);
  const distribution = [...distributions.values()].map(r => ({ ...r, values: { amount: round(r.values.amount!), percent: expenseTotal ? r.values.amount! / expenseTotal * 100 : 0 } })).sort((a,b) => b.values.amount! - a.values.amount!);
  return { periods, distribution, transactions, hasData: transactions.length > 0 };
}
export function accountingChartWarnings(data: FinanceData) {
  const warnings: string[] = [];
  if (data.transactions.some(isLegacyShared)) warnings.push('Compartidos históricos sin migrar: se conservan los cálculos vigentes; no se estima una parte propia ni se reclasifican cobros sin vínculos verificados.');
  if (legacyTransferReport(data.transactions).unresolved.length) warnings.push('Hay traspasos históricos ambiguos: conservan su tratamiento contable vigente hasta revisión.');
  return warnings;
}
export function planningChartData(data: FinanceData, month: string, grouping: 'family' | 'partida') {
  const catalog = chartCatalog(data), rows = calculateMonthlyBudgetRows(month, data.transactions, data.budgetPlans, catalog);
  const meta = data.planningMonths?.find(m => m.monthYear === month), yearly = annualPlanning(data, month.slice(0,4));
  const plan = yearly.find(m => m.monthYear === month)!;
  const grouped = new Map<string, ChartRow>();
  const groups = new Map(data.budgetGroups.flatMap(g => g.partidas.map(p => [planningKey(p), g] as const)));
  const approval = new Map(meta?.approval?.lines.map(l => [planningKey(l), l.amountCents / 100]) ?? []);
  for (const row of rows) {
    const g = groups.get(planningKey(row));
    const id = grouping === 'partida' ? planningKey(row) : `${row.type}:${g?.code ?? 'historical'}`;
    const target = grouped.get(id) ?? { id, label: `${row.type === 'INGRESO' ? 'Ingreso' : 'Gasto'} · ${grouping === 'partida' ? row.name : g?.name ?? 'Fuera del catálogo'}`, values: { planned: plan.status === 'Sin plan' ? null : 0, executed: 0, approved: meta?.approval ? 0 : null } };
    if (target.values.planned !== null) target.values.planned += row.previsto;
    target.values.executed! += row.ejecutado;
    if (target.values.approved !== null) target.values.approved += approval.get(planningKey(row)) ?? 0;
    grouped.set(id, target);
  }
  // An approved category may have moved/been removed: keep its snapshot visible.
  if (grouping === 'partida') for (const l of meta?.approval?.lines ?? []) if (!grouped.has(planningKey(l))) grouped.set(planningKey(l), { id: planningKey(l), label: `${l.type} · Fotografía ${l.code}`, values: { planned: plan.status === 'Sin plan' ? null : 0, executed: 0, approved: l.amountCents / 100 } });
  if (grouping === 'family') {
    const remaining = (meta?.approval?.lines ?? []).filter(l => !catalog.some(p => planningKey(p) === planningKey(l)));
    for (const type of ['INGRESO','GASTO']) {
      const value = remaining.filter(l=>l.type===type).reduce((n,l)=>n+l.amountCents/100,0);
      if (value) grouped.set(`snapshot:${type}`, { id: `snapshot:${type}`, label: `${type} · Fotografía fuera del catálogo`, values: { planned: null, executed: 0, approved: value } });
    }
  }
  const annual: ChartRow[] = yearly.map(m => {
    const summary = calculateMonthlySummary(m.monthYear, data.transactions, data.budgetPlans, catalog);
    const hasPlan = m.status !== 'Sin plan';
    return { id: m.monthYear, label: m.monthYear, note: m.status, values: { income: hasPlan ? m.totals.income / 100 : null, expenses: hasPlan ? m.totals.expenses / 100 : null, savings: hasPlan ? m.totals.savings / 100 : null, plannedBalance: hasPlan ? m.totals.balance / 100 : null, realBalance: summary.balanceReal, realIncome: summary.ingresosReales, realExpenses: summary.gastosEjecutados } };
  });
  return { comparison: [...grouped.values()].map(r=>({ ...r, values: Object.fromEntries(Object.entries(r.values).map(([k,v])=>[k,v === null ? null : round(v)])) })), annual, status: plan.status, approval: meta?.approval };
}
export function walletChartData(data: FinanceData, range: ChartRange, selected: string) {
  const balances = calculateWalletBalances(data.wallets, data.transactions);
  const names = selected === 'all' ? Object.keys(balances) : [selected];
  const current: ChartRow[] = names.map(name => ({ id: name, label: name, values: { balance: balances[name] ?? 0 } }));
  const total = round(names.reduce((n,name)=>n+(balances[name] ?? 0),0));
  const zeroWallets = data.wallets.map(w=>({ ...w, initialBalance: 0 }));
  const buckets = rangeBuckets(range), cumulative = Object.fromEntries(names.map(n=>[`wallet:${n}`,0]));
  const grouped = new Map<string, Transaction[]>();
  for (const t of data.transactions) if (t.processed && t.date >= range.from && t.date <= range.to) {
    const date = new Date(`${t.date}T00:00:00Z`);
    if (range.granularity === 'month') date.setUTCDate(1); else date.setUTCDate(date.getUTCDate()-(date.getUTCDay()+6)%7);
    const key = date.toISOString().slice(0,10); const list = grouped.get(key) ?? []; list.push(t); grouped.set(key,list);
  }
  const changes: ChartRow[] = buckets.map(b => {
    const movements = grouped.get(b.id) ?? [], delta = calculateWalletBalances(zeroWallets, movements);
    for (const name of names) cumulative[`wallet:${name}`] = round(cumulative[`wallet:${name}`]+(delta[name] ?? 0));
    return { ...b, values: { ...cumulative, total: round(names.reduce((n,name)=>n+cumulative[`wallet:${name}`],0)) }, ids: movements.filter(t => names.includes(t.transfer ? transferWalletName(t,data.wallets) : (t.reimbursement || t.splitInfo?.accountingVersion === '2.7') ? sharedWalletName(t,data) : t.wallet.toUpperCase().trim())).map(t=>t.id) };
  });
  return { current, changes, total, names, hasMovements: changes.some(r=>r.ids!.length>0), limitation: 'No se muestran saldos históricos: los saldos iniciales no tienen fecha de referencia y puede faltar historial. La curva muestra solo la variación bancaria acumulada registrada desde el inicio del rango, partiendo de 0; no es un saldo ni una fecha de apertura.' };
}
