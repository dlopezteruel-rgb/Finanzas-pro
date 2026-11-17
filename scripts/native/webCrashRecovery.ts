/** Real Chromium process-group termination with isolated fictitious browser profiles.
 * node --import tsx scripts/native/webCrashRecovery.ts <production-dist> <report.json>
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
import {DATA_KEY,parseSnapshot,serializeSnapshot} from '../../src/utils/backup';
import {multilingualCatalogFixture} from '../multilingualCatalogFixture';
import {navigateModule} from '../browserNavigation';

const runStartedAt=new Date().toISOString();
const [dist,report]=process.argv.slice(2);if(!dist||!report)throw Error('Production dist and report path are required.');
const synthetic=serializeSnapshot(multilingualCatalogFixture()),directory=await mkdtemp(path.join(tmpdir(),'finanzas-fictitious-web-crash-'));
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
const results:{scenario:string;passed:boolean;confirmedRevisionPreserved:boolean;error?:string;stage?:string;observation?:{priorSnapshotHash:string|null;confirmedSnapshotHash:string;observedSnapshotHash:string|null;priorSnapshotRetained:boolean;newWalletCount:number;priorRevision:string|null;confirmedRevision:string|null;recoveredRevision:string|null;confirmedWalletIds:string[];recoveredWalletIds:string[];confirmationToKillMs:number;submitToConfirmationMs:number}}[]=[];
try{
 for(const scenario of ['graceful-after-confirmed-save','after-confirmed-save','before-write-lock-callback']){
  let stage='launch';let observation:typeof results[number]['observation'];
  try {
  const profile=await mkdtemp(path.join(directory,'profile-'));let page=await launch(profile);stage='establish-durable-fixture';
  await page.goto(origin+'/__fixture');await page.evaluate(({key,value})=>{localStorage.setItem(key,value);localStorage.setItem('finanzas.ui.language','es');}, {key:DATA_KEY,value:synthetic});
  await closeGracefully();page=await launch(profile);await page.goto(origin+'/__fixture');assert.equal(await page.evaluate(key=>localStorage.getItem(key),DATA_KEY),synthetic,'Graceful fixture checkpoint must survive before injecting a financial crash.');stage='fixture-and-form';
  await page.goto(origin+'/app');await page.locator('.home-quick').waitFor();await navigateModule(page,'Cuentas');await page.getByRole('button',{name:'Nueva Cuenta',exact:true}).click();
  const form=page.getByRole('dialog',{name:'Cartera',exact:true}),name='Cuenta ficticia de cierre '+scenario;await form.getByLabel('Nombre de la cuenta',{exact:true}).fill(name);
  const prior=await page.evaluate(key=>localStorage.getItem(key),DATA_KEY);
  if(scenario==='before-write-lock-callback')await page.evaluate(()=>{Object.defineProperty(navigator.locks,'request',{configurable:true,value:()=>{(window as any).__heldFinanceWrite=true;return new Promise(()=>{});}});});
  const submittedAt=performance.now();await form.locator('button[type=submit]').click();
  if(scenario!=='before-write-lock-callback')await form.waitFor({state:'hidden'});else{await page.waitForFunction(()=>(window as any).__heldFinanceWrite===true);assert.equal(await form.isVisible(),true);}
  const confirmationDetectedAt=performance.now();const confirmed=await page.evaluate(key=>localStorage.getItem(key),DATA_KEY);assert.ok(confirmed);
  if(scenario==='before-write-lock-callback')assert.equal(confirmed,prior);else assert.notEqual(confirmed,prior);
  const killRequestedAt=performance.now();stage='kill-and-reopen';if(scenario==='graceful-after-confirmed-save')await closeGracefully();else await killOwnedProcess();browser=undefined;
  const reopened=await launch(profile);await reopened.goto(origin+'/app');await reopened.locator('.home-quick').waitFor();const restored=await reopened.evaluate(key=>localStorage.getItem(key),DATA_KEY);
  const digest=(raw:string|null)=>raw===null?null:createHash('sha256').update(raw).digest('hex');
  observation={priorSnapshotHash:digest(prior),confirmedSnapshotHash:digest(confirmed)!,observedSnapshotHash:digest(restored),priorSnapshotRetained:restored===prior,newWalletCount:restored?parseSnapshot(restored).wallets.filter(w=>w.name===name.toUpperCase()).length:0,priorRevision:prior?JSON.parse(prior).revision??null:null,confirmedRevision:JSON.parse(confirmed).revision??null,recoveredRevision:restored?JSON.parse(restored).revision??null:null,confirmedWalletIds:parseSnapshot(confirmed).wallets.map(w=>w.id),recoveredWalletIds:restored?parseSnapshot(restored).wallets.map(w=>w.id):[],confirmationToKillMs:killRequestedAt-confirmationDetectedAt,submitToConfirmationMs:confirmationDetectedAt-submittedAt};
  stage='verify-confirmed-snapshot';assert.equal(restored,confirmed,'Confirmed financial snapshot/revision did not survive the tested browser process kill.');
  const data=parseSnapshot(restored!);assert.equal(data.wallets.filter(w=>w.name===name.toUpperCase()).length,scenario!=='before-write-lock-callback'?1:0);
  results.push({scenario,passed:true,confirmedRevisionPreserved:true,observation});
  } catch(error) {
   results.push({scenario,passed:false,confirmedRevisionPreserved:false,stage,observation,error:error instanceof Error?error.name:'UnknownError'});
   console.error('Web crash scenario failed:',scenario,'stage:',stage,'type:',error instanceof Error?error.name:'UnknownError');
  } finally {await killOwnedProcess();browser=undefined;}
 }
 await writeFile(report,JSON.stringify({runStartedAt,finishedAt:new Date().toISOString(),sourceCommit:process.env.DURABILITY_SOURCE_SHA??null,scope:'Real Chromium SIGKILL with isolated fictitious persistent profiles. Web only; not mobile, reader, device, power-cut or all-browser certification.',productionDist:path.resolve(dist),browser:{version:browserVersion,executable:process.env.CHROMIUM_PATH??'/usr/bin/chromium'},results},null,2)+'\n');console.log('Web crash recovery: '+results.filter(r=>r.passed).length+'/'+results.length+' scenarios passed.');if(results.some(r=>!r.passed))process.exitCode=1;
}finally{
 await killOwnedProcess();await browser?.close().catch(()=>{});await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(directory,{recursive:true,force:true});
}
