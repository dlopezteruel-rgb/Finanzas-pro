import test from 'node:test';
import assert from 'node:assert/strict';
import { budgetSubitemFixture as fixture, demoParent as parent, demoMonth as month, demoBreakdown as breakdown, demoTransaction as tx } from '../../scripts/budgetSubitemFixture';
import { createSubitem,editSubitem,subitemBudgetRows,subitemsFor,assertSubitemTransition,subitemUsed,validateSubitems,normalizedSubitemBreakdowns } from './budgetSubitems';
import { FinanceStore } from './financeStore';
import { DATA_KEY,RECOVERY_PREFIX,makeBackup,parseBackup,type FinanceData } from './backup';
import { savePlanning,planningScope,planningStatus } from './planning';
import { previewAutomation,applyAutomationPreview,reconcileAutomation } from './planningAutomation';
import { duplicatePartida,changePartidaGroup } from './budgetChanges';
import { calculateMonthlySummary,calculateWalletBalances } from './finance';
import { saveSharedTransaction,splitExactly,saveSettlement } from './sharedExpenses';
import { transferPair } from './transfers';
import { movementRule } from '../../scripts/intelligentFixture';
import { saveMovementRule,occurrencePreviews,applyOccurrenceBatch,occurrenceScope } from './recurringMovements';
import { proposeChatMovement } from './chatRegistration';
import { clearedData } from './clearData';

class MemoryStorage {
  values=new Map<string,string>();writes=0;fail:''|'copy'|'verify'|'active'='';
  get length(){return this.values.size;}key(n:number){return [...this.values.keys()][n]??null;}getItem(k:string){return this.values.get(k)??null;}
  setItem(k:string,v:string){if(this.fail==='copy'&&k.startsWith(RECOVERY_PREFIX)||this.fail==='active'&&k===DATA_KEY)throw new Error('Cuota ficticia');this.writes++;this.values.set(k,this.fail==='verify'&&k.startsWith(RECOVERY_PREFIX)?'incompleto':v);}
}
function setup(data=fixture()) {const storage=new MemoryStorage();storage.setItem(DATA_KEY,JSON.stringify(makeBackup(data)));const store=new FinanceStore(storage,fixture(false),async write=>write());return {storage,store};}
const commit=(d:FinanceData,a=6000,b=4000,approve=false)=>savePlanning(d,month,[{...parent,amountCents:a+b}],20000,planningScope(d,month),approve,false,[breakdown(a,b)]);
const catalog=(d:FinanceData)=>d.budgetGroups.flatMap(g=>g.partidas);

test('subítems: cero, uno y varios; añadir no reparte ni escribe presupuestos anteriores',()=>{
  const old=fixture(false),one=createSubitem(old,parent,'Cine','one'),many=createSubitem(one,parent,'Cultura','two');
  assert.equal(subitemsFor(old,parent).length,0);assert.equal(subitemsFor(one,parent).length,1);assert.equal(subitemsFor(many,parent).length,2);
  assert.deepEqual(many.budgetPlans,old.budgetPlans);assert.deepEqual(many.transactions,old.transactions);assert.deepEqual(many.budgetSubitems!.months,[]);
});
test('subítems: identidad estable al renombrar/ordenar, archivo y no-op',()=>{
  const d=fixture(),renamed=editSubitem(d,{kind:'rename',id:'demo-cine',name:'Cine nuevo'}),ordered=editSubitem(renamed,{kind:'reorder',id:'demo-cultura',direction:-1});
  assert.equal(subitemsFor(ordered,parent)[0].id,'demo-cultura');assert.equal(ordered.budgetSubitems!.items.find(i=>i.id==='demo-cine')!.name,'Cine nuevo');
  assert.equal(editSubitem(ordered,{kind:'rename',id:'demo-cine',name:'Cine nuevo'}),ordered);assert.equal(editSubitem(d,{kind:'reorder',id:'demo-cine',direction:-1}),d);
  const archived=editSubitem(ordered,{kind:'archive',id:'demo-cine',archived:true});assert.equal(subitemsFor(archived,parent)[1].archived,true);assert.deepEqual(archived.budgetPlans,d.budgetPlans);
});
test('subítems: IDs retirados nunca se reutilizan, ni desde un editor genérico',async()=>{
  const {store,storage}=setup();await store.mutate(d=>editSubitem(d,{kind:'delete',id:'demo-cine'}));const raw=storage.getItem(DATA_KEY);
  assert.throws(()=>createSubitem(store.data,parent,'Otra entidad','demo-cine'),/retirado/);
  await assert.rejects(store.mutate(d=>({...d,budgetSubitems:{...d.budgetSubitems!,items:d.budgetSubitems!.items.filter(i=>i.id!=='demo-cine')}})),/identidad/);
  await assert.rejects(store.mutate(d=>({...d,budgetSubitems:{...d.budgetSubitems!,items:d.budgetSubitems!.items.map(i=>i.id==='demo-cine'?{...i,deleted:undefined,archived:false}:i)}})),/permanente/);assert.equal(storage.getItem(DATA_KEY),raw);
});
for(const kind of ['movement','forecast','approval'] as const)test(`subítems: borrado bloqueado con dependencia ${kind}`,()=>{
  let d=fixture();if(kind==='movement')d={...d,transactions:[tx({subitemId:'demo-cine'})]};else d=commit(d,6000,4000,kind==='approval');
  if(kind==='approval')d={...d,budgetSubitems:{...d.budgetSubitems!,months:[]},budgetPlans:d.budgetPlans.filter(p=>p.type!=='GASTO'),planningMonths:d.planningMonths!.map(m=>({...m,revision:m.revision+1}))};
  assert.equal(subitemUsed(d,'demo-cine'),true);assert.throws(()=>editSubitem(d,{kind:'delete',id:'demo-cine'}),/históricos/);
  assert.doesNotThrow(()=>validateSubitems(editSubitem(d,{kind:'archive',id:'demo-cine',archived:true})));
});
test('subítems: importes exactos 0,10 + 0,20; total padre una sola vez y sin cambiar saldos',()=>{
  const d=fixture(),next=commit(d,10,20);assert.equal(next.budgetPlans.find(p=>p.type==='GASTO')!.plannedAmount,0.3);
  const summary=calculateMonthlySummary(month,next.transactions,next.budgetPlans,catalog(next));assert.equal(summary.gastosPrevistos,0.3);assert.deepEqual(calculateWalletBalances(next.wallets,next.transactions),calculateWalletBalances(d.wallets,d.transactions));
  assert.doesNotThrow(()=>parseBackup(JSON.stringify(makeBackup(next))));
});
for(const problem of ['fraction','negative','duplicate','duplicate-id','difference','missing','wrong-parent','wrong-type'] as const)test(`subítems: rechazar ${problem} en backup y dominio`,()=>{
  const d=commit(fixture()),bad=structuredClone(d),m=bad.budgetSubitems!.months[0];
  if(problem==='fraction')m.lines[0].amountCents=0.1;if(problem==='negative')m.lines[0].amountCents=-1;if(problem==='duplicate')m.lines[1].subitemId=m.lines[0].subitemId;if(problem==='difference')m.lines[0].amountCents++;
  if(problem==='duplicate-id')bad.budgetSubitems!.items[1].id=bad.budgetSubitems!.items[0].id;
  if(problem==='missing')m.lines[0].subitemId='missing';if(problem==='wrong-parent')bad.budgetSubitems!.items[0].code='other';if(problem==='wrong-type')bad.budgetSubitems!.items[0].type='INGRESO';
  assert.throws(()=>parseBackup(JSON.stringify(makeBackup(bad))));assert.throws(()=>assertSubitemTransition(d,bad));
});
test('subítems: atribución manual, sin asignar y edición histórica conservan ejecutado total',()=>{
  let d=fixture();d=saveSharedTransaction(d,tx({id:'new',subitemId:'demo-cine',amount:20}));const original=d.transactions.find(t=>t.subitemId)!;
  d=saveSharedTransaction(d,{...original,description:'Concepto corregido'},original.id);assert.equal(d.transactions.find(t=>t.id===original.id)!.subitemId,'demo-cine');
  const rows=subitemBudgetRows(d,month,catalog(d).find(p=>p.type==='GASTO')!);assert.equal(rows.find(r=>r.id==='demo-cine')!.executed,2000);assert.equal(rows.find(r=>r.id===undefined)!.executed,1200);
  assert.equal(rows.reduce((n,r)=>n+r.executed,0),3200);assert.equal(d.transactions.find(t=>t.id==='legacy-demo')!.subitemId,undefined);
});
test('subítems: referencia de movimiento inválida o archivada rechazada; editar atribución archivada se conserva',()=>{
  const d=fixture();assert.throws(()=>saveSharedTransaction(d,tx({subitemId:'missing'})),/referencia/);
  assert.throws(()=>saveSharedTransaction(d,tx({subitemId:'demo-cine',type:'INGRESO'})),/referencia/);
  let next=saveSharedTransaction(d,tx({subitemId:'demo-cine'}),'legacy-demo');next=editSubitem(next,{kind:'archive',id:'demo-cine',archived:true});
  assert.doesNotThrow(()=>saveSharedTransaction(next,{...next.transactions[0],description:'Editado'},'legacy-demo'));
  assert.throws(()=>saveSharedTransaction(next,tx({id:'another',subitemId:'demo-cine'})),/archivado/);
});
test('subítems: parte propia compartida, reintegro, transferencia y principal no duplican ejecución',()=>{
  let d=fixture();d={...d,wallets:[...d.wallets,{...d.wallets[0],id:'cash',name:'EFECTIVO FICTICIO'}]};
  d=saveSharedTransaction(d,tx({amount:60,subitemId:'demo-cine',splitInfo:splitExactly(60,d.contacts,'bank')}),'legacy-demo');
  d=saveSettlement(d,{expenseId:'legacy-demo',contactId:'friend',amount:5,date:'2026-11-04',processed:true,kind:'cash',walletId:'bank'});
  d={...d,transactions:[...d.transactions,...transferPair(d.wallets,{fromWalletId:'bank',toWalletId:'cash',amount:15,date:'2026-11-05',concept:'Ficticio',processed:true})]};
  const rows=subitemBudgetRows(d,month,catalog(d).find(p=>p.type==='GASTO')!);assert.equal(rows.find(r=>r.id==='demo-cine')!.executed,3000);assert.equal(rows.reduce((n,r)=>n+r.executed,0),3000);
  const invalid={...d,transactions:d.transactions.map(t=>t.reimbursement?{...t,subitemId:'demo-cine'}:t)};assert.throws(()=>validateSubitems(invalid),/referencia|sin efecto/);
});
test('subítems: solo tramitados; consultas no mutan datos',()=>{
  const d={...fixture(),transactions:[tx({subitemId:'demo-cine',processed:false}),tx({id:'processed',subitemId:'demo-cultura',amount:7})]},before=JSON.stringify(d);
  const rows=subitemBudgetRows(d,month,catalog(d).find(p=>p.type==='GASTO')!);assert.equal(rows.find(r=>r.id==='demo-cine')!.executed,0);assert.equal(rows.find(r=>r.id==='demo-cultura')!.executed,700);assert.equal(JSON.stringify(d),before);
});
test('subítems: revisiones detectan redistribución con mismo total y fotografías conservan nombres/importes',async()=>{
  const {store}=setup();await store.mutate(d=>commit(d,6000,4000,true));const photo=structuredClone(store.data.planningMonths![0].approval!);
  await store.mutate(d=>commit(d,5000,5000));assert.equal(planningStatus(store.data,month),'Modificada desde la última aprobación');assert.deepEqual(store.data.planningMonths![0].approval,photo);
  await store.mutate(d=>editSubitem(d,{kind:'rename',id:'demo-cine',name:'Nombre actual'}));await store.mutate(d=>commit(d,5000,5000,true));
  assert.deepEqual(store.data.planningAutomation!.history[0].approvals[0],photo);assert.equal(store.data.planningMonths![0].approval!.subitemBreakdowns![0].lines.find(l=>l.subitemId==='demo-cine')!.name,'Nombre actual');
  assert.throws(()=>reconcileAutomation(store.data,{...store.data,planningAutomation:{...store.data.planningAutomation!,history:[]}}),/inmutable/);
});
test('subítems: aprobación antigua no se reconstruye al añadir catálogo o aprobar otro mes',()=>{
  const old=savePlanning(fixture(false),month,[{...parent,amountCents:10000}],20000,planningScope(fixture(false),month),true),photo=structuredClone(old.planningMonths![0].approval);
  const next=createSubitem(old,parent,'Cine','new');assert.deepEqual(next.planningMonths![0].approval,photo);assert.equal(photo!.subitemBreakdowns,undefined);assert.doesNotThrow(()=>parseBackup(JSON.stringify(makeBackup(next))));
});
test('subítems: aprobación vigente debe coincidir también en distribución; snapshot inválido no entra',()=>{
  const d=commit(fixture(),6000,4000,true),bad=structuredClone(d);bad.planningMonths![0].approval!.subitemBreakdowns![0].lines[0].amountCents++;assert.throws(()=>parseBackup(JSON.stringify(makeBackup(bad))));
  const swapped=structuredClone(d);swapped.budgetSubitems!.months[0].lines.reverse();swapped.budgetSubitems!.months[0].lines[0].amountCents=5000;swapped.budgetSubitems!.months[0].lines[1].amountCents=5000;assert.throws(()=>parseBackup(JSON.stringify(makeBackup(swapped))),/distribución aprobada/);
});
test('subítems: copia incluye desglose aunque el total coincida; sobrescritura explícita y bloqueo aprobado',async()=>{
  const {store}=setup(commit(fixture()));
  const request={kind:'copy' as const,source:month,first:'2026-12',last:'2026-12',keys:[`GASTO:${parent.code}`],savings:false,overwrite:[]};
  await store.mutate(d=>applyAutomationPreview(d,previewAutomation(d,request)));assert.deepEqual(store.data.budgetSubitems!.months.find(m=>m.monthYear==='2026-12')!.lines,breakdown().lines);
  await store.mutate(d=>savePlanning(d,'2026-12',[{...parent,amountCents:10000}],0,planningScope(d,'2026-12'),false,false,[breakdown(5000,5000,'2026-12')]));
  assert.equal(previewAutomation(store.data,request).rows[0].status,'skip');await store.mutate(d=>applyAutomationPreview(d,previewAutomation(d,{...request,overwrite:['2026-12']})));
  assert.deepEqual(store.data.budgetSubitems!.months.find(m=>m.monthYear==='2026-12')!.lines,breakdown().lines);
  assert.equal(applyAutomationPreview(store.data,previewAutomation(store.data,{...request,overwrite:['2026-12']})),store.data);
  assert.equal(normalizedSubitemBreakdowns([breakdown()]),normalizedSubitemBreakdowns([{...breakdown(),lines:[...breakdown().lines].reverse().map(l=>({amountCents:l.amountCents,subitemId:l.subitemId}))}]));
  await store.mutate(d=>savePlanning(d,'2026-12',[],0,planningScope(d,'2026-12'),true,true));assert.equal(previewAutomation(store.data,{...request,overwrite:['2026-12']}).rows[0].status,'blocked');
});
test('subítems: regla global no sustituye distribución; si no hay desglose señala pendiente',()=>{
  const d=commit(fixture()),rule={id:'rule',name:'Global ficticia',target:'GASTO' as const,code:parent.code,amountCents:12000,frequency:'monthly' as const,startMonth:month,active:true};
  const withRule=applyAutomationPreview(d,previewAutomation(d,{kind:'rule',rule})),p=previewAutomation(withRule,{kind:'recurrences',first:month,last:month,overwrite:[`${month}:GASTO:${parent.code}:rule`]});
  assert.equal(p.rows[0].status,'blocked');assert.match(p.rows[0].reason,/Desglose mensual/);
  const future=previewAutomation(withRule,{kind:'recurrences',first:'2026-12',last:'2026-12',overwrite:[]});assert.equal(future.rows[0].status,'apply');assert.match(future.rows[0].reason,/Pendiente de desglose/);
});
test('subítems: arrastre no inventa distribución y activación con arrastre global se bloquea',()=>{
  const d=commit(fixture()),p=previewAutomation(d,{kind:'carry',source:month,amounts:[{code:parent.code,amountCents:100}]},new Date('2026-12-05T12:00:00Z'));assert.equal(p.rows[0].status,'blocked');assert.match(p.rows[0].reason,/desglose mensual/);
  let old=fixture();old.budgetPlans=old.budgetPlans.map(p=>({...p,monthYear:'2026-10'}));old=applyAutomationPreview(old,previewAutomation(old,{kind:'carry',source:'2026-10',amounts:[{code:parent.code,amountCents:100}]},new Date('2026-11-11T12:00:00Z')),new Date('2026-11-11T12:00:00Z'));
  assert.throws(()=>commit(old),/arrastre global/);
  assert.throws(()=>savePlanning(old,'2026-10',[{...parent,amountCents:10000}],0,planningScope(old,'2026-10'),false,false,[breakdown(6000,4000,'2026-10')]),/arrastre global/);
});
test('subítems: duplicar partida clona identidades nuevas sin movimientos ni previsiones',()=>{
  const d=commit(fixture()),original=catalog(d).find(p=>p.type==='GASTO')!,copy=duplicatePartida(d,original),clone=catalog(copy).find(p=>p.name.endsWith('(Copia)'))!;
  assert.doesNotThrow(()=>parseBackup(JSON.stringify(makeBackup(copy))));
  assert.equal(subitemsFor(copy,clone).length,2);assert.equal(subitemsFor(copy,clone).some(i=>subitemsFor(d,original).some(o=>o.id===i.id)),false);assert.deepEqual(copy.transactions,d.transactions);assert.deepEqual(copy.budgetPlans,d.budgetPlans);assert.deepEqual(copy.budgetSubitems!.months,d.budgetSubitems!.months);
  assert.throws(()=>changePartidaGroup(copy,clone,'I'),/Ingresos y Gastos/);
});
test('subítems: chat y recurrencias no inventan IDs; ocurrencias permiten atribución manual posterior',()=>{
  let d=fixture();assert.equal(proposeChatMovement('Registra un gasto de 5',d.wallets,catalog(d))!.subitemId,undefined);
  d=saveMovementRule(d,movementRule({code:parent.code,startDate:'2026-11-01',day:12}));const previews=occurrencePreviews(d,month),proposed=previews.find(o=>o.status==='proposed')!;
  d=applyOccurrenceBatch(d,{first:month,last:month,scope:occurrenceScope(d),ids:[proposed.id],action:'register',acknowledgeCollisions:true});
  const recurring=d.transactions.find(t=>t.recurrence)!;assert.equal(recurring.subitemId,undefined);assert.equal(recurring.processed,false);
  d=saveSharedTransaction(d,{...recurring,subitemId:'demo-cine'},recurring.id);assert.equal(d.transactions.find(t=>t.id===recurring.id)!.subitemId,'demo-cine');
});
test('subítems: primera escritura 3.3 conserva copia 3.2, recarga y restauración íntegra',async()=>{
  const base=fixture(false),{store,storage}=setup(base),raw=storage.getItem(DATA_KEY);assert.equal(storage.writes,1);assert.equal(makeBackup(store.data).version,'3.2');
  await store.mutate(d=>createSubitem(d,parent,'Cine','new'));assert.equal(makeBackup(store.data).version,'3.3');assert.equal([...storage.values].filter(([k])=>k.startsWith(RECOVERY_PREFIX)).length,1);
  const copy=parseBackup([...storage.values].find(([k])=>k.startsWith(RECOVERY_PREFIX))![1]);assert.equal(copy.version,'3.2');assert.deepEqual(copy.transactions,base.transactions);assert.deepEqual(copy.budgetPlans,base.budgetPlans);assert.equal(copy.budgetSubitems,undefined);assert.ok(raw);
  const reload=new FinanceStore(storage,fixture(false),async write=>write());assert.equal(reload.data.budgetSubitems!.items[0].id,'new');
  const exported=parseBackup(JSON.stringify(makeBackup(reload.data)));await reload.restore(makeBackup(base));assert.equal(reload.data.budgetSubitems,undefined);await reload.restore(exported);assert.equal(reload.data.budgetSubitems!.items[0].id,'new');
});
for(const failure of ['copy','verify','active'] as const)test(`subítems: fallo ${failure} conserva datos activos y UI`,async()=>{
  const {store,storage}=setup(fixture(false)),raw=storage.getItem(DATA_KEY),before=structuredClone(store.data);storage.fail=failure;
  await assert.rejects(store.mutate(d=>createSubitem(d,parent,'Cine','new')));assert.equal(storage.getItem(DATA_KEY),raw);assert.deepEqual(store.data,before);
});
test('subítems: IDs duplicados, nombre inválido, borrado dependiente y no-op no escriben',async()=>{
  const {store,storage}=setup(commit(fixture())),raw=storage.getItem(DATA_KEY),writes=storage.writes;
  await assert.rejects(store.mutate(d=>createSubitem(d,parent,'Otro','demo-cine')));await assert.rejects(store.mutate(d=>editSubitem(d,{kind:'rename',id:'demo-cine',name:' '})));await assert.rejects(store.mutate(d=>editSubitem(d,{kind:'delete',id:'demo-cine'})));
  await store.mutate(d=>editSubitem(d,{kind:'rename',id:'demo-cine',name:'Cine ficticio'}));assert.equal(storage.writes,writes);assert.equal(storage.getItem(DATA_KEY),raw);
});
test('subítems: dos pestañas y doble guardado no pierden cambios ni duplican identidad',async()=>{
  const {store,storage}=setup(),other=new FinanceStore(storage,fixture(false),async write=>write());await store.mutate(d=>editSubitem(d,{kind:'rename',id:'demo-cine',name:'Primera pestaña'}));const raw=storage.getItem(DATA_KEY);
  await assert.rejects(other.mutate(d=>editSubitem(d,{kind:'rename',id:'demo-cultura',name:'Segunda pestaña'})),/Otra pestaña/);assert.equal(storage.getItem(DATA_KEY),raw);
  await store.mutate(d=>createSubitem(d,parent,'Una sola entidad','once'));await assert.rejects(store.mutate(d=>createSubitem(d,parent,'Una sola entidad','once')));assert.equal(store.data.budgetSubitems!.items.filter(i=>i.id==='once').length,1);
});
test('subítems: borrado explícito de presupuestos quita desgloses pero conserva IDs e imputaciones',()=>{
  const d=commit({...fixture(),transactions:[tx({subitemId:'demo-cine'})]}),next=clearedData(d,{clearAllWallets:false,clearWalletBalances:false,clearTransactions:false,clearDebts:false,clearBudgets:true});
  assert.deepEqual(next.budgetSubitems!.months,[]);assert.deepEqual(next.budgetSubitems!.items,d.budgetSubitems!.items);assert.deepEqual(next.transactions,d.transactions);assert.doesNotThrow(()=>parseBackup(JSON.stringify(makeBackup(next))));
});

for(const version of ['2.5','2.6','2.7','2.8','2.9','3.0','3.1','3.2'] as const)test(`subítems: importar/abrir ${version} no migra ni escribe, primera ampliación recuperable 3.3`,async()=>{
  const d=fixture(false);delete d.defaultWalletId;
  if(version==='2.9')d.planningMonths=[{monthYear:month,savingsCents:0,revision:1}];
  if(version==='3.0')d.planningAutomation={rules:[{id:'old',name:'Regla histórica',target:'GASTO',code:parent.code,amountCents:100,frequency:'monthly',startMonth:month,active:true}],carryovers:[],origins:[],history:[]};
  if(version==='3.1')d.intelligentFinance={recurringRules:[],occurrences:[],obligations:[]};
  if(version==='3.2')d.defaultWalletId='bank';
  const backup={...makeBackup(d),version},storage=new MemoryStorage();storage.setItem(DATA_KEY,JSON.stringify(backup));const raw=storage.getItem(DATA_KEY),writes=storage.writes;
  const parsed=parseBackup(raw!),store=new FinanceStore(storage,fixture(false),async write=>write());assert.equal(parsed.version,version);assert.equal(storage.writes,writes);assert.equal(storage.getItem(DATA_KEY),raw);
  await store.mutate(data=>createSubitem(data,parent,'Nuevo subítem','new'));
  assert.equal(makeBackup(store.data).version,'3.3');assert.deepEqual(store.data.budgetPlans,d.budgetPlans);assert.deepEqual(store.data.transactions,d.transactions);
  const copy=parseBackup([...storage.values].find(([k])=>k.startsWith(RECOVERY_PREFIX))![1]);assert.deepEqual(copy.transactions,d.transactions);assert.deepEqual(copy.budgetPlans,d.budgetPlans);assert.equal(copy.budgetSubitems,undefined);
});
test('subítems: editor global no rompe una base calculada y céntimos cero son válidos',async()=>{
  const {store,storage}=setup(commit(fixture())),before=storage.getItem(DATA_KEY);
  await assert.rejects(store.update('budgetPlans',plans=>plans.map(p=>p.type==='GASTO'?{...p,plannedAmount:101}:p)),/suma de hijos/);assert.equal(storage.getItem(DATA_KEY),before);
  await store.mutate(d=>commit(d,0,0));assert.equal(store.data.budgetPlans.some(p=>p.type==='GASTO'),false);assert.deepEqual(store.data.budgetSubitems!.months[0].lines.map(l=>l.amountCents),[0,0]);
});
test('subítems: cambiar familia del mismo tipo conserva atribuciones, distribución y economía',()=>{
  const d=commit({...fixture(),transactions:[tx({subitemId:'demo-cine'})]});d.budgetGroups.push({code:'G2',type:'GASTO',name:'Otra familia ficticia',partidas:[]});
  const next=changePartidaGroup(d,catalog(d).find(p=>p.type==='GASTO')!,'G2');assert.deepEqual(next.budgetSubitems,d.budgetSubitems);assert.deepEqual(next.transactions,d.transactions);assert.deepEqual(next.budgetPlans,d.budgetPlans);assert.doesNotThrow(()=>validateSubitems(next));
});
