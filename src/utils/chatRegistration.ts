import { BudgetPartida, Transaction, Wallet } from '../types/finance';
import { parseFinancialInput } from './parser';
import { walletFromText } from './defaultWallet';

import {classifyChatIntent} from './registrationIntent';
export {classifyChatIntent,type ChatIntent} from './registrationIntent';

export function proposeChatMovement(
  text: string, wallets: Wallet[], partidas: BudgetPartida[], referenceDate?: Date, defaultWalletId?: string | null,
): Omit<Transaction, 'id'> | null {
  if (classifyChatIntent(text) !== 'registration') return null;
  const parsed = parseFinancialInput(text, referenceDate,partidas);
  if (!parsed || !Number.isFinite(parsed.amount) || parsed.amount <= 0) return null;
  const partida = partidas.find(p => p.type === parsed.type && p.code === parsed.code&&!p.archived&&!p.deleted);
  if (!partidas.some(p=>p.type===parsed.type&&!p.archived&&!p.deleted)) return null;
  return {
    type: parsed.type, amount: parsed.amount, date: parsed.date,
    code: partida?.code??'', categoryName: partida?.groupName??'', subcategoryName: partida?.name??'Selecciona una partida',
    wallet: walletFromText(text, parsed.wallet, wallets, defaultWalletId)?.name ?? '',
    description: parsed.description, processed: parsed.processed,
    notes: `Propuesta revisada desde chat: "${text}"`,
  };
}
