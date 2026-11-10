import { validateDistribution } from './sharedDistribution';
import type { FinanceData } from './backup';
import type { SharedExpenseInfo, Transaction, SettlementInput, DebtSettlement, Contact } from '../types/finance';

export const isStructuredShared = (t: Transaction) => t.splitInfo?.accountingVersion === '2.7';
export const isLegacyShared = (t: Transaction) => !!t.splitInfo?.isShared && !isStructuredShared(t);
export function cents(value: number): number {
  const result = Math.round(value * 100);
  if (!Number.isFinite(value) || value < 0 || !Number.isSafeInteger(result) || result / 100 !== value) throw new Error('El importe debe ser finito, no negativo y expresado en céntimos exactos.');
  return result;
}
export function positiveCents(value: number): number {
  const result = cents(value);
  if (!result) throw new Error('El importe debe ser positivo.');
  return result;
}
export function splitExactly(amount: number, contacts: Contact[], walletId: string): SharedExpenseInfo {
  const total = positiveCents(amount), count = contacts.length + 1;
  if (!contacts.length || new Set(contacts.map(c => c.id)).size !== contacts.length) throw new Error('Selecciona contactos distintos para todos los participantes.');
  const base = Math.floor(total / count), remainder = total % count;
  const shares = Array.from({ length: count }, (_, i) => base + (i < remainder ? 1 : 0));
  return { accountingVersion: '2.7', walletId, settlements: [], isShared: true, totalParticipants: count,
    myShare: shares[0] / 100, totalOwedToMe: (total - shares[0]) / 100,
    participants: contacts.map((c, i) => ({ contactId: c.id, contactName: c.name, amount: shares[i + 1] / 100, isPaid: false })) };
}
const realDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value;
export function remainingDebt(expense: Transaction, contactId: string, exclude?: string): number {
  const participant = expense.splitInfo?.participants.find(p => p.contactId === contactId);
  if (!participant) throw new Error('El participante de la deuda no existe.');
  if (!expense.processed) return 0;
  if (!isStructuredShared(expense)) return participant.isPaid ? 0 : participant.amount;
  const paid = expense.splitInfo!.settlements!.filter(s => s.contactId === contactId && s.processed && s.id !== exclude).reduce((sum, s) => sum + cents(s.amount), 0);
  return (cents(participant.amount) - paid) / 100;
}
/** UI cache only. The persisted ledger, rather than the legacy paid flags, is authoritative. */
export function sharedViewTransactions(transactions: Transaction[]): Transaction[] {
  return transactions.map(t => !isStructuredShared(t) ? t : { ...t, splitInfo: { ...t.splitInfo!,
    totalOwedToMe: t.splitInfo!.participants.reduce((sum, p) => sum + cents(remainingDebt(t, p.contactId)), 0) / 100,
    participants: t.splitInfo!.participants.map(p => ({ ...p, remainingAmount: remainingDebt(t, p.contactId), isPaid: remainingDebt(t, p.contactId) === 0, paidDate: remainingDebt(t, p.contactId) === 0 ? t.splitInfo!.settlements!.filter(s => s.contactId === p.contactId && s.processed).map(s => s.date).sort().at(-1) : undefined })),
  } });
}

export function assertSharedIntegrity(data: FinanceData) {
  const settlementIds = new Set<string>(), bankIds = new Set<string>();
  for (const expense of data.transactions.filter(isStructuredShared)) {
    const split = expense.splitInfo!;
    if (!split.isShared || expense.type !== 'GASTO' || expense.transfer || expense.reimbursement || expense.loanId) throw new Error('Un gasto compartido debe ser un gasto independiente.');
    if (!data.wallets.some(w => w.id === split.walletId) || !Array.isArray(split.settlements)) throw new Error('La cartera o el registro de liquidaciones del gasto no existe.');
    if (split.totalParticipants !== split.participants.length + 1 || !split.participants.length ||
      cents(split.myShare) + split.participants.reduce((n, p) => n + cents(p.amount), 0) !== positiveCents(expense.amount)) throw new Error('El total debe coincidir con la parte propia y las deudas, sin diferencias de céntimos.');
    if (split.distribution !== undefined) validateDistribution(split.distribution, split.participants.map(p => p.contactId), cents(expense.amount), [cents(split.myShare), ...split.participants.map(p => cents(p.amount))]);
    for (const p of split.participants) {
      if (!data.contacts.some(c => c.id === p.contactId)) throw new Error('No puede eliminarse un contacto con gastos vinculados.');
      const reserved = split.settlements.filter(s => s.contactId === p.contactId).reduce((n, s) => n + positiveCents(s.amount), 0);
      if (reserved > cents(p.amount)) throw new Error('El cobro supera la deuda pendiente o duplica un cobro ya registrado.');
    }
    for (const s of split.settlements) {
      if (settlementIds.has(s.id) || !split.participants.some(p => p.contactId === s.contactId)) throw new Error('Liquidación duplicada o participante inexistente.');
      settlementIds.add(s.id); positiveCents(s.amount);
      if (!realDate(s.date) || s.date < expense.date || typeof s.processed !== 'boolean' || !['cash', 'offset'].includes(s.kind)) throw new Error('Fecha o tipo de liquidación inválido.');
      if (!expense.processed) throw new Error('No se puede liquidar un gasto todavía no tramitado.');
      if (s.kind === 'offset') {
        if (s.walletId !== undefined || s.transactionId !== undefined) throw new Error('Una compensación no puede crear un movimiento bancario.');
        continue;
      }
      const tx = data.transactions.find(t => t.id === s.transactionId);
      if (!s.walletId || !data.wallets.some(w => w.id === s.walletId) || !tx || bankIds.has(tx.id) || tx.type !== 'INGRESO' || tx.amount !== s.amount || tx.date !== s.date || tx.processed !== s.processed || tx.transfer || tx.splitInfo || tx.loanId ||
        tx.reimbursement?.expenseId !== expense.id || tx.reimbursement.settlementId !== s.id || tx.reimbursement.contactId !== s.contactId || tx.reimbursement.walletId !== s.walletId) throw new Error('El reintegro y su liquidación deben guardarse y modificarse juntos.');
      bankIds.add(tx.id);
    }
  }
  for (const tx of data.transactions) if (tx.reimbursement && !bankIds.has(tx.id)) throw new Error('Hay un reintegro sin gasto, participante o liquidación correspondiente.');
}

export function saveSettlement(data: FinanceData, input: SettlementInput, id?: string): FinanceData {
  const expense = data.transactions.find(t => t.id === input.expenseId);
  if (!expense || !isStructuredShared(expense)) throw new Error('Revisa y migra este gasto histórico antes de liquidarlo.');
  if (!expense.processed) throw new Error('El gasto original aún no está tramitado.');
  positiveCents(input.amount);
  const previous = id ? expense.splitInfo!.settlements!.find(s => s.id === id) : undefined;
  if (id && (!previous || previous.contactId !== input.contactId)) throw new Error('La liquidación o el participante ya no coincide.');
  const settlementId = id ?? input.operationId ?? crypto.randomUUID();
  if (!id && data.transactions.some(t => t.splitInfo?.settlements?.some(s => s.id === settlementId))) throw new Error('Esta liquidación ya se ha registrado. Recarga antes de repetir el cobro.');
  const next: DebtSettlement = { id: settlementId, contactId: input.contactId, amount: input.amount, date: input.date, processed: input.processed, kind: input.kind };
  let bank: Transaction | undefined;
  if (input.kind === 'cash') {
    const wallet = data.wallets.find(w => w.id === input.walletId);
    if (!wallet) throw new Error('La cartera receptora debe existir.');
    const contact = data.contacts.find(c => c.id === input.contactId);
    if (!contact) throw new Error('El contacto no existe.');
    next.walletId = wallet.id; next.transactionId = previous?.transactionId ?? `reimbursement-${settlementId}`;
    const oldBank = data.transactions.find(t => t.id === previous?.transactionId);
    bank = { ...oldBank, id: next.transactionId, type: 'INGRESO', amount: input.amount, date: input.date, wallet: wallet.name, processed: input.processed,
      code: expense.code, categoryName: expense.categoryName, subcategoryName: expense.subcategoryName,
      description: `Reintegro ${contact.name}: ${expense.description}`,
      reimbursement: { expenseId: expense.id, settlementId, contactId: contact.id, walletId: wallet.id } };
  }
  const settlements = [...expense.splitInfo!.settlements!.filter(s => s.id !== id), next];
  const transactions = data.transactions.filter(t => t.id !== previous?.transactionId).map(t => t.id === expense.id ? { ...t, splitInfo: { ...t.splitInfo!, settlements } } : t);
  if (bank) transactions.unshift(bank);
  const candidate = { ...data, transactions }; assertSharedIntegrity(candidate); return candidate;
}
export function deleteSettlement(data: FinanceData, expenseId: string, id: string): FinanceData {
  const expense = data.transactions.find(t => t.id === expenseId), settlement = expense?.splitInfo?.settlements?.find(s => s.id === id);
  if (!settlement) throw new Error('La liquidación ya no existe.');
  return { ...data, transactions: data.transactions.filter(t => t.id !== settlement.transactionId).map(t => t.id !== expenseId ? t : { ...t, splitInfo: { ...t.splitInfo!, settlements: t.splitInfo!.settlements!.filter(s => s.id !== id) } }) };
}

export function saveSharedTransaction(data: FinanceData, draft: Omit<Transaction, 'id'>, id?: string): FinanceData {
  const previous = data.transactions.find(t => t.id === id);
  if (id && !previous) throw new Error('El movimiento ya no existe. Recarga los datos.');
  if (previous?.transfer) throw new Error('Edita el traspaso como una operación completa.');
  if (previous?.obligationSettlement) throw new Error('La liquidación de principal se gestiona desde Deudas.');
  if (previous?.reimbursement) throw new Error('Edita el reintegro desde su liquidación.');
  if (previous && isLegacyShared(previous)) throw new Error('Revisa y migra el gasto histórico antes de editarlo.');
  let tx: Transaction = { ...previous, ...draft, id: id ?? crypto.randomUUID() };
  if(previous?.recurrence){
    const wallet=data.wallets.find(w=>w.name===draft.wallet);
    if(!wallet)throw new Error('La cartera del movimiento periódico debe existir.');
    tx.recurrence={...previous.recurrence,walletId:wallet.id};
  }
  if (draft.splitInfo?.isShared) {
    const wallet = data.wallets.find(w => w.name === draft.wallet);
    if (!wallet) throw new Error('La cartera del gasto debe existir.');
    const sameSplit = !draft.splitInfo.distribution && previous && isStructuredShared(previous) && previous.amount === draft.amount && JSON.stringify(previous.splitInfo!.participants.map(p => p.contactId)) === JSON.stringify(draft.splitInfo.participants.map(p => p.contactId));
    if (previous?.splitInfo?.settlements?.length) {
      const allocation = (s: SharedExpenseInfo) => [s.myShare, ...s.participants.map(p => [p.contactId, p.amount])];
      if (!sameSplit && JSON.stringify(allocation(previous.splitInfo)) !== JSON.stringify(allocation(draft.splitInfo))) throw new Error('El gasto tiene liquidaciones: corrige explícitamente los cobros antes de modificar su reparto.');
    }
    tx = { ...tx, splitInfo: { ...(sameSplit ? previous.splitInfo! : draft.splitInfo), accountingVersion: '2.7', walletId: wallet.id, settlements: previous?.splitInfo?.settlements ?? [] } };
  }
  return { ...data, transactions: previous ? data.transactions.map(t => t.id === id ? tx : t) : [tx, ...data.transactions] };
}
export function adjustDebt(data: FinanceData, expenseId: string, contactId: string, amount: number): FinanceData {
  cents(amount);
  const expense = data.transactions.find(t => t.id === expenseId);
  if (!expense || !isStructuredShared(expense)) throw new Error('Revisa y migra el gasto histórico antes de corregir la deuda.');
  if (!expense.splitInfo!.participants.some(p => p.contactId === contactId)) throw new Error('El participante no existe.');
  const participants = expense.splitInfo!.participants.map(p => p.contactId === contactId ? { ...p, amount } : p);
  const owed = participants.reduce((n, p) => n + cents(p.amount), 0), own = cents(expense.amount) - owed;
  if (own < 0) throw new Error('Las deudas superan el importe total pagado.');
  const candidate = { ...data, transactions: data.transactions.map(t => t.id === expenseId ? { ...t, splitInfo: { ...t.splitInfo!, participants, myShare: own / 100, totalOwedToMe: owed / 100, ...(t.splitInfo!.distribution ? { distribution: { method: 'amounts' as const } } : {}) } } : t) };
  assertSharedIntegrity(candidate); return candidate;
}

/** Do not allow unrelated forms/budget actions to detach receipts or rewrite collected cash. */
export function assertSharedTransition(current: FinanceData, candidate: FinanceData) {
  const legacyIds = new Set(current.transactions.filter(isLegacyShared).flatMap(t => [t.id, ...t.splitInfo!.participants.map(p => p.reimbursementTxId).filter((id): id is string => !!id)]));
  for (const old of current.transactions) {
    const next = candidate.transactions.find(t => t.id === old.id);
    if (legacyIds.has(old.id) && JSON.stringify(next) !== JSON.stringify(old)) throw new Error('Revisa y migra el gasto compartido histórico antes de modificarlo.');
    if (!isStructuredShared(old)) continue;
    if (next && !isStructuredShared(next)) throw new Error('No se puede retirar la relación del gasto compartido.');
    if (old.splitInfo!.settlements!.length) {
      const fields = (t: Transaction) => [t.amount, t.type, t.date, t.code, t.categoryName, t.subcategoryName, t.processed, t.splitInfo?.walletId, t.splitInfo?.participants.map(p => p.contactId)];
      if (!next || JSON.stringify(fields(old)) !== JSON.stringify(fields(next))) throw new Error('El gasto tiene liquidaciones: elimina o corrige explícitamente los cobros antes de cambiar importe, participantes, fecha, categoría, cartera o borrar el gasto.');
    }
  }
  for (const contact of current.contacts) if (!candidate.contacts.some(c => c.id === contact.id) && current.transactions.some(t => t.splitInfo?.participants.some(p => p.contactId === contact.id))) throw new Error('El contacto tiene gastos vinculados y no puede eliminarse.');
  for (const wallet of current.wallets) if (!candidate.wallets.some(w => w.id === wallet.id && w.name === wallet.name) && current.transactions.some(t => isLegacyShared(t) && t.wallet === wallet.name)) throw new Error('Revisa los gastos compartidos históricos antes de renombrar o eliminar la cartera.');
}

export function sharedMigrationReport(data: FinanceData) {
  const candidates: { expense: Transaction; settlements: DebtSettlement[] }[] = [], issues: string[] = [];
  const references = data.transactions.flatMap(t => t.splitInfo?.participants.map(p => p.reimbursementTxId).filter(Boolean) ?? []);
  for (const expense of data.transactions.filter(isLegacyShared)) {
    const s = expense.splitInfo!, settlements: DebtSettlement[] = [];
    try {
      if (expense.type !== 'GASTO' || expense.transfer || expense.loanId || !data.wallets.some(w => w.name === expense.wallet) || s.totalParticipants !== s.participants.length + 1 || !s.participants.length ||
        cents(s.myShare) + s.participants.reduce((n, p) => n + cents(p.amount), 0) !== positiveCents(expense.amount)) throw new Error('reparto, tipo o cartera no verificables');
      for (const p of s.participants) {
        if (!data.contacts.some(c => c.id === p.contactId)) throw new Error('participante sin contacto estable');
        if (!p.isPaid && p.reimbursementTxId) throw new Error('referencia a cobro en deuda no saldada');
        if (!p.isPaid) continue;
        const bank = data.transactions.find(t => t.id === p.reimbursementTxId), wallet = data.wallets.find(w => w.name === bank?.wallet);
        if (!expense.processed || !p.reimbursementTxId || references.filter(id => id === p.reimbursementTxId).length !== 1 || !bank || !wallet || !bank.processed || bank.type !== 'INGRESO' || bank.transfer || bank.splitInfo || bank.loanId || bank.reimbursement ||
          bank.amount !== p.amount || bank.date !== p.paidDate || bank.date < expense.date || bank.code !== expense.code || bank.description !== `Reintegro ${p.contactName}: ${expense.description}`) throw new Error('pago sin movimiento inequívoco; una marca de pagado no demuestra un cobro ni una compensación');
        settlements.push({ id: `legacy-${expense.id}-${p.contactId}`, contactId: p.contactId, amount: p.amount, date: bank.date, processed: bank.processed, kind: 'cash', walletId: wallet.id, transactionId: bank.id });
      }
      candidates.push({ expense, settlements });
    } catch (error) { issues.push(`${expense.id}: ${error instanceof Error ? error.message : 'requiere revisión'}. Se conserva sin migrar.`); }
  }
  return { candidates, issues };
}
export function migrateSharedExpenses(data: FinanceData): FinanceData {
  const { candidates } = sharedMigrationReport(data), replacements = new Map<string, Transaction>();
  for (const { expense, settlements } of candidates) {
    replacements.set(expense.id, { ...expense, splitInfo: { ...expense.splitInfo!, accountingVersion: '2.7', walletId: data.wallets.find(w => w.name === expense.wallet)!.id, settlements } });
    for (const s of settlements) {
      const bank = data.transactions.find(t => t.id === s.transactionId)!;
      replacements.set(bank.id, { ...bank, reimbursement: { expenseId: expense.id, settlementId: s.id, contactId: s.contactId, walletId: s.walletId! } });
    }
  }
  const candidate = { ...data, transactions: data.transactions.map(t => replacements.get(t.id) ?? t) }; assertSharedIntegrity(candidate); return candidate;
}

export function sharedWalletName(t: Transaction, data: Pick<FinanceData, 'wallets'>): string {
  const id = t.reimbursement?.walletId ?? (isStructuredShared(t) ? t.splitInfo!.walletId : undefined);
  return id ? data.wallets.find(w => w.id === id)?.name ?? t.wallet : t.wallet;
}
