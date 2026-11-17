/** Real owned Chromium SIGKILL at actual IndexedDB transaction signals.
 * Test bundle only; no application fault switches or financial data caches. */
import assert from 'node:assert/strict';
import {spawn,type ChildProcess} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,readFile,writeFile,rm,unlink,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import express from 'express';
import {build} from 'vite';
import {chromium,type Browser} from 'playwright-core';
import {serializeSnapshot,DATA_KEY,RECOVERY_PREFIX,parseSnapshot} from '../../src/utils/backup';
import {multilingualCatalogFixture} from '../multilingualCatalogFixture';
import {createHash} from 'node:crypto';
const report=process.argv[2];if(!report)throw Error('Report path required.');
const root=await mkdtemp(path.join(tmpdir(),'finanzas-fictitious-crash-controls-')),entry=path.join(root,'entry');
await build({configFile:false,logLevel:'error',build:{outDir:entry,minify:false,lib:{entry:path.resolve('scripts/research/webDriverEntry.ts'),formats:['es'],fileName:()=> 'entry.js'}}});
const app=express();app.get('/__fixture',(_q,r)=>r.type('html').send('<!doctype html><html lang="es"><title>Isolated fictitious crash controls</title><body></body></html>'));app.use('/driver',express.static(entry));
const server=await new Promise<ReturnType<typeof app.listen>>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));}),origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
let child:ChildProcess|undefined,browser:Browser|undefined,version='';
async function terminate(graceful=false){
 if(!child)return;const own=child;child=undefined;if(own.exitCode===null&&own.signalCode===null){const closed=once(own,'exit');if(graceful&&browser)await(await browser.newBrowserCDPSession()).send('Browser.close').catch(()=>{});else try{process.kill(-own.pid!,'SIGKILL');}catch(e){if((e as NodeJS.ErrnoException).code!=='ESRCH')throw e;}await closed;}browser=undefined;
}
async function launch(profile:string){
 await unlink(path.join(profile,'DevToolsActivePort')).catch(e=>{if(e.code!=='ENOENT')throw e;});
 child=spawn(process.env.CHROMIUM_PATH??'/usr/bin/chromium',['--headless=new','--no-sandbox','--no-first-run','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{detached:true,stdio:'ignore'});
 let port='';const deadline=Date.now()+30000;while(Date.now()<deadline){if(child.exitCode!==null)throw Error('Owned test browser exited.');try{port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];if(/^\d+$/.test(port))break;}catch{}await new Promise(r=>setTimeout(r,50));}assert.match(port,/^\d+$/);
 browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);version=browser.version();const context=browser.contexts()[0];await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await context.addInitScript(()=>{(window as any).__name=(f:unknown)=>f;});const page=await context.newPage();page.setDefaultTimeout(10000);await page.goto(origin+'/__fixture');return page;
}
const scenarios=['migration-during-prepare','migration-after-prepare-commit','migration-during-activation','migration-after-activation-commit','financial-during-transaction','financial-after-commit-before-response','restore-during-transaction','restore-after-commit-before-response'];
const raw=serializeSnapshot(multilingualCatalogFixture()),oldCopyKey=RECOVERY_PREFIX+'preexisting-control';
// Use a structurally valid backup for migration, retaining all financial relationships.
const parsed=JSON.parse(raw);delete parsed.revision;const backup=JSON.stringify(parsed),digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const results:any[]=[];
try{
 for(const scenario of scenarios){
  const profile=await mkdtemp(path.join(root,'profile-'));let stage='seed';
  try{
   let page=await launch(profile);await page.evaluate(({raw,key,copyKey,backup})=>{localStorage.setItem(key,raw);localStorage.setItem(copyKey,backup);},{raw,key:DATA_KEY,copyKey:oldCopyKey,backup});await terminate(true);page=await launch(profile);
   stage='install-passive-signal-and-interruption';
   await page.evaluate(scenario=>{
    const w=window as any;w.__crash={scenario,armed:scenario.startsWith('migration'),signal:null,next:null,copies:[],migrationId:null,settled:false,error:null};
    const c=w.__crash,txMethod=IDBDatabase.prototype.transaction,completion=Object.getOwnPropertyDescriptor(IDBTransaction.prototype,'oncomplete')!,targets=new WeakMap<IDBTransaction,string>();
    IDBDatabase.prototype.transaction=function(...args:any[]){
     const tx=txMethod.apply(this,args as any);if(this.name!=='finanzas-pro-web-v1'||args[1]!=='readwrite')return tx;
     Object.defineProperty(tx,'oncomplete',{configurable:true,get(){return completion.get!.call(tx);},set(fn){completion.set!.call(tx,function(event:Event){if(targets.has(tx)&&scenario.includes('after-')){c.signal='native-complete-response-withheld';return;}if(fn)fn.call(tx,event);});}});return tx;
    };
    for(const method of ['put','add'] as const){const original=IDBObjectStore.prototype[method];IDBObjectStore.prototype[method]=function(value:any,key?:IDBValidKey){
     const request=original.call(this,value,key);if(!c.armed||this.transaction.db.name!=='finanzas-pro-web-v1')return request;
     if(this.name==='finance'&&typeof key==='string'&&key.startsWith('finanzas_pro_recovery_'))c.copies.push({key,content:value});
     const prepare=scenario.includes('prepare')&&this.name==='metadata'&&key==='migration'&&value.status==='prepared';
     const activate=scenario.includes('activation')&&this.name==='metadata'&&key==='migration'&&value.status==='active';
     const financial=!scenario.startsWith('migration')&&this.name==='finance'&&key==='finanzas_pro_data_v1';
     if(!prepare&&!activate&&!financial)return request;
     if(prepare||activate)c.migrationId=value.id;if(financial)c.next=value;
     const tx=this.transaction;targets.set(tx,scenario);
     if(scenario.includes('during-'))request.addEventListener('success',()=>{
      c.signal='request-success-transaction-kept-open';
      // Test-only failure injection: keep the native transaction pending until SIGKILL.
      // These requests are not used as evidence of flushing or as a production mechanism.
      const keepAlive=()=>{const r=tx.objectStore('metadata').get('__test_only_pending_transaction__');r.onsuccess=keepAlive;};keepAlive();
     });return request;
    };}
   },scenario);
   await page.evaluate(async({raw,scenario})=>{
    const w=window as any,url='/driver/entry.js',m=await import(/* @vite-ignore */url),initial=m.parseSnapshot(raw),storage={getItem:(k:string)=>localStorage.getItem(k),setItem:(k:string,v:string)=>{localStorage.setItem(k,v);return undefined;},key:(i:number)=>localStorage.key(i),get length(){return localStorage.length;}};
    const work=async()=>{
     const controller=await m.openWebFinance(initial,storage);
     if(scenario.startsWith('migration'))return;
     w.__crash.armed=true;
     const next={...initial,wallets:[...initial.wallets,{id:'interrupted-control-wallet',name:'CONTROL FICTICIO',type:'BANK',initialBalance:12.34,color:'#fff'}]};
     if(scenario.startsWith('restore'))await controller.restore(m.makeBackup(next));else await controller.mutate(()=>next);
    };
    void work().then(()=>{w.__crash.settled=true;}).catch(e=>{w.__crash.error=e instanceof Error?e.message:'error';});
   },{raw,scenario});
   await page.waitForFunction(()=>(window as any).__crash.signal||(window as any).__crash.error);const observed=await page.evaluate(()=>(window as any).__crash);
   assert.equal(observed.error,null);assert.equal(observed.settled,false,'Caller cannot receive success at the held native boundary.');const signalledAt=performance.now();stage='sigkill';await terminate();
   const killMs=performance.now()-signalledAt;page=await launch(profile);stage='reconcile-after-restart';
   const recovered=await page.evaluate(async raw=>{
    const url='/driver/entry.js',m=await import(/* @vite-ignore */url),driver=await m.IndexedFinanceDriver.open(),before=await driver.inspect();driver.close();
    const storage={getItem:(k:string)=>localStorage.getItem(k),setItem:(k:string,v:string)=>{localStorage.setItem(k,v);return undefined;},key:(i:number)=>localStorage.key(i),get length(){return localStorage.length;}};
    const c=await m.openWebFinance(m.parseSnapshot(raw),storage),d=await m.IndexedFinanceDriver.open(),state=await d.inspect(),copies=await d.copies(),records=await d.forensic();c.close();d.close();return {before,state,copies,receipts:records.operations};
   },raw);
   const committed=scenario.includes('after-'),economic=!scenario.startsWith('migration'),expected=economic&&committed?observed.next:raw;
   assert.equal(recovered.state.head.snapshot,expected,'Complete committed document must match the signalled transaction boundary.');
   const data=parseSnapshot(expected);assert.equal(data.wallets.filter(w=>w.id==='interrupted-control-wallet').length,economic&&committed?1:0);
   assert.ok(recovered.copies.some((c:{key:string;content:string})=>c.key===oldCopyKey&&c.content===backup));
   if(scenario.startsWith('restore')&&committed){assert.equal(recovered.copies.length,2);for(const copy of observed.copies)assert.ok(recovered.copies.some((c:{key:string;content:string})=>c.key===copy.key&&c.content===copy.content));}else assert.equal(recovered.copies.length,1);
   if(scenario.startsWith('migration')&&scenario!=='migration-during-prepare')assert.equal(recovered.state.migration!.id,observed.migrationId,'Prepared migration must resume with its original identity.');
   assert.equal(recovered.receipts.length,economic&&committed?1:0);
   results.push({scenario,passed:true,profileId:path.basename(profile),nativeSignal:observed.signal,callerSettledBeforeKill:observed.settled,signalToKillCompleteMs:killMs,priorHash:digest(raw),proposedHash:observed.next?digest(observed.next):null,recoveredHash:digest(expected),revision:JSON.parse(expected).revision??null,migrationId:recovered.state.migration!.id,copies:recovered.copies.map((c:{key:string;content:string})=>({key:c.key,hash:digest(c.content)})),operationReceipts:recovered.receipts.length});
  }catch(e){results.push({scenario,passed:false,stage,error:e instanceof Error?e.message:String(e)});console.error(scenario,stage,e);}finally{await terminate();await rm(profile,{recursive:true,force:true});}
 }
 await mkdir(path.dirname(report),{recursive:true});await writeFile(report,JSON.stringify({sourceCommit:process.env.DURABILITY_SOURCE_SHA??null,browser:version,scope:'Actual driver, real isolated Chromium SIGKILL at native request-success/complete signals. Pending transactions held open only by explicit test fault injection. Not production delays, native mobile or physical power-loss certification.',results},null,2)+'\n');console.log(`Real crash boundary controls: ${results.filter(r=>r.passed).length}/${results.length}`);if(results.some(r=>!r.passed))process.exitCode=1;
}finally{await terminate();await new Promise<void>(r=>server.close(()=>r()));await rm(root,{recursive:true,force:true});}
