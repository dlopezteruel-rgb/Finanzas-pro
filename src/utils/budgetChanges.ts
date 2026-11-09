import type { FinanceData } from './backup';
import type { BudgetPartida } from '../types/finance';
import { isLegacyTransfer } from './transfers';

/** Pure candidate for one atomic store mutation; never recategorize transfer legs. */
export function changePartidaGroup(data: FinanceData, partida: BudgetPartida, targetGroupCode: string): FinanceData {
  // Catalog groupCode may identify a subgroup (e.g. F.003), not the containing package.
  const source = data.budgetGroups.find(g => g.partidas.some(p => p.code === partida.code && p.type === partida.type));
  const target = data.budgetGroups.find(g => g.code === targetGroupCode);
  if (!source || !target) throw new Error('La partida o el paquete de destino ya no existe.');
  if (source.code === target.code) return data;
  const current = source.partidas.find(p => p.code === partida.code && p.type === partida.type)!;
  if (data.budgetGroups.some(g => g !== source && g.partidas.some(p => p.code === current.code && p.type === target.type))) {
    throw new Error('Ya existe una partida con ese código y tipo en el catálogo. No se ha aplicado el traslado.');
  }
  if(current.type!==target.type&&data.planningAutomation?.carryovers.some(c=>c.code===current.code))throw new Error('Revisa y elimina los arrastres de esta partida antes de cambiar su tipo.');
  const updated = { ...current, groupCode: target.code, groupName: target.name, type: target.type };
  return {
    ...data,
    budgetGroups: data.budgetGroups.map(g => g === source
      ? { ...g, partidas: g.partidas.filter(p => p !== current) }
      : g === target ? { ...g, partidas: [...g.partidas, updated] } : g),
    budgetPlans: data.budgetPlans.map(p => p.code === current.code && p.type === current.type ? { ...p, type: target.type } : p),
    transactions: data.transactions.map(t => t.code === current.code && t.type === current.type && !t.transfer && !isLegacyTransfer(t)
      ? { ...t, type: target.type, categoryName: target.name } : t),
  };
}
