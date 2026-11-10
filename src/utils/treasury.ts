import type { FinanceData } from './backup';
import type { Transaction } from '../types/finance';
import { calculateLoanStatus,calculateWalletBalances } from './finance';
import { addDays,dateAtDay,madridDate,realDate,shiftMonth } from './financialCalendar';
import { occurrencePreviews } from './recurringMovements';
import { intelligent } from './intelligentValidation';
import { obligationOverview,remainingCents,reservedCents } from './personalObligations';
import { safeCents } from './planningMoney';
import { economicTransactions } from './transfers';
import { cents } from './sharedExpenses';

export interface TreasuryEvent {
  id:string;date:string;concept:string;amountCents:number;
  source:'pending'|'recurring'|'personal'|'loan';certainty:'registered'|'proposed'|'estimated';
  originId:string;overdue:boolean;projectedCents?:number;
}
export const transactionWalletId=(data:FinanceData,t:Transaction)=>t.transfer?(t.transfer.leg==='out'?t.transfer.fromWalletId:t.transfer.toWalletId):t.recurrence?.walletId??t.obligationSettlement?.walletId??t.reimbursement?.walletId??t.splitInfo?.walletId??data.wallets.find(w=>w.name.toUpperCase().trim()===t.wallet.toUpperCase().trim())?.id;
export function liquidBalanceCents(data:FinanceData):number {
  const balances=calculateWalletBalances(data.wallets,data.transactions);
  return data.wallets.filter(w=>w.type!=='INVESTMENT').reduce((n,w)=>safeCents(n+Math.round((balances[w.name]??0)*100),false),0);
}
export interface TreasuryProjection {
  from:string;to:string;liquidCents:number;incomeCents:number;expenseCents:number;projectedCents:number;minimumCents:number;
  events:TreasuryEvent[];warnings:string[];undatedReceivableCents:number;undatedPayableCents:number;
  months:{month:string;incomeCents:number;expenseCents:number;projectedCents:number}[];
}
/** Cash projection, never an economic budget calculation. IDs take precedence over resemblance. */
export function treasuryProjection(data:FinanceData,from=madridDate(),days=30):TreasuryProjection {
  if(!realDate(from)||!Number.isInteger(days)||days<1||days>366)throw new Error('Usa una fecha real y entre 1 y 366 días.');
  const to=addDays(from,days-1),liquidCents=liquidBalanceCents(data),events:TreasuryEvent[]=[],warnings:string[]=[];
  const liquidIds=new Set(data.wallets.filter(w=>w.type!=='INVESTMENT').map(w=>w.id));
  const allTxIds=new Set(data.wallets.map(w=>w.id));
  const pending=data.transactions.filter(t=>!t.processed&&t.date<=to);
  for(const t of pending) {
    const walletId=transactionWalletId(data,t);
    if(!walletId||!allTxIds.has(walletId)){warnings.push(`Movimiento ${t.id}: cartera no disponible; excluido de la proyección.`);continue;}
    if(!liquidIds.has(walletId))continue;
    events.push({id:`tx:${t.id}`,originId:t.id,date:t.date,concept:t.description,source:'pending',certainty:'registered',amountCents:cents(t.amount)*(t.type==='INGRESO'?1:-1),overdue:t.date<from});
  }
  // Recurrence generator is bounded to 12 months per query; a 366-day horizon can touch 13.
  let first=from.slice(0,7);const last=to.slice(0,7);
  while(first<=last) {
    const month=first;
    for(const row of occurrencePreviews(data,month,month))if(row.status==='proposed'&&row.dueDate>=from&&row.dueDate<=to&&liquidIds.has(row.rule.walletId)) {
      events.push({id:`recurring:${row.id}`,originId:row.id,date:row.dueDate,concept:row.rule.concept,source:'recurring',certainty:'proposed',amountCents:row.rule.amountCents*(row.rule.type==='INGRESO'?1:-1),overdue:false});
      if(row.collisions.length)warnings.push(`Regla ${row.rule.id} el ${row.dueDate}: coincidencia manual sin enlace inequívoco. Se muestran ambos escenarios de flujo; omite la propuesta si es la misma obligación.`);
    }
    const next=shiftMonth(first,1);if(!next)break;first=next;
  }
  for(const o of intelligent(data).obligations) {
    if(o.cancelled||!o.dueDate||o.dueDate>to)continue;
    // Pending linked repayments are already represented by their bank movement, not again here.
    const unreserved=o.principalCents-reservedCents(o);
    if(unreserved>0)events.push({id:`personal:${o.id}`,originId:o.id,date:o.dueDate,concept:o.concept,source:'personal',certainty:'estimated',amountCents:unreserved*(o.direction==='receivable'?1:-1),overdue:o.dueDate<from});
  }
  for(const loan of data.loans) {
    const status=calculateLoanStatus(loan,data.transactions,from);
    if(status.saldoPendienteReal<=0)continue;
    if(!data.wallets.some(w=>w.name===loan.wallet&&liquidIds.has(w.id))){warnings.push(`Préstamo ${loan.id}: cartera habitual no líquida o no disponible; cuotas excluidas.`);continue;}
    const matches=economicTransactions(data.transactions).filter(t=>t.type==='GASTO'&&t.splitInfo?.accountingVersion!=='2.7'&&(t.loanId===loan.id||t.description.toLowerCase().includes(loan.name.toLowerCase())));
    if(matches.some(t=>t.loanId!==loan.id))warnings.push(`Préstamo ${loan.id}: el motor histórico también reconoce cuotas por nombre. Revisa sus enlaces; no se reescribe el historial.`);
    // Preserve the existing monthly schedule and principal approximation, including historic matching.
    let left=cents(status.saldoPendienteReal),month=from.slice(0,7);
    for(const tx of matches.filter(t=>!t.processed&&t.date<=to))left=Math.max(0,left-cents(tx.amount));
    while(month<=last&&left>0) {
      const due=dateAtDay(month,Number(loan.startDate.slice(8))),startIndex=Number(loan.startDate.slice(0,4))*12+Number(loan.startDate.slice(5,7)),index=Number(month.slice(0,4))*12+Number(month.slice(5));
      const linkedThisMonth=matches.some(t=>t.date.slice(0,7)===month);
      if(due>=from&&due<=to&&due>=loan.startDate&&index-startIndex<loan.totalTermMonths&&!linkedThisMonth) {
        const amount=Math.min(left,cents(loan.monthlyPayment));
        if(amount){events.push({id:`loan:${loan.id}@${due}`,originId:loan.id,date:due,concept:`Cuota estimada: ${loan.name}`,source:'loan',certainty:'estimated',amountCents:-amount,overdue:false});left-=amount;}
      }
      const next=shiftMonth(month,1);if(!next)break;month=next;
    }
  }
  const overview=obligationOverview(data,from),undatedReceivableCents=overview.filter(o=>o.direction==='receivable'&&!o.dueDate&&o.source!=='loan').reduce((n,o)=>safeCents(n+o.remainingCents),0),undatedPayableCents=overview.filter(o=>o.direction==='payable'&&!o.dueDate&&o.source!=='loan').reduce((n,o)=>safeCents(n+o.remainingCents),0);
  if(undatedReceivableCents||undatedPayableCents)warnings.push('Hay compromisos o repartos sin vencimiento: se muestran separados y no se inventa una fecha de cobro/pago.');
  if(events.some(e=>e.overdue))warnings.push('Los movimientos y compromisos vencidos se aplican al inicio del horizonte como supuesto pendiente de revisión.');
  if(data.transactions.some(t=>t.processed&&t.date>madridDate()))warnings.push('Hay movimientos futuros marcados tramitados en el historial: el saldo de partida conserva el cálculo bancario existente.');
  if(data.budgetPlans.length)warnings.push('La planificación presupuestaria es una previsión económica; no se suma como un flujo adicional de tesorería.');
  let balance=liquidCents,minimumCents=balance,incomeCents=0,expenseCents=0;
  events.sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
  const monthly=new Map<string,{month:string;incomeCents:number;expenseCents:number;projectedCents:number}>();
  for(const event of events) {
    balance=safeCents(balance+event.amountCents,false);minimumCents=Math.min(minimumCents,balance);event.projectedCents=balance;
    if(event.amountCents>0)incomeCents=safeCents(incomeCents+event.amountCents);else expenseCents=safeCents(expenseCents-event.amountCents);
    const month=event.date<from?from.slice(0,7):event.date.slice(0,7),row=monthly.get(month)??{month,incomeCents:0,expenseCents:0,projectedCents:balance};
    if(event.amountCents>0)row.incomeCents=safeCents(row.incomeCents+event.amountCents);else row.expenseCents=safeCents(row.expenseCents-event.amountCents);row.projectedCents=balance;monthly.set(month,row);
  }
  if(minimumCents<0)warnings.push('Posible déficit: el saldo proyectado resulta negativo en al menos una fecha.');
  return {from,to,liquidCents,incomeCents,expenseCents,projectedCents:balance,minimumCents,events,warnings:[...new Set(warnings)],undatedReceivableCents,undatedPayableCents,months:[...monthly.values()]};
}
