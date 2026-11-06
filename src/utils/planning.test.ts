import test from 'node:test';
import assert from 'node:assert/strict';
import { makeBackup, parseBackup, parseSnapshot, recoveryCopies, DATA_KEY, RECOVERY_PREFIX, type FinanceData, validateBackup } from './backup';
import { FinanceStore, type ExclusiveWrite } from './financeStore';
import { annualPlanning, parsePlanningMoney, planningScope, planningStatus, planningTotals, savePlanning, formatPlanningCents, planningMoneyInput } from './planning';
import { clearScope } from './clearData';
import { calculateMonthlySummary, calculateWalletBalances } from './finance';
import { BUDGET_GROUPS } from '../constants/categories';
import { INITIAL_TRANSACTIONS, INITIAL_BUDGET_PLANS, INITIAL_CONTACTS, INITIAL_LOANS, INITIAL_WALLETS } from './seedData';
import { migrateSharedExpenses } from './sharedExpenses';
import { transferPair } from './transfers';

const base = (): FinanceData => structuredClone({ theme: 'dark', budgetGroups: BUDGET_GROUPS, budgetPlans: [], transactions: [], contacts: INITIAL_CONTACTS, loans: INITIAL_LOANS, wallets: INITIAL_WALLETS });
const month = '2028-02';
const lines = [{ type: 'INGRESO' as const, code: 'income', amountCents: 300000 }, { type: 'GASTO' as const, code: 'expense', amountCents: 220000 }];
const save = (d: FinanceData, approve = false, edits = lines, savings = 60000, deficit = false) => savePlanning(d, month, edits, savings, planningScope(d,month), approve, deficit);
class MemoryStorage {
  values = new Map<string,string>(); writes: string[] = []; fail: (key: string) => boolean = () => false; corruptRecovery = false;
  get length() { return this.values.size; }
  key(i:number) { return [...this.values.keys()][i] ?? null; }
  getItem(key:string) { return this.values.get(key) ?? null; }
  setItem(key:string,value:string) { if (this.fail(key)) throw new Error('Cuota simulada'); this.writes.push(key); this.values.set(key,this.corruptRecovery && key.startsWith(RECOVERY_PREFIX) ? '{}' : value); }
}
const exclusive: ExclusiveWrite = async write => write();
function store(d=base(), lock=exclusive) { const storage=new MemoryStorage(); storage.setItem(DATA_KEY,JSON.stringify(makeBackup(d))); storage.writes=[]; return { storage, store:new FinanceStore(storage,base(),lock) }; }

test('3A: entrada estricta decimal española, sin redondeos ni coerciones', () => {
  for (const [text,cents] of [['0',0],['15,5',1550],['15.50',1550],['3.000,00',300000],['0,01',1],[' 2200 ',220000]] as const) assert.equal(parsePlanningMoney(text),cents);
  for (const text of ['', ' ', '-1', '+1', 'NaN', 'Infinity', '1e3', '1.001', '1,001', '1,', '1.2.3', '1,000.00', '1 000', '€20', '9007199254740992']) assert.throws(()=>parsePlanningMoney(text),text);
});
test('3A: I/G/S y déficit en céntimos exactos', () => {
  assert.deepEqual(planningTotals(lines,60000),{income:300000,expenses:220000,savings:60000,available:240000,margin:20000,balance:80000});
  assert.equal(planningTotals(lines,90000).margin,-10000);
  assert.equal(planningTotals([{type:'INGRESO',code:'i',amountCents:10},{type:'GASTO',code:'g',amountCents:1}],2).margin,7);
  assert.throws(()=>planningTotals(lines,NaN));
  assert.throws(()=>planningTotals([{type:'INGRESO',code:'a',amountCents:Number.MAX_SAFE_INTEGER},{type:'INGRESO',code:'b',amountCents:1}],0));
});
test('3A: múltiples filas y ahorro se guardan juntos en una sola escritura activa, sin alterar contabilidad', async () => {
  const d=base(); d.transactions=structuredClone(INITIAL_TRANSACTIONS); d.budgetPlans=structuredClone(INITIAL_BUDGET_PLANS);
  const {storage,store:s}=store(d); const balances=calculateWalletBalances(d.wallets,d.transactions); const summary=calculateMonthlySummary('2026-10',d.transactions,d.budgetPlans);
  await s.mutate(current=>save(current));
  assert.equal(storage.writes.filter(k=>k===DATA_KEY).length,1);
  assert.equal(storage.writes[0].startsWith(RECOVERY_PREFIX),true);
  assert.equal(makeBackup(s.data).version,'2.9'); assert.equal(s.data.budgetPlans.filter(p=>p.monthYear===month).length,2);
  assert.deepEqual(s.data.transactions,d.transactions); assert.deepEqual(s.data.contacts,d.contacts); assert.deepEqual(s.data.loans,d.loans); assert.deepEqual(s.data.wallets,d.wallets);
  assert.deepEqual(calculateWalletBalances(s.data.wallets,s.data.transactions),balances); assert.deepEqual(calculateMonthlySummary('2026-10',s.data.transactions,s.data.budgetPlans),summary);
  assert.deepEqual(parseBackup(recoveryCopies(storage)[0].content).transactions,d.transactions);
});
test('3A: cargar, navegar meses futuros y resumen anual no escriben ni crean planes vacíos', () => {
  const {storage,store:s}=store(); const before=[...storage.values];
  for (const year of ['2028','2030']) { const rows=annualPlanning(s.data,year); assert.equal(rows.length,12); assert.ok(rows.every(r=>r.status==='Sin plan')); }
  assert.deepEqual([...storage.values],before); assert.equal(storage.writes.length,0);
  const d=save(base()); assert.equal(annualPlanning(d,'2028').filter(r=>r.status!=='Sin plan').length,1); assert.equal(planningStatus(d,month),'Borrador');
});
test('3A: aprobación, invalidación desde editor antiguo, vuelta al importe inicial y reaprobación', async () => {
  const {store:s}=store(); await s.mutate(d=>save(d,true));
  const snapshot=structuredClone(s.data.planningMonths![0].approval); assert.equal(planningStatus(s.data,month),'Aprobado');
  await s.update('budgetPlans',plans=>plans.map(p=>p.code==='expense'?{...p,plannedAmount:2300}:p));
  assert.equal(planningStatus(s.data,month),'Modificada desde la última aprobación'); assert.deepEqual(s.data.planningMonths![0].approval,snapshot);
  await s.update('budgetPlans',plans=>plans.map(p=>p.code==='expense'?{...p,plannedAmount:2200}:p));
  assert.equal(planningStatus(s.data,month),'Modificada desde la última aprobación');
  await s.mutate(d=>save(d,true)); assert.equal(planningStatus(s.data,month),'Aprobado'); assert.equal(s.data.planningMonths![0].approval!.number,2);
  assert.deepEqual(snapshot!.totals,planningTotals(lines,60000));
});
test('3A: aprobación deficitaria exige consentimiento explícito y conserva importes', async () => {
  const {store:s,storage}=store(); const before=[...storage.values];
  await assert.rejects(s.mutate(d=>save(d,true,lines,90000)),/expresamente/); assert.deepEqual([...storage.values],before);
  await s.mutate(d=>save(d,true,lines,90000,true)); assert.equal(s.data.planningMonths![0].approval!.totals.margin,-10000); assert.equal(s.data.planningMonths![0].savingsCents,90000);
});
for (const failure of ['recovery','verify','active','locks','invalid','scope','conflict'] as const) test(`3A: ${failure} rechaza aprobación íntegra, sin aplicar cambios parciales`,async()=>{
  const lock:ExclusiveWrite = failure==='locks' ? async()=>{throw new Error('Web Locks no disponible')} : exclusive;
  const {storage,store:s}=store(base(),lock); const before=storage.getItem(DATA_KEY), original=structuredClone(s.data);
  if (failure==='recovery') storage.fail=k=>k.startsWith(RECOVERY_PREFIX);
  if (failure==='active') storage.fail=k=>k===DATA_KEY;
  if (failure==='verify') storage.corruptRecovery=true;
  if (failure==='conflict') storage.setItem(DATA_KEY,JSON.stringify({...makeBackup(base()),revision:'other-tab'}));
  await assert.rejects(s.mutate(d=>failure==='invalid' ? save(d,true,[{...lines[0],amountCents:-1}]) : failure==='scope' ? savePlanning(d,month,lines,60000,'stale',true) : save(d,true)));
  assert.deepEqual(s.data,original); if(failure!=='conflict') assert.equal(storage.getItem(DATA_KEY),before);
});
test('3A: segunda pestaña y edición local obsoleta se rechazan antes de escribir',async()=>{
  const {storage,store:a}=store(); const b=new FinanceStore(storage,base(),exclusive); const scope=planningScope(a.data,month);
  await a.mutate(d=>save(d)); await assert.rejects(b.mutate(d=>save(d)),/Otra pestaña/);
  await assert.rejects(a.mutate(d=>savePlanning(d,month,lines,60000,scope)),/ha cambiado/);
});
test('3A: 2.9 round trip, snapshot y restauración a copia previa sin perder colecciones',async()=>{
  const {storage,store:s}=store(); const before=makeBackup(s.data); await s.mutate(d=>save(d,true));
  const exported=makeBackup(s.data); assert.deepEqual(parseBackup(JSON.stringify(exported)),exported); assert.deepEqual(parseSnapshot(storage.getItem(DATA_KEY)!).planningMonths,exported.planningMonths);
  await s.restore(parseBackup(recoveryCopies(storage)[0].content)); assert.equal(makeBackup(s.data).version,before.version); assert.equal(s.data.planningMonths,undefined);
  assert.ok(recoveryCopies(storage).some(c=>parseBackup(c.content).version==='2.9'));
});
test('3A: 2.5–2.8 conservan sus datos y no reciben metadatos durante lectura/exportación',()=>{
  const d=base(); const pair=transferPair(d.wallets,{fromWalletId:d.wallets[0].id,toWalletId:d.wallets[1].id,amount:10,date:'2026-10-01',concept:'Ficticio',processed:true});
  const variants=[makeBackup(d),{...makeBackup({...d,transactions:pair}),version:'2.6' as const},makeBackup(migrateSharedExpenses({...d,transactions:structuredClone(INITIAL_TRANSACTIONS)}))];
  const structured=variants[2].transactions.find(t=>t.splitInfo?.accountingVersion==='2.7');
  if(structured) { const v28=structuredClone(variants[2]);v28.transactions.find(t=>t.id===structured.id)!.splitInfo!.distribution={method:'amounts'}; variants.push(makeBackup(v28)); }
  assert.deepEqual(variants.map(v=>v.version),['2.5','2.6','2.7','2.8']);
  for(const v of variants) { const parsed=parseBackup(JSON.stringify(v)); assert.deepEqual(parsed,v); assert.equal(parsed.planningMonths,undefined); assert.equal(makeBackup(parsed).planningMonths,undefined); }
});
test('3A: rechaza 2.9 malformado, totales incoherentes y metadatos bajo etiquetas antiguas',()=>{
  const valid=makeBackup(save(base(),true));
  const mutations: ((d:any)=>void)[]=[d=>{delete d.planningMonths},d=>{d.planningMonths=[]},d=>{d.planningMonths.push(d.planningMonths[0])},d=>{d.planningMonths[0].savingsCents=1.5},d=>{d.planningMonths[0].extra=1},d=>{d.planningMonths[0].monthYear='2028-13'},d=>{d.planningMonths[0].revision=0},d=>{d.planningMonths[0].approval.revision=999},d=>{d.planningMonths[0].approval.totals.income++},d=>{d.planningMonths[0].approval.lines[0].amountCents++},d=>{d.planningMonths[0].approval.lines.push(d.planningMonths[0].approval.lines[0])},d=>{d.planningMonths[0].approval.approvedAt='2028-02-30T00:00:00.000Z'},d=>{d.budgetPlans[0].plannedAmount=1.234},d=>{d.planningMonths[0].approval.number=1.2}];
  for(const change of mutations) { const d=structuredClone(valid);change(d);assert.throws(()=>validateBackup(d)); }
  for(const version of ['2.5','2.6','2.7','2.8']) assert.throws(()=>validateBackup({...valid,version}));
});
test('3A: no permite reescribir ni eliminar la fotografía aprobada desde una mutación genérica',async()=>{
  const {store:s}=store();await s.mutate(d=>save(d,true));
  await assert.rejects(s.mutate(d=>({...d,planningMonths:d.planningMonths!.map(m=>({...m,approval:undefined}))})),/fotografía/);
  await assert.rejects(s.mutate(d=>({...d,planningMonths:[]})),/metadatos/);
});
test('3A: limpieza de presupuestos incluye objetivos, aprobaciones, alcance y copia previa',async()=>{
  const {store:s,storage}=store();await s.mutate(d=>save(d,true));
  const options={clearWalletBalances:false,clearAllWallets:false,clearTransactions:false,clearBudgets:true,clearDebts:false};
  const scope=clearScope(s.data,options);await s.mutate(d=>save(d,false,lines,61000));
  await assert.rejects(s.mutate({clear:options,scope}),/alcance/);
  await s.mutate({clear:options,scope:clearScope(s.data,options)});
  assert.equal(s.data.budgetPlans.length,0);assert.equal(s.data.planningMonths,undefined); assert.equal(makeBackup(s.data).version,'2.5');
  assert.ok(recoveryCopies(storage).some(c=>parseBackup(c.content).planningMonths?.[0].savingsCents===61000));
});

test('3A: el orden de claves JSON no cambia la validez de una fotografía',()=>{
  const backup=makeBackup(save(base(),true));
  backup.planningMonths![0].approval!.lines=backup.planningMonths![0].approval!.lines.map(l=>({amountCents:l.amountCents,code:l.code,type:l.type}));
  assert.deepEqual(parseBackup(JSON.stringify(backup)),backup);
});
test('3A: rechaza importes que perderían un céntimo al representarse en budgetPlans',()=>{
  assert.throws(()=>save(base(),false,[{type:'INGRESO',code:'i',amountCents:Number.MAX_SAFE_INTEGER}]),/exactamente/);
});
test('3A: activar 2.9 conserva JSON 2.8 con repartos, reintegros, liquidaciones, traspasos y préstamos',async()=>{
  let d=migrateSharedExpenses({...base(),transactions:structuredClone(INITIAL_TRANSACTIONS),budgetPlans:structuredClone(INITIAL_BUDGET_PLANS)});
  d={...d,transactions:[...d.transactions.map(t=>t.splitInfo?.accountingVersion==='2.7'?{...t,splitInfo:{...t.splitInfo,distribution:{method:'amounts' as const}}}:t),...transferPair(d.wallets,{fromWalletId:d.wallets[0].id,toWalletId:d.wallets[1].id,amount:10,date:'2026-10-01',concept:'Traspaso ficticio',processed:true})]};
  assert.equal(makeBackup(d).version,'2.8');const {store:s,storage}=store(d);await s.mutate(current=>save(current,true));
  const roundTrip=parseBackup(JSON.stringify(makeBackup(s.data)));assert.equal(roundTrip.version,'2.9');
  for(const key of ['transactions','wallets','contacts','loans','budgetGroups'] as const)assert.deepEqual(roundTrip[key],d[key]);
  const prior=parseBackup(recoveryCopies(storage)[0].content);assert.equal(prior.version,'2.8');await s.restore(prior);
  for(const key of ['transactions','wallets','contacts','loans','budgetGroups','budgetPlans'] as const)assert.deepEqual(s.data[key],d[key]);
});

test('3A: formato monetario exacto incluso en el límite seguro de céntimos',()=>{
  assert.equal(formatPlanningCents(Number.MAX_SAFE_INTEGER),'90.071.992.547.409,91 €');
  assert.equal(formatPlanningCents(-Number.MAX_SAFE_INTEGER),'-90.071.992.547.409,91 €');
  assert.equal(planningMoneyInput(Number.MAX_SAFE_INTEGER),'90071992547409.91');
  assert.equal(parsePlanningMoney(planningMoneyInput(Number.MAX_SAFE_INTEGER)),Number.MAX_SAFE_INTEGER);
});
