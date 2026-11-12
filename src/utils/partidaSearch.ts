import type { BudgetGroup, BudgetPartida, MovementType, Transaction } from '../types/finance';
import { economicTransactions, isLegacyTransfer } from './transfers';

export const normalizeSearch = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
export type CatalogItem = { partida: BudgetPartida; familyCode: string; familyName: string };
export function partidaCatalog(groups: BudgetGroup[]): CatalogItem[] {
  return groups.filter(g=>!g.archived&&!g.deleted).flatMap(g => g.partidas.filter(p=>!p.archived&&!p.deleted).map(partida => ({ partida, familyCode: g.code, familyName: g.name })));
}
export function searchPartidas(catalog: CatalogItem[], type: MovementType, query = '', family = '', group = '') {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  return catalog.filter(({ partida: p, familyCode, familyName }) => {
    if (p.type !== type || (family && familyCode !== family) || (group && `${p.groupCode}:${p.groupName}` !== group)) return false;
    const text = normalizeSearch([p.code, p.name, p.groupCode, p.groupName, p.description ?? '', familyCode, familyName, ...p.keywords].join(' '));
    return terms.every(term => text.includes(term));
  });
}
export function recentPartidas(catalog: CatalogItem[], transactions: Transaction[], type: MovementType, count = 5): CatalogItem[] {
  const receipts = new Set(transactions.flatMap(t => t.splitInfo?.participants.map(p => p.reimbursementTxId).filter(Boolean) ?? []));
  const used = new Set<string>(), result: CatalogItem[] = [];
  const sorted = economicTransactions(transactions).filter(t => !isLegacyTransfer(t) && !receipts.has(t.id) && t.type === type)
    .map((t, index) => ({ t, index })).sort((a, b) => b.t.date.localeCompare(a.t.date) || a.index - b.index);
  for (const { t } of sorted) {
    const key = `${type}:${t.code}`, item = catalog.find(c => c.partida.type === type && c.partida.code === t.code);
    if (!item || used.has(key)) continue;
    used.add(key); result.push(item); if (result.length === count) break;
  }
  return result;
}
