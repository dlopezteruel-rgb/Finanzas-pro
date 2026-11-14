import test from 'node:test';
import assert from 'node:assert/strict';
import {BUDGET_GROUPS} from '../constants/categories';
import {makeBackup,parseBackup,DATA_KEY,RECOVERY_PREFIX,type FinanceData} from './backup';
import {FinanceStore,loadFinanceData} from './financeStore';
import {editCatalog,assertCatalogTransition} from './budgetCatalog';
import {systemCatalogNames,defaultFamilies,defaultItems,defaultSubgroups,isSystemFamily,isSystemItem,isSystemSubgroup,catalogNameCandidates,catalogNamesScope,reviewCatalogNames,selectedCatalogNames,validateCatalogNames} from './catalogNames';
import {budgetSubitemFixture} from '../../scripts/budgetSubitemFixture';

const fixture=():FinanceData=>({...budgetSubitemFixture(true,true),budgetGroups:structuredClone(BUDGET_GROUPS)});
const fresh=():FinanceData=>({...fixture(),catalogNames:systemCatalogNames()});
const parent={type:'GASTO' as const,code:'F.001.001'};
class Storage{
  values=new Map<string,string>();writes=0;fail:''|'copy'|'verify'|'active'='';
  get length(){return this.values.size;}key(i:number){return [...this.values.keys()][i]??null;}getItem(k:string){return this.values.get(k)??null;}
  setItem(k:string,v:string){if(this.fail==='copy'&&k.startsWith(RECOVERY_PREFIX)||this.fail==='active'&&k===DATA_KEY)throw new Error('Cuota ficticia');this.writes++;this.values.set(k,this.fail==='verify'&&k.startsWith(RECOVERY_PREFIX)?'incompleto':v);}
}
function setup(data=fixture()){const storage=new Storage();storage.setItem(DATA_KEY,JSON.stringify(makeBackup(data)));return {storage,store:new FinanceStore(storage,fresh(),async write=>write())};}
function unchanged(a:FinanceData,b:FinanceData){for(const field of Object.keys(a).filter(k=>!['catalogNames','version','exportedAt'].includes(k)) as (keyof FinanceData)[])assert.deepEqual(b[field],a[field],field);}

test('5D: 12 familias, 77 partidas y 31 subgrupos; tipo separa códigos coincidentes',()=>{
 assert.equal(defaultFamilies.size,12);assert.equal(defaultItems.size,77);assert.equal(defaultSubgroups.size,31);
 assert.notEqual(defaultItems.get('GASTO:F.001.001')!.name,defaultItems.get('INGRESO:F.001.001')!.name);
 validateCatalogNames(fresh());assert.equal(makeBackup(fresh()).version,'3.5');
});
test('5D: igualdad de nombres y códigos antiguos nunca atribuye procedencia de sistema',()=>{
 const d=fixture(),g=d.budgetGroups[0],p=g.partidas[0];assert.equal(isSystemFamily(d,g),false);assert.equal(isSystemItem(d,p),false);assert.equal(isSystemSubgroup(d,p),false);
 assert.equal(catalogNameCandidates(d).length,120);assert.deepEqual(selectedCatalogNames(d),[]);assert.equal(d.catalogNames,undefined);
});
test('5D: revisión explícita y reversión solo cambian metadatos, nunca importes, históricos ni aprobaciones',()=>{
 const d=fixture(),selected=catalogNameCandidates(d),next=reviewCatalogNames(d,selected,catalogNamesScope(d));unchanged(d,next);assert.equal(selectedCatalogNames(next).length,120);
 const back=reviewCatalogNames(next,[],catalogNamesScope(next));unchanged(d,back);assert.equal(selectedCatalogNames(back).length,0);assert.equal(makeBackup(back).version,'3.5');
});
test('5D: los nombres personales o identidades nuevas no se ofrecen para inferencia',()=>{
 let d=editCatalog(fixture(),{kind:'renameFamily',code:'F_EXP',name:'MI FAMILIA'});d=editCatalog(d,{kind:'updatePartida',parent,name:'F.001.001',description:'',keywords:[]});
 d=editCatalog(d,{kind:'createFamily',type:'GASTO',id:'personal',name:BUDGET_GROUPS[0].name});
 const candidates=catalogNameCandidates(d);assert.ok(!candidates.some(t=>t.kind==='family'&&['F_EXP','family-personal'].includes(t.code)));assert.ok(!candidates.some(t=>t.kind==='item'&&t.type===parent.type&&t.code===parent.code));
});
test('5D: revisión revalida el alcance y rechaza selecciones duplicadas o manipuladas',()=>{
 const d=fixture(),scope=catalogNamesScope(d),candidate=catalogNameCandidates(d)[0];
 assert.throws(()=>reviewCatalogNames(editCatalog(d,{kind:'renameFamily',code:'F_EXP',name:'Propia'}),[candidate],scope),/ha cambiado/);
 for(const selected of [[candidate,candidate],[{kind:'family',code:'unknown'}],[null],[{kind:'item',type:'GASTO',code:parent.code,extra:true}]] as any[])assert.throws(()=>reviewCatalogNames(d,selected,scope),/selección inválida/);
});
for(const same of [false,true])test(`5D: renombrar retira procedencia incluso con igual ortografía (${same})`,()=>{
 const d=fresh(),g=d.budgetGroups.find(g=>g.code==='F_EXP')!,p=g.partidas[0];
 const next=editCatalog(d,{kind:'renameFamily',code:g.code,name:same?g.name:'Personal'});assert.equal(isSystemFamily(next,next.budgetGroups.find(g=>g.code==='F_EXP')!),false);
 const item=editCatalog(d,{kind:'updatePartida',parent,name:same?p.name:'Personal',description:'',keywords:[],personalizeName:true});assert.ok(!item.catalogNames!.items.some(ref=>ref.type===parent.type&&ref.code===parent.code));assert.equal(item.catalogNames!.families.length,12);
});
test('5D: editar descripción no personaliza nombre; duplicar y crear no heredan procedencia',()=>{
 const d=fresh(),p=d.budgetGroups.find(g=>g.code==='F_EXP')!.partidas[0],next=editCatalog(d,{kind:'updatePartida',parent,name:p.name,description:'Descripción personal',keywords:['propia']});assert.equal(isSystemItem(next,p),true);
 const copy=editCatalog(next,{kind:'duplicatePartida',parent});assert.deepEqual(copy.catalogNames,next.catalogNames);const originals=new Set(next.budgetGroups.flatMap(g=>g.partidas.map(p=>`${p.type}:${p.code}`)));const created=copy.budgetGroups.flatMap(g=>g.partidas).find(p=>!originals.has(`${p.type}:${p.code}`))!;assert.equal(isSystemItem(copy,created),false);
});
test('5D: archivo, reactivación, traslado y orden conservan procedencia e identidades',()=>{
 const d=fresh();let next=editCatalog(d,{kind:'archiveFamily',code:'F_EXP',archived:true});next=editCatalog(next,{kind:'archiveFamily',code:'F_EXP',archived:false});next=editCatalog(next,{kind:'movePartida',parent,groupCode:'V_EXP'});next=editCatalog(next,{kind:'reorderFamily',code:'V_EXP',direction:-1});validateCatalogNames(next);assert.deepEqual(next.catalogNames,d.catalogNames);assertCatalogTransition(d,next);
 for(const field of ['transactions','budgetPlans','budgetSubitems','planningMonths','wallets','loans'] as const)assert.deepEqual(next[field],d[field]);
});
for(const bad of ['unknown','duplicate','extra','version','personal','subgroup','missing'] as const)test(`5D: validación estricta de procedencia (${bad})`,()=>{
 const d=fresh();if(bad==='unknown')d.catalogNames!.families[0]='unknown';if(bad==='duplicate')d.catalogNames!.items[0]=d.catalogNames!.items[1];if(bad==='extra')(d.catalogNames as any).extra=true;if(bad==='version')(d.catalogNames as any).version=2;if(bad==='personal')d.budgetGroups[0].name='Personal';if(bad==='subgroup')d.budgetGroups[0].partidas[0].groupName='Personal';if(bad==='missing')d.budgetGroups[0].partidas.shift();assert.throws(()=>parseBackup(JSON.stringify(makeBackup(d))),/Nombres del catálogo/);
});
test('5D: datos 3.5 viajan con exportación/restauración; 3.4 rechaza metadatos nuevos',()=>{
 const d=fresh(),roundtrip=parseBackup(JSON.stringify(makeBackup(d)));unchanged(d,roundtrip);assert.deepEqual(roundtrip.catalogNames,d.catalogNames);assert.throws(()=>parseBackup(JSON.stringify({...makeBackup(d),version:'3.4'})),/campo no reconocido/);
});
for(const legacy of [false,true])test(`5D: lectura antigua no hereda procedencia ni escribe (${legacy?'claves heredadas':'snapshot'})`,()=>{
 const storage=new Storage(),d=fixture();if(legacy)storage.setItem('finanzas_pro_groups_v2',JSON.stringify(d.budgetGroups));else storage.setItem(DATA_KEY,JSON.stringify(makeBackup(d)));const before=storage.writes;
 const loaded=loadFinanceData(storage,fresh());assert.equal(loaded.catalogNames,undefined);assert.equal(storage.writes,before);
});
test('5D: defaults realmente nuevos tienen procedencia sin escritura al abrir',()=>{const storage=new Storage();assert.deepEqual(loadFinanceData(storage,fresh()).catalogNames,systemCatalogNames());assert.equal(storage.writes,0);});
test('5D: primera elección guarda y verifica copia anterior antes de JSON 3.5',async()=>{
 const {store,storage}=setup(),before=structuredClone(store.data);await store.mutate({catalog:{kind:'reviewNames',selected:catalogNameCandidates(store.data),scope:catalogNamesScope(store.data)}});
 unchanged(before,store.data);assert.equal(makeBackup(store.data).version,'3.5');const recovery=parseBackup([...storage.values].find(([k])=>k.startsWith(RECOVERY_PREFIX))![1]);assert.equal(recovery.catalogNames,undefined);unchanged(before,recovery);
 const other=new FinanceStore(storage,fresh(),async write=>write());assert.deepEqual(other.data.catalogNames,store.data.catalogNames);await other.restore(makeBackup(before));assert.equal(other.data.catalogNames,undefined);unchanged(before,other.data);
});
for(const failure of ['copy','verify','active'] as const)test(`5D: fallo ${failure} conserva datos anteriores y permite reintento`,async()=>{
 const {store,storage}=setup(),before=storage.getItem(DATA_KEY),old=structuredClone(store.data);storage.fail=failure;const edit={kind:'reviewNames' as const,selected:catalogNameCandidates(store.data),scope:catalogNamesScope(store.data)};
 await assert.rejects(store.mutate({catalog:edit}));assert.equal(storage.getItem(DATA_KEY),before);assert.deepEqual(store.data,old);storage.fail='';await store.mutate({catalog:edit});assert.equal(makeBackup(store.data).version,'3.5');unchanged(old,store.data);
});
test('5D: revisión desde pestaña obsoleta no sobrescribe cambios simultáneos',async()=>{
 const {store,storage}=setup(),other=new FinanceStore(storage,fresh(),async write=>write()),edit={kind:'reviewNames' as const,selected:catalogNameCandidates(store.data),scope:catalogNamesScope(store.data)};
 await store.mutate({catalog:edit});const before=storage.getItem(DATA_KEY);await assert.rejects(other.mutate({catalog:edit}),/Otra pestaña/);assert.equal(storage.getItem(DATA_KEY),before);
});
test('5D: mutación directa no puede traducir un nombre personalizado usando procedencia obsoleta',async()=>{
 const {store,storage}=setup(fresh()),before=storage.getItem(DATA_KEY);await assert.rejects(store.update('budgetGroups',groups=>groups.map(g=>g.code==='F_EXP'?{...g,name:'Personal'}:g)),/Nombres del catálogo/);assert.equal(storage.getItem(DATA_KEY),before);
});
test('5D: identidades duplicadas no reciben traducción y conservan el rechazo de importación previo',()=>{
 const d=fixture(),g=d.budgetGroups.find(g=>g.code==='F_EXP')!,p=g.partidas[0];d.budgetGroups.push(structuredClone(g));
 assert.equal(isSystemFamily(d,g),false);assert.equal(isSystemItem(d,p),false);assert.ok(!catalogNameCandidates(d).some(t=>t.kind==='family'&&t.code===g.code||t.kind==='item'&&t.type===p.type&&t.code===p.code));
 const before=JSON.stringify(d);assert.throws(()=>parseBackup(JSON.stringify(makeBackup(d))),/contiene identificadores duplicados/);assert.equal(JSON.stringify(d),before);
 assert.throws(()=>reviewCatalogNames(d,[{kind:'family',code:g.code}],catalogNamesScope(d)),/selección inválida/);assert.throws(()=>validateCatalogNames({...d,catalogNames:systemCatalogNames()}),/Nombres del catálogo/);
});
