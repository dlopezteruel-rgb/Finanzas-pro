import {waitForStoredCondition} from './asyncStorageCondition';
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
 const scenarios=['migration-preserves-bytes-and-copies','unsupported-strict-is-readonly','quota-abort-and-explicit-retry','restoration-abort-rolls-back-copies','response-lost-no-duplicate','corrupt-write-readback-aborts','copy-readback-disagreement-aborts','missing-receipt-blocks-opening','legacy-divergence-is-preserved','unknown-schema-forensic-no-recreate','legacy-collections','invalid-source-preserved','migration-quota-keeps-source','migration-guard-denied-resumes','versionchange-forensic','legacy-denied-readable-database',...['2.5','2.6','2.7','2.8','2.9','3.0','3.1','3.2','3.3','3.4','3.5'].map(v=>'json-'+v)];
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
   if(scenario==='invalid-source-preserved'){
    const invalid='not valid JSON; FICTITIOUS FORENSIC';localStorage.setItem(m.DATA_KEY,invalid);let failed=false;try{await m.openWebFinance(data,storage);}catch{failed=true;}
    const state=await inspect(),forensic=JSON.parse(await m.exportWebForensic(()=>storage));return {passed:failed&&state.head.snapshot===null&&localStorage.getItem(m.DATA_KEY)===invalid&&forensic.legacy[m.DATA_KEY]===invalid,preserved:true};
   }
   if(scenario==='legacy-collections'){
    localStorage.removeItem(m.DATA_KEY);localStorage.setItem('finanzas_pro_transactions_v2',JSON.stringify(data.transactions));localStorage.setItem('finanzas_pro_wallets_v2',JSON.stringify(data.wallets));
    const source=m.legacyInventory(storage),expected=m.sourceData(source,data),c=await m.openWebFinance(data,storage),state=await inspect();c.close();
    const normalized=(d:any)=>{const {exportedAt,...rest}=d;return JSON.stringify(rest);};
    return {passed:normalized(m.parseSnapshot(state.head.snapshot))===normalized(expected)&&JSON.stringify(expected.wallets)===JSON.stringify(data.wallets)&&JSON.stringify(expected.transactions)===JSON.stringify(data.transactions)&&Object.entries(source).every(([key,value])=>state.migration.source[key]===value)&&localStorage.getItem('finanzas_pro_transactions_v2')===JSON.stringify(data.transactions),sourceKeys:Object.keys(source)};
   }
   if(scenario.startsWith('json-')){
    const version=scenario.slice(5),initial=version==='3.5'?m.multilingualCatalogFixture():m.intelligentFixture();
    if(version==='2.9')initial.planningMonths=[{monthYear:'2026-11',savingsCents:0,revision:1}];
    if(version==='3.0')initial.planningAutomation={rules:[{id:'rule',name:'Regla ficticia',target:'GASTO',code:'g',amountCents:100,frequency:'monthly',startMonth:'2026-11',active:true}],carryovers:[],origins:[],history:[]};
    if(version==='3.1')initial.intelligentFinance={recurringRules:[],occurrences:[],obligations:[]};if(version==='3.2')initial.defaultWalletId='bank';if(version==='3.3')initial.budgetSubitems={items:[],months:[]};
    const original=JSON.stringify({...m.makeBackup(initial),version,revision:'historical-'+version});localStorage.setItem(m.DATA_KEY,original);const c=await m.openWebFinance(initial,storage),state=await inspect();c.close();
    return {passed:state.head.snapshot===original&&state.migration.source[m.DATA_KEY]===original&&state.head.operationId===null&&JSON.stringify(m.parseSnapshot(original))===JSON.stringify(m.parseSnapshot(state.head.snapshot)),version,hash:state.head.hash,revision:JSON.parse(state.head.snapshot).revision};
   }
   if(scenario==='migration-quota-keeps-source'){
    const add=IDBObjectStore.prototype.add;IDBObjectStore.prototype.add=function(value,key){if(this.name===m.WEB_RECORDS&&key===m.DATA_KEY)throw new DOMException('Synthetic migration quota','QuotaExceededError');return add.call(this,value,key);};
    const c=await m.openWebFinance(data,storage),failed=await inspect(),before=localStorage.getItem(m.DATA_KEY);c.close();IDBObjectStore.prototype.add=add;
    const reopened=await m.openWebFinance(data,storage),state=await inspect();reopened.close();return {passed:c.phase==='readonly'&&before===raw&&failed.migration===null&&failed.head.snapshot===null&&state.head.snapshot===raw&&state.migration.status==='active',preserved:true,retryExplicit:true};
   }
   if(scenario==='migration-guard-denied-resumes'){
    const set=storage.setItem;storage.setItem=(key,value)=>{if(key===m.DATA_KEY)throw new DOMException('Synthetic denied guard','SecurityError');return set(key,value);};
    const c=await m.openWebFinance(data,storage),prepared=await inspect(),before=localStorage.getItem(m.DATA_KEY);c.close();storage.setItem=set;
    const reopened=await m.openWebFinance(data,storage),state=await inspect();reopened.close();return {passed:c.phase==='readonly'&&before===raw&&prepared.migration.status==='prepared'&&prepared.head.snapshot===raw&&state.migration.id===prepared.migration.id&&state.migration.status==='active'&&state.head.snapshot===raw,idPreserved:state.migration.id===prepared.migration.id};
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
   if(scenario==='legacy-denied-readable-database'){
    controller.close();Object.defineProperty(window,'localStorage',{configurable:true,get(){throw new DOMException('Synthetic denied legacy source','SecurityError');}});
    const c=await m.webFinanceBinding.open(data,()=>{});let blocked=false;try{await c.mutate(add());}catch{blocked=true;}
    const exported=m.parseBackup(await c.exportJSON()),report=JSON.parse(await m.exportWebForensic(m.webFinanceBinding.getStorage)),state=await inspect();c.close();
    return {passed:c.phase==='readonly'&&blocked&&JSON.stringify(exported.wallets)===JSON.stringify(data.wallets)&&state.head.snapshot===raw&&report.complete===false&&report.errors.includes('LEGACY_UNREADABLE')&&report.database.finance.some((r:any)=>r.key===m.DATA_KEY&&r.value===raw),readableConfirmedData:true,legacyUnavailable:true};
   }
   if(scenario==='versionchange-forensic'){
    const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(m.WEB_DATABASE,99);r.onupgradeneeded=()=>r.result.createObjectStore('future');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();
    let rejected=false;try{await controller.mutate(add());}catch{rejected=true;}
    const report=JSON.parse(await controller.forensic());controller.close();return {passed:rejected&&report.database.finance.some((r:any)=>r.key===m.DATA_KEY&&r.value===raw)&&report.complete===false,snapshotPreserved:true};
   }
   if(scenario==='unknown-schema-forensic-no-recreate'){
    controller.close();const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open(m.WEB_DATABASE,99);r.onupgradeneeded=()=>{r.result.createObjectStore('future');r.transaction!.objectStore('future').put('FICTITIOUS_FUTURE_DOCUMENT','raw');};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});db.close();
    let failed=false;try{await m.openWebFinance(data,storage);}catch{failed=true;}const report=JSON.parse(await m.exportWebForensic(()=>storage));return {passed:failed&&report.database.future.some((r:any)=>r.key==='raw'&&r.value==='FICTITIOUS_FUTURE_DOCUMENT'),unknownPreserved:true};
   }
   throw Error('Unimplemented synthetic scenario.');
  },scenario);
  results.push({scenario,passed:result.passed,details:result});assert.equal(result.passed,true,JSON.stringify(result));await context.close();
 });
 await t.test('two real tabs: Web Locks, stale writers, transactional CAS and old-code guard',async()=>{
  const context=await browser.newContext();t.after(()=>context.close());const pages=await Promise.all([context.newPage(),context.newPage()]);for(const p of pages)await p.goto(origin+'/__driver');
  await pages[0].evaluate(async()=>{(window as any).__name=(f:unknown)=>f;const url='/driver/entry.js',m=await import(/* @vite-ignore */url),initial=m.intelligentFixture(),raw=m.serializeSnapshot(initial);localStorage.setItem(m.DATA_KEY,raw);const storage={getItem:(k:string)=>localStorage.getItem(k),setItem:(k:string,v:string)=>{localStorage.setItem(k,v);return undefined;},key:(i:number)=>localStorage.key(i),get length(){return localStorage.length;}};(window as any).__oldStore=new m.FinanceStore(storage,initial,m.browserExclusiveWrite);});
  for(const p of pages)await p.evaluate(async()=>{(window as any).__name=(f:unknown)=>f;const url='/driver/entry.js',m=await import(/* @vite-ignore */url),storage={getItem:(k:string)=>localStorage.getItem(k),setItem:(k:string,v:string)=>{localStorage.setItem(k,v);return undefined;},key:(i:number)=>localStorage.key(i),get length(){return localStorage.length;}};(window as any).__m=m;(window as any).__controller=await m.openWebFinance(m.intelligentFixture(),storage);});
  const attempts=await Promise.all(pages.map((p,i)=>p.evaluate(async id=>{const c=(window as any).__controller;try{await c.mutate((d:any)=>({...d,wallets:[...d.wallets,{id,name:id,type:'BANK',initialBalance:9.99,color:'#fff'}]}));return {ok:true,phase:c.phase};}catch(e){return {ok:false,phase:c.phase,error:e instanceof Error?e.message:'unknown'};}},'tab-'+i)));
  assert.equal(attempts.filter(r=>r.ok).length,1);assert.equal(attempts.filter(r=>r.phase==='conflict').length,1);
  const rejectedOld=await pages[0].evaluate(async()=>{try{await (window as any).__oldStore.mutate((d:any)=>({...d,wallets:[]}));return false;}catch{return true;}});assert.equal(rejectedOld,true);
  // Deliberately bypass the controller lock for this driver test: CAS itself must reject one stale writer.
  const cas=await Promise.all(pages.map((p,i)=>p.evaluate(async id=>{const m=(window as any).__m,driver=await m.IndexedFinanceDriver.open(),state=await driver.inspect(),next=m.serializeSnapshot({...m.parseSnapshot(state.head.snapshot),theme:id==='direct-0'?'light':'dark'}),request={id:crypto.randomUUID(),expected:state.head.snapshot,next,hash:await m.digest(next),copies:[]};(window as any).__direct={driver,request:{...request,fingerprint:await m.requestFingerprint(request)}};return state.head.snapshot;},'direct-'+i)));
  assert.equal(cas[0],cas[1]);const direct=await Promise.all(pages.map(p=>p.evaluate(async()=>{const {driver,request}=(window as any).__direct;try{await driver.commit(request);return 'committed';}catch(e){return e instanceof (window as any).__m.StorageConflictError?'StorageConflictError':e instanceof Error?e.message:'error';}finally{driver.close();}})));
  assert.equal(direct.filter(r=>r==='committed').length,1);assert.equal(direct.filter(r=>r==='StorageConflictError').length,1);
  const final=await pages[0].evaluate(async()=>{const m=(window as any).__m,d=await m.IndexedFinanceDriver.open(),state=await d.inspect(),rows=await d.forensic();d.close();return {wallets:m.parseSnapshot(state.head.snapshot).wallets,operations:rows.operations.length};});
  assert.equal(final.wallets.filter((w:any)=>w.id.startsWith('tab-')).length,1);assert.equal(final.operations,2);
  results.push({scenario:'two-real-tabs-and-direct-cas',passed:true,details:{attempts,direct,oldClientRejected:rejectedOld,operations:final.operations}});await context.close();
 });
 await t.test('async predicate polling waits for a true result, preserves timeout and cancels without cached finance',async()=>{
  const context=await browser.newContext();try{const page=await context.newPage();await page.goto(origin+'/__driver');await page.evaluate(()=>{(window as any).__asyncProbe={calls:0,permit:false};});
  let resolved=false;const pending=waitForStoredCondition(page,async()=>{const p=(window as any).__asyncProbe;p.calls++;return Promise.resolve(p.permit);},undefined,{timeout:8000}).then(handle=>{resolved=true;return handle;});
  await page.waitForFunction(()=>(window as any).__asyncProbe.calls>=2);assert.equal(resolved,false);await page.evaluate(()=>(window as any).__asyncProbe.permit=true);const handle=await pending;assert.equal(await handle.jsonValue(),true);await handle.dispose();
  await assert.rejects(waitForStoredCondition(page,async()=>false,undefined,{timeout:50}),{name:'TimeoutError'});assert.equal(await page.evaluate(()=>Object.keys((window as any).__storageWaitTokens).length),0);
  results.push({scenario:'async-condition-is-not-a-truthy-promise',passed:true,details:{falseResultsNotAccepted:true,originalTimeoutEnforced:true,noFinancialCache:true}});
  }finally{await context.close();}
 });
 const directoryOut=path.resolve(process.env.CI_ARTIFACT_DIR??'ci-artifacts','browser');await mkdir(directoryOut,{recursive:true});await writeFile(path.join(directoryOut,'web-storage-engine.json'),JSON.stringify({scope:'Actual Chromium IndexedDB; faults explicitly injected. No real disk-full, Firefox, WebKit or physical-power-loss certification.',results},null,2)+'\n');
});
