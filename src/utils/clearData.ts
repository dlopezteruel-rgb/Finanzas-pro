import { assertDeletionTransition, type DeletionReport } from './deletion';
import type { FinanceData } from './backup';
import { isLegacyTransfer, legacyTransferReport } from './transfers';

export interface ClearDataOptions {
  clearWalletBalances: boolean;
  clearAllWallets: boolean;
  clearTransactions: boolean;
  clearBudgets: boolean;
  clearDebts: boolean;
}

/** Build the selected scope without rewriting debts or removing surviving references. */
export function clearedData(data: FinanceData, options: ClearDataOptions): FinanceData {
  const intelligence=data.intelligentFinance;
  if(intelligence && !(options.clearTransactions&&options.clearDebts)) {
    if(options.clearTransactions&&(intelligence.occurrences.some(o=>o.transactionId)||intelligence.obligations.some(o=>o.settlements.some(s=>s.transactionId))))throw new Error('Los movimientos tienen ocurrencias o liquidaciones personales. Revisa también el borrado de deudas para eliminar todos los vínculos juntos.');
    if(options.clearDebts&&intelligence.obligations.some(o=>o.settlements.some(s=>s.transactionId)))throw new Error('Los compromisos tienen movimientos bancarios. Selecciona también borrar movimientos.');
  }
  if (options.clearAllWallets && !options.clearTransactions && data.transactions.some(t => t.transfer)) {
    throw new Error('No se pueden borrar carteras conservando sus traspasos. Selecciona también borrar movimientos.');
  }
  if (options.clearDebts && !options.clearTransactions && data.transactions.some(t => t.splitInfo)) throw new Error('Para saldar sin movimiento bancario registra una compensación explícita. El borrado completo requiere borrar también los movimientos.');
  const transactions = options.clearTransactions ? [] : data.transactions;
  const candidate = {
    ...data,
    ...(options.clearAllWallets && data.defaultWalletId !== undefined ? { defaultWalletId: null } : {}),
    wallets: options.clearAllWallets ? [] : options.clearWalletBalances ? data.wallets.map(w => ({ ...w, initialBalance: 0 })) : data.wallets,
    ...(options.clearBudgets && data.budgetSubitems ? {budgetSubitems:{...data.budgetSubitems,months:[]}}:{}),
    budgetPlans: options.clearBudgets ? [] : data.budgetPlans,
    ...(options.clearBudgets && data.planningMonths ? { planningMonths: [] } : {}),
    ...(options.clearBudgets && data.planningAutomation ? {planningAutomation: undefined} : {}),
    loans: options.clearDebts ? [] : data.loans,
    transactions,
    ...(intelligence?{intelligentFinance:options.clearTransactions&&options.clearDebts?{recurringRules:[],occurrences:[],obligations:[]}:options.clearDebts?{...intelligence,obligations:[]}:intelligence}:{}),
  };
  assertDeletionTransition(data, candidate);
  if(options.clearBudgets)delete candidate.planningAutomation;
  return candidate;
}


/** Snapshot of the reviewed scope; a queued write must not silently expand it. */
export function clearScope(data: FinanceData, options: ClearDataOptions): string {
  return JSON.stringify({ options, ...(data.budgetSubitems?{budgetSubitems:data.budgetSubitems}:{}), ...(data.intelligentFinance?{intelligentFinance:data.intelligentFinance}:{}), transactions: data.transactions, wallets: data.wallets, loans: data.loans, budgetPlans: data.budgetPlans, ...(data.planningMonths ? { planningMonths: data.planningMonths } : {}),...(data.planningAutomation?{planningAutomation:data.planningAutomation}:{}) });
}
export function confirmedClearData(data: FinanceData, options: ClearDataOptions, scope: string): FinanceData {
  if (clearScope(data, options) !== scope) throw new Error('El alcance del borrado ha cambiado. Cancela y vuelve a revisar las cantidades antes de confirmar.');
  return clearedData(data, options);
}
export function clearImpact(data: FinanceData, options: ClearDataOptions): DeletionReport {
  const removed = options.clearTransactions ? data.transactions : [];
  const historical = legacyTransferReport(removed, data.wallets);
  const settlements = removed.flatMap(t => t.splitInfo?.settlements ?? []);
  const oldReceipts = new Set(data.transactions.flatMap(t => t.splitInfo?.participants.flatMap(p => p.reimbursementTxId ? [p.reimbursementTxId] : []) ?? []));
  const counts: [string, number][] = [
    ['Movimientos a eliminar', removed.length],
    ['Transferencias completas incluidas', new Set(removed.flatMap(t => t.transfer ? [t.transfer.id] : [])).size + historical.pairs.length],
    ['Registros históricos de traspaso incluidos', removed.filter(isLegacyTransfer).length],
    ['Registros de traspaso pendientes de revisión', historical.unresolved.length],
    ['Gastos compartidos incluidos', removed.filter(t => t.splitInfo?.isShared).length],
    ['Obligaciones del reparto incluidas', removed.reduce((n, t) => n + (t.splitInfo?.participants.length ?? 0), 0)],
    ['Liquidaciones y compensaciones incluidas', settlements.length],
    ['Reintegros incluidos', removed.filter(t => t.reimbursement || oldReceipts.has(t.id)).length],
    ['Cuotas de préstamos incluidas', removed.filter(t => t.loanId).length],
    ['Cuentas a eliminar', options.clearAllWallets ? data.wallets.length : 0],
    ['Saldos base a poner a cero', options.clearWalletBalances && !options.clearAllWallets ? data.wallets.filter(w => w.initialBalance !== 0).length : 0],
    ['Desgloses mensuales de subítems a eliminar',options.clearBudgets?(data.budgetSubitems?.months.length ?? 0):0],
    ['Planes presupuestarios a eliminar', options.clearBudgets ? data.budgetPlans.length : 0],
    ['Objetivos y aprobaciones mensuales a eliminar', options.clearBudgets ? (data.planningMonths?.length ?? 0) : 0],
    ['Reglas de planificación a eliminar',options.clearBudgets?(data.planningAutomation?.rules.length ?? 0):0],
    ['Arrastres a eliminar',options.clearBudgets?(data.planningAutomation?.carryovers.length ?? 0):0],
    ['Fotografías históricas a eliminar',options.clearBudgets?(data.planningAutomation?.history.reduce((n,h)=>n+h.approvals.length,0) ?? 0):0],
    ['Procedencias de previsiones a eliminar',options.clearBudgets?(data.planningAutomation?.origins.length ?? 0):0],
    ['Préstamos a eliminar', options.clearDebts ? data.loans.length : 0],
    ['Compromisos personales a eliminar',options.clearDebts?(data.intelligentFinance?.obligations.length??0):0],
    ['Reglas periódicas e identidades a eliminar',options.clearTransactions&&options.clearDebts?(data.intelligentFinance?.recurringRules.length??0)+(data.intelligentFinance?.occurrences.length??0):0],
  ];
  const blockers: string[] = [];
  try { clearedData(data, options); } catch (error) { blockers.push(error instanceof Error ? error.message : 'El borrado dejaría referencias inconsistentes.'); }
  return { title: 'Confirmar borrado seleccionado', name: 'Datos seleccionados de todas las fechas', exists: true,
    relations: counts.map(([label, count]) => ({ label, count, examples: [], blocking: false })), blockers,
    notices: [`Se conservan ${data.contacts.length} contactos, ${data.budgetGroups.length} familias y ${data.budgetGroups.reduce((n, g) => n + g.partidas.length, 0)} partidas del catálogo.`,
      'Se guardará y verificará una copia recuperable completa antes de aplicar el borrado. Si falla la copia o el guardado, los datos activos se conservan.'] };
}
