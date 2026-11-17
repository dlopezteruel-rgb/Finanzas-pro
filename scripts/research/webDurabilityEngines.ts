/** Real Chromium process-group termination with isolated fictitious browser profiles.
 * node --import tsx scripts/research/webDurabilityEngines.ts <production-dist> <report.json>
 * This checks the original WEB contract, not Android/iOS or power-cut durability.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawn,type ChildProcess} from 'node:child_process';
import {once} from 'node:events';
import {mkdtemp,readFile,writeFile,rm,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import express from 'express';
import {chromium,type Browser} from 'playwright-core';

const [dist,report]=process.argv.slice(2);if(!dist||!report)throw Error('Production dist and report path are required.');
const synthetic=JSON.stringify({revision:'probe-old',marker:'FICTITIOUS_ONLY',content:'x'.repeat(4096)}),directory=await mkdtemp(path.join(tmpdir(),'finanzas-fictitious-web-crash-'));
const app=express();app.get('/__fixture',(_q,r)=>r.type('html').send('<!doctype html><title>Fictitious crash fixture</title>'));app.use(express.static(path.resolve(dist)));app.get('*',(_q,r)=>r.sendFile(path.resolve(dist,'index.html')));
const server=await new Promise<ReturnType<typeof app.listen>>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));}),origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
let processHandle:ChildProcess|undefined,browser:Browser|undefined,browserVersion='';
const wait=()=>new Promise<void>(resolve=>setTimeout(resolve,100));
async function killOwnedProcess(){
 if(!processHandle)return;const child=processHandle;processHandle=undefined;
 if(child.exitCode!==null||child.signalCode!==null)return;
 const exited=once(child,'exit');try{process.kill(-child.pid!,'SIGKILL');}catch(error){if((error as NodeJS.ErrnoException).code!=='ESRCH')throw error;}await exited;
}
async function closeGracefully(){
 if(!browser||!processHandle)return;const child=processHandle,exited=once(child,'exit');
 await (await browser.newBrowserCDPSession()).send('Browser.close').catch(()=>{});
 if(child.exitCode===null&&child.signalCode===null)await exited;processHandle=undefined;browser=undefined;
}
async function launch(profile:string){
 await unlink(path.join(profile,'DevToolsActivePort')).catch(error=>{if(error.code!=='ENOENT')throw error;});
 processHandle=spawn(process.env.CHROMIUM_PATH??'/usr/bin/chromium',['--headless=new','--no-sandbox','--no-first-run','--no-default-browser-check','--disable-background-networking','--disable-component-update','--disable-sync','--disable-extensions','--remote-debugging-address=127.0.0.1','--remote-debugging-port=0','--user-data-dir='+profile,'about:blank'],{detached:true,stdio:['ignore','ignore','ignore']});
 const deadline=Date.now()+30000;let port='';
 while(Date.now()<deadline){
  if(processHandle.exitCode!==null)throw Error('Owned Chromium failed to start.');
  try{port=(await readFile(path.join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];if(/^\d+$/.test(port))break;}catch{}await wait();
 }
 assert.ok(/^\d+$/.test(port),'Owned browser did not expose its local debugging port.');
 browser=await chromium.connectOverCDP('http://127.0.0.1:'+port);browserVersion=browser.version();
 const context=browser.contexts()[0];await context.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 await context.addInitScript(()=>{(window as any).__name=(fn:unknown)=>fn;});
 const page=await context.newPage();page.setDefaultTimeout(8000);return page;
}

const results:any[]=[];
try{
 for(const engine of ['localStorage','strict','relaxed'])for(let repetition=0;repetition<3;repetition++){
  const profile=await mkdtemp(path.join(directory,'profile-'));let page=await launch(profile);await page.goto(origin+'/__fixture');
  const write=async(raw:string)=>page.evaluate(async({engine,raw})=>{
   if(engine==='localStorage'){localStorage.setItem('probe',raw);return {requestMs:0,completeMs:0,durability:null};}
   const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('fictitious-durability-research',1);r.onupgradeneeded=()=>r.result.createObjectStore('records');r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   const start=performance.now();let requestMs=0;
   try{return await new Promise<any>((resolve,reject)=>{const tx=db.transaction('records','readwrite',{durability:engine as IDBTransactionDurability});if(tx.durability!==engine){tx.abort();reject(Error('Requested durability was not honored.'));return;}const r=tx.objectStore('records').put(raw,'head');r.onsuccess=()=>{requestMs=performance.now()-start;};tx.onabort=()=>reject(tx.error??Error('Aborted'));tx.oncomplete=()=>resolve({requestMs,completeMs:performance.now()-start,durability:tx.durability});});}finally{db.close();}
  },{engine,raw});
  const read=async()=>page.evaluate(async engine=>{
   if(engine==='localStorage')return localStorage.getItem('probe');
   const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('fictitious-durability-research',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
   try{return await new Promise<string>((resolve,reject)=>{const tx=db.transaction('records','readonly'),r=tx.objectStore('records').get('head');tx.oncomplete=()=>resolve(r.result);tx.onabort=()=>reject(tx.error);});}finally{db.close();}
  },engine);
  await write(synthetic);await closeGracefully();page=await launch(profile);await page.goto(origin+'/__fixture');assert.equal(await read(),synthetic);
  const storage=await page.evaluate(async()=>({persisted:await navigator.storage.persisted(),persistGranted:await navigator.storage.persist()}));
  const next=JSON.stringify({...JSON.parse(synthetic),revision:crypto.randomUUID()}),commit=await write(next),killAt=Date.now();await killOwnedProcess();browser=undefined;page=await launch(profile);await page.goto(origin+'/__fixture');const recovered=await read();
  results.push({engine,repetition,passed:recovered===next,commit,storage,killAt,priorHash:createHash('sha256').update(synthetic).digest('hex'),confirmedHash:createHash('sha256').update(next).digest('hex'),recoveredHash:createHash('sha256').update(recovered??'').digest('hex')});await killOwnedProcess();browser=undefined;
 }
 await writeFile(report,JSON.stringify({scope:'Pre-implementation engine research. Fictitious isolated profiles, immediate owned-process SIGKILL after the actual API completion. Not the financial UI or a power-loss certification.',browser:browserVersion,results},null,2)+'\n');console.log(results.map(r=>({engine:r.engine,passed:r.passed,commit:r.commit,storage:r.storage})));
}finally{await killOwnedProcess();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(directory,{recursive:true,force:true});}
