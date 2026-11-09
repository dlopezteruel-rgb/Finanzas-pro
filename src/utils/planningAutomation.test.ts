import test from 'node:test';
import assert from 'node:assert/strict';
import { applyAutomationPreview,previewAutomation,carryObservation,carryIsStale,automationScope } from './planningAutomation';
import { emptyAutomation,effectiveBudgetPlans,planningBudgetRows } from './planningBasis';
import { DATA_KEY,makeBackup,parseBackup,parseSnapshot,recoveryCopies,RECOVERY_PREFIX,type FinanceData } from './backup';
import { FinanceStore,type ExclusiveWrite } from './financeStore';
import { savePlanning,planningScope,annualPlanning,planningStatus } from './planning';
import { planningChartData,economicChartData,walletChartData } from './chartData';
import { clearScope,clearImpact } from './clearData';
import { calculateWalletBalances } from './finance';
import { chartFixture } from '../../scripts/chartFixture';
import { type AutomationRequest } from './planningAutomation';
import type { PlanningRule } from '../types/finance';

const future='2028-02';
const lines=[{type:'INGRESO' as const,code:'i',amountCents:300000},{type:'GASTO' as const,code:'g',amountCents:220000}];
const base=()=>savePlanning(chartFixture(),future,lines,60000,planningScope(chartFixture(),future));
class MemoryStorage {
  values=new Map<string,string>();writes:string[]=[];fail:(key:string)=>boolean=()=>false;corrupt=false;
  get length(){return this.values.size} key(i:number){return [...this.values.keys()][i] ?? null} getItem(k:string){return this.values.get(k) ?? null}
  setItem(k:string,v:string){if(this.fail(k))throw new Error('Cuota ficticia');this.writes.push(k);this.values.set(k,this.corrupt&&k.startsWith(RECOVERY_PREFIX)?'{}':v)}
}
const lock:ExclusiveWrite=async write=>write();
function setup(data=base(),exclusive=lock){const storage=new MemoryStorage();storage.setItem(DATA_KEY,JSON.stringify(makeBackup(data)));storage.writes=[];return {storage,store:new FinanceStore(storage,data,exclusive)}}
const copy=(overwrite:string[]=[]):Extract<AutomationRequest,{kind:'copy'}>=>({kind:'copy',source:future,first:'2028-03',last:'2028-04',keys:['INGRESO:i','GASTO:g'],savings:true,overwrite});
async function apply(store:FinanceStore,request:AutomationRequest){const preview=previewAutomation(store.data,request);await store.mutate(d=>applyAutomationPreview(d,preview));return preview}
const rule=(id:string,target:PlanningRule['target'],amount:number,frequency:PlanningRule['frequency']='monthly',code?:string):PlanningRule=>({id,name:`Regla ficticia ${id}`,target,...(code?{code}:{}),amountCents:amount,frequency,startMonth:'2028-01',endMonth:'2028-12',active:true});
function pastData(){const d:FinanceData=JSON.parse(JSON.stringify(chartFixture()).replaceAll('2026-10','2026-09'));d.transactions=d.transactions.filter(t=>t.id!=='pending');return {...d,budgetPlans:[{monthYear:'2026-09',type:'GASTO' as const,code:'g',plannedAmount:200},{monthYear:'2026-10',type:'GASTO' as const,code:'g',plannedAmount:200}]}}

test('3B: copia de febrero a marzo/abril es atómica, con ahorro y sin copiar aprobación',async()=>{
  const initial=savePlanning(base(),future,lines,60000,planningScope(base(),future),true),{store,storage}=setup(initial),before=structuredClone(store.data);
  const preview=previewAutomation(store.data,copy());assert.equal(preview.rows.filter(r=>r.status==='apply').length,6);assert.equal(storage.writes.length,0);
  await store.mutate(d=>applyAutomationPreview(d,preview));assert.equal(storage.writes.filter(k=>k===DATA_KEY).length,1);assert.equal(makeBackup(store.data).version,'3.0');
  for(const month of ['2028-03','2028-04']){const r=annualPlanning(store.data,'2028').find(m=>m.monthYear===month)!;assert.equal(r.totals.income,300000);assert.equal(r.totals.expenses,220000);assert.equal(r.totals.savings,60000);assert.equal(r.totals.margin,20000);assert.equal(r.status,'Borrador')}
  assert.deepEqual(store.data.planningMonths?.find(m=>m.monthYear===future),before.planningMonths?.find(m=>m.monthYear===future));assert.deepEqual(store.data.transactions,before.transactions);assert.deepEqual(store.data.wallets,before.wallets);
  assert.equal(parseBackup(recoveryCopies(storage)[0].content).version,'2.9');
  const active=storage.getItem(DATA_KEY),writes=storage.writes.length;await apply(store,copy());assert.equal(storage.getItem(DATA_KEY),active);assert.equal(storage.writes.length,writes);
});
test('3B: copia opcional de ahorro, históricos, cruce diciembre y límite 12 meses',async()=>{
  let d=base();d=savePlanning(d,'2028-12',[{type:'GASTO',code:'orphan',amountCents:1500}],0,planningScope(d,'2028-12'));
  const {store}=setup(d);await apply(store,{kind:'copy',source:'2028-12',first:'2029-01',last:'2029-01',keys:['GASTO:orphan'],savings:false,overwrite:[]});
  assert.equal(store.data.budgetPlans.find(p=>p.monthYear==='2029-01')?.plannedAmount,15);assert.equal(store.data.planningAutomation?.origins[0].sourceMonth,'2028-12');
  assert.throws(()=>previewAutomation(d,{...copy(),kind:'copy',last:'2029-03'}),/12 meses/);
  assert.throws(()=>previewAutomation(d,{...copy(),kind:'copy',keys:['GASTO:missing']}),/no existe/);
});
test('3B: borrar/cancelar vista previa no escribe; borrador destino se omite y mezcla solo con permiso individual',async()=>{
  let d=base();d=savePlanning(d,'2028-03',[{type:'GASTO',code:'g',amountCents:100},{type:'INGRESO',code:'historical',amountCents:5500}],500,planningScope(d,'2028-03'));
  const {store,storage}=setup(d);const before=[...storage.values],p=previewAutomation(d,copy());assert.equal(p.rows.filter(r=>r.month==='2028-03').every(r=>r.status==='skip'),true);assert.deepEqual([...storage.values],before);
  await apply(store,copy(['2028-03']));assert.equal(store.data.budgetPlans.find(p=>p.monthYear==='2028-03'&&p.type==='GASTO')?.plannedAmount,2200);assert.equal(store.data.budgetPlans.find(p=>p.monthYear==='2028-03'&&p.code==='historical')?.plannedAmount,55);assert.deepEqual(annualPlanning(store.data,'2028').find(m=>m.monthYear==='2028-03')!.origins.sort(),['copy','manual']);
});
for(const modified of [false,true])test(`3B: bloqueo absoluto de lote en mes ${modified?'modificado':'aprobado'}`,async()=>{
  let d=base();d=savePlanning(d,'2028-03',lines,60000,planningScope(d,'2028-03'),true);if(modified)d=savePlanning(d,'2028-03',lines,61000,planningScope(d,'2028-03'));
  const {store}=setup(d),photo=structuredClone(d.planningMonths?.find(m=>m.monthYear==='2028-03'));
  const p=await apply(store,copy(['2028-03']));assert.ok(p.rows.filter(r=>r.month==='2028-03').every(r=>r.status==='blocked'));assert.deepEqual(store.data.planningMonths?.find(m=>m.monthYear==='2028-03'),photo);
});
test('3B: reglas mensual/trimestral/anual, calendario, pausa/edición/borrado sin presupuestos automáticos',async()=>{
  const {store,storage}=setup();const plans=structuredClone(store.data.budgetPlans),bank=structuredClone(store.data.transactions);
  for(const r of [rule('salary','INGRESO',300000,'monthly','i'),rule('rent','GASTO',100000,'quarterly','g'),rule('annual','GASTO',36000,'yearly','insurance'),rule('goal','SAVINGS',60000)])await apply(store,{kind:'rule',rule:r});
  assert.deepEqual(store.data.budgetPlans,plans);assert.deepEqual(store.data.transactions,bank);
  const p=await apply(store,{kind:'recurrences',first:'2028-01',last:'2028-12',overwrite:[]});
  assert.equal(p.rows.filter(r=>r.origin?.ruleName?.includes('salary')).length,12);assert.equal(p.rows.filter(r=>r.origin?.ruleName?.includes('rent')).length,4);assert.equal(p.rows.filter(r=>r.origin?.ruleName?.includes('annual')).length,1);
  const before=storage.getItem(DATA_KEY),writes=storage.writes.length;await apply(store,{kind:'recurrences',first:'2028-01',last:'2028-12',overwrite:[]});assert.equal(storage.getItem(DATA_KEY),before);assert.equal(storage.writes.length,writes);
  const salary=store.data.planningAutomation!.rules[0];await apply(store,{kind:'rule',rule:{...salary,active:false}});const created=structuredClone(store.data.budgetPlans);assert.equal(previewAutomation(store.data,{kind:'recurrences',first:'2029-01',last:'2029-12',overwrite:[]}).rows.length,0);
  await apply(store,{kind:'deleteRule',id:salary.id});assert.deepEqual(store.data.budgetPlans,created);assert.ok(store.data.planningAutomation!.origins.some(o=>o.kind==='rule'&&o.ruleName===salary.name));
});
test('3B: reglas coincidentes no duplican partida y exigen elegir una propuesta',async()=>{
  const {store}=setup();for(const r of [rule('a','GASTO',100,'monthly','g'),rule('b','GASTO',200,'monthly','g')])await apply(store,{kind:'rule',rule:r});
  const p=previewAutomation(store.data,{kind:'recurrences',first:'2028-06',last:'2028-06',overwrite:[]});assert.ok(p.rows.every(r=>r.status==='skip'));
  await apply(store,{kind:'recurrences',first:'2028-06',last:'2028-06',overwrite:[p.rows[1].id]});assert.equal(store.data.budgetPlans.filter(p=>p.monthYear==='2028-06'&&p.code==='g').length,1);assert.equal(store.data.budgetPlans.find(p=>p.monthYear==='2028-06')!.plannedAmount,2);
});
test('3B: excepción manual y ahorro existentes se protegen; sobrescritura individual explícita',async()=>{
  const {store}=setup();await apply(store,{kind:'rule',rule:rule('a','GASTO',100,'monthly','g')});await apply(store,{kind:'rule',rule:rule('s','SAVINGS',100)});
  let p=previewAutomation(store.data,{kind:'recurrences',first:future,last:future,overwrite:[]});assert.ok(p.rows.every(r=>r.status==='skip'));
  await apply(store,{kind:'recurrences',first:future,last:future,overwrite:[p.rows.find(r=>r.target==='GASTO')!.id]});assert.equal(store.data.planningMonths!.find(m=>m.monthYear===future)!.savingsCents,60000);
  await store.update('budgetPlans',plans=>plans.map(p=>p.monthYear===future&&p.code==='g'?{...p,plannedAmount:7}:p));assert.equal(store.data.planningAutomation!.origins.find(o=>o.monthYear===future&&o.code==='g')!.kind,'manual');
});
test('3B: remanente 200−150=50; base 200+50=250, sin ingreso/saldo ni cascada',async()=>{
  const d=pastData();d.transactions=[{...d.transactions.find(t=>t.id==='shared')!,amount:600,splitInfo:{...d.transactions.find(t=>t.id==='shared')!.splitInfo!,myShare:150,totalOwedToMe:450,participants:d.contacts.map(c=>({contactId:c.id,contactName:c.name,amount:150,isPaid:false})),settlements:[],distribution:{method:'equal'}}}];
  const {store}=setup(d),before=calculateWalletBalances(d.wallets,d.transactions);assert.equal(carryObservation(store.data,'2026-09','g').remainder,5000);
  await apply(store,{kind:'carry',source:'2026-09',amounts:[{code:'g',amountCents:5000}]});assert.equal(store.data.budgetPlans.find(p=>p.monthYear==='2026-10')!.plannedAmount,200);assert.equal(effectiveBudgetPlans(store.data).find(p=>p.monthYear==='2026-10')!.plannedAmount,250);
  const rows=planningBudgetRows(store.data,'2026-10',d.budgetGroups.flatMap(g=>g.partidas));assert.equal(rows.find(r=>r.code==='g')!.basePrevisto,200);assert.equal(rows.find(r=>r.code==='g')!.arrastre,50);
  assert.deepEqual(calculateWalletBalances(store.data.wallets,store.data.transactions),before);
  const carry=store.data.planningAutomation!.carryovers[0];assert.equal(carryIsStale(store.data,carry,new Date('2026-10-01T10:00:00Z')),false);assert.equal(carryIsStale(store.data,carry,new Date('2026-09-30T10:00:00Z')),true);
  assert.ok(previewAutomation(store.data,{kind:'carry',source:'2026-09',amounts:[{code:'g',amountCents:5000}]}).rows.every(r=>r.status==='blocked'));
  assert.match(previewAutomation(store.data,{kind:'carry',source:'2026-10',amounts:[{code:'g',amountCents:100}]}).rows[0].reason,/cascadas/);
  const current=new Date().toLocaleDateString('sv-SE',{timeZone:'Europe/Madrid'}).slice(0,7);assert.match(previewAutomation(store.data,{kind:'carry',source:current,amounts:[{code:'g',amountCents:100}]}).rows[0].reason,/cerrado/);
});
test('3B: reintegros, transferencias y pendientes no crean remanente económico adicional',async()=>{
  const d=pastData(),{store}=setup(d),before=economicChartData(d,{from:'2026-09-01',to:'2026-09-30',granularity:'month',type:'all',family:'all',processed:true});
  assert.equal(carryObservation(d,'2026-09','g').executedCents,1500);await apply(store,{kind:'carry',source:'2026-09',amounts:[{code:'g',amountCents:5000}]});
  assert.deepEqual(economicChartData(store.data,{from:'2026-09-01',to:'2026-09-30',granularity:'month',type:'all',family:'all',processed:true}),before);
  const graph=planningChartData(store.data,'2026-10','family').comparison.find(r=>r.id==='GASTO:G')!;assert.equal(graph.values.base,200);assert.equal(graph.values.carryover,50);assert.equal(graph.values.planned,250);
  const unplanned=planningChartData(store.data,'2026-10','family').annual.find(r=>r.id==='2026-11')!;assert.equal(unplanned.values.baseExpenses,null);assert.equal(unplanned.values.carryover,null);assert.equal(unplanned.values.expenses,null);
});
test('3B: origen modificado señala ajuste desactualizado; revisar/eliminar es explícito e invalida aprobación',async()=>{
  const {store}=setup(pastData());await apply(store,{kind:'carry',source:'2026-09',amounts:[{code:'g',amountCents:5000}]});const c=store.data.planningAutomation!.carryovers[0];
  await store.mutate(d=>savePlanning(d,'2026-10',[],0,planningScope(d,'2026-10'),true,true));const approval=structuredClone(store.data.planningMonths!.find(m=>m.monthYear==='2026-10')!.approval);
  await store.update('budgetPlans',p=>p.map(p=>p.monthYear==='2026-09'?{...p,plannedAmount:220}:p));assert.equal(carryIsStale(store.data,c),true);assert.equal(store.data.planningAutomation!.carryovers[0].amountCents,5000);
  await apply(store,{kind:'reviewCarry',id:c.id});assert.equal(carryIsStale(store.data,store.data.planningAutomation!.carryovers[0]),false);
  await apply(store,{kind:'removeCarry',id:c.id});assert.equal(planningStatus(store.data,'2026-10'),'Modificada desde la última aprobación');assert.deepEqual(store.data.planningMonths!.find(m=>m.monthYear==='2026-10')!.approval,approval);
});
for(const number of [1,2])test(`3B: importar foto única 2.9 n.º ${number} y archivar solo historia real`,async()=>{
  let d=savePlanning(base(),future,lines,60000,planningScope(base(),future),true);d.planningMonths!.find(m=>m.monthYear===future)!.approval!.number=number;assert.equal(makeBackup(d).version,'2.9');
  const {store,storage}=setup(parseBackup(JSON.stringify(makeBackup(d)))),old=structuredClone(store.data.planningMonths!.find(m=>m.monthYear===future)!.approval);
  await store.mutate(d=>savePlanning(d,future,lines,60000,planningScope(d,future),true));assert.equal(makeBackup(store.data).version,'3.0');assert.deepEqual(store.data.planningAutomation!.history[0].approvals,[old]);assert.equal(store.data.planningMonths!.find(m=>m.monthYear===future)!.approval!.number,number+1);
  await store.mutate(d=>savePlanning(d,future,lines,60000,planningScope(d,future),true));assert.equal(store.data.planningAutomation!.history[0].approvals.length,2);assert.equal(parseBackup(recoveryCopies(storage)[0].content).version,'2.9');
  await assert.rejects(store.update('planningAutomation',a=>({...a!,history:[]})),/inmutable/);
});
for(const failure of ['recovery','verify','quota','locks','stale','conflict'] as const)test(`3B: ${failure} no aplica un lote parcialmente`,async()=>{
  const exclusive:ExclusiveWrite=failure==='locks'?async()=>{throw new Error('Web Locks denegado')}:lock;const {store,storage}=setup(base(),exclusive),p=previewAutomation(store.data,copy()),original=structuredClone(store.data),before=storage.getItem(DATA_KEY);
  if(failure==='recovery')storage.fail=k=>k.startsWith(RECOVERY_PREFIX);if(failure==='quota')storage.fail=k=>k===DATA_KEY;if(failure==='verify')storage.corrupt=true;
  if(failure==='conflict')storage.setItem(DATA_KEY,JSON.stringify({...makeBackup(base()),revision:'other'}));
  if(failure==='stale')await store.update('budgetPlans',p=>p.map(p=>({...p,plannedAmount:p.plannedAmount+1})));
  await assert.rejects(store.mutate(d=>applyAutomationPreview(d,p)));if(failure!=='stale')assert.deepEqual(store.data,original);if(!['conflict','stale'].includes(failure))assert.equal(storage.getItem(DATA_KEY),before);
});
test('3B: JSON 3.0 round trip, backup anterior y restauración íntegra',async()=>{
  const initial=pastData(),{store,storage}=setup(initial);await apply(store,{kind:'rule',rule:rule('salary','INGRESO',300000,'monthly','i')});await apply(store,{kind:'carry',source:'2026-09',amounts:[{code:'g',amountCents:5000}]});
  const exported=makeBackup(store.data);assert.deepEqual(parseBackup(JSON.stringify(exported)),exported);assert.deepEqual(parseSnapshot(storage.getItem(DATA_KEY)!).planningAutomation,exported.planningAutomation);
  const prior=recoveryCopies(storage).find(c=>parseBackup(c.content).version!=='3.0')!;await store.restore(parseBackup(prior.content));assert.deepEqual(store.data.transactions,initial.transactions);assert.equal(store.data.planningAutomation,undefined);
});
test('3B: rechaza 3.0 corrupto, cascadas, duplicados y etiquetas 2.x adulteradas',async()=>{
  const {store}=setup(pastData());await apply(store,{kind:'rule',rule:rule('s','SAVINGS',100)});await apply(store,{kind:'carry',source:'2026-09',amounts:[{code:'g',amountCents:5000}]});const valid=makeBackup(store.data);
  for(const mutate of [(d:any)=>{d.planningAutomation.extra=1},(d:any)=>{d.planningAutomation.rules[0].amountCents=-1},(d:any)=>{d.planningAutomation.rules[0].frequency='daily'},(d:any)=>{d.planningAutomation.rules[0].code='not-savings'},(d:any)=>{d.planningAutomation.carryovers[0].toMonth='2026-12'},(d:any)=>{d.planningAutomation.carryovers[0].sourceBaseCents=1},(d:any)=>{d.planningAutomation.carryovers.push(d.planningAutomation.carryovers[0])},(d:any)=>{d.planningAutomation.carryovers[0].sourceSignature='invalid'},(d:any)=>{d.planningAutomation.carryovers[0].sourceSignature=1234567890123456},(d:any)=>{d.planningAutomation.carryovers[0].type='INGRESO'},(d:any)=>{d.planningAutomation.carryovers[0].createdAt='2026-08-01T00:00:00.000Z'},(d:any)=>{delete d.planningMonths}]){const d=structuredClone(valid);mutate(d);assert.throws(()=>parseBackup(JSON.stringify(d)));}
  for(const version of ['2.5','2.6','2.7','2.8','2.9'])assert.throws(()=>parseBackup(JSON.stringify({...valid,version})));
});
test('3B: clear presupuestos incluye reglas/historia/arrastres/procedencias con alcance y recovery',async()=>{
  const {store,storage}=setup(pastData());await apply(store,{kind:'rule',rule:rule('s','SAVINGS',100)});await apply(store,{kind:'carry',source:'2026-09',amounts:[{code:'g',amountCents:5000}]});
  const options={clearWalletBalances:false,clearAllWallets:false,clearTransactions:false,clearBudgets:true,clearDebts:false};const old=structuredClone(store.data);const report=clearImpact(old,options);assert.ok(report.relations.some(r=>r.label==='Arrastres a eliminar'&&r.count===1));
  const scope=clearScope(store.data,options);await apply(store,{kind:'rule',rule:rule('s','SAVINGS',200)});await assert.rejects(store.mutate({clear:options,scope}),/alcance/);
  await store.mutate({clear:options,scope:clearScope(store.data,options)});assert.equal(store.data.planningAutomation,undefined);assert.equal(store.data.planningMonths,undefined);assert.deepEqual(store.data.transactions,old.transactions);assert.deepEqual(store.data.wallets,old.wallets);assert.ok(recoveryCopies(storage).some(c=>parseBackup(c.content).planningAutomation?.carryovers.length===1));
});
test('3B: regla de cero conserva idempotencia y permite aprobación sin mezclar revisiones',async()=>{
  const {store}=setup();await apply(store,{kind:'rule',rule:rule('zero','GASTO',0,'monthly','g')});await apply(store,{kind:'recurrences',first:'2028-06',last:'2028-06',overwrite:[]});
  assert.equal(store.data.budgetPlans.find(p=>p.monthYear==='2028-06')!.plannedAmount,0);
  await store.mutate(d=>savePlanning(d,'2028-06',[{type:'GASTO',code:'g',amountCents:0}],0,planningScope(d,'2028-06'),true));assert.equal(planningStatus(store.data,'2028-06'),'Aprobado');
});
test('3B: editar regla y pausarla nunca reescribe los meses ya generados',async()=>{
  const {store}=setup();const original=rule('edit','INGRESO',300000,'monthly','i');await apply(store,{kind:'rule',rule:original});await apply(store,{kind:'recurrences',first:'2028-06',last:'2028-06',overwrite:[]});const plans=structuredClone(store.data.budgetPlans);
  await apply(store,{kind:'rule',rule:{...original,amountCents:310000,frequency:'quarterly',active:false}});assert.deepEqual(store.data.budgetPlans,plans);assert.equal(store.data.planningAutomation!.rules[0].amountCents,310000);
});
test('3B: firma actual obliga a que la observación aritmética coincida; observación antigua conserva aviso',async()=>{
  const {store}=setup(pastData());await apply(store,{kind:'carry',source:'2026-09',amounts:[{code:'g',amountCents:5000}]});const altered=makeBackup(store.data);altered.planningAutomation!.carryovers[0].sourceExecutedCents++;
  assert.throws(()=>parseBackup(JSON.stringify(altered)),/observación inconsistente/);
  const tx=store.data.transactions.find(t=>t.id==='shared')!;await store.update('transactions',list=>[...list,{...tx,id:'own-new',amount:190,splitInfo:undefined,reimbursement:undefined,transfer:undefined,description:'Nuevo gasto ficticio'}]);
  assert.equal(carryIsStale(store.data,store.data.planningAutomation!.carryovers[0]),true);assert.equal(store.data.planningAutomation!.carryovers[0].amountCents,5000);assert.equal(previewAutomation(store.data,{kind:'reviewCarry',id:store.data.planningAutomation!.carryovers[0].id}).rows[0].status,'blocked');
});
test('3B: historial y desglose base/arrastre malformados se rechazan al restaurar',async()=>{
  const {store}=setup(pastData());await apply(store,{kind:'carry',source:'2026-09',amounts:[{code:'g',amountCents:5000}]});
  await store.mutate(d=>savePlanning(d,'2026-10',[],0,planningScope(d,'2026-10'),true,true));await store.mutate(d=>savePlanning(d,'2026-10',[],0,planningScope(d,'2026-10'),true,true));const valid=makeBackup(store.data);
  for(const mutate of [(d:any)=>{d.planningAutomation.history[0].approvals[0].totals.expenses++},(d:any)=>{d.planningAutomation.history[0].approvals[0].number=2},(d:any)=>{d.planningAutomation.history[0].approvals.push(d.planningAutomation.history[0].approvals[0])},(d:any)=>{d.planningAutomation.history[0].approvals[0].carryLines[0].amountCents++},(d:any)=>{delete d.planningAutomation.history[0].approvals[0].baseLines},(d:any)=>{d.planningAutomation.history[0].approvals[0].approvedAt='2099-01-01T00:00:00.000Z'},(d:any)=>{d.planningAutomation.history[0].monthYear='2028-13'}]){const bad=structuredClone(valid);mutate(bad);assert.throws(()=>parseBackup(JSON.stringify(bad)));}
});
test('3B: round trips 2.5–2.9 no añaden automatización; 3.0 conserva préstamos y colecciones bancarias',async()=>{
  const d=chartFixture();d.transactions=[];d.loans=[{id:'loan',name:'Préstamo ficticio',entity:'BANCO',principal:1000,interestRate:0,totalTermMonths:12,startDate:'2026-01-01',monthlyPayment:100,wallet:'BANCO',code:'g'}];
  for(const version of ['2.5','2.6','2.7','2.8'] as const){const file={...makeBackup(d),version},parsed=parseBackup(JSON.stringify(file));assert.deepEqual(parsed,file);assert.equal(parsed.planningAutomation,undefined);}
  const v29=savePlanning(d,future,lines,60000,planningScope(d,future)),old=makeBackup(v29);assert.equal(old.version,'2.9');assert.deepEqual(parseBackup(JSON.stringify(old)),old);
  const {store}=setup(v29);await apply(store,copy());for(const field of ['transactions','wallets','contacts','loans','budgetGroups'] as const)assert.deepEqual(store.data[field],v29[field]);assert.equal(parseBackup(JSON.stringify(makeBackup(store.data))).version,'3.0');
});
