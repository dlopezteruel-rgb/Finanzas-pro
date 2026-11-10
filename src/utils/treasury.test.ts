import test from 'node:test';
import assert from 'node:assert/strict';
import { intelligentFixture as fixture,movementRule as rule,personalObligation as obligation } from '../../scripts/intelligentFixture';
import { treasuryProjection } from './treasury';
import { saveMovementRule,applyOccurrenceBatch,occurrencePreviews,occurrenceScope } from './recurringMovements';
import { saveObligation,settleObligation } from './personalObligations';
import { saveTransfer } from './transfers';
import { splitExactly,saveSettlement } from './sharedExpenses';
import { calculateWalletBalances } from './finance';

test('5D: 1000 + 1500 − 950 = 1550; regla, pendiente y presupuesto no duplican alquiler',()=>{
  let d=saveMovementRule(fixture(),rule({id:'salary',type:'INGRESO',amountCents:150000,day:15,code:'i'}));d=saveMovementRule(d,rule({day:20}));
  d.budgetPlans=[{monthYear:'2026-11',code:'g',type:'GASTO',plannedAmount:950}];
  const first='2026-11',row=occurrencePreviews(d,first).find(r=>r.ruleId==='rent')!;
  d=applyOccurrenceBatch(d,{first,last:first,action:'register',ids:[row.id],scope:occurrenceScope(d),acknowledgeCollisions:false});
  const before=JSON.stringify(d),p=treasuryProjection(d,'2026-11-10',30);
  assert.equal(p.liquidCents,100000);assert.equal(p.projectedCents,155000);assert.equal(p.events.length,2);assert.equal(p.events.filter(e=>e.source==='pending').length,1);assert.equal(JSON.stringify(d),before);
  d.transactions=d.transactions.map(t=>({...t,processed:true}));const next=treasuryProjection(d,'2026-11-10',30);assert.equal(next.liquidCents,5000);assert.equal(next.projectedCents,155000);assert.equal(next.events.some(e=>e.originId===row.id),false);
});
test('5D: compromiso con cobro parcial pendiente se proyecta una vez; sin vencimiento fuera',()=>{
  let d=saveObligation(fixture(),obligation());d=settleObligation(d,'personal',{id:'part',amountCents:5000,date:'2026-11-15',kind:'bank',processed:false,note:'',walletId:'bank'});
  d=saveObligation(d,obligation({id:'undated',dueDate:undefined,principalCents:90000}));
  const p=treasuryProjection(d,'2026-11-10');assert.equal(p.incomeCents,20000);assert.equal(p.events.length,2);assert.equal(p.projectedCents,120000);assert.equal(p.undatedReceivableCents,90000);
});
test('5D: cuota ya registrada, incluidos pendientes, suprime cuota estimada del mismo mes',()=>{
  const d=fixture();d.loans=[{id:'loan',name:'Crédito ficticio',entity:'Entidad ficticia',principal:5000,interestRate:2,totalTermMonths:24,startDate:'2026-01-20',monthlyPayment:100,wallet:'BANCO FICTICIO',code:'g'}];
  assert.equal(treasuryProjection(d,'2026-11-10').events.filter(e=>e.source==='loan').length,1);
  d.transactions=[{id:'installment',loanId:'loan',date:'2026-11-20',type:'GASTO',amount:100,wallet:'BANCO FICTICIO',code:'g',categoryName:'G',subcategoryName:'Cuota',description:'Cuota con ID',processed:false}];
  const p=treasuryProjection(d,'2026-11-10');assert.equal(p.events.length,1);assert.equal(p.events[0].source,'pending');assert.equal(p.expenseCents,10000);
});
test('5D: gasto compartido proyecta banco completo, reintegro solo banco, transferencia líquida neta cero',()=>{
  let d=fixture();d.wallets.push({id:'other',name:'OTRA FICTICIA',initialBalance:0,type:'CASH',color:'#fff'});
  d.transactions=saveTransfer(d.transactions,d.wallets,{fromWalletId:'bank',toWalletId:'other',amount:250,date:'2026-11-20',concept:'Traspaso ficticio',processed:false});
  d.transactions.push({id:'shared',date:'2026-11-15',type:'GASTO',amount:40,description:'Compartido ficticio',code:'g',categoryName:'G',subcategoryName:'Gasto',wallet:'BANCO FICTICIO',processed:false,splitInfo:splitExactly(40,d.contacts,'bank')});
  assert.equal(treasuryProjection(d,'2026-11-10').expenseCents-treasuryProjection(d,'2026-11-10').incomeCents,4000);
  d.transactions=d.transactions.map(t=>t.id==='shared'?{...t,processed:true}:t);
  d=saveSettlement(d,{operationId:'receipt',expenseId:'shared',contactId:'friend',amount:10,date:'2026-11-20',kind:'cash',processed:false,walletId:'bank'});
  const before=calculateWalletBalances(d.wallets,d.transactions),p=treasuryProjection(d,'2026-11-10');assert.equal(p.projectedCents,97000);assert.equal(p.undatedReceivableCents,2000);assert.deepEqual(calculateWalletBalances(d.wallets,d.transactions),before);
});
test('5D: déficit diario, vencidos, inversión fuera y horizonte/fechas extremas acotados',()=>{
  let d=saveMovementRule(fixture(),rule({amountCents:150000,day:15}));d.wallets.push({id:'invest',name:'INVERSIÓN FICTICIA',initialBalance:9999,type:'INVESTMENT',color:'#fff'});
  const p=treasuryProjection(d,'2026-11-10');assert.equal(p.liquidCents,100000);assert.equal(p.minimumCents,-50000);assert.ok(p.warnings.some(w=>w.includes('déficit')));
  d=saveObligation(d,obligation({direction:'payable',dueDate:'2026-02-01'}));assert.ok(treasuryProjection(d,'2026-11-10').events.some(e=>e.overdue));
  assert.throws(()=>treasuryProjection(d,'2026-02-30'));assert.throws(()=>treasuryProjection(d,'2026-01-01',10000));assert.equal(treasuryProjection(d,'9999-12-31').to,'9999-12-31');
  assert.ok(treasuryProjection(d,'2026-11-10',90).months.length>=3);
});
