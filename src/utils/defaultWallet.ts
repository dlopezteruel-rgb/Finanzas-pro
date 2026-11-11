import type { Wallet } from '../types/finance';
import type { FinanceData } from './backup';

/** Resolution is read-only: a sole wallet is automatic, multiple wallets need a valid ID. */
export function resolveDefaultWallet(wallets: Wallet[], defaultWalletId?: string | null): Wallet | undefined {
  return wallets.length === 1 ? wallets[0] : wallets.find(wallet => wallet.id === defaultWalletId);
}
export const initialWalletName = (wallets: Wallet[], defaultWalletId?: string | null, existing?: string) =>
  existing ?? resolveDefaultWallet(wallets, defaultWalletId)?.name ?? '';
export const initialWalletId = (wallets: Wallet[], defaultWalletId?: string | null, existing?: string) =>
  existing ?? resolveDefaultWallet(wallets, defaultWalletId)?.id ?? '';

export function chooseDefaultWallet(data: FinanceData, id: string | null): FinanceData {
  if (id !== null && !data.wallets.some(wallet => wallet.id === id)) throw new Error('La cartera seleccionada ya no existe.');
  if ((data.defaultWalletId ?? null) === id) return data;
  return { ...data, defaultWalletId: id };
}

/** Clear only a reference to an actually removed wallet, never repair an invalid new choice. */
export function reconcileDefaultWallet(current: FinanceData, next: FinanceData): FinanceData {
  const id = next.defaultWalletId;
  return id && current.wallets.some(w => w.id === id) && !next.wallets.some(w => w.id === id)
    ? { ...next, defaultWalletId: null } : next;
}

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim().replace(/\s+/g, ' ');
export function walletFromText(text: string, parsedWallet: string, wallets: Wallet[], defaultWalletId?: string | null): Wallet | undefined {
  const normalized = ` ${normalize(text).replace(/[^\p{L}\p{N} ]/gu, ' ')} `;
  const named = wallets.filter(w => normalized.includes(` ${normalize(w.name)} `));
  // Explicit custom names take precedence over parser aliases and over the preference.
  const longest = named.filter(w => !named.some(other => normalize(other.name).length > normalize(w.name).length && normalize(other.name).includes(normalize(w.name))));
  if (longest.length) return longest.length === 1 ? longest[0] : undefined;
  if (parsedWallet) return wallets.find(w => normalize(w.name).replace(/ /g, '') === normalize(parsedWallet).replace(/ /g, ''));
  if (/\b(?:cartera|cuenta)\s+(?!predeterminada\b)/.test(normalize(text))) return undefined;
  return resolveDefaultWallet(wallets, defaultWalletId);
}

/** Legacy orphans remain readable/restorable; new or edited bank records need an origin. */
export function assertWalletTransition(current: FinanceData, next: FinanceData) {
  const originals = new Map(current.transactions.map(tx => [tx.id, tx]));
  const loans = new Map(current.loans.map(loan => [loan.id, loan]));
  const ids = new Set(next.wallets.map(w => w.id)), names = new Set(next.wallets.map(w => w.name));
  for (const tx of next.transactions) {
    const old = originals.get(tx.id);
    if (old === tx || (old && JSON.stringify(old) === JSON.stringify(tx))) continue;
    const id = tx.transfer ? (tx.transfer.leg === 'out' ? tx.transfer.fromWalletId : tx.transfer.toWalletId)
      : tx.reimbursement?.walletId ?? tx.recurrence?.walletId ?? tx.obligationSettlement?.walletId
        ?? (tx.splitInfo?.accountingVersion === '2.7' ? tx.splitInfo.walletId : undefined);
    if (!(id ? ids.has(id) : names.has(tx.wallet))) {
      throw new Error('Selecciona una cartera de origen válida. No se ha guardado el movimiento.');
    }
  }
  for (const loan of next.loans) {
    const old = loans.get(loan.id);
    if ((!old || JSON.stringify(old) !== JSON.stringify(loan)) && !names.has(loan.wallet)) {
      throw new Error('Selecciona una cartera válida para el préstamo.');
    }
  }
}
