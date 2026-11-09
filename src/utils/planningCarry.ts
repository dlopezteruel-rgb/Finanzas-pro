import type { FinanceData } from './backup';
import type { PlanningCarryover } from '../types/finance';
import { assertMonth, planCents } from './planningMoney';
import { calculateMonthlyBudgetRows } from './finance';
import { temporalMonth } from './planningCalendar';

function signature(value:string) {
  // Non-cryptographic change marker, never used instead of lock/revision/preview validation.
  let hash=0xcbf29ce484222325n;for(let i=0;i<value.length;i++){hash^=BigInt(value.charCodeAt(i));hash=BigInt.asUintN(64,hash*0x100000001b3n);}return hash.toString(16).padStart(16,'0');
}
export function carryObservation(data:FinanceData,month:string,code:string) {
  assertMonth(month);
  const baseCents=planCents(data.budgetPlans.find(p=>p.monthYear===month&&p.type==='GASTO'&&p.code===code)?.plannedAmount ?? 0);
  const row=calculateMonthlyBudgetRows(month,data.transactions,data.budgetPlans,[{type:'GASTO',code,name:code,groupName:'',groupCode:'',keywords:[]}])[0];
  const executedCents=planCents(row.ejecutado);
  const sourceSignature=signature(JSON.stringify({baseCents,transactions:data.transactions.filter(t=>t.date.slice(0,7)===month).slice().sort((a,b)=>a.id.localeCompare(b.id))}));
  return {baseCents,executedCents,remainder:Math.max(0,baseCents-executedCents),sourceSignature};
}
export const carryIsStale=(data:FinanceData,carry:PlanningCarryover,now=new Date())=>{try{return carry.fromMonth>=temporalMonth(now)||carryObservation(data,carry.fromMonth,carry.code).sourceSignature!==carry.sourceSignature}catch{return true}};
