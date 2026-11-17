import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm,mkdir,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import express from 'express';
import {build} from 'vite';
import {chromium} from 'playwright-core';

/** Real browser IndexedDB transactions, with scoped faults; not a simulated storage engine. */
test('WEB-001: real strict IndexedDB, atomic recovery, capability gates',{timeout:180000},async t=>{
 const directory=await mkdtemp(path.join(tmpdir(),'finanzas-fictitious-idb-tests-'));
 t.after(()=>rm(directory,{recursive:true,force:true}));
 await build({configFile:false,logLevel:'error',build:{outDir:directory,emptyOutDir:true,minify:false,lib:{entry:path.resolve('scripts/research/webDriverEntry.ts'),formats:['es'],fileName:()=> 'entry.js'}}});
 const app=express();app.get('/__driver',(_q,r)=>r.type('html').send('<!doctype html><html lang="es"><title>Synthetic storage engine tests</title><body></body></html>'));app.use('/driver',express.static(directory));
 const server=await new Promise<ReturnType<typeof app.listen>>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise<void>(r=>server.close(()=>r())));
 const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`,browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
 const results:{scenario:string;passed:boolean;details:unknown}[]=[];
 const scenarios=['migration-preserves-bytes-and-copies','unsupported-strict-is-readonly','quota-abort-and-explicit-retry','restoration-abort-rolls-back-copies','response-lost-no-duplicate','corrupt-write-readback-aborts','copy-readback-disagreement-aborts','missing-receipt-blocks-opening','legacy-divergence-is-preserved','unknown-schema-forensic-no-recreate'];
 for(const scenario of scenarios)await t.test(scenario,async()=>{
  const context=await browser.newContext();t.after(()=>context.close());
  await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
  const page=await context.newPage();page.setDefaultTimeout(8000);await page.goto(origin+'/__driver');
  const result=await page.evaluate(async scenario=>{
   (window as any).__name=(fn:unknown)=>fn;
   const url='/driver/entry.js',m=await import(/* @vite-ignore */url),data=m.intelligentFixture(),raw=m.serializeSnapshot(data);
   localStorage.setItem(m.DATA_KEY,raw);localStorage.setItem('finanzas.ui.language','fr');localStorage.setItem('finanzas.ui.theme','light');
   const copyKey=m.RECOVERY_PREFIX+'historical',copy=JSON.stringify(m.makeBackup(data));
   if(scenario==='migration-preserves-bytes-and-copies')localStorage.setItem(copyKey,copy);
   const storage={getItem:(key:string)=>localStorage.getItem(key),setItem:(key:string,value:string)=>{localStorage.setItem(key,value);return undefined;},key:(i:number)=>localStorage.key(i),get length(){return localStorage.length;}};
   const add=(id='new')=>(d:any)=>({...d,wallets:[...d.wallets,{id,name:'CUENTA '+id,type:'BANK',initialBalance:123.45,color:'#fff'}]});
   const inspect=async()=>{const driver=await m.IndexedFinanceDriver.open();try{return await driver.inspect();}finally{driver.close();}};
   const errorText=(e:unknown)=>e instanceof Error?e.message:'unknown';
   if(scenario==='unsupported-strict-is-readonly'){
    const transaction=IDBDatabase.prototype.transaction;
    IDBDatabase.prototype.transaction=function(...args:any[]){const tx=(transaction as any).apply(this,args);if(args[1]==='readwrite')Object.defineProperty(tx,'durability',{value:'default'});return tx;};
    const c=await m.openWebFinance(data,storage);let failed=false;try{await c.mutate(add());}catch{failed=true;}
    const state=await inspect();c.close();IDBDatabase.prototype.transaction=transaction;
    return {passed:failed&&c.phase==='readonly'&&c.problem==='WEB_STRICT_UNAVAILABLE'&&state.head.snapshot===null&&localStorage.getItem(m.DATA_KEY)===raw,phase:c.phase,problem:c.problem,snapshotUnchanged:localStorage.getItem(m.DATA_KEY)===raw};
   }
   const controller=await m.openWebFinance(data,storage);
   if(scenario==='migration-preserves-bytes-and-copies'){
    const state=await inspect(),copies=await controller.recoveryCopies();controller.close();
    return {passed:state.head.snapshot===raw&&state.migration.source[m.DATA_KEY]===raw&&state.migration.source[copyKey]===copy&&copies.some((c:any)=>c.key===copyKey&&c.content===copy)&&localStorage.getItem(copyKey)===copy&&localStorage.getItem('finanzas.ui.language')==='fr'&&localStorage.getItem('finanzas.ui.theme')==='light',sourceHash:state.migration.sourceHash,hash:state.head.hash,copies:copies.length,guardPresent:JSON.parse(localStorage.getItem(m.DATA_KEY)!).finanzasWebStorage==='indexeddb-strict-v1'};
   }
   if(scenario==='quota-abort-and-explicit-retry'){
    const put=IDBObjectStore.prototype.put;let inject=true;
    IDBObjectStore.prototype.put=function(value,key){if(this.name===m.WEB_RECORDS&&key===m.DATA_KEY&&inject)throw new DOMException('Synthetic quota','QuotaExceededError');return put.call(this,value,key);};
    let error='';try{await controller.mutate(add());}catch(e){error=e instanceof Error?e.name:'unknown';}
    const after=await inspect(),kept=JSON.stringify(controller.data)===JSON.stringify(m.parseSnapshot(raw));inject=false;
    await controller.mutate(add());IDBObjectStore.prototype.put=put;const state=await inspect();controller.close();
    return {passed:error==='QuotaExceededError'&&kept&&after.head.snapshot===raw&&m.parseSnapshot(state.head.snapshot).wallets.filter((w:any)=>w.id==='new').length===1,error};
   }
   if(scenario==='restoration-abort-rolls-back-copies'){
    const addRecord=IDBObjectStore.prototype.add;
    IDBObjectStore.prototype.add=function(value,key){const r=addRecord.call(this,value,key);if(this.name===m.WEB_RECORDS&&String(key).startsWith(m.RECOVERY_PREFIX))r.addEventListener('success',()=>r.transaction!.abort());return r;};
    let failed=false;try{await controller.restore(m.makeBackup(add()(data)));}catch{failed=true;}
    IDBObjectStore.prototype.add=addRecord;const state=await inspect(),copies=await controller.recoveryCopies();controller.close();return {passed:failed&&state.head.snapshot===raw&&copies.length===0,copies:copies.length};
   }
   if(scenario==='response-lost-no-duplicate'){
    const driver=await m.IndexedFinanceDriver.open(),state=await driver.inspect();controller.close();
    const commit=driver.commit.bind(driver);let calls=0;driver.commit=async(request:any)=>{calls++;await commit(request);throw Error('Synthetic reply lost after real strict commit.');};
    const c=new m.WebController(driver,storage,state.migration,state.head,data,m.exclusiveWebOperation);await c.mutate(add());
    const final=await driver.inspect(),rows=await driver.forensic();c.close();return {passed:calls===1&&c.phase==='ready'&&m.parseSnapshot(final.head.snapshot).wallets.filter((w:any)=>w.id==='new').length===1&&rows.operations.length===1,calls,receipts:rows.operations.length};
   }
   if(scenario==='corrupt-write-readback-aborts'){
    const put=IDBObjectStore.prototype.put;IDBObjectStore.prototype.put=function(value,key){return put.call(this,this.name===m.WEB_RECORDS&&key===m.DATA_KEY?'not-json':value,key);};
    let failed=false;try{await controller.mutate(add());}catch{failed=true;}IDBObjectStore.prototype.put=put;
    const state=await inspect();controller.close();return {passed:failed&&state.head.snapshot===raw,unchanged:state.head.snapshot===raw};
   }
   if(scenario==='copy-readback-disagreement-aborts'){
    const get=IDBObjectStore.prototype.get;IDBObjectStore.prototype.get=function(key){const r=get.call(this,key);if(this.name===m.WEB_RECORDS&&String(key).startsWith(m.RECOVERY_PREFIX))r.addEventListener('success',()=>Object.defineProperty(r,'result',{value:'unverified copy'}));return r;};
    let failed=false;try{await controller.restore(m.makeBackup(add()(data)));}catch{failed=true;}IDBObjectStore.prototype.get=get;
    const state=await inspect(),copies=await controller.recoveryCopies();controller.close();return {passed:failed&&state.head.snapshot===raw&&copies.length===0,copies:copies.length};
   }
   if(scenario==='legacy-divergence-is-preserved'){
    const divergent=m.serializeSnapshot(add('older')(data));localStorage.setItem(m.DATA_KEY,divergent);let error='';try{await controller.mutate(add());}catch(e){error=errorText(e);}
    const state=await inspect(),report=JSON.parse(await controller.forensic());controller.close();return {passed:error==='WEB_LEGACY_DIVERGED'&&state.head.snapshot===raw&&localStorage.getItem(m.DATA_KEY)===divergent&&report.legacy[m.DATA_KEY]===divergent&&report.database.finance.some((r:any)=>r.key===m.DATA_KEY&&r.value===raw),error};
   }
   if(scenario==='missing-receipt-blocks-opening'){
    await controller.mutate(add());const saved=await inspect();controller.close();
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(m.WEB_DATABASE);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
    await new Promise<void>((resolve,reject)=>{const tx=db.transaction(m.WEB_OPERATIONS,'readwrite',{durability:'strict'});tx.objectStore(m.WEB_OPERATIONS).delete(saved.head.operationId);tx.oncomplete=()=>resolve();tx.onabort=()=>reject(tx.error);});db.close();
    let error='';try{await m.openWebFinance(data,storage);}catch(e){error=errorText(e);}
    const report=JSON.parse(await m.exportWebForensic(()=>storage));return {passed:error==='WEB_CORRUPT'&&report.database.finance.some((r:any)=>r.key===m.DATA_KEY&&r.value===saved.head.snapshot),error};
   }
   if(scenario==='unknown-schema-forensic-no-recreate'){
    controller.close();const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(m.WEB_DATABASE,99);r.onupgradeneeded=()=>{r.result.createObjectStore('future');r.transaction!.objectStore('future').put('FICTITIOUS_FUTURE_DOCUMENT','raw');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();
    let failed=false;try{await m.openWebFinance(data,storage);}catch{failed=true;}const report=JSON.parse(await m.exportWebForensic(()=>storage));return {passed:failed&&report.database.future.some((r:any)=>r.key==='raw'&&r.value==='FICTITIOUS_FUTURE_DOCUMENT'),unknownPreserved:true};
   }
   throw Error('Unimplemented synthetic scenario.');
  },scenario);
  results.push({scenario,passed:result.passed,details:result});assert.equal(result.passed,true,JSON.stringify(result));await context.close();
 });
 const directoryOut=path.resolve(process.env.CI_ARTIFACT_DIR??'ci-artifacts','browser');await mkdir(directoryOut,{recursive:true});await writeFile(path.join(directoryOut,'web-storage-engine.json'),JSON.stringify({scope:'Actual Chromium IndexedDB; faults explicitly injected. No real disk-full, Firefox, WebKit or physical-power-loss certification.',results},null,2)+'\n');
});
