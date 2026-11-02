import { FinanceData } from './backup';

export interface ClearDataOptions {
  clearWalletBalances: boolean;
  clearAllWallets: boolean;
  clearTransactions: boolean;
  clearBudgets: boolean;
  clearDebts: boolean;
}

/** Preserve existing clearing semantics; persistence/backups belong to the store. */
export function clearedData(data: FinanceData, options: ClearDataOptions): FinanceData {
  const transactions = options.clearTransactions ? [] : data.transactions;
  return {
    ...data,
    wallets: options.clearAllWallets ? [] : options.clearWalletBalances ? data.wallets.map(w => ({ ...w, initialBalance: 0 })) : data.wallets,
    budgetPlans: options.clearBudgets ? [] : data.budgetPlans,
    loans: options.clearDebts ? [] : data.loans,
    transactions: options.clearDebts ? transactions.map(t => !t.splitInfo ? t : ({
      ...t, splitInfo: {
        ...t.splitInfo, totalOwedToMe: 0,
        participants: t.splitInfo.participants.map(p => ({ ...p, isPaid: true, paidDate: new Date().toISOString().slice(0, 10) })),
      },
    })) : transactions,
  };
}
