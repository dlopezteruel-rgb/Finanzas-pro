import type { Transaction, TransferInput, Wallet } from '../types/finance';

export const TRANSFER_CODE = 'F.003.001';

/** This code is also used by insurance/credit. Never classify by code alone. */
export function isLegacyTransfer(t: Transaction): boolean {
  return !t.transfer && t.code === TRANSFER_CODE &&
    (t.subcategoryName === 'Traspaso entre cuentas' || /^tx-traspaso-(out|in)-\d+$/.test(t.id));
}

export function validTransferAmount(amount: number): boolean {
  const cents = Math.round(amount * 100);
  return Number.isFinite(amount) && amount > 0 && Number.isSafeInteger(cents) &&
    amount === cents / 100;
}

// Deliberately local to transfers: do not change the general monetary parser.
export function parseTransferAmount(text: string): number {
  return /^\d+(?:[.,]\d{1,2})?$/.test(text.trim()) ? Number(text.trim().replace(',', '.')) : NaN;
}

function validDate(date: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date)) &&
    new Date(date).toISOString().slice(0, 10) === date;
}

export function transferPair(wallets: Wallet[], input: TransferInput, id: string = crypto.randomUUID()): Transaction[] {
  const from = wallets.find(w => w.id === input.fromWalletId);
  const to = wallets.find(w => w.id === input.toWalletId);
  if (!from || !to) throw new Error('Las carteras del traspaso deben existir.');
  if (from.id === to.id) throw new Error('El origen y el destino deben ser carteras distintas.');
  if (!validTransferAmount(input.amount)) throw new Error('El importe debe ser positivo, finito y tener como máximo dos decimales.');
  if (!validDate(input.date)) throw new Error('La fecha del traspaso no es válida.');
  if (typeof input.concept !== 'string' || typeof input.processed !== 'boolean') throw new Error('Datos del traspaso inválidos.');
  return (['out', 'in'] as const).map(leg => ({
    id: `transfer-${id}-${leg}`, date: input.date, amount: input.amount,
    type: leg === 'out' ? 'GASTO' : 'INGRESO', code: TRANSFER_CODE,
    categoryName: 'FINANCIEROS', subcategoryName: 'Traspaso entre cuentas',
    description: `Traspaso ${leg === 'out' ? 'a ' + to.name : 'desde ' + from.name}${input.concept ? ': ' + input.concept : ''}`,
    wallet: leg === 'out' ? from.name : to.name, processed: input.processed,
    transfer: { id, fromWalletId: from.id, toWalletId: to.id, leg, concept: input.concept },
  }));
}

/** Domain invariant on every load, write and restore; no orphan or independent leg. */
export function assertTransferIntegrity(transactions: Transaction[], wallets: Wallet[]) {
  const groups = new Map<string, Transaction[]>();
  for (const t of transactions) if (t.transfer) {
    const link = t.transfer;
    if (!link.id || !link.fromWalletId || !link.toWalletId || !['out', 'in'].includes(link.leg) || typeof link.concept !== 'string') throw new Error('Relación de traspaso inválida.');
    if (link.fromWalletId === link.toWalletId || !wallets.some(w => w.id === link.fromWalletId) || !wallets.some(w => w.id === link.toWalletId)) throw new Error('Las carteras del traspaso deben existir y ser distintas.');
    if (t.loanId || t.splitInfo || t.code !== TRANSFER_CODE || !validTransferAmount(t.amount)) throw new Error('Un traspaso no puede ser un préstamo ni un gasto compartido y debe tener un importe válido.');
    const group = groups.get(link.id) ?? [];
    group.push(t); groups.set(link.id, group);
  }
  for (const group of groups.values()) {
    const out = group.find(t => t.transfer!.leg === 'out');
    const incoming = group.find(t => t.transfer!.leg === 'in');
    if (group.length !== 2 || !out || !incoming || out.type !== 'GASTO' || incoming.type !== 'INGRESO' ||
      out.amount !== incoming.amount || out.date !== incoming.date || out.processed !== incoming.processed ||
      out.transfer!.fromWalletId !== incoming.transfer!.fromWalletId || out.transfer!.toWalletId !== incoming.transfer!.toWalletId ||
      out.transfer!.concept !== incoming.transfer!.concept) throw new Error('Los dos extremos del traspaso deben guardarse y modificarse juntos.');
  }
}

/** Match only the exact historical generator, including its adjacent timestamp IDs,
 * reciprocal descriptions/notes and equal date/amount/status. Never infer from amount alone. */
export function legacyTransferReport(transactions: Transaction[], wallets?: Wallet[]) {
  const legacy = transactions.filter(isLegacyTransfer);
  const byId = new Map<string, Transaction[]>();
  for (const t of legacy) byId.set(t.id, [...(byId.get(t.id) ?? []), t]);
  const pairs: { out: Transaction; incoming: Transaction; concept: string }[] = [];
  const linked = new Set<string>();
  for (const out of legacy) {
    const match = /^tx-traspaso-out-(\d+)$/.exec(out.id);
    if (!match || out.type !== 'GASTO' || out.loanId || out.splitInfo || !validTransferAmount(out.amount)) continue;
    const candidates = (byId.get(`tx-traspaso-in-${BigInt(match[1]) + 1n}`) ?? []).filter(incoming => {
      if (incoming.id !== `tx-traspaso-in-${BigInt(match[1]) + 1n}` || incoming.type !== 'INGRESO' || incoming.loanId || incoming.splitInfo || incoming.wallet === out.wallet) return false;
      if (incoming.date !== out.date || incoming.amount !== out.amount || incoming.processed !== out.processed) return false;
      const prefix = `Traspaso a ${incoming.wallet}`;
      if (out.description !== prefix && !out.description.startsWith(prefix + ': ')) return false;
      const suffix = out.description.slice(prefix.length);
      return incoming.description === `Traspaso desde ${out.wallet}${suffix}` &&
        out.notes === `Traspaso ordenado hacia ${incoming.wallet}` && incoming.notes === `Traspaso recibido desde ${out.wallet}` &&
        out.categoryName === 'FINANCIEROS' && incoming.categoryName === 'FINANCIEROS' &&
        out.subcategoryName === 'Traspaso entre cuentas' && incoming.subcategoryName === 'Traspaso entre cuentas';
    });
    if (candidates.length !== 1 || linked.has(candidates[0].id)) continue;
    const incoming = candidates[0];
    if (wallets && (!wallets.some(w => w.name === out.wallet) || !wallets.some(w => w.name === incoming.wallet))) continue;
    const prefix = `Traspaso a ${incoming.wallet}`;
    pairs.push({ out, incoming, concept: out.description.slice(prefix.length).replace(/^: /, '') });
    linked.add(out.id); linked.add(incoming.id);
  }
  return { pairs, unresolved: legacy.filter(t => !linked.has(t.id)), linked };
}

/** Pure classification: legacy originals remain untouched until explicit migration. */
export function economicTransactions(transactions: Transaction[]): Transaction[] {
  const { linked } = legacyTransferReport(transactions);
  return transactions.filter(t => !t.transfer && !linked.has(t.id));
}

export function migrateLegacyTransfers<T extends { transactions: Transaction[]; wallets: Wallet[] }>(data: T): T {
  const report = legacyTransferReport(data.transactions, data.wallets);
  const additions = new Map<string, Transaction['transfer']>();
  for (const { out, incoming, concept } of report.pairs) {
    const common = {
      id: `legacy-${out.id}`, fromWalletId: data.wallets.find(w => w.name === out.wallet)!.id,
      toWalletId: data.wallets.find(w => w.name === incoming.wallet)!.id, concept,
    };
    additions.set(out.id, { ...common, leg: 'out' });
    additions.set(incoming.id, { ...common, leg: 'in' });
  }
  return { ...data, transactions: data.transactions.map(t => additions.has(t.id) ? { ...t, transfer: additions.get(t.id)! } : t) };
}

export function saveTransfer(transactions: Transaction[], wallets: Wallet[], input: TransferInput, id?: string): Transaction[] {
  const previous = id ? transactions.filter(t => t.transfer?.id === id) : [];
  if (id && previous.length !== 2) throw new Error('El traspaso ya no existe o está incompleto.');
  const pair = transferPair(wallets, input, id);
  if (!id) return [...pair, ...transactions];
  // Preserve historical IDs and notes when editing; replace both legs in one candidate.
  return transactions.map(t => t.transfer?.id !== id ? t : { ...t, ...pair.find(p => p.transfer!.leg === t.transfer!.leg)!, id: t.id });
}

export function deleteTransfer(transactions: Transaction[], id: string): Transaction[] {
  if (transactions.filter(t => t.transfer?.id === id).length !== 2) throw new Error('El traspaso ya no existe o está incompleto.');
  return transactions.filter(t => t.transfer?.id !== id);
}

export function transferWalletName(t: Transaction, wallets: Wallet[]): string {
  if (!t.transfer) return t.wallet;
  const id = t.transfer.leg === 'out' ? t.transfer.fromWalletId : t.transfer.toWalletId;
  return wallets.find(w => w.id === id)?.name ?? t.wallet;
}
