import { BudgetPartida, Transaction, Wallet } from '../types/finance';
import { parseFinancialInput } from './parser';

export type ChatIntent = 'query' | 'negation' | 'registration';

export function classifyChatIntent(text: string): ChatIntent {
  const normalized = text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLowerCase();
  // Negations and questions take precedence over any embedded instruction.
  if (/\b(no|nunca|jamas|tampoco|cancelar|cancela|evita|olvida)\b/.test(normalized)) return 'negation';
  if (/[¿?]/.test(text) || /^(como|cuanto|cuanta|cuantos|cuantas|que|cual|cuales|puedo|puedes|podria|deberia|si)\b/.test(normalized)) return 'query';
  const command = /^(?:por favor[, ]+)?(?:registra|registrar|anota|anotar|apunta|apuntar|agrega|agregar|anade|anadir|guarda|guardar)\b/;
  const statement = /^(?:(?:hoy|ayer|anteayer)[, ]+)?(?:pague|gaste|compre|cene|cobre|recibi|he pagado|he gastado|he cobrado)\b/;
  return command.test(normalized) || statement.test(normalized) ? 'registration' : 'query';
}

export function proposeChatMovement(
  text: string, wallets: Wallet[], partidas: BudgetPartida[], referenceDate?: Date,
): Omit<Transaction, 'id'> | null {
  if (classifyChatIntent(text) !== 'registration') return null;
  const parsed = parseFinancialInput(text, referenceDate);
  if (!parsed || !Number.isFinite(parsed.amount) || parsed.amount <= 0) return null;
  const partida = partidas.find(p => p.type === parsed.type && p.code === parsed.code)
    ?? partidas.find(p => p.type === parsed.type);
  if (!partida) return null;
  return {
    type: parsed.type, amount: parsed.amount, date: parsed.date,
    code: partida.code, categoryName: partida.groupName, subcategoryName: partida.name,
    wallet: wallets.find(w => w.name === parsed.wallet)?.name ?? wallets[0]?.name ?? '',
    description: parsed.description, processed: parsed.processed,
    notes: `Propuesta revisada desde chat: "${text}"`,
  };
}
