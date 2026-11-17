import test from 'node:test';
import assert from 'node:assert/strict';
import {DATA_KEY,RECOVERY_PREFIX,makeBackup,parseBackup,parseSnapshot,serializeSnapshot,StorageConflictError,type FinanceData} from '../../utils/backup';
import {FinanceStore} from '../../utils/financeStore';
import {memoryFinanceStorage} from '../financeBinding';
import {WebController,ReadOnlyWebController} from './controller';
import {digest,WebTransactionAborted,type Head,type Inspection,type Migration,type Receipt,type WebDriver,type WriteRequest} from './protocol';
import {legacyInventory,sourceHash,sourceData,verifyLegacy} from './legacy';
import {intelligentFixture} from '../../../scripts/intelligentFixture';
import {multilingualCatalogFixture} from '../../../scripts/multilingualCatalogFixture';

/** Controlled transport/commit outcomes; the actual IDB engine is tested in Chromium separately. */
class ControlledDriver implements WebDriver {
 head:Head;receipts=new Map<string,Omit<Receipt,'head'>>();savedCopies=new Map<string,string>();commits=0;attempts=0;fail:''|'abort'|'quota'|'reply'='';resolveFails=false;
 gate?:Promise<void>;started?:()=>void;afterCommit?:()=>void;
 constructor(readonly migration:Migration,head:Head){this.head=structuredClone(head);}
 async inspect():Promise<Inspection>{return {migration:this.migration,head:structuredClone(this.head)};}
 async prepare():Promise<void>{throw Error('Controller may not migrate through a financial mutation.');}
 async activate():Promise<void>{throw Error('Controller may not activate through a financial mutation.');}
 async commit(r:WriteRequest):Promise<Receipt>{
  this.attempts++;this.started?.();if(this.gate)await this.gate;
  const fault=this.fail;this.fail='';
  if(fault==='abort'||fault==='quota')throw new WebTransactionAborted(fault==='quota'?new DOMException('Synthetic quota','QuotaExceededError'):undefined);
  if(this.head.snapshot!==r.expected)throw new StorageConflictError();
  const copies=new Map(this.savedCopies);for(const copy of r.copies){assert.equal(copies.has(copy.key),false);copies.set(copy.key,copy.content);}
  this.head={snapshot:r.next,hash:r.hash,operationId:r.id};this.savedCopies=copies;this.commits++;
  const receipt={id:r.id,fingerprint:r.fingerprint,status:'committed' as const,snapshotHash:r.hash};this.receipts.set(r.id,receipt);this.afterCommit?.();
  if(fault==='reply')throw Error('Synthetic response loss after commit.');
  return {...receipt,head:structuredClone(this.head)};
 }
 async resolve(id:string,fingerprint:string):Promise<Receipt>{
  if(this.resolveFails)throw Error('Synthetic unavailable transport.');
  if(!this.receipts.has(id))this.receipts.set(id,{id,fingerprint,status:'aborted',snapshotHash:null});
  return {...this.receipts.get(id)!,head:structuredClone(this.head)};
 }
 async copies(){return [...this.savedCopies].map(([key,content])=>({key,content}));}
 async forensic(){return {records:[{key:DATA_KEY,value:this.head.snapshot}],operations:[...this.receipts.values()]};}
 close(){}
}
const same=async<T>(work:()=>Promise<T>)=>work();
const addWallet=(id='new')=>(data:FinanceData)=>({...data,wallets:[...data.wallets,{id,name:'CUENTA '+id,type:'BANK' as const,initialBalance:123.45,color:'#123456'}]});
async function fixture(data:FinanceData=intelligentFixture(),raw=serializeSnapshot(data)){
 const storage=memoryFinanceStorage(),source={[DATA_KEY]:raw},hash=await digest(raw),id=crypto.randomUUID(),guard=JSON.stringify({finanzasWebStorage:'indexeddb-strict-v1',databaseId:id});
 const migration:Migration={schema:1,id,guard,status:'active',source,sourceHash:await sourceHash(source),initialHash:hash};storage.setItem(DATA_KEY,guard);
 const driver=new ControlledDriver(migration,{snapshot:raw,hash,operationId:null});
 const controller=new WebController(driver,storage,migration,driver.head,data,same);
 return {controller,driver,storage,migration,raw};
}
const normalized=(data:FinanceData)=>{const {exportedAt,...rest}=makeBackup(data);return rest;};

test('WEB-001: legacy archive inventory excludes independent preferences, preserves all financial bytes and has locale-independent identity',async()=>{
 const storage=memoryFinanceStorage();for(const [key,value]of [['finanzas.ui.language','fr'],['finanzas.ui.theme','light'],[DATA_KEY,'raw'],[RECOVERY_PREFIX+'old','backup'],['finanzas_pro_transactions_v2','[]'],['finanzas_pro_web_metadata','internal']])storage.setItem(key,value);
 const source=legacyInventory(storage);assert.deepEqual(source,{[DATA_KEY]:'raw',[RECOVERY_PREFIX+'old']:'backup',finanzas_pro_transactions_v2:'[]'});
 assert.equal(await sourceHash(source),await sourceHash(Object.fromEntries(Object.entries(source).reverse())));
});
test('WEB-001: detached staging never publishes or confirms while commit is pending',async()=>{
 const f=await fixture(),before=JSON.stringify(f.controller.data);let release!:()=>void,started!:()=>void;
 f.driver.gate=new Promise(r=>{release=r;});const reached=new Promise<void>(r=>{started=r;});f.driver.started=started;
 let resolved=false;const saved=f.controller.mutate(addWallet()).then(()=>{resolved=true;});await reached;
 assert.equal(f.controller.phase,'saving');assert.equal(resolved,false);assert.equal(JSON.stringify(f.controller.data),before);assert.equal(f.driver.commits,0);
 release();await saved;assert.equal(resolved,true);assert.equal(f.controller.data.wallets.length,2);assert.equal(f.driver.commits,1);assert.equal(f.controller.phase,'ready');
});
for(const fault of ['abort','quota'] as const)test(`WEB-001: known transaction ${fault} keeps data/copies and allows an explicit fresh retry`,async()=>{
 const f=await fixture(),before=JSON.stringify(f.controller.data);f.driver.fail=fault;
 await assert.rejects(f.controller.mutate(addWallet()),fault==='quota'?{name:'QuotaExceededError'}:/WEB_NOT_COMMITTED/);
 assert.equal(f.controller.phase,'ready');assert.equal(JSON.stringify(f.controller.data),before);assert.equal(f.driver.head.snapshot,f.raw);assert.equal(f.driver.savedCopies.size,0);
 await f.controller.mutate(addWallet());assert.equal(f.driver.commits,1);assert.equal(f.controller.data.wallets.filter(w=>w.id==='new').length,1);
});
test('WEB-001: lost commit response reconciles a durable receipt without a second financial mutation',async()=>{
 const f=await fixture();f.driver.fail='reply';await f.controller.mutate(addWallet());assert.equal(f.driver.attempts,1);assert.equal(f.driver.commits,1);assert.equal(f.controller.data.wallets.filter(w=>w.id==='new').length,1);
});
test('WEB-001: uncertain response freezes new mutations; later known commit requires reload and retains the old form model',async()=>{
 const f=await fixture();f.driver.fail='reply';f.driver.resolveFails=true;await assert.rejects(f.controller.mutate(addWallet()),/WEB_UNCERTAIN/);assert.equal(f.controller.phase,'recoveryRequired');assert.equal(f.controller.data.wallets.length,1);
 let transformed=false;await assert.rejects(f.controller.mutate(d=>{transformed=true;return d;}));assert.equal(transformed,false);assert.equal(f.driver.commits,1);
 f.driver.resolveFails=false;await assert.rejects(f.controller.reconcile(),/WEB_RELOAD/);assert.equal(f.controller.phase,'reloadRequired');assert.equal(f.controller.data.wallets.length,1);assert.equal(f.driver.commits,1);
 const reopened=new WebController(f.driver,f.storage,f.migration,f.driver.head,intelligentFixture(),same);assert.equal(reopened.data.wallets.filter(w=>w.id==='new').length,1);
});
test('WEB-001: absent operation receipt is cancelled transactionally, never blindly replayed',async()=>{
 const f=await fixture();f.driver.commit=async()=>{throw Error('Before transaction.');};await assert.rejects(f.controller.mutate(addWallet()),/WEB_NOT_COMMITTED/);assert.equal(f.controller.phase,'ready');assert.equal(f.driver.commits,0);assert.equal([...f.driver.receipts.values()][0].status,'aborted');assert.equal(f.driver.head.snapshot,f.raw);
});
test('WEB-001: two stale controllers cannot overwrite a confirmed snapshot',async()=>{
 const f=await fixture(),other=new WebController(f.driver,f.storage,f.migration,f.driver.head,intelligentFixture(),same);
 const results=await Promise.allSettled([f.controller.mutate(addWallet('a')),other.mutate(addWallet('b'))]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(f.driver.commits,1);const loser=results[0].status==='rejected'?f.controller:other;assert.equal(loser.phase,'conflict');assert.equal(loser.data.wallets.length,1);assert.equal(await loser.checkForConflict(),true);assert.ok(results.some(r=>r.status==='rejected'&&r.reason instanceof StorageConflictError));
});
test('WEB-001: a committed reply overtaken by another writer never claims the first operation was not saved',async()=>{
 const f=await fixture();f.driver.afterCommit=()=>{const data=parseBackup(JSON.stringify(makeBackup(addWallet('second')(parseSnapshot(f.driver.head.snapshot!)))));const snapshot=serializeSnapshot(data);f.driver.head={snapshot,hash:'different-known-head',operationId:'second'};};
 // Give the overtaking head a correct hash before the receipt is inspected.
 const original=f.driver.commit.bind(f.driver);f.driver.commit=async r=>{const reply=await original(r);f.driver.head.hash=await digest(f.driver.head.snapshot!);return {...reply,head:structuredClone(f.driver.head)};};
 await assert.rejects(f.controller.mutate(addWallet()),/WEB_RELOAD/);assert.equal(f.controller.phase,'reloadRequired');assert.equal(f.driver.commits,1);assert.equal(f.controller.data.wallets.length,1);
});
test('WEB-001: invalid economic proposals are rejected before any persistence attempt',async()=>{
 const f=await fixture(),before=JSON.stringify(f.controller.data);await assert.rejects(f.controller.mutate(d=>{d.wallets[0].initialBalance=Number.NaN;return d;}));assert.equal(f.driver.attempts,0);assert.equal(JSON.stringify(f.controller.data),before);assert.equal(f.driver.head.snapshot,f.raw);
});
test('WEB-001: restore preserves the complete recoverable previous document atomically',async()=>{
 const initial=multilingualCatalogFixture(),f=await fixture(initial),incoming=makeBackup(intelligentFixture());await f.controller.restore(incoming);
 assert.equal(f.driver.savedCopies.size,1);const previous=parseBackup([...f.driver.savedCopies.values()][0]);assert.deepEqual(normalized(previous),normalized(initial));assert.deepEqual(normalized(f.controller.data),normalized(incoming));
});
test('WEB-001: failed restore does not leave a new copy or replacement applied',async()=>{
 const initial=multilingualCatalogFixture(),f=await fixture(initial);f.driver.fail='abort';await assert.rejects(f.controller.restore(makeBackup(intelligentFixture())));assert.equal(f.driver.head.snapshot,f.raw);assert.equal(f.driver.savedCopies.size,0);assert.deepEqual(normalized(f.controller.data),normalized(initial));
});
test('WEB-001: same economic engine preserves exact finances on mutation and explicit restore',async()=>{
 const initial=multilingualCatalogFixture(),f=await fixture(initial),scratch=memoryFinanceStorage();scratch.setItem(DATA_KEY,f.raw);const original=new FinanceStore(scratch,initial,async work=>work());
 await original.mutate(addWallet());await f.controller.mutate(addWallet());assert.deepEqual(normalized(f.controller.data),normalized(original.data));
 const replacement=makeBackup(initial);await original.restore(replacement);await f.controller.restore(replacement);assert.deepEqual(normalized(f.controller.data),normalized(original.data));
});
test('WEB-001: repair accepts only exact archived legacy bytes; divergent old clients are preserved and blocked',async()=>{
 const f=await fixture();f.storage.setItem(DATA_KEY,f.raw);await verifyLegacy(f.storage,f.migration,true);assert.equal(f.storage.getItem(DATA_KEY),f.migration.guard);
 const divergent=serializeSnapshot(addWallet('old-client')(intelligentFixture()));f.storage.setItem(DATA_KEY,divergent);await assert.rejects(f.controller.mutate(addWallet()),/WEB_LEGACY_DIVERGED/);assert.equal(f.storage.getItem(DATA_KEY),divergent);assert.equal(f.driver.head.snapshot,f.raw);assert.equal(f.controller.phase,'readonly');assert.equal(f.driver.commits,0);
 const forensic=JSON.parse(await f.controller.forensic());assert.equal(forensic.legacy[DATA_KEY],divergent);assert.equal(forensic.database.records[0].value,f.raw);
});
test('WEB-001: readonly capability failure never writes; readable export remains complete and nonempty forensic is explicit',async()=>{
 const data=intelligentFixture(),storage=memoryFinanceStorage(),readonly=new ReadOnlyWebController(data,'WEB_STRICT_UNAVAILABLE',storage);
 await assert.rejects(readonly.mutate(addWallet()),/WEB_STRICT_UNAVAILABLE/);await assert.rejects(readonly.restore(makeBackup(data)),/WEB_STRICT_UNAVAILABLE/);assert.equal(storage.length,0);assert.deepEqual(normalized(parseBackup(await readonly.exportJSON())),normalized(data));await assert.rejects(readonly.forensic(),/WEB_FORENSIC_EMPTY/);
});
for(const version of ['2.5','2.6','2.7','2.8','2.9','3.0','3.1','3.2','3.3','3.4','3.5'] as const)test(`WEB-001: opening ${version} retains exact raw bytes and revisions, with no mutation or format upgrade`,async()=>{
 const data=version==='3.5'?multilingualCatalogFixture():intelligentFixture();if(version==='2.9')data.planningMonths=[{monthYear:'2026-11',savingsCents:0,revision:1}];
 if(version==='3.0')data.planningAutomation={rules:[{id:'rule',name:'Regla ficticia',target:'GASTO',code:'g',amountCents:100,frequency:'monthly',startMonth:'2026-11',active:true}],carryovers:[],origins:[],history:[]};
 if(version==='3.1')data.intelligentFinance={recurringRules:[],occurrences:[],obligations:[]};if(version==='3.2')data.defaultWalletId='bank';if(version==='3.3')data.budgetSubitems={items:[],months:[]};

 const raw=JSON.stringify({...makeBackup(data),version,revision:'historical-'+version});parseBackup(JSON.stringify({...JSON.parse(raw),revision:undefined}));
 const f=await fixture(data,raw);assert.equal(f.driver.head.snapshot,raw);assert.equal(f.driver.commits,0);assert.equal(f.driver.attempts,0);assert.deepEqual(f.controller.data,sourceData({[DATA_KEY]:raw},intelligentFixture()));
});

test('WEB-001: a readonly legacy view detects drift and refuses to export stale data as current',async()=>{
 const data=intelligentFixture(),storage=memoryFinanceStorage();storage.setItem(DATA_KEY,serializeSnapshot(data));const c=new ReadOnlyWebController(data,'WEB_LEGACY_VIEW',storage);assert.equal(await c.checkForConflict(),false);
 const changed=serializeSnapshot(addWallet()(data));storage.setItem(DATA_KEY,changed);assert.equal(await c.checkForConflict(),true);await assert.rejects(c.exportJSON(),/Otra pestaña/);assert.equal(storage.getItem(DATA_KEY),changed);assert.equal(c.data.wallets.length,1);
});
