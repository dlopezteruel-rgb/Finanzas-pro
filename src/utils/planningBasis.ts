import type { FinanceData } from './backup';
import type { BudgetPartida, BudgetPlan, PlanningAutomation, PlanningLine } from '../types/finance';
import { planCents, safeCents } from './planningMoney';
import { calculateMonthlyBudgetRows } from './finance';

export const emptyAutomation = (): PlanningAutomation => ({ rules: [], carryovers: [], origins: [], history: [] });
export function hasAutomation(data: FinanceData) {
  const a=data.planningAutomation;
  return !!(a && [a.rules,a.carryovers,a.origins,a.history].some(items=>items?.length)) || !!data.planningMonths?.some(m=>m.approval?.baseLines || m.approval?.carryLines);
}
const key=(line:{type:string;code:string})=>`${line.type}:${line.code}`;
export function combineLines(base: PlanningLine[], carry: PlanningLine[]): PlanningLine[] {
  const map=new Map<string,PlanningLine>();
  for(const line of [...base,...carry]) { const old=map.get(key(line));map.set(key(line),{...line,amountCents:safeCents((old?.amountCents ?? 0)+line.amountCents)}); }
  return [...map.values()].filter(l=>l.amountCents!==0).sort((a,b)=>key(a).localeCompare(key(b)));
}
export function carryLines(data: FinanceData, month: string): PlanningLine[] {
  return combineLines([],data.planningAutomation?.carryovers.filter(c=>c.toMonth===month).map(c=>({type:c.type,code:c.code,amountCents:c.amountCents})) ?? []);
}
export function effectiveBudgetPlans(data: FinanceData): BudgetPlan[] {
  if(!data.planningAutomation?.carryovers.length)return data.budgetPlans;
  const map=new Map(data.budgetPlans.map(p=>[`${p.monthYear}:${key(p)}`,p]));
  for(const c of data.planningAutomation.carryovers) {
    const id=`${c.toMonth}:${key(c)}`,base=map.get(id);
    const cents=safeCents((base?planCents(base.plannedAmount):0)+c.amountCents);
    if(planCents(cents/100)!==cents)throw new Error('Presupuesto efectivo fuera del rango monetario exacto.');
    map.set(id,{monthYear:c.toMonth,type:c.type,code:c.code,plannedAmount:cents/100});
  }
  return [...map.values()];
}
export function planningContent(data: FinanceData, month: string) {
  return { plans:data.budgetPlans.filter(p=>p.monthYear===month).map(p=>({monthYear:p.monthYear,type:p.type,code:p.code,plannedAmount:p.plannedAmount})).sort((a,b)=>key(a).localeCompare(key(b))), carryovers:data.planningAutomation?.carryovers.filter(c=>c.toMonth===month).map(c=>({id:c.id,fromMonth:c.fromMonth,code:c.code,type:c.type,amountCents:c.amountCents})).sort((a,b)=>a.id.localeCompare(b.id)) ?? [] };
}
export function planningCatalog(data:FinanceData,catalog:BudgetPartida[]) {
  const extra=[...effectiveBudgetPlans(data),...data.transactions].filter(p=>!catalog.some(c=>key(c)===key(p))).map(p=>({code:p.code,type:p.type,name:'subcategoryName' in p?p.subcategoryName:`Partida histórica ${p.code}`,groupCode:'historical',groupName:'Fuera del catálogo',keywords:[]}));
  return [...new Map([...catalog,...extra].map(p=>[key(p),p])).values()];
}
export function planningBudgetRows(data: FinanceData, month: string, catalog: BudgetPartida[]) {
  const unique=planningCatalog(data,catalog);
  return calculateMonthlyBudgetRows(month,data.transactions,effectiveBudgetPlans(data),unique).map(r=>({...r,basePrevisto:data.budgetPlans.find(p=>p.monthYear===month&&key(p)===key(r))?.plannedAmount ?? 0,arrastre:(carryLines(data,month).find(l=>key(l)===key(r))?.amountCents ?? 0)/100}));
}
