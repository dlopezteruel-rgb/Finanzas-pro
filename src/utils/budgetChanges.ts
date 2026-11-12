import { subitemsFor, createSubitem } from './budgetSubitems';
import type { FinanceData } from './backup';
import type { BudgetPartida } from '../types/finance';

function containingGroup(data: FinanceData, partida: BudgetPartida) {
  return data.budgetGroups.find(g => g.partidas.some(p => p.code === partida.code && p.type === partida.type));
}

/** Catalog organization never reclassifies financial records, including their stored labels. */
export function changePartidaGroup(data: FinanceData, partida: BudgetPartida, targetGroupCode: string): FinanceData {
  // Catalog groupCode may identify a subgroup (e.g. F.003), not the containing package.
  const source = containingGroup(data, partida);
  const target = data.budgetGroups.find(g => g.code === targetGroupCode);
  if (!source || !target) throw new Error('La partida o el paquete de destino ya no existe.');
  if(source.deleted||target.deleted||target.archived||partida.deleted)throw new Error('Elige una partida y una familia de destino activas.');
  if (source.type !== target.type) throw new Error('No se permite cambiar entre Ingresos y Gastos desde el catálogo. Elige una familia del mismo tipo.');
  if (source.code === target.code) return data;
  const current = source.partidas.find(p => p.code === partida.code && p.type === partida.type)!;
  if(current.deleted)throw new Error('La partida está retirada.');
  if (data.budgetGroups.some(g => g !== source && g.partidas.some(p => p.code === current.code && p.type === target.type))) {
    throw new Error('Ya existe una partida con ese código y tipo en el catálogo. No se ha aplicado el traslado.');
  }
  const updated = { ...current, groupCode: target.code, groupName: target.name };
  return {
    ...data,
    budgetGroups: data.budgetGroups.map(g => g === source
      ? { ...g, partidas: g.partidas.filter(p => p !== current) }
      : g === target ? { ...g, partidas: [...g.partidas, updated] } : g),
  };
}

/** BudgetPartida identity is its type + code in the existing JSON schema. */
export function duplicatePartida(data: FinanceData, partida: BudgetPartida): FinanceData {
  const source = containingGroup(data, partida);
  if (!source) throw new Error('La partida ya no existe. No se ha creado ninguna copia.');
  if(source.archived||source.deleted||partida.archived||partida.deleted)throw new Error('Reactiva la partida y su familia antes de duplicar.');
  const index = source.partidas.findIndex(p => p.code === partida.code && p.type === partida.type);
  const original = source.partidas[index];
  if(original.archived||original.deleted)throw new Error('Reactiva la partida antes de duplicar.');
  const suffix = /^(.*\.)(\d+)$/.exec(original.code);
  const prefix = suffix?.[1] ?? `${original.code}.`;
  let number = suffix ? BigInt(suffix[2]) + 1n : 1n;
  // An absent catalog entry may still be referenced by a historical plan/rule.
  // Reusing that code would attach those amounts to the newly created copy.
  const approvals = [...(data.planningMonths ?? []).flatMap(m => m.approval ? [m.approval] : []),
    ...(data.planningAutomation?.history ?? []).flatMap(h => h.approvals)];
  const occupied = new Set([
    ...data.budgetGroups.flatMap(g => g.partidas.map(p => p.code)),
    ...(data.budgetSubitems?.items ?? []).map(i=>i.code), ...data.transactions.map(t => t.code), ...data.budgetPlans.map(p => p.code), ...data.loans.map(l => l.code),
    ...(data.planningAutomation?.rules ?? []).map(r => r.code),
    ...(data.planningAutomation?.origins ?? []).map(o => o.code),
    ...(data.planningAutomation?.carryovers ?? []).map(c => c.code),
    ...(data.intelligentFinance?.recurringRules ?? []).map(r => r.code),
    ...approvals.flatMap(a => [...a.lines, ...(a.baseLines ?? []), ...(a.carryLines ?? [])].map(l => l.code)),
  ]);
  let code: string;
  do { code = `${prefix}${String(number++).padStart(3, '0')}`; } while (occupied.has(code));
  const copy = { ...original, code, name: `${original.name} (Copia)`, keywords: [...original.keywords] };
  let next = { ...data, budgetGroups: data.budgetGroups.map(g => g === source
    ? { ...g, partidas: [...g.partidas.slice(0, index + 1), copy, ...g.partidas.slice(index + 1)] } : g) };
  for(const item of subitemsFor(data,original).filter(i=>!i.archived)) next=createSubitem(next,copy,item.name);
  return next;
}

export function reorderPartida(data: FinanceData, groupCode: string, index: number, direction: 'UP' | 'DOWN'): FinanceData {
  const group = data.budgetGroups.find(g => g.code === groupCode);
  if (!group) throw new Error('La familia ya no existe.');
  if (!Number.isInteger(index) || index < 0 || index >= group.partidas.length) return data;
  const visible = group.partidas.map((p,n)=>({p,n})).filter(({p})=>!p.deleted).map(({n})=>n);
  const position=visible.indexOf(index),target=visible[position+(direction==='UP'?-1:1)];
  if(position<0||target===undefined)return data;
  const partidas = [...group.partidas];
  [partidas[index], partidas[target]] = [partidas[target], partidas[index]];
  return { ...data, budgetGroups: data.budgetGroups.map(g => g === group ? { ...g, partidas } : g) };
}
