import test from 'node:test';
import assert from 'node:assert/strict';
import { economicChartData, planningChartData, walletChartData, rangeBuckets, accountingChartWarnings, type EconomicFilter } from './chartData';
import { chartFixture } from '../../scripts/chartFixture';
import { makeBackup, parseBackup } from './backup';
import { remainingDebt } from './sharedExpenses';
import { savePlanning, planningScope } from './planning';
import { calculateMonthlySummary, calculateWalletBalances } from './finance';

const filter:EconomicFilter={from:'2026-10-01',to:'2026-10-31',granularity:'month',type:'all',family:'all',processed:true};
test('gráficos: parte propia 15, reintegro 10 y compensación 5 sin ingreso económico',()=>{
  const d=chartFixture(),before=JSON.stringify(d),result=economicChartData(d,filter);
  assert.deepEqual(result.periods[0].values,{income:3000,expenses:15,balance:2985});
  assert.equal(result.distribution[0].values.amount,15);assert.equal(result.distribution[0].values.percent,100);
  assert.equal(result.transactions.some(t=>t.reimbursement||t.transfer),false);
  assert.equal(remainingDebt(d.transactions.find(t=>t.id==='shared')!,'ana'),0);
  assert.equal(JSON.stringify(d),before);parseBackup(JSON.stringify(makeBackup(d)));
});
test('gráficos: transferencias solo cambian saldos individuales; pendientes separados',()=>{
  const d=chartFixture(),b=walletChartData(d,filter,'all');
  assert.equal(b.current.find(r=>r.id==='BANCO')!.values.balance,3925);
  assert.equal(b.current.find(r=>r.id==='OTRA')!.values.balance,125);
  assert.equal(b.current.find(r=>r.id==='NEGATIVA')!.values.balance,-50);
  assert.equal(b.current.find(r=>r.id==='SIN MOVIMIENTOS')!.values.balance,0);
  assert.equal(b.total,4000);assert.equal(b.changes[0].values.total,2950);
  assert.equal(b.changes[0].values['wallet:BANCO'],2925);
  const pending=economicChartData(d,{...filter,processed:false});assert.equal(pending.periods[0].values.expenses,999);assert.equal(pending.periods[0].values.income,0);
  assert.equal(walletChartData(d,filter,'BANCO').total,calculateWalletBalances(d.wallets,d.transactions).BANCO);
});
test('gráficos: clasificación global antes de filtrar por familia, tipo y rango',()=>{
  const d=chartFixture();
  assert.equal(economicChartData(d,{...filter,from:'2026-10-04',to:'2026-10-06'}).hasData,false);
  assert.equal(economicChartData(d,{...filter,family:'GASTO:G'}).periods[0].values.expenses,15);
  assert.equal(economicChartData(d,{...filter,type:'INGRESO'}).distribution.length,0);
  assert.equal(economicChartData(d,{...filter,granularity:'week'}).periods.reduce((n,r)=>n+r.values.expenses!,0),15);
  const buckets=rangeBuckets({...filter,from:'2026-10-04',to:'2026-10-13',granularity:'week'});assert.equal(buckets[0].from,'2026-10-04');assert.equal(buckets.at(-1)!.to,'2026-10-13');
});
test('gráficos: rangos vacíos/futuros, inválidos y excesivos explícitos',()=>{
  const d=chartFixture(),r=economicChartData(d,{...filter,from:'2030-01-01',to:'2030-01-31'});assert.equal(r.hasData,false);assert.equal(r.periods.length,1);assert.equal(r.distribution.length,0);
  for(const range of [{...filter,from:''},{...filter,from:'2026-02-30'},{...filter,to:'2025-01-01'},{...filter,from:'2000-01-01'}])assert.throws(()=>economicChartData(d,range));
});
test('gráficos: huérfanos e históricos conservan las reglas vigentes con aviso',()=>{
  const d=chartFixture();d.transactions.push({...d.transactions.find(t=>t.id==='income')!,id:'orphan',code:'unknown',amount:7});
  const r=economicChartData(d,filter);assert.equal(r.periods[0].values.income,3007);
  const shared=d.transactions.find(t=>t.id==='shared')!;d.transactions=d.transactions.filter(t=>!t.reimbursement);delete shared.splitInfo!.accountingVersion;delete shared.splitInfo!.settlements;delete shared.splitInfo!.distribution;delete shared.splitInfo!.walletId;
  assert.ok(accountingChartWarnings(d).some(w=>w.includes('Históricos')||w.includes('históricos')));
  assert.equal(economicChartData(d,filter).periods[0].values.expenses,60);
});
test('gráficos: plan 2200 / ejecutado 1900, objetivo 600 y fotografía diferente del actual',()=>{
  let d=chartFixture();d.transactions=[d.transactions.find(t=>t.id==='income')!,{...d.transactions.find(t=>t.id==='pending')!,amount:1900,processed:true}];
  d=savePlanning(d,'2026-10',[{type:'INGRESO',code:'i',amountCents:300000},{type:'GASTO',code:'g',amountCents:220000}],60000,planningScope(d,'2026-10'),true);
  const before=JSON.stringify(d),r=planningChartData(d,'2026-10','family');
  assert.equal(r.status,'Aprobado');assert.deepEqual(r.comparison.find(r=>r.id==='GASTO:G')!.values,{planned:2200,executed:1900,approved:2200});
  assert.equal(r.annual[9].values.savings,600);assert.equal(r.annual[9].values.realBalance,1100);
  assert.equal(r.annual[0].values.income,null);assert.equal(r.annual[0].note,'Sin plan');assert.equal(r.annual.length,12);
  assert.equal(JSON.stringify(d),before);
  d=savePlanning(d,'2026-10',[{type:'GASTO',code:'g',amountCents:230000}],60000,planningScope(d,'2026-10'));
  const modified=planningChartData(d,'2026-10','partida');assert.match(modified.status,/Modificada/);assert.equal(modified.comparison.find(r=>r.id==='GASTO:g')!.values.approved,2200);assert.equal(modified.comparison.find(r=>r.id==='GASTO:g')!.values.planned,2300);
});
test('gráficos: presupuestos futuros sin plan son huecos; aprobar no altera ejecución ni saldos',()=>{
  const d=chartFixture(),balances=calculateWalletBalances(d.wallets,d.transactions),econ=economicChartData(d,filter);
  const approved=savePlanning(d,'2026-10',[],0,planningScope(d,'2026-10'),true);
  assert.deepEqual(economicChartData(approved,filter),econ);assert.deepEqual(calculateWalletBalances(approved.wallets,approved.transactions),balances);
  const future=planningChartData(d,'2030-01','partida');assert.equal(future.status,'Sin plan');assert.ok(future.annual.every(r=>r.values.income===null&&r.values.expenses===null&&r.values.savings===null));assert.ok(future.comparison.every(r=>r.values.planned===null&&r.values.approved===null));
});
test('gráficos: aprobación huérfana permanece visible sin crear plan editable',()=>{
  let d=chartFixture();d=savePlanning(d,'2026-10',[{code:'old',type:'GASTO',amountCents:1000}],0,planningScope(d,'2026-10'),true,true);
  d={...d,budgetPlans:[],planningMonths:d.planningMonths!.map(m=>({...m,revision:m.revision+1}))};
  const r=planningChartData(d,'2026-10','family');assert.equal(r.comparison.find(r=>r.id==='snapshot:GASTO')!.values.approved,10);
  assert.equal(planningChartData(d,'2026-10','partida').comparison.find(r=>r.id==='GASTO:old')!.values.approved,10);
});
test('gráficos: variaciones bancarias no afirman saldos históricos y conservan todos los movimientos relevantes',()=>{
  const d=chartFixture(),before=JSON.stringify(d),result=walletChartData(d,{...filter,granularity:'week'},'all');
  assert.match(result.limitation,/no tienen fecha/);assert.match(result.limitation,/no es un saldo/);
  assert.equal(result.changes.at(-1)!.values.total,2950);assert.ok(result.changes.flatMap(r=>r.ids!).includes('transfer-pair-in'));assert.ok(result.changes.flatMap(r=>r.ids!).includes('settlement-cash')||result.changes.flatMap(r=>r.ids!).some(id=>d.transactions.find(t=>t.id===id)?.reimbursement));assert.equal(JSON.stringify(d),before);
});
test('gráficos: 10000 movimientos se agregan sin perder céntimos ni alterar los datos',()=>{
  const d=chartFixture(),template=d.transactions.find(t=>t.id==='income')!;d.transactions=Array.from({length:10000},(_,i)=>({...template,id:`bulk-${i}`,amount:.01}));
  const r=economicChartData(d,filter);assert.equal(r.transactions.length,10000);assert.equal(r.periods[0].values.income,100);
  const summary=calculateMonthlySummary('2026-10',d.transactions,d.budgetPlans,d.budgetGroups.flatMap(g=>g.partidas));assert.equal(r.periods[0].values.income,summary.ingresosReales);
});
