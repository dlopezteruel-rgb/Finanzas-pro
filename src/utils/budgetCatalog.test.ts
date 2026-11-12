import test from 'node:test';
import assert from 'node:assert/strict';
import {editCatalog,catalogArchiveImpact,catalogEntry,catalogDependencies,availableCatalogGroups,assertCatalogTransition} from './budgetCatalog';
import {makeBackup,parseBackup,DATA_KEY,RECOVERY_PREFIX,type FinanceData} from './backup';
import {FinanceStore} from './financeStore';
import {budgetSubitemFixture as fixture,demoParent as parent,demoMonth as month} from '../../scripts/budgetSubitemFixture';
import {calculateWalletBalances,calculateMonthlySummary} from './finance';
import {savePlanning,planningScope} from './planning';

class Storage{
  values=new Map<string,string>();writes=0;fail:''|'copy'|'verify'|'active'='';
  get length(){return this.values.size;}key(i:number){return [...this.values.keys()][i]??null;}getItem(k:string){return this.values.get(k)??null;}
  setItem(k:string,v:string){if(this.fail==='copy'&&k.startsWith(RECOVERY_PREFIX)||this.fail==='active'&&k===DATA_KEY)throw new Error('Cuota ficticia');this.writes++;this.values.set(k,this.fail==='verify'&&k.startsWith(RECOVERY_PREFIX)?'incompleto':v);}
}
function setup(d=fixture()){const storage=new Storage();storage.setItem(DATA_KEY,JSON.stringify(makeBackup(d)));return {storage,store:new FinanceStore(storage,fixture(false),async write=>write())};}
const family=(d:FinanceData)=>catalogEntry(d,parent).group!;
const createFamily=(d:FinanceData,id='new',type:'GASTO'|'INGRESO'='GASTO')=>editCatalog(d,{kind:'createFamily',type,name:'Familia nueva',id});
function sameFinances(a:FinanceData,b:FinanceData){for(const field of ['transactions','budgetPlans','budgetSubitems','planningMonths','planningAutomation','wallets','loans','contacts','intelligentFinance'] as const)assert.deepEqual(b[field],a[field],field);assert.deepEqual(calculateWalletBalances(a.wallets,a.transactions),calculateWalletBalances(b.wallets,b.transactions));assert.deepEqual(calculateMonthlySummary(month,a.transactions,a.budgetPlans),calculateMonthlySummary(month,b.transactions,b.budgetPlans));}

test('catálogo personal: crear familias/partidas en ambos tipos, códigos automáticos y cero importes nuevos',()=>{
  for(const type of ['GASTO','INGRESO'] as const){const d=fixture(),g=createFamily(d,'new',type),next=editCatalog(g,{kind:'createPartida',groupCode:'family-new',name:'Partida nueva',description:'Descripción',keywords:[' viaje ','viaje'],id:'new'}),item=catalogEntry(next,{type,code:'partida-new'}).item!;assert.equal(item.name,'Partida nueva');assert.deepEqual(item.keywords,['viaje']);assert.equal(item.type,type);assert.equal(makeBackup(next).version,'3.4');sameFinances(d,next);parseBackup(JSON.stringify(makeBackup(next)));}
});
test('catálogo personal: renombrar conserva códigos, subgrupos históricos, fotografía y saldos',()=>{
  const d=fixture(true,true),g=family(d),groupCode=catalogEntry(d,parent).item!.groupCode;
  const renamed=editCatalog(d,{kind:'renameFamily',code:g.code,name:'Familia propia'}),next=editCatalog(renamed,{kind:'updatePartida',parent,name:'Nombre propio',description:'Nueva',keywords:['ocio']});
  assert.equal(family(next).code,g.code);assert.equal(catalogEntry(next,parent).item!.groupCode,groupCode);assert.equal(catalogEntry(next,parent).item!.code,parent.code);sameFinances(d,next);
});
test('catálogo personal: traslado conserva identidad, subítems y finanzas y rechaza otro tipo',()=>{
  const d=fixture(true,true),active=createFamily(d),moved=editCatalog(active,{kind:'movePartida',parent,groupCode:'family-new'});assert.equal(catalogEntry(moved,parent).group!.code,'family-new');sameFinances(d,moved);
  const income=createFamily(moved,'income','INGRESO');assert.throws(()=>editCatalog(income,{kind:'movePartida',parent,groupCode:'family-income'}),/mismo tipo/);
});
test('catálogo personal: duplicar crea identidades nuevas, sin importes, aprobaciones ni movimientos nuevos',()=>{
  const d=fixture(true,true),copy=editCatalog(d,{kind:'duplicatePartida',parent});assert.equal(copy.budgetGroups.flatMap(g=>g.partidas).length,d.budgetGroups.flatMap(g=>g.partidas).length+1);assert.deepEqual(copy.budgetPlans,d.budgetPlans);assert.deepEqual(copy.transactions,d.transactions);assert.deepEqual(copy.planningMonths,d.planningMonths);assert.equal(new Set(copy.budgetSubitems!.items.map(i=>i.id)).size,4);assert.deepEqual(copy.budgetSubitems!.months,d.budgetSubitems!.months);
});
test('catálogo personal: archivo y reactivación excluyen familia o partida de nuevas opciones sin borrar históricos',()=>{
  const d=fixture(),archived=editCatalog(d,{kind:'archiveFamily',code:family(d).code,archived:true});assert.equal(availableCatalogGroups(archived.budgetGroups).some(g=>g.code===family(d).code),false);sameFinances(d,archived);
  const active=editCatalog(archived,{kind:'archiveFamily',code:family(d).code,archived:false}),item=editCatalog(active,{kind:'archivePartida',parent,archived:true});assert.equal(availableCatalogGroups(item.budgetGroups).flatMap(g=>g.partidas).some(p=>p.code===parent.code),false);sameFinances(d,item);
});
test('catálogo personal: eliminar pide ausencia de relaciones y conserva tombstones y códigos retirados',()=>{
  let d=createFamily(fixture());d=editCatalog(d,{kind:'createPartida',groupCode:'family-new',name:'Sin uso',description:'',keywords:[],id:'unused'});const parent={type:'GASTO' as const,code:'partida-unused'};
  assert.throws(()=>editCatalog(d,{kind:'deleteFamily',code:'family-new'}),/contiene partidas/);
  d=editCatalog(d,{kind:'deletePartida',parent});assert.equal(catalogEntry(d,parent).item!.deleted,true);assert.throws(()=>editCatalog(d,{kind:'createPartida',groupCode:'family-new',name:'Reutilizar',description:'',keywords:[],id:'unused'}),/retirada/);
  d=editCatalog(d,{kind:'deleteFamily',code:'family-new'});assert.throws(()=>createFamily(d),/retirada/);parseBackup(JSON.stringify(makeBackup(d)));
});
for(const relation of ['movimientos','previsiones','subítems','aprobaciones','préstamos','reglas','arrastres','orígenes','periódicos'] as const)test(`catálogo personal: eliminación bloqueada por ${relation}`,()=>{
  let d=fixture(false);d={...d,transactions:[],budgetPlans:[]};
  if(relation==='movimientos')d.transactions=fixture(false).transactions;
  if(relation==='previsiones')d.budgetPlans=[{...parent,monthYear:month,plannedAmount:1}];
  if(relation==='subítems')d.budgetSubitems=fixture().budgetSubitems;
  if(relation==='aprobaciones'){const approved=savePlanning(d,month,[{...parent,amountCents:100}],0,planningScope(d,month),true,true);d={...approved,budgetPlans:[]};}
  if(relation==='préstamos')d.loans=[{id:'l',name:'Cuota',code:parent.code,entity:'Ficticia',wallet:d.wallets[0].name,principal:100,interestRate:0,totalTermMonths:1,monthlyPayment:100,startDate:'2026-01-01'}];
  if(['reglas','arrastres','orígenes'].includes(relation))d.planningAutomation={rules:relation==='reglas'?[{id:'r',name:'Regla',target:parent.type,code:parent.code,amountCents:100,frequency:'monthly',startMonth:month,active:false}]:[],carryovers:relation==='arrastres'?[{...parent,id:'c',fromMonth:'2026-10',toMonth:month,amountCents:100,sourceBaseCents:100,sourceExecutedCents:0,sourceSignature:'x',createdAt:'2026-11-01T12:00:00.000Z'}]:[],origins:relation==='orígenes'?[{monthYear:month,target:parent.type,code:parent.code,kind:'manual',appliedAt:'2026-11-01T12:00:00.000Z'}]:[],history:[]};
  if(relation==='periódicos')d.intelligentFinance={recurringRules:[{...parent,id:'r',concept:'Periódica',amountCents:100,categoryName:'Ficticia',subcategoryName:'Ficticia',walletId:'bank',frequency:'monthly',startDate:'2026-01-01',day:1,active:false,deleted:true}],occurrences:[],obligations:[]};
  assert.ok(catalogDependencies(d,parent).length);assert.throws(()=>editCatalog(d,{kind:'deletePartida',parent}),/dependencias/);
});
test('catálogo personal: FinanceStore rechaza cambios de identidad, borrados físicos y reactivación de retirados',async()=>{
  const {store,storage}=setup();const before=storage.getItem(DATA_KEY);
  await assert.rejects(store.mutate(d=>({...d,budgetGroups:d.budgetGroups.map(g=>g.code===family(d).code?{...g,type:'INGRESO'}:g)})),/tipo/);
  await assert.rejects(store.update('budgetGroups',groups=>groups.filter(g=>g.code!==family(store.data).code)),/identidad/);
  await assert.rejects(store.mutate(d=>({...d,budgetGroups:d.budgetGroups.map(g=>({...g,partidas:g.partidas.filter(p=>p.code!==parent.code)}))})),/identidad/);assert.equal(storage.getItem(DATA_KEY),before);
  let retired=createFamily(store.data);retired=editCatalog(retired,{kind:'deleteFamily',code:'family-new'});assert.throws(()=>assertCatalogTransition(retired,{...retired,budgetGroups:retired.budgetGroups.map(g=>g.code==='family-new'?{...g,deleted:undefined,archived:false}:g)}),/permanentes/);
});
test('catálogo personal: archivado conserva edición histórica, bloquea movimiento nuevo y previsión nueva',async()=>{
  const {store}=setup();await store.mutate(d=>editCatalog(d,{kind:'archiveFamily',code:family(d).code,archived:true}));const original=store.data.transactions[0];
  await store.update('transactions',txs=>txs.map(t=>({...t,description:'Histórico editado'})));assert.equal(store.data.transactions[0].code,original.code);
  await assert.rejects(store.update('transactions',txs=>[{...original,id:'new'},...txs]),/archivada/);
  await assert.rejects(store.update('budgetPlans',plans=>[...plans,{...parent,monthYear:'2027-01',plannedAmount:1}]),/archivada/);
});
for(const failure of ['copy','verify','active'] as const)test(`catálogo personal: recuperación y fallo ${failure} conservan estado; reintento único`,async()=>{
  const {store,storage}=setup(),before=storage.getItem(DATA_KEY),old=structuredClone(store.data);storage.fail=failure;
  await assert.rejects(store.mutate(d=>createFamily(d)));assert.equal(storage.getItem(DATA_KEY),before);assert.deepEqual(store.data,old);
  storage.fail='';await store.mutate(d=>createFamily(d));assert.equal(makeBackup(store.data).version,'3.4');assert.equal(store.data.budgetGroups.filter(g=>g.code==='family-new').length,1);
  const copy=parseBackup([...storage.values].find(([k,v])=>k.startsWith(RECOVERY_PREFIX)&&v!=='incompleto')![1]);assert.deepEqual(copy.budgetGroups,old.budgetGroups);
});
for(const version of ['2.5','2.6','2.7','2.8','2.9','3.0','3.1','3.2','3.3'] as const)test(`catálogo personal: abrir ${version} no migra; primera escritura 3.4 conserva recuperación`,async()=>{
  const d=fixture(version==='3.3');delete d.defaultWalletId;
  if(version==='2.9')d.planningMonths=[{monthYear:month,savingsCents:0,revision:1}];
  if(version==='3.0')d.planningAutomation={rules:[{id:'old',name:'Histórica',target:parent.type,code:parent.code,amountCents:100,frequency:'monthly',startMonth:month,active:true}],carryovers:[],origins:[],history:[]};
  if(version==='3.1')d.intelligentFinance={recurringRules:[],occurrences:[],obligations:[]};if(version==='3.2')d.defaultWalletId='bank';
  const storage=new Storage();storage.setItem(DATA_KEY,JSON.stringify({...makeBackup(d),version}));const raw=storage.getItem(DATA_KEY),writes=storage.writes,store=new FinanceStore(storage,fixture(false),async write=>write());assert.equal(storage.getItem(DATA_KEY),raw);assert.equal(storage.writes,writes);
  await store.mutate(d=>createFamily(d));assert.equal(makeBackup(store.data).version,'3.4');const copy=parseBackup([...storage.values].find(([k])=>k.startsWith(RECOVERY_PREFIX))![1]);assert.equal(copy.version,makeBackup(d).version);sameFinances(d,copy);sameFinances(d,store.data);
});
test('catálogo personal: orden de familias por tipo y entradas heredadas sin normalizar subgrupos',()=>{const d=createFamily(fixture()),ordered=editCatalog(d,{kind:'reorderFamily',code:'family-new',direction:-1});assert.equal(ordered.budgetGroups.filter(g=>g.type==='GASTO')[0].code,'family-new');sameFinances(d,ordered);assert.equal(catalogEntry(ordered,parent).item!.groupCode,catalogEntry(d,parent).item!.groupCode);});
test('catálogo personal: cuota y pestaña obsoleta no permiten sobrescribir un catálogo',async()=>{const d=fixture(),{store,storage}=setup(d),other=new FinanceStore(storage,d,async write=>write());await store.mutate(d=>createFamily(d));const saved=storage.getItem(DATA_KEY);await assert.rejects(other.mutate(d=>createFamily(d,'other')),/Otra pestaña/);assert.equal(storage.getItem(DATA_KEY),saved);});
test('catálogo personal: 3.4 rechaza estados inválidos y las versiones anteriores rechazan metadatos nuevos',()=>{const d=createFamily(fixture());const b=makeBackup(d);assert.throws(()=>parseBackup(JSON.stringify({...b,version:'3.3'})),/campo no reconocido/);assert.throws(()=>parseBackup(JSON.stringify({...b,budgetGroups:b.budgetGroups.map(g=>g.code==='family-new'?{...g,deleted:true,archived:false}:g)})),/archivada/);});

test('catálogo personal: reordenar omite tombstones y nunca cambia su identidad',()=>{
  let d=createFamily(fixture());for(const id of ['a','b','c'])d=editCatalog(d,{kind:'createPartida',groupCode:'family-new',name:id,description:'',keywords:[],id});
  d=editCatalog(d,{kind:'deletePartida',parent:{type:'GASTO',code:'partida-a'}});const retired=d.budgetGroups.find(g=>g.code==='family-new')!.partidas[0];
  const next=editCatalog(d,{kind:'reorderPartida',parent:{type:'GASTO',code:'partida-c'},direction:-1});assert.deepEqual(next.budgetGroups.find(g=>g.code==='family-new')!.partidas.map(p=>p.code),['partida-a','partida-c','partida-b']);assert.deepEqual(next.budgetGroups.find(g=>g.code==='family-new')!.partidas[0],retired);assertCatalogTransition(d,next);
});
test('catálogo personal: una referencia antigua no permite duplicar ni mover una identidad retirada',()=>{
  let d=createFamily(fixture());d=editCatalog(d,{kind:'createPartida',groupCode:'family-new',name:'Sin uso',description:'',keywords:[],id:'old'});const p=catalogEntry(d,{type:'GASTO',code:'partida-old'}).item!;d=editCatalog(d,{kind:'deletePartida',parent:p});
  assert.throws(()=>editCatalog(d,{kind:'duplicatePartida',parent:p}),/ya no existe/);assert.throws(()=>editCatalog(d,{kind:'movePartida',parent:p,groupCode:family(d).code}),/ya no existe/);
});

// PR #22 review: economic immutability and reviewed active-rule archival.
for(const target of ['partida','familia'] as const)for(const monthly of [false,true])test(`archivo: FinanceStore protege previsión existente y desglose (${target}, desglose=${monthly})`,async()=>{
  const {store,storage}=setup(fixture(monthly,monthly));
  const edit=target==='familia'?{kind:'archiveFamily' as const,code:family(store.data).code}:{kind:'archivePartida' as const,parent};
  const original=structuredClone(store.data);
  await store.mutate({catalog:{...edit,archived:true}});
  assert.deepEqual(store.data.budgetPlans,original.budgetPlans);assert.deepEqual(store.data.budgetSubitems,original.budgetSubitems);
  const before=storage.getItem(DATA_KEY),writes=storage.writes;
  const change=(d:FinanceData)=>({...d,budgetPlans:d.budgetPlans.map(p=>p.code===parent.code?{...p,plannedAmount:p.plannedAmount+1}:p),budgetSubitems:d.budgetSubitems?{...d.budgetSubitems,months:d.budgetSubitems.months.map(m=>({...m,lines:m.lines.map((l,i)=>({...l,amountCents:l.amountCents+(i===0?100:0)}))}))}:undefined});
  await assert.rejects(store.mutate(change),/solo lectura/);
  await assert.rejects(store.update('budgetPlans',plans=>plans.filter(p=>p.code!==parent.code)),/solo lectura/);
  if(monthly){
    await assert.rejects(store.update('budgetSubitems',s=>({...s!,months:s!.months.map(m=>({...m,lines:m.lines.map((l,i)=>({...l,amountCents:l.amountCents+(i===0?100:-100)}))}))})),/desglose.*solo lectura/);
    await assert.rejects(store.update('budgetSubitems',s=>({...s!,months:[]})),/desglose.*solo lectura/);
    // Ordering an unchanged distribution is not an economic edit.
    await store.update('budgetSubitems',s=>({...s!,months:s!.months.map(m=>({...m,lines:[...m.lines].reverse()}))}));
  }
  const unchanged=storage.getItem(DATA_KEY);
  await assert.rejects(store.mutate(d=>change(editCatalog(d,{...edit,archived:false}))),/solo lectura/);
  assert.equal(storage.getItem(DATA_KEY),unchanged);
  if(!monthly){assert.equal(before,unchanged);assert.equal(storage.writes,writes);}
  await store.mutate({catalog:{...edit,archived:false}});
  assert.deepEqual(store.data.budgetPlans,original.budgetPlans);
  await store.mutate(change);assert.equal(store.data.budgetPlans.find(p=>p.code===parent.code)!.plannedAmount,101);
});

import {catalogArchiveFixture} from '../../scripts/catalogArchiveFixture';
for(const target of ['partida','familia'] as const)test(`archivo: alcance y confirmación explícita de reglas activas (${target})`,async()=>{
  const {store,storage}=setup(catalogArchiveFixture());
  const edit=target==='familia'?{kind:'archiveFamily' as const,code:family(store.data).code}:{kind:'archivePartida' as const,parent};
  const impact=catalogArchiveImpact(store.data,edit),original=structuredClone(store.data),before=storage.getItem(DATA_KEY);
  assert.equal(impact.dependencies.length,target==='familia'?4:2);
  assert.ok(!impact.dependencies.some(r=>/inactivo|inactiva|retirado|independiente/.test(r.name)));
  await assert.rejects(store.mutate(d=>editCatalog(d,{...edit,archived:true})),/reglas activas/);
  await assert.rejects(store.mutate({catalog:{...edit,archived:true}}),/reglas activas/);
  assert.equal(storage.getItem(DATA_KEY),before);
  await store.mutate({catalog:{...edit,archived:true,scope:impact.scope}});
  for(const field of ['budgetPlans','budgetSubitems','transactions','intelligentFinance','planningAutomation'] as const)assert.deepEqual(store.data[field],original[field]);
});
for(const change of ['importe','activar','nueva','reasignar','retirar'] as const)test(`archivo: confirmación obsoleta por cambio simultáneo de reglas (${change})`,async()=>{
  const {store,storage}=setup(catalogArchiveFixture()),edit={kind:'archivePartida' as const,parent},scope=catalogArchiveImpact(store.data,edit).scope;
  await store.mutate(d=>({...d,planningAutomation:{...d.planningAutomation!,rules:change==='nueva'?[...d.planningAutomation!.rules,{...d.planningAutomation!.rules[0],id:'new'}]:d.planningAutomation!.rules.flatMap(r=>change==='retirar'&&r.id==='active'?[]:[r.id===(change==='activar'?'inactive':'active')?{...r,...(change==='activar'?{active:true}:change==='reasignar'?{code:'other'}:{amountCents:r.amountCents+1})}:r])}}));
  const before=storage.getItem(DATA_KEY),writes=storage.writes;
  await assert.rejects(store.mutate({catalog:{...edit,archived:true,scope}}),/alcance.*cambiado/);
  assert.equal(storage.getItem(DATA_KEY),before);assert.equal(storage.writes,writes);
});
test('archivo: alcance vacío también se revalida si aparece una regla antes de guardar',async()=>{
  const {store}=setup(catalogArchiveFixture()),edit={kind:'archivePartida' as const,parent:{type:'INGRESO' as const,code:'i'}},scope=catalogArchiveImpact(store.data,edit).scope;
  await store.mutate(d=>({...d,planningAutomation:{...d.planningAutomation!,rules:[...d.planningAutomation!.rules,{...d.planningAutomation!.rules[0],id:'income',target:'INGRESO',code:'i'}]}}));
  await assert.rejects(store.mutate({catalog:{...edit,archived:true,scope}}),/alcance.*cambiado/);
});
test('archivo: una mutación directa no puede confirmar archivo y cambiar las reglas afectadas',async()=>{
  const data=catalogArchiveFixture(),edit={kind:'archivePartida' as const,parent,archived:true},scope=catalogArchiveImpact(data,{kind:edit.kind,parent}).scope;
  const archived=editCatalog(data,edit),changed={...archived,planningAutomation:{...archived.planningAutomation!,rules:archived.planningAutomation!.rules.map(r=>({...r,active:false}))}};
  assert.throws(()=>assertCatalogTransition(data,changed,{...edit,scope}),/no puede borrar, desactivar ni reasignar/);
});
