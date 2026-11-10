import type { FinanceData } from './backup';
import type { MovementOccurrence, RecurringMovementRule, Transaction } from '../types/finance';
import { dateAtDay, realDate, shiftMonth } from './financialCalendar';
import { monthNumber, planningRange } from './planningCalendar';
import { intelligent, validateIntelligent } from './intelligentValidation';

export function saveMovementRule(data: FinanceData, rule: RecurringMovementRule): FinanceData {
  const state=intelligent(data),old=state.recurringRules.find(r=>r.id===rule.id);
  if(old?.deleted)throw new Error('Esta regla está eliminada. Crea una nueva identidad.');
  const candidate={...data,intelligentFinance:{...state,recurringRules:old?state.recurringRules.map(r=>r.id===rule.id?rule:r):[...state.recurringRules,rule]}};
  validateIntelligent(candidate);return candidate;
}
export function removeMovementRule(data: FinanceData, id: string): FinanceData {
  const old=intelligent(data).recurringRules.find(r=>r.id===id);
  if(!old)throw new Error('La regla ya no existe.');
  return saveMovementRule(data,{...old,active:false,deleted:true});
}
export function ruleDate(rule: RecurringMovementRule, month: string): string | null {
  const distance=monthNumber(month)-monthNumber(rule.startDate.slice(0,7));
  const step={monthly:1,quarterly:3,yearly:12}[rule.frequency];
  if(rule.deleted||!rule.active||distance<0||distance%step!==0)return null;
  const due=dateAtDay(month,rule.day);
  return due<rule.startDate||(rule.endDate&&due>rule.endDate)?null:due;
}
export function nextRuleDate(rule: RecurringMovementRule, from: string): string | null {
  if(!realDate(from))throw new Error('Fecha inválida.');
  const first=from>rule.startDate?from:rule.startDate;
  for(let i=0;i<=12;i++) {
    const month=shiftMonth(first.slice(0,7),i);if(!month)return null;
    const date=ruleDate(rule,month);if(date&&date>=from)return date;
  }
  return null;
}
export interface OccurrencePreview {
  id: string; ruleId: string; dueDate: string; rule: RecurringMovementRule;
  status: 'proposed' | 'registered' | 'skipped'; transactionId?: string; collisions: string[];
}
export function occurrencePreviews(data: FinanceData, first: string, last = first): OccurrencePreview[] {
  const months=planningRange(first,last),state=intelligent(data);
  const known=new Map(state.occurrences.map(o=>[o.id,o]));
  const result: OccurrencePreview[]=[];
  for(const rule of state.recurringRules)for(const month of months) {
    const due=ruleDate(rule,month);if(!due)continue;
    const id=`${rule.id}@${due}`,saved=known.get(id);
    const wallet=data.wallets.find(w=>w.id===rule.walletId);
    const collisions=data.transactions.filter(t=>!t.recurrence&&!t.transfer&&!t.reimbursement&&!t.obligationSettlement&&!t.loanId&&t.date===due&&t.type===rule.type&&t.amount===rule.amountCents/100&&t.wallet===wallet?.name).map(t=>t.id);
    result.push({id,ruleId:rule.id,dueDate:due,rule,status:saved?.status??'proposed',transactionId:saved?.transactionId,collisions});
  }
  // Also show historical occurrences after edits/pauses/deletion of a rule.
  const visible=new Set(result.map(r=>r.id));
  for(const o of state.occurrences)if(!visible.has(o.id)&&o.dueDate.slice(0,7)>=first&&o.dueDate.slice(0,7)<=last) {
    result.push({...o,rule:state.recurringRules.find(r=>r.id===o.ruleId)!,collisions:[]});
  }
  if(result.length>12000)throw new Error('Reduce el periodo: máximo 12.000 ocurrencias por consulta.');
  return result.sort((a,b)=>a.dueDate.localeCompare(b.dueDate)||a.id.localeCompare(b.id));
}
export const occurrenceScope=(data: FinanceData)=>JSON.stringify({state:intelligent(data),transactions:data.transactions,wallets:data.wallets});
export interface OccurrenceBatch { first: string; last: string; ids: string[]; scope: string; action: 'register' | 'skip'; acknowledgeCollisions: boolean }
/** Entire batch and its persistent identity ledger commit in one FinanceStore mutation. */
export function applyOccurrenceBatch(data: FinanceData, batch: OccurrenceBatch): FinanceData {
  if(occurrenceScope(data)!==batch.scope)throw new Error('La vista previa ha cambiado. Revisa de nuevo antes de confirmar.');
  if(!batch.ids.length||batch.ids.length>500||new Set(batch.ids).size!==batch.ids.length)throw new Error('Selecciona entre 1 y 500 ocurrencias distintas.');
  const previews=new Map(occurrencePreviews(data,batch.first,batch.last).map(r=>[r.id,r]));
  const state=intelligent(data),newOccurrences:MovementOccurrence[]=[],newTransactions:Transaction[]=[];
  for(const id of batch.ids) {
    const row=previews.get(id);if(!row)throw new Error('La ocurrencia ya no está disponible.');
    if(row.status!=='proposed')continue; // Idempotent retry on the same saved ledger.
    if(row.collisions.length&&batch.action==='register'&&!batch.acknowledgeCollisions)throw new Error('Hay movimientos manuales parecidos. Revisa la coincidencia y confirma crear otro, o bien omite esta ocurrencia.');
    const occurrence:MovementOccurrence={id,ruleId:row.ruleId,dueDate:row.dueDate,status:batch.action==='skip'?'skipped':'registered'};
    if(batch.action==='register') {
      const r=row.rule,wallet=data.wallets.find(w=>w.id===r.walletId);
      if(!wallet)throw new Error('La cartera de la regla no existe.');
      occurrence.transactionId=`recurring:${id}`;
      if(data.transactions.some(t=>t.id===occurrence.transactionId))throw new Error('Identificador de movimiento ya utilizado.');
      newTransactions.push({id:occurrence.transactionId,date:row.dueDate,amount:r.amountCents/100,type:r.type,code:r.code,categoryName:r.categoryName,subcategoryName:r.subcategoryName,description:r.concept,wallet:wallet.name,processed:false,recurrence:{ruleId:r.id,occurrenceId:id,dueDate:row.dueDate,walletId:r.walletId}});
    }
    newOccurrences.push(occurrence);
  }
  if(!newOccurrences.length)return data;
  const next={...data,transactions:[...newTransactions,...data.transactions],intelligentFinance:{...state,occurrences:[...state.occurrences,...newOccurrences]}};
  validateIntelligent(next);return next;
}
