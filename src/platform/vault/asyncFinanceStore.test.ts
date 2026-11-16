import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {SQLiteTestDriver,type FaultPoint} from '../../../scripts/native/sqliteTestDriver';
import {multilingualCatalogFixture} from '../../../scripts/multilingualCatalogFixture';
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
