import test from 'node:test';
import assert from 'node:assert/strict';
import { intelligentFixture as fixture,movementRule as rule,personalObligation as obligation } from '../../scripts/intelligentFixture';
import { applyOccurrenceBatch,occurrencePreviews,occurrenceScope,saveMovementRule,removeMovementRule,ruleDate,nextRuleDate } from './recurringMovements';
import { saveObligation,settleObligation,remainingCents,toggleObligationSettlement,obligationOverview } from './personalObligations';
import { FinanceStore,type ExclusiveWrite } from './financeStore';
import { DATA_KEY,RECOVERY_PREFIX,makeBackup,parseBackup,serializeSnapshot,type FinanceData } from './backup';
import { calculateWalletBalances,calculateMonthlySummary } from './finance';
import { economicTransactions } from './transfers';
import { assertIntelligentTransition } from './intelligentValidation';
import { savePlanning,planningScope } from './planning';
import { deletionReport } from './deletion';

class MemoryStorage {
  values=new Map<string,string>(); writes:string[]=[];fail='';badRecovery=false;
  get length(){return this.values.size} key(i:number){return [...this.values.keys()][i]??null}
  getItem(k:string){const v=this.values.get(k)??null;return this.badRecovery&&k.startsWith(RECOVERY_PREFIX)?'corrupt':v}
  setItem(k:string,v:string){if(k===this.fail||this.fail==='recovery'&&k.startsWith(RECOVERY_PREFIX))throw new Error('QuotaExceededError');this.writes.push(k);this.values.set(k,v)}
}
const setup=(data=fixture(),lock:ExclusiveWrite=async fn=>fn())=>{const storage=new MemoryStorage();storage.setItem(DATA_KEY,serializeSnapshot(data));return {storage,store:new FinanceStore(storage,fixture(),lock)}};
const batch=(data:FinanceData,first='2028-01',last='2028-03',action:'register'|'skip'='register')=>({first,last,action,scope:occurrenceScope(data),ids:occurrencePreviews(data,first,last).map(o=>o.id),acknowledgeCollisions:false});

test('5B: regla y vistas previas no crean transacciones; fechas inclusivas y anclaje sin deriva',()=>{
  const d=saveMovementRule(fixture(),rule()),original=JSON.stringify(d);
  assert.equal(ruleDate(rule(),'2028-02'),'2028-02-29');assert.equal(ruleDate(rule(),'2029-02'),'2029-02-28');assert.equal(ruleDate(rule(),'2100-02'),'2100-02-28');
  assert.equal(ruleDate(rule({startDate:'2028-01-31',frequency:'quarterly'}),'2028-04'),'2028-04-30');assert.equal(ruleDate(rule({frequency:'yearly'}),'2028-02'),null);
  assert.equal(ruleDate(rule({startDate:'2028-01-31',day:1}),'2028-01'),null);
  assert.equal(ruleDate(rule({endDate:'2028-02-29'}),'2028-02'),'2028-02-29');assert.equal(ruleDate(rule({endDate:'2028-02-28'}),'2028-02'),null);
  assert.equal(nextRuleDate(rule({startDate:'9999-12-31'}),'9999-12-01'),'9999-12-31');
  assert.equal(occurrencePreviews(d,'2028-01','2028-03').length,3);assert.equal(JSON.stringify(d),original);assert.equal(d.transactions.length,0);
  assert.throws(()=>occurrencePreviews(d,'0001-01','9999-12'),/12 meses/);
});
test('5B: lote atómico idempotente tras recarga, JSON, pausa, baja y edición de ocurrencia',async()=>{
  const {store,storage}=setup();await store.mutate(d=>saveMovementRule(d,rule()));assert.equal(makeBackup(store.data).version,'3.1');
  const oldPlans=structuredClone(store.data.budgetPlans);await store.mutate(d=>applyOccurrenceBatch(d,batch(d)));
  assert.equal(store.data.transactions.length,3);assert.ok(store.data.transactions.every(t=>!t.processed));assert.equal(calculateWalletBalances(store.data.wallets,store.data.transactions)['BANCO FICTICIO'],1000);
  const writes=storage.writes.length;await store.mutate(d=>applyOccurrenceBatch(d,batch(d)));assert.equal(storage.writes.length,writes);
  const restored=parseBackup(JSON.stringify(makeBackup(store.data))),reloaded=new FinanceStore(storage,fixture(),async fn=>fn());assert.equal(restored.intelligentFinance!.occurrences.length,3);
  await reloaded.mutate(d=>applyOccurrenceBatch(d,batch(d)));assert.equal(reloaded.data.transactions.length,3);
  await reloaded.update('transactions',ts=>ts.map((t,i)=>i===0?{...t,amount:42,description:'Solo esta ocurrencia'}:t));assert.equal(reloaded.data.intelligentFinance!.recurringRules[0].amountCents,95000);
  await reloaded.mutate(d=>removeMovementRule(d,'rent'));assert.equal(reloaded.data.transactions.length,3);assert.equal(occurrencePreviews(reloaded.data,'2028-01','2028-03').length,3);assert.deepEqual(reloaded.data.budgetPlans,oldPlans);
  assert.ok(deletionReport(reloaded.data,{kind:'wallet',id:'bank'}).blockers.length);
  await assert.rejects(reloaded.update('transactions',ts=>ts.slice(1)),/origen|identidad|vinculad/);
});
test('5B: omisión persistente y coincidencia manual nunca fusionada',()=>{
  let d=saveMovementRule(fixture(),rule({day:15}));d.transactions=[{id:'manual',date:'2028-01-15',amount:950,type:'GASTO',code:'g',categoryName:'G',subcategoryName:'Alquiler',description:'Manual parecido',wallet:'BANCO FICTICIO',processed:false}];
  assert.deepEqual(occurrencePreviews(d,'2028-01')[0].collisions,['manual']);assert.throws(()=>applyOccurrenceBatch(d,batch(d,'2028-01','2028-01')),/coincidencia/);
  const skipped=applyOccurrenceBatch(d,batch(d,'2028-01','2028-01','skip'));assert.equal(skipped.transactions.length,1);assert.equal(occurrencePreviews(skipped,'2028-01')[0].status,'skipped');
  const separate=applyOccurrenceBatch(d,{...batch(d,'2028-01','2028-01'),acknowledgeCollisions:true});assert.equal(separate.transactions.length,2);assert.equal(separate.transactions[1].id,'manual');
});
for(const failure of ['recovery','verify','active'])test(`5: migración 3.1 con fallo ${failure} conserva la clave activa y el estado`,async()=>{
  const {storage,store}=setup(),before=storage.getItem(DATA_KEY);if(failure==='verify')storage.badRecovery=true;else storage.fail=failure==='active'?DATA_KEY:'recovery';
  await assert.rejects(store.mutate(d=>saveMovementRule(d,rule())));assert.equal(storage.getItem(DATA_KEY),before);assert.equal(store.data.intelligentFinance,undefined);
  storage.fail='';storage.badRecovery=false;await store.mutate(d=>saveMovementRule(d,rule()));
  const copy=[...storage.values].find(([k])=>k.startsWith(RECOVERY_PREFIX)&&storage.values.get(k)!=='corrupt');assert.ok(copy);assert.equal(parseBackup(copy[1]).version,'2.5');assert.equal(makeBackup(store.data).version,'3.1');
});
test('5: conflictos entre pestañas y vistas previas obsoletas no aplican ni duplican',async()=>{
  const {storage,store}=setup();const other=new FinanceStore(storage,fixture(),async fn=>fn());await store.mutate(d=>saveMovementRule(d,rule()));await assert.rejects(other.mutate(d=>saveMovementRule(d,rule())),/Otra pestaña/);
  const old=batch(store.data);await store.update('theme','light'); // Preview scope excludes display-only preferences.
  await store.mutate(d=>applyOccurrenceBatch(d,old));assert.equal(store.data.transactions.length,3);
  const stale=batch(store.data);await store.mutate(d=>saveMovementRule(d,rule({amountCents:90000})));await assert.rejects(store.mutate(d=>applyOccurrenceBatch(d,stale)),/vista previa/);
});
test('5C: cobros y pagos parciales exactos, reservas, principal separado de ingreso/gasto',async()=>{
  const {store}=setup();await store.mutate(d=>saveObligation(d,obligation()));const banks=calculateWalletBalances(store.data.wallets,store.data.transactions);
  const adjustment={id:'first',amountCents:5000,date:'2026-01-15',kind:'adjustment' as const,processed:true,note:'Acuerdo sin banco ficticio'};
  await store.mutate(d=>settleObligation(d,'personal',adjustment));await store.mutate(d=>settleObligation(d,'personal',adjustment));assert.equal(remainingCents(store.data.intelligentFinance!.obligations[0]),15000);assert.deepEqual(calculateWalletBalances(store.data.wallets,store.data.transactions),banks);
  await store.mutate(d=>settleObligation(d,'personal',{id:'bank-pay',amountCents:7000,date:'2026-02-01',kind:'bank',walletId:'bank',processed:false,note:''}));
  assert.equal(remainingCents(store.data.intelligentFinance!.obligations[0]),15000);assert.equal(store.data.transactions.length,1);
  await assert.rejects(store.mutate(d=>settleObligation(d,'personal',{...adjustment,id:'too-much',amountCents:9000})),/supera/);
  await store.mutate(d=>toggleObligationSettlement(d,'obligation:bank-pay'));assert.equal(remainingCents(store.data.intelligentFinance!.obligations[0]),8000);assert.equal(economicTransactions(store.data.transactions).length,0);assert.equal(calculateWalletBalances(store.data.wallets,store.data.transactions)['BANCO FICTICIO'],1070);
  assert.equal(calculateMonthlySummary('2026-02',store.data.transactions,[],store.data.budgetGroups.flatMap(g=>g.partidas)).ingresosReales,0);
  await assert.rejects(store.mutate(d=>saveObligation(d,{...d.intelligentFinance!.obligations[0],principalCents:100})),/superiores|historial/);
  await assert.rejects(store.update('contacts',[]),/compromiso|Compromiso/);assert.equal(obligationOverview(store.data,'2026-12-01')[0].overdueCents,8000);
});
test('5: validación estricta 3.1, enlaces huérfanos y transiciones protegidas',()=>{
  let d=saveMovementRule(fixture(),rule());d=applyOccurrenceBatch(d,batch(d,'2028-01','2028-01'));const valid=makeBackup(d);
  for(const corrupt of [(b:any)=>b.intelligentFinance.occurrences.push(b.intelligentFinance.occurrences[0]),(b:any)=>b.transactions[0].recurrence.ruleId='missing',(b:any)=>b.intelligentFinance.extra=true,(b:any)=>b.intelligentFinance.recurringRules[0].startDate='2026-02-30',(b:any)=>b.version='3.0',(b:any)=>b.intelligentFinance.recurringRules[0].amountCents=.1]){const b=structuredClone(valid);corrupt(b);assert.throws(()=>parseBackup(JSON.stringify(b)));}
  const unlinked={...d,transactions:d.transactions.map(t=>({...t,recurrence:undefined}))};assert.throws(()=>assertIntelligentTransition(d,unlinked),/origen/);
});
test('5: aprobar planificación 2.9 y ampliar 3.1 conserva la fotografía exacta',async()=>{
  let d=fixture();d=savePlanning(d,'2026-10',[{type:'INGRESO',code:'i',amountCents:300000},{type:'GASTO',code:'g',amountCents:95000}],60000,planningScope(d,'2026-10'),true);
  assert.equal(makeBackup(d).version,'2.9');const photo=structuredClone(d.planningMonths);const {store}=setup(d);await store.mutate(d=>saveMovementRule(d,rule()));assert.deepEqual(store.data.planningMonths,photo);assert.equal(makeBackup(store.data).version,'3.1');
});
