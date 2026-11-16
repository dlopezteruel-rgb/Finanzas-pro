import test from 'node:test';
import assert from 'node:assert/strict';
import {FinanceStore} from '../utils/financeStore';
import {DATA_KEY,makeBackup,recoveryCopies,serializeSnapshot} from '../utils/backup';
import {multilingualCatalogFixture} from '../../scripts/multilingualCatalogFixture';
import {memoryFinanceStorage,prototypeFinanceBinding,type SyncFinanceStorage} from './financeBinding';
import {backRegistry} from './services';
import {externalHttpsLink} from './linkPolicy';
import {hydrateVisualPreferences,visualPreferenceWriter,type PreferenceDriver} from './native/preferences';
import {nativeFileExporter,EXPORT_DIRECTORY,type ExportDriver} from './native/fileExport';
import {LANGUAGE_KEY} from '../i18n/preference';
import {THEME_KEY} from '../app/themePreference';

// @ts-expect-error A bridge Promise cannot masquerade as a synchronous write.
const invalidAsyncSetter:SyncFinanceStorage['setItem']=async()=>undefined;
void invalidAsyncSetter;
const exclusive=async<T>(write:()=>T)=>write();
test('5G: isolated synchronous sessions never share financial documents',()=>{
 const a=memoryFinanceStorage(),b=memoryFinanceStorage();assert.equal(a.setItem('test','fixture'),undefined);assert.equal(a.length,1);assert.equal(a.key(0),'test');assert.equal(a.getItem('test'),'fixture');assert.equal(b.getItem('test'),null);
});
test('5G: unchanged FinanceStore validates and restores3.5 in a disposable session',async()=>{
 const storage=memoryFinanceStorage(),store=new FinanceStore(storage,multilingualCatalogFixture(),exclusive);
 await store.mutate(d=>({...d,wallets:[...d.wallets,{id:'session-only',name:'Cuenta ficticia',type:'CASH',initialBalance:1,color:'#fff'}]}));
 assert.equal(JSON.parse(storage.getItem(DATA_KEY)!).version,'3.5');assert.ok(store.data.wallets.some(w=>w.id==='session-only'));
 await store.restore(makeBackup(multilingualCatalogFixture()));assert.equal(recoveryCopies(storage).length,1);assert.ok(!store.data.wallets.some(w=>w.id==='session-only'));
 assert.equal(memoryFinanceStorage().getItem(DATA_KEY),null,'A new process/session does not claim recovery or durability');
});
test('5G: revision conflicts do not overwrite a newer session document',async()=>{
 const storage=memoryFinanceStorage(),store=new FinanceStore(storage,multilingualCatalogFixture(),exclusive),prior=JSON.stringify(store.data);
 const other=serializeSnapshot(makeBackup({...multilingualCatalogFixture(),theme:'light'}));storage.setItem(DATA_KEY,other);
 await assert.rejects(store.mutate(d=>({...d,theme:'dark'})));assert.equal(storage.getItem(DATA_KEY),other);assert.equal(JSON.stringify(store.data),prior);
});
test('5G: failed active write preserves previous data and verified recovery copy',async()=>{
 const memory=memoryFinanceStorage(),first=serializeSnapshot(makeBackup(multilingualCatalogFixture()));memory.setItem(DATA_KEY,first);
 const storage:SyncFinanceStorage={...memory,get length(){return memory.length;},setItem:(key,value)=>{if(key===DATA_KEY)throw new DOMException('Synthetic quota','QuotaExceededError');return memory.setItem(key,value);}};
 const store=new FinanceStore(storage,multilingualCatalogFixture(),exclusive),before=JSON.stringify(store.data);
 await assert.rejects(store.restore(makeBackup({...multilingualCatalogFixture(),theme:'light'})));assert.equal(memory.getItem(DATA_KEY),first);assert.equal(JSON.stringify(store.data),before);assert.equal(recoveryCopies(memory).length,1);
});
test('5G: prototype initialization never accesses WebView financial storage',t=>{
 const previous=Object.getOwnPropertyDescriptor(globalThis,'window');let reads=0;
 Object.defineProperty(globalThis,'window',{configurable:true,value:{get localStorage(){reads++;throw Error('Synthetic denied profile');}}});
 t.after(()=>{if(previous)Object.defineProperty(globalThis,'window',previous);else delete (globalThis as any).window;});
 const binding=prototypeFinanceBinding();assert.equal(binding.permanence,'disposable-session');const store=new FinanceStore(binding.getStorage(),multilingualCatalogFixture(),exclusive);assert.ok(store.data.transactions.length);assert.equal(reads,0);
});
test('5G: missing secure Web Locks cannot execute a prototype write',async t=>{
 const prior=Object.getOwnPropertyDescriptor(globalThis,'isSecureContext');Object.defineProperty(globalThis,'isSecureContext',{value:false,configurable:true});t.after(()=>{if(prior)Object.defineProperty(globalThis,'isSecureContext',prior);else delete (globalThis as any).isSecureContext;});
 let writes=0;const binding=prototypeFinanceBinding();await assert.rejects(binding.exclusive(()=>{writes++;}));assert.equal(writes,0);assert.equal(binding.getStorage().length,0);
});
test('5G: late cleanup cannot erase the current back guard',()=>{
 const registry=backRegistry(),dispose=registry.register(()=> 'root');registry.register(()=> 'handled');dispose();assert.equal(registry.request(),'handled');
});
test('5G: external links never authorize HTTP, files, credentials or script execution',()=>{
 assert.equal(externalHttpsLink('https://example.invalid/help'),'https://example.invalid/help');for(const url of ['http://example.invalid','javascript:alert(1)','file:///private/data','https://user:password@example.invalid','/relative'])assert.equal(externalHttpsLink(url),null);
});
test('5G: native preference hydration writes only validated visual keys',async()=>{
 const touched:string[]=[],local={setItem:(k:string,v:string)=>{touched.push(k+'='+v);}},driver:PreferenceDriver={get:async({key})=>({value:key===LANGUAGE_KEY?'fr':'light'}),set:async()=>{}};
 await hydrateVisualPreferences(driver,local);assert.deepEqual(touched,[LANGUAGE_KEY+'=fr',THEME_KEY+'=light']);assert.ok(!touched.some(x=>x.startsWith(DATA_KEY)));
});
test('5G: a rejected native preference read preserves the current UI cache',async()=>{
 let writes=0;await assert.rejects(hydrateVisualPreferences({get:async()=>{throw Error('Synthetic denied');},set:async()=>{}},{setItem:()=>{writes++;}}));assert.equal(writes,0);
});
test('5G: invalid native preference values recover through existing language policy',async()=>{
 const values=new Map<string,string>();await hydrateVisualPreferences({get:async({key})=>({value:key===LANGUAGE_KEY?'invalid':'invalid'}),set:async()=>{}},{setItem:(k,v)=>{values.set(k,v);}});assert.equal(values.get(LANGUAGE_KEY),'es');assert.equal(values.has(THEME_KEY),false);
});
test('5G: asynchronous preferences serialize rapid changes and reject non-UI values',async()=>{
 const values=new Map<string,string>(),calls:string[]=[];const writer=visualPreferenceWriter({get:async()=>({value:null}),set:async({key,value})=>{await Promise.resolve();values.set(key,value);calls.push(key);}});
 await Promise.all([writer('es','dark'),writer('fr','light'),writer('pt','dark')]);assert.equal(values.get(LANGUAGE_KEY),'pt');assert.equal(values.get(THEME_KEY),'dark');assert.deepEqual(new Set(calls),new Set([LANGUAGE_KEY,THEME_KEY]));await assert.rejects(writer('not-a-language','dark'));
});
function exportFixture(options:{corrupt?:boolean;quota?:boolean}={}){
 const files=new Map<string,string>(),removed:string[]=[],shared:string[]=[];let writes=0;
 const driver:ExportDriver={list:async()=>[{name:'prototype-old-backup.json',mtime:0},{name:'unrelated.json',mtime:0},{name:'../outside.json',mtime:0}],write:async(p,text)=>{writes++;if(options.quota)throw Error('Synthetic quota');files.set(p,options.corrupt?'truncated':text);return 'content://prototype/'+p;},read:async p=>files.get(p)!,remove:async p=>{removed.push(p);files.delete(p);},share:async uri=>{shared.push(uri);}};
 return {driver,files,removed,shared,get writes(){return writes;}};
}
test('5G: exports verify the complete private file before explicit sharing',async()=>{
 const f=exportFixture(),run=nativeFileExporter(f.driver,()=> 'fixture',()=>172800001);await run('{"fictitious":true}','demo.json','application/json');assert.equal(f.shared.length,1);assert.ok(f.removed.includes(EXPORT_DIRECTORY+'/prototype-old-backup.json'));assert.ok(!f.removed.some(x=>x.includes('unrelated')||x.includes('../')));assert.equal(f.files.size,1,'Verified file remains available to asynchronous recipients');
});
test('5G: partial export and quota failure do not share corrupt files',async()=>{
 for(const scenario of [{corrupt:true},{quota:true}]){const f=exportFixture(scenario);await assert.rejects(nativeFileExporter(f.driver,()=> 'fixture')('fixture','demo.json','application/json'));assert.equal(f.shared.length,0);assert.equal(f.files.size,0);}
});
test('5G: export paths and MIME types cannot escape the private cache',async()=>{
 const f=exportFixture(),run=nativeFileExporter(f.driver,()=> 'fixture');for(const name of ['../demo.json','folder/demo.json','folder\\demo.json','demo.txt'])await assert.rejects(run('fixture',name,'application/json'));assert.equal(f.writes,0);
});
test('5G: concurrent export cannot open a second native share operation',async()=>{
 const f=exportFixture();let release!:()=>void;const blocked=new Promise<void>(r=>{release=r;});f.driver.share=async()=>blocked;
 const run=nativeFileExporter(f.driver,()=> 'fixture'),first=run('fixture','demo.json','application/json');await assert.rejects(run('other','other.json','application/json'),/EXPORT_BUSY/);release();await first;assert.equal(f.writes,1);
});
