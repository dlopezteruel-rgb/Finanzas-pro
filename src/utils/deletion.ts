import type { FinanceData } from './backup';
import type { Transaction } from '../types/finance';
import { economicTransactions, isLegacyTransfer } from './transfers';

export type DeletionTarget = { kind: 'contact' | 'wallet' | 'loan' | 'transaction'; id: string };
export interface DeletionRelation { label: string; count: number; examples: string[]; blocking: boolean }
export interface DeletionReport { title: string; name: string; exists: boolean; relations: DeletionRelation[]; notices: string[]; blockers: string[] }
const labels = { contact: 'contacto', wallet: 'cuenta', loan: 'préstamo', transaction: 'movimiento' };
const describe = (t: Transaction) => `${t.description} (${t.id})`;

/** Read-only impact analysis. Stable IDs take precedence; old name references remain protected. */
export function deletionReport(data: FinanceData, target: DeletionTarget): DeletionReport {
  const item = target.kind === 'contact' ? data.contacts.find(c => c.id === target.id)
    : target.kind === 'wallet' ? data.wallets.find(w => w.id === target.id)
    : target.kind === 'loan' ? data.loans.find(l => l.id === target.id) : data.transactions.find(t => t.id === target.id);
  const report: DeletionReport = { title: `Eliminar ${labels[target.kind]}`, name: item ? 'name' in item ? item.name : item.description : target.id, exists: !!item, relations: [], notices: [], blockers: [] };
  if (!item) { report.blockers.push('El elemento ya no existe. Cierra esta ventana y revisa los datos actualizados.'); return report; }
  const add = (label: string, examples: string[], blocking = true) => {
    if (examples.length) report.relations.push({ label, count: examples.length, examples: examples.slice(0, 4), blocking });
  };
  if (target.kind === 'contact') {
    add('Compromisos personales', (data.intelligentFinance?.obligations??[]).filter(o=>o.counterparty.contactId===target.id).map(o=>o.concept));
    const expenses = data.transactions.filter(t => t.splitInfo?.participants.some(p => p.contactId === target.id));
    add('Gastos compartidos', expenses.map(describe));
    add('Obligaciones del reparto (incluidas las saldadas)', expenses.flatMap(t => t.splitInfo!.participants.filter(p => p.contactId === target.id).map(() => describe(t))));
    add('Liquidaciones y compensaciones', data.transactions.flatMap(t => (t.splitInfo?.settlements ?? []).filter(s => s.contactId === target.id).map(s => `${s.id} · ${t.description}`)));
    const oldReceipts = new Set(expenses.flatMap(t => t.splitInfo!.participants.filter(p => p.contactId === target.id).flatMap(p => p.reimbursementTxId ? [p.reimbursementTxId] : [])));
    add('Reintegros', data.transactions.filter(t => t.reimbursement?.contactId === target.id || oldReceipts.has(t.id)).map(describe));
    add('Referencias históricas a reintegros no disponibles', [...oldReceipts].filter(id => !data.transactions.some(t => t.id === id)));
  } else if (target.kind === 'wallet') {
    const wallet = data.wallets.find(w => w.id === target.id)!;
    add('Reglas periódicas (incluidas las dadas de baja)', (data.intelligentFinance?.recurringRules??[]).filter(r=>r.walletId===wallet.id).map(r=>r.concept));
    const movements = data.transactions.filter(t => (t.recurrence || t.obligationSettlement) ? (t.recurrence?.walletId??t.obligationSettlement?.walletId)===wallet.id : t.transfer ? [t.transfer.fromWalletId, t.transfer.toWalletId].includes(wallet.id)
      : t.reimbursement ? t.reimbursement.walletId === wallet.id : t.splitInfo?.walletId ? t.splitInfo.walletId === wallet.id : t.wallet === wallet.name);
    add('Movimientos vinculados (incluidos los pendientes)', movements.map(describe));
    add('Transferencias', [...new Set(movements.filter(t => t.transfer || isLegacyTransfer(t)).map(t => t.transfer?.id ?? t.id))]);
    add('Gastos compartidos', movements.filter(t => t.splitInfo?.isShared).map(describe));
    const legacyReceipts = new Set(data.transactions.flatMap(t => t.splitInfo?.participants.flatMap(p => p.reimbursementTxId ? [p.reimbursementTxId] : []) ?? []));
    add('Reintegros', movements.filter(t => t.reimbursement || legacyReceipts.has(t.id)).map(describe));
    add('Liquidaciones con cartera receptora', data.transactions.flatMap(t => (t.splitInfo?.settlements ?? []).filter(s => s.walletId === wallet.id).map(s => `${s.id} · ${t.description}`)));
    add('Préstamos con esta cartera habitual', data.loans.filter(l => l.wallet === wallet.name).map(l => `${l.name} (${l.id})`));
    report.notices.push(`Saldo base que se retiraría del patrimonio: ${wallet.initialBalance.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}.`);
  } else if (target.kind === 'loan') {
    add('Cuotas y movimientos del préstamo', data.transactions.filter(t => t.loanId === target.id).map(describe));
    const loan = data.loans.find(l => l.id === target.id)!;
    add('Cartera habitual del préstamo', [loan.wallet], false);
    report.notices.push(`Se retirará el seguimiento de ${loan.name} (${loan.entity}), con capital inicial ${loan.principal.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })}. La eliminación no registra ningún pago.`);
    add('Posibles cuotas históricas por el criterio actual de nombre (requieren revisión)', economicTransactions(data.transactions).filter(t => t.type === 'GASTO' && t.splitInfo?.accountingVersion !== '2.7' && t.loanId !== loan.id && t.description.toLowerCase().includes(loan.name.toLowerCase())).map(describe));
  } else {
    const tx = data.transactions.find(t => t.id === target.id)!;
    if(tx.recurrence)report.blockers.push('El origen periódico se conserva para evitar duplicados. Edita el movimiento o registra una corrección explícita.');
    if(tx.obligationSettlement)report.blockers.push('El movimiento conserva el historial de liquidación de principal. Revísalo desde Deudas.');
    const parents = data.transactions.filter(t => t.splitInfo?.participants.some(p => p.reimbursementTxId === tx.id) || t.splitInfo?.settlements?.some(s => s.transactionId === tx.id));
    add('Gastos que referencian este reintegro', parents.map(describe));
    add('Liquidaciones del gasto', (tx.splitInfo?.settlements ?? []).map(s => `${s.id} · ${s.date}`));
    if (tx.transfer || isLegacyTransfer(tx)) report.blockers.push('El traspaso debe revisarse y eliminarse como una operación completa desde su ventana específica.');
    if (tx.reimbursement) report.blockers.push('El reintegro debe eliminarse desde su liquidación, junto con su registro vinculado.');
    if (tx.splitInfo && tx.splitInfo.accountingVersion !== '2.7') report.blockers.push('Revisa y migra el gasto compartido histórico antes de eliminarlo.');
    if (tx.loanId) add('Préstamo de esta cuota', [data.loans.find(l => l.id === tx.loanId)?.name ?? tx.loanId], false);
    if (tx.splitInfo?.isShared) {
      add('Obligaciones incluidas en este gasto', tx.splitInfo.participants.map(p => `${p.contactName} (${p.contactId})`), false);
      report.notices.push('Eliminar el gasto sin liquidaciones retira también su propio reparto y sus deudas pendientes. No se eliminarán contactos.');
    }
    report.notices.push(`Se retirará el movimiento de ${tx.amount.toLocaleString('es-ES', { style: 'currency', currency: 'EUR' })} del ${tx.date}; sus efectos en saldo y presupuesto se recalcularán.`);
  }
  for (const relation of report.relations.filter(r => r.blocking)) report.blockers.push(`${relation.label}: ${relation.count}. Debes revisar estas relaciones antes de eliminar el elemento.`);
  return report;
}

/** Called inside FinanceStore.mutate, never from a stale preview alone. */
export function deleteEntity(data: FinanceData, target: DeletionTarget): FinanceData {
  const report = deletionReport(data, target);
  if (report.blockers.length) throw new Error(`No se puede eliminar ${target.kind === 'wallet' ? 'la cartera; las carteras vinculadas requieren revisión' : labels[target.kind]} «${report.name}». ${report.blockers.join(' ')}`);
  switch (target.kind) {
    case 'contact': return { ...data, contacts: data.contacts.filter(c => c.id !== target.id) };
    case 'wallet': return { ...data, wallets: data.wallets.filter(w => w.id !== target.id) };
    case 'loan': return { ...data, loans: data.loans.filter(l => l.id !== target.id) };
    case 'transaction': return { ...data, transactions: data.transactions.filter(t => t.id !== target.id) };
  }
}

/** Also protect deletions attempted by another mutation, without changing legacy read validation. */
export function assertDeletionTransition(current: FinanceData, candidate: FinanceData) {
  for (const [field, kind] of [['contacts', 'contact'], ['wallets', 'wallet'], ['loans', 'loan']] as const) {
    for (const item of current[field]) if (!candidate[field].some(next => next.id === item.id)) {
      // Analyse the references that would survive, resolving the removed object's old identity.
      const view = { ...candidate, [field]: [...candidate[field], item] } as FinanceData;
      const report = deletionReport(view, { kind, id: item.id });
      if (report.blockers.length) throw new Error(`No se puede eliminar ${kind === 'wallet' ? 'la cartera; las carteras vinculadas requieren revisión' : labels[kind]} «${report.name}». ${report.blockers.join(' ')}`);
    }
  }
}
