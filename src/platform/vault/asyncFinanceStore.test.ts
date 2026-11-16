import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {SQLiteTestDriver,type FaultPoint} from '../../../scripts/native/sqliteTestDriver';
import {multilingualCatalogFixture} from '../../../scripts/multilingualCatalogFixture';
import {BUDGET_GROUPS} from '../../constants/categories';
import {systemCatalogNames} from '../../utils/catalogNames';
import {transferPair} from '../../utils/transfers';
import {saveSettlement} from '../../utils/sharedExpenses';
import {calculateWalletBalances} from '../../utils/finance';
import {FinanceStore} from '../../utils/financeStore';
import {makeBackup,parseBackup,parseSnapshot,StorageConflictError,serializeSnapshot,DATA_KEY} from '../../utils/backup';
import {memoryFinanceStorage} from '../financeBinding';
import {AsyncFinanceStore} from './asyncFinanceStore';
import {sha256,VaultError,type VaultDriver} from './protocol';

async function fixture(t:any){const dir=mkdtempSync(path.join(tmpdir(),'finanzas-vault-'));const driver=new SQLiteTestDriver(path.join(dir,'test.db'));t.after(async()=>{try{await driver.close();}catch{}rmSync(dir,{recursive:true,force:true});});const defaults=multilingualCatalogFixture(),store=await AsyncFinanceStore.open(driver,defaults);return {dir,driver,defaults,store};}
const wallet={id:'test-extra-wallet',name:'Cuenta ficticia',type:'CASH' as const,initialBalance:123.45,color:'#123456'};
const economic=(data:any)=>{const {exportedAt,version,...domain}=data;return domain;};

test('5H: opening a vault does not persist demo data; initialization is explicit',async t=>{
 const {driver,store}=await fixture(t);assert.equal(await driver.read(),null);assert.equal(driver.commits,0);
 await store.initialize();assert.equal(driver.commits,1);assert.ok(await driver.read());
 await store.initialize();assert.equal(driver.commits,1);
});
test('5H: the same FinanceStore produces economically identical native proposals',async t=>{
 const {dir,driver,defaults,store}=await fixture(t);await store.initialize();
 const memory=memoryFinanceStorage();memory.setItem(DATA_KEY,(await driver.read())!.snapshot);const web=new FinanceStore(memory,defaults,async write=>write());
 const edit=(d:typeof defaults)=>({...d,wallets:[...d.wallets,wallet]});await web.mutate(edit);await store.mutate(edit);
 assert.deepEqual(economic(store.data),economic(web.data));assert.equal(store.data.wallets.at(-1)!.initialBalance,123.45);
 const reopened=await AsyncFinanceStore.open(new SQLiteTestDriver(path.join(dir,'test.db')),defaults);assert.deepEqual(economic(reopened.data),economic(store.data));await reopened.close();
 const raw=(await driver.read())!;assert.deepEqual(economic(parseSnapshot(raw.snapshot)),economic(store.data));
});
test('5H: React-facing state is not published while durable commit is pending',async t=>{
 const {driver,defaults}=await fixture(t);let release!:()=>void,entered!:()=>void;const gate=new Promise<void>(r=>release=r),reached=new Promise<void>(r=>entered=r);let calls=0;
 const wrapped:VaultDriver={read:()=>driver.read(),commit:async p=>{calls++;if(calls===2){entered();await gate;}return driver.commit(p);},resolve:(...a)=>driver.resolve(...a),recoveries:()=>driver.recoveries(),close:()=>driver.close()};
 const store=await AsyncFinanceStore.open(wrapped,defaults);await store.initialize();const before=store.data;const pending=store.mutate(d=>({...d,wallets:[...d.wallets,wallet]}));
 await reached;assert.equal(store.phase,'saving');assert.deepEqual(store.data,before);release();await pending;assert.ok(store.data.wallets.some(w=>w.id===wallet.id));
});
for(const point of ['beforeBegin','afterBegin','afterRecovery','beforeCommit'] as FaultPoint[])test(`5H: SQLite rollback at ${point} keeps head and recovery copies intact`,async t=>{
 const {driver,store}=await fixture(t);await store.initialize();const before=(await driver.read())!.snapshot;driver.fault=point;
 await assert.rejects(store.restore(makeBackup({...store.data,wallets:[...store.data.wallets,wallet]})),(e:any)=>e.code==='VAULT_NOT_COMMITTED');
 assert.equal((await driver.read())!.snapshot,before);assert.deepEqual(await driver.recoveries(),[]);assert.equal(store.phase,'ready');assert.ok(!store.data.wallets.some(w=>w.id===wallet.id));
});
test('5H: a lost response after commit reconciles once, without a duplicate operation',async t=>{
 const {driver,store}=await fixture(t);await store.initialize();driver.fault='afterCommit';await store.mutate(d=>({...d,wallets:[...d.wallets,wallet]}));
 assert.equal(driver.commits,2);assert.equal(store.data.wallets.filter(w=>w.id===wallet.id).length,1);assert.equal(store.phase,'ready');
});
test('5H: unresolved commit freezes writes and late confirmation requires reload',async t=>{
 const {driver,store}=await fixture(t);await store.initialize();const before=store.data;driver.fault='afterCommit';driver.failResolution=true;
 await assert.rejects(store.mutate(d=>({...d,wallets:[...d.wallets,wallet]})));assert.equal(store.phase,'recoveryRequired');assert.deepEqual(store.data,before);
 await assert.rejects(store.mutate(d=>d));driver.failResolution=false;await store.reconcile();assert.equal(store.phase,'reloadRequired');await assert.rejects(store.mutate(d=>d));assert.equal(driver.commits,2);
});
test('5H: CAS rejects a stale connection and never overwrites the winning document',async t=>{
 const {dir,driver,defaults,store}=await fixture(t);await store.initialize();const otherDriver=new SQLiteTestDriver(path.join(dir,'test.db'));t.after(()=>otherDriver.close());const other=await AsyncFinanceStore.open(otherDriver,defaults);
 await store.mutate(d=>({...d,wallets:[...d.wallets,wallet]}));const winning=(await driver.read())!.snapshot;
 await assert.rejects(other.mutate(d=>({...d,wallets:[...d.wallets,{...wallet,id:'stale',name:'Stale'}]})),StorageConflictError);assert.equal((await driver.read())!.snapshot,winning);assert.equal(other.phase,'conflict');
});
test('5H: request receipts are idempotent and aborted requests cannot arrive late',async t=>{
 const {driver,store}=await fixture(t);await store.initialize();const before=(await driver.read())!;const raw=serializeSnapshot(makeBackup({...store.data,wallets:[...store.data.wallets,wallet]}));
 const payload=JSON.stringify({protocol:1,operationId:crypto.randomUUID(),expectedRevision:before.revision,nextSnapshot:raw,recoveryKey:null});const first=await driver.commit(payload),again=await driver.commit(payload);assert.deepEqual(first,again);assert.equal(driver.commits,2);
 const cancelled=JSON.stringify({protocol:1,operationId:crypto.randomUUID(),expectedRevision:first.revision,nextSnapshot:serializeSnapshot(store.data),recoveryKey:null});const op=JSON.parse(cancelled);await driver.resolve(op.operationId,await sha256(cancelled));assert.equal((await driver.commit(cancelled)).status,'aborted');assert.equal(driver.commits,2);
 await assert.rejects(driver.commit(JSON.stringify({...op,nextSnapshot:raw})),VaultError);
});
test('5H: restoration retains a verified complete independent JSON recovery document',async t=>{
 const {store}=await fixture(t);await store.initialize();const before=economic(store.data);await store.restore(makeBackup({...store.data,wallets:[...store.data.wallets,wallet]}));
 const copies=await store.recoveryCopies();assert.equal(copies.length,1);assert.deepEqual(economic(parseBackup(copies[0].content)),before);assert.equal(JSON.parse(await store.exportJSON()).version,'3.5');
});
test('5H: native reads reject mismatched integrity without deleting',async t=>{
 const {driver,store}=await fixture(t);await store.initialize();driver.db.prepare('UPDATE active SET snapshot_hash=?').run('bad');await assert.rejects(AsyncFinanceStore.open(driver,store.data));assert.equal(Number(driver.db.prepare('SELECT count(*) AS n FROM active').get()!.n),1);
});

test('5H: unknown SQL versions are refused without replacing the file or its records',async t=>{
 const {dir,driver,store}=await fixture(t);await store.initialize();const old=(await driver.read())!.snapshot;driver.db.exec('PRAGMA user_version=9');
 assert.throws(()=>new SQLiteTestDriver(path.join(dir,'test.db')),VaultError);assert.equal(driver.db.prepare('PRAGMA user_version').get()!.user_version,9);assert.equal(driver.db.prepare('SELECT snapshot FROM active').get()!.snapshot,old);
});

test('5H: invalid financial proposals never reach SQLite and preserve the draft document',async t=>{
 const {driver,store}=await fixture(t);await store.initialize();const before=(await driver.read())!,commits=driver.commits;
 await assert.rejects(store.mutate(d=>({...d,transactions:[{} as any]})));assert.deepEqual(await driver.read(),before);assert.equal(driver.commits,commits);assert.equal(store.phase,'ready');
});
test('5H: rapid independent actions serialize against successive durable revisions',async t=>{
 const {driver,store}=await fixture(t);await store.initialize();await Promise.all(['first','second','third'].map(id=>store.mutate(d=>({...d,wallets:[...d.wallets,{...wallet,id,name:id}]}))));
 assert.equal(driver.commits,4);assert.deepEqual(store.data.wallets.slice(-3).map(w=>w.id),['first','second','third']);assert.equal((await driver.read())!.snapshotHash,await sha256((await driver.read())!.snapshot));
});
test('5H: missing active record after prior commits is corruption, never a new empty profile',async t=>{
 const {driver,store}=await fixture(t);await store.initialize();driver.db.exec('DELETE FROM active');await assert.rejects(AsyncFinanceStore.open(driver,store.data),(e:any)=>e.code==='VAULT_CORRUPT');assert.equal(driver.commits,1);
});

test('5H: an unavailable read freezes writes and can recover without inventing a pending financial operation',async t=>{
 const {driver,defaults}=await fixture(t);let locked=false;
 const wrapped:VaultDriver={read:()=>locked?Promise.reject(new VaultError('VAULT_LOCKED')):driver.read(),commit:p=>driver.commit(p),resolve:(...args)=>driver.resolve(...args),recoveries:()=>driver.recoveries(),close:()=>driver.close()};
 const store=await AsyncFinanceStore.open(wrapped,defaults);await store.initialize();const before=(await driver.read())!.snapshot;
 locked=true;await assert.rejects(store.checkForConflict());assert.equal(store.phase,'recoveryRequired');await assert.rejects(store.mutate(d=>d));locked=false;await store.reconcile();assert.equal(store.phase,'ready');assert.equal((await driver.read())!.snapshot,before);assert.equal(driver.commits,1);
});

for(const version of ['2.5','2.6','2.7','2.8','2.9','3.0','3.1','3.2','3.3','3.4','3.5'] as const)test(`5H: opening historical ${version} preserves exact bytes and revision without migration`,async t=>{
 const {driver,defaults}=await fixture(t);
 const legacy:any={version,exportedAt:'2026-11-01T00:00:00.000Z',theme:'dark',budgetGroups:structuredClone(BUDGET_GROUPS),transactions:[],budgetPlans:[],loans:[],wallets:[],contacts:[]};
 if(version==='2.9')legacy.planningMonths=[{monthYear:'2026-11',savingsCents:0,revision:1}];
 if(version==='3.0')legacy.planningAutomation={rules:[{id:'fictitious-rule',name:'Regla ficticia',target:'GASTO',code:'F.001.001',amountCents:100,frequency:'monthly',startMonth:'2026-11',active:true}],carryovers:[],origins:[],history:[]};
 if(version==='3.1')legacy.intelligentFinance={recurringRules:[],occurrences:[],obligations:[]};
 if(version==='3.2')legacy.defaultWalletId=null;
 if(version==='3.3')legacy.budgetSubitems={items:[],months:[]};
 if(version==='3.5')legacy.catalogNames=systemCatalogNames();
 parseBackup(JSON.stringify(legacy));const snapshot=JSON.stringify({...legacy,revision:'historical-'+version});
 await driver.commit(JSON.stringify({protocol:1,operationId:crypto.randomUUID(),expectedRevision:null,nextSnapshot:snapshot,recoveryKey:null}));
 const store=await AsyncFinanceStore.open(driver,defaults),before=(await driver.read())!;
 assert.deepEqual(economic(store.data),economic(legacy));assert.equal((await driver.read())!.snapshot,snapshot);assert.deepEqual(await driver.read(),before);assert.equal(driver.commits,1);assert.equal(store.phase,'ready');
});

test('5H: active state without its matching committed receipt is rejected and retained',async t=>{
 const {driver,store}=await fixture(t);await store.initialize();const before=(await driver.read())!;driver.db.prepare('DELETE FROM operations WHERE operation_id=?').run(before.operationId);
 await assert.rejects(AsyncFinanceStore.open(driver,store.data),(e:any)=>e.code==='VAULT_CORRUPT');assert.equal(driver.db.prepare('SELECT snapshot FROM active').get()!.snapshot,before.snapshot);assert.equal(driver.commits,1);
});

test('5H: linked transfers, loan payment, reimbursement, approvals and catalogue stay exactly equivalent to web',async t=>{
 const {driver,defaults,store}=await fixture(t);await store.initialize();const memory=memoryFinanceStorage();memory.setItem(DATA_KEY,(await driver.read())!.snapshot);const web=new FinanceStore(memory,defaults,async write=>write());
 const [from,to]=defaults.wallets,code=defaults.budgetGroups.find(g=>g.type==='GASTO')!.partidas[0].code;
 const add=(d:typeof defaults)=>({...d,loans:[...d.loans,{id:'vault-loan',name:'Préstamo ficticio',entity:'Entidad ficticia',principal:1000,interestRate:3,totalTermMonths:12,startDate:'2026-10-01',monthlyPayment:85,wallet:from.name,code}],transactions:[...d.transactions,{id:'vault-loan-payment',type:'GASTO' as const,code,loanId:'vault-loan',amount:85,date:'2026-11-09',categoryName:'Familia ficticia',subcategoryName:'Cuota ficticia',description:'Cuota ficticia',wallet:from.name,processed:true},...transferPair(d.wallets,{fromWalletId:from.id,toWalletId:to.id,amount:123.45,date:'2026-11-09',concept:'Traspaso ficticio',processed:true},'vault-transfer')]});
 await web.mutate(add);await store.mutate(add);
 const settle=(d:typeof defaults)=>saveSettlement(d,{expenseId:'shared',contactId:'bea',amount:1.23,date:'2026-11-10',processed:true,kind:'cash',walletId:from.id,operationId:'vault-reimbursement'});
 await web.mutate(settle);await store.mutate(settle);
 assert.deepEqual(economic(store.data),economic(web.data));assert.deepEqual(calculateWalletBalances(store.data.wallets,store.data.transactions),calculateWalletBalances(web.data.wallets,web.data.transactions));
 assert.equal(store.data.transactions.filter(tx=>tx.transfer?.id==='vault-transfer').length,2);assert.equal(store.data.transactions.find(tx=>tx.loanId==='vault-loan')!.amount,85);assert.deepEqual(store.data.planningMonths,defaults.planningMonths);assert.deepEqual(store.data.budgetSubitems,defaults.budgetSubitems);assert.deepEqual(store.data.catalogNames,defaults.catalogNames);
 const roundtrip=parseBackup(await store.exportJSON());assert.deepEqual(economic(roundtrip),economic(web.data));await store.restore(makeBackup(defaults));assert.deepEqual(economic(store.data),economic(defaults));assert.deepEqual(economic(parseBackup((await store.recoveryCopies()).at(-1)!.content)),economic(web.data));
});

for(const lostResponse of [false,true])test(`5H: confirmed commit overtaken before ${lostResponse?'lost':'direct'} response requires reload, never claims not saved`,async t=>{
 const {dir,driver,defaults}=await fixture(t);const otherDriver=new SQLiteTestDriver(path.join(dir,'test.db'));t.after(()=>otherDriver.close());let calls=0;
 const wrapped:VaultDriver={read:()=>driver.read(),commit:async payload=>{const receipt=await driver.commit(payload);if(++calls===2){const other=await AsyncFinanceStore.open(otherDriver,defaults);await other.mutate(d=>({...d,wallets:[...d.wallets,{...wallet,id:'other-connection',name:'Otra ficticia'}]}));if(lostResponse)throw new VaultError('VAULT_UNCERTAIN');return {...receipt,head:await otherDriver.read()};}return receipt;},resolve:(...args)=>driver.resolve(...args),recoveries:()=>driver.recoveries(),close:()=>driver.close()};
 const store=await AsyncFinanceStore.open(wrapped,defaults);await store.initialize();const before=store.data;
 await assert.rejects(store.mutate(d=>({...d,wallets:[...d.wallets,wallet]})),(error:any)=>error.code==='VAULT_RELOAD'&&!(error instanceof StorageConflictError));
 assert.equal(store.phase,'reloadRequired');assert.deepEqual(store.data,before);await assert.rejects(store.mutate(d=>({...d,wallets:[...d.wallets,wallet]})));
 const reopened=await AsyncFinanceStore.open(driver,defaults);assert.equal(reopened.data.wallets.filter(w=>w.id===wallet.id).length,1);assert.equal(reopened.data.wallets.filter(w=>w.id==='other-connection').length,1);assert.equal(driver.commits,2);
});

test('5H: rollback-journal persistence uses EXTRA durability, including directory sync',async t=>{
 const {driver}=await fixture(t);assert.equal(driver.db.prepare('PRAGMA synchronous').get()!.synchronous,3);assert.equal(driver.db.prepare('PRAGMA journal_mode').get()!.journal_mode,'delete');
});
