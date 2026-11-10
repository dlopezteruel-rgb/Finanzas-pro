import type { FinanceData } from './backup';
import type { PersonalObligation, PersonalSettlement, Transaction } from '../types/finance';
import { intelligent, validateIntelligent } from './intelligentValidation';
import { safeCents } from './planningMoney';
import { madridDate } from './financialCalendar';
import { calculateLoanStatus } from './finance';
import { cents, remainingDebt } from './sharedExpenses';

export const settledCents=(o:PersonalObligation)=>o.settlements.filter(s=>s.processed).reduce((n,s)=>safeCents(n+s.amountCents),0);
export const remainingCents=(o:PersonalObligation)=>o.cancelled?0:safeCents(o.principalCents-settledCents(o));
export const reservedCents=(o:PersonalObligation)=>o.settlements.reduce((n,s)=>safeCents(n+s.amountCents),0);
export function saveObligation(data:FinanceData, obligation:PersonalObligation):FinanceData {
  const state=intelligent(data),old=state.obligations.find(o=>o.id===obligation.id);
  if(!old && obligation.settlements.length)throw new Error('Crea el compromiso antes de liquidarlo.');
  if(old&&JSON.stringify(old.settlements)!==JSON.stringify(obligation.settlements))throw new Error('El historial se registra por su propia operación.');
  const next={...data,intelligentFinance:{...state,obligations:old?state.obligations.map(o=>o.id===old.id?obligation:o):[...state.obligations,obligation]}};
  validateIntelligent(next);return next;
}
export function cancelObligation(data:FinanceData,id:string):FinanceData {
  const old=intelligent(data).obligations.find(o=>o.id===id);
  if(!old||old.settlements.length)throw new Error('No se puede cancelar un compromiso con historial.');
  return saveObligation(data,{...old,cancelled:true});
}
/** No physical deletion: cancellation keeps the reviewed principal and counterparty traceable. */
export function settleObligation(data:FinanceData,obligationId:string,input:PersonalSettlement):FinanceData {
  const state=intelligent(data),old=state.obligations.find(o=>o.id===obligationId);
  if(!old||old.cancelled)throw new Error('El compromiso no está disponible.');
  const existing=old.settlements.find(s=>s.id===input.id);
  if(existing){if(JSON.stringify(existing)!==JSON.stringify(input))throw new Error('Identificador de liquidación ya utilizado.');return data;}
  if(input.processed&&input.date>madridDate())throw new Error('Un cobro/pago futuro debe quedar pendiente de tramitar.');
  if(input.amountCents>old.principalCents-reservedCents(old))throw new Error('El pago/cobro supera el saldo no reservado.');
  let transaction:Transaction|undefined;
  const settlement={...input};
  if(input.kind==='bank') {
    const wallet=data.wallets.find(w=>w.id===input.walletId);
    if(!wallet)throw new Error('Selecciona una cartera válida.');
    settlement.transactionId=`obligation:${input.id}`;
    if(data.transactions.some(t=>t.id===settlement.transactionId))throw new Error('Identidad bancaria duplicada.');
    transaction={id:settlement.transactionId,type:old.direction==='receivable'?'INGRESO':'GASTO',amount:input.amountCents/100,date:input.date,description:`${old.direction==='receivable'?'Cobro':'Pago'} de principal: ${old.concept}`,wallet:wallet.name,processed:input.processed,code:'PERSONAL.PRINCIPAL',categoryName:'Compromisos personales',subcategoryName:'Devolución de principal (sin ingreso/gasto económico)',obligationSettlement:{obligationId:old.id,settlementId:input.id,walletId:wallet.id}};
  }
  const next={...data,transactions:transaction?[transaction,...data.transactions]:data.transactions,intelligentFinance:{...state,obligations:state.obligations.map(o=>o.id===old.id?{...o,settlements:[...o.settlements,settlement]}:o)}};
  validateIntelligent(next);return next;
}
export function toggleObligationSettlement(data:FinanceData,transactionId:string):FinanceData {
  const tx=data.transactions.find(t=>t.id===transactionId),link=tx?.obligationSettlement;
  if(!tx||!link)throw new Error('Liquidación bancaria inexistente.');
  if(!tx.processed&&tx.date>madridDate())throw new Error('No se puede tramitar un pago/cobro futuro.');
  const state=intelligent(data),next={...data,transactions:data.transactions.map(t=>t.id===tx.id?{...t,processed:!t.processed}:t),intelligentFinance:{...state,obligations:state.obligations.map(o=>o.id===link.obligationId?{...o,settlements:o.settlements.map(s=>s.id===link.settlementId?{...s,processed:!tx.processed}:s)}:o)}};
  validateIntelligent(next);return next;
}
export interface ObligationOverview {
  id:string;direction:'receivable'|'payable';source:'shared'|'personal'|'loan';name:string;concept:string;remainingCents:number;overdueCents:number;dueDate?:string;closed:boolean;
}
/** Read-only adapters reuse the existing ledgers; no duplicate contact balances are stored. */
export function obligationOverview(data:FinanceData,today=madridDate()):ObligationOverview[] {
  const rows:ObligationOverview[]=[];
  for(const t of data.transactions)if(t.splitInfo?.isShared&&t.processed)for(const p of t.splitInfo.participants) {
    const amount=cents(remainingDebt(t,p.contactId));
    rows.push({id:`shared:${t.id}:${p.contactId}`,source:'shared',direction:'receivable',name:data.contacts.find(c=>c.id===p.contactId)?.name??p.contactName,concept:t.description,remainingCents:amount,overdueCents:0,closed:amount===0});
  }
  for(const o of intelligent(data).obligations) {
    const amount=remainingCents(o);
    rows.push({id:o.id,source:'personal',direction:o.direction,name:o.counterparty.contactId?data.contacts.find(c=>c.id===o.counterparty.contactId)?.name??o.counterparty.name:o.counterparty.name,concept:o.concept,remainingCents:amount,overdueCents:o.dueDate&&o.dueDate<today?amount:0,dueDate:o.dueDate,closed:o.cancelled||amount===0});
  }
  for(const l of data.loans) {
    const s=calculateLoanStatus(l,data.transactions,today),remaining=cents(s.saldoPendienteReal);
    rows.push({id:l.id,source:'loan',direction:'payable',name:l.entity,concept:l.name,remainingCents:remaining,overdueCents:Math.min(remaining,cents(Math.max(0,s.cuotasTeoricasAcumuladas-s.cuotasRealesTramitadas)*l.monthlyPayment)),closed:remaining===0});
  }
  return rows;
}
