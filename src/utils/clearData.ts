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
  if (options.clearAllWallets && !options.clearTransactions && data.transactions.some(t => t.transfer)) {
    throw new Error('No se pueden borrar carteras conservando sus traspasos. Selecciona también borrar movimientos.');
  }
  if (options.clearDebts && !options.clearTransactions && data.transactions.some(t => t.splitInfo)) throw new Error('Para saldar sin movimiento bancario registra una compensación explícita. El borrado completo requiere borrar también los movimientos.');
  const transactions = options.clearTransactions ? [] : data.transactions;
  const candidate = {
    ...data,
    wallets: options.clearAllWallets ? [] : options.clearWalletBalances ? data.wallets.map(w => ({ ...w, initialBalance: 0 })) : data.wallets,
    budgetPlans: options.clearBudgets ? [] : data.budgetPlans,
    loans: options.clearDebts ? [] : data.loans,
    transactions,
  };
  assertDeletionTransition(data, candidate);
  return candidate;
}


/** Snapshot of the reviewed scope; a queued write must not silently expand it. */
export function clearScope(data: FinanceData, options: ClearDataOptions): string {
  return JSON.stringify({ options, transactions: data.transactions, wallets: data.wallets, loans: data.loans, budgetPlans: data.budgetPlans });
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
    ['Planes presupuestarios a eliminar', options.clearBudgets ? data.budgetPlans.length : 0],
    ['Préstamos a eliminar', options.clearDebts ? data.loans.length : 0],
  ];
  const blockers: string[] = [];
  try { clearedData(data, options); } catch (error) { blockers.push(error instanceof Error ? error.message : 'El borrado dejaría referencias inconsistentes.'); }
  return { title: 'Confirmar borrado seleccionado', name: 'Datos seleccionados de todas las fechas', exists: true,
    relations: counts.map(([label, count]) => ({ label, count, examples: [], blocking: false })), blockers,
    notices: [`Se conservan ${data.contacts.length} contactos, ${data.budgetGroups.length} familias y ${data.budgetGroups.reduce((n, g) => n + g.partidas.length, 0)} partidas del catálogo.`,
      'Se guardará y verificará una copia recuperable completa antes de aplicar el borrado. Si falla la copia o el guardado, los datos activos se conservan.'] };
}
