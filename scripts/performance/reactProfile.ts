import {build} from 'vite';
import {mkdtemp,rm,writeFile,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import express from 'express';
import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {DATA_KEY} from '../../src/utils/backup';
import {volumeFixture} from './fixture';
import {navigateModule} from '../browserNavigation';

if(!process.env.PERF_BASE_SOURCE)throw Error('Set PERF_BASE_SOURCE to the unmodified baseline worktree');
const output=process.env.PERF_OUTPUT??'ci-artifacts/react-profile.json',browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']}),rows:any[]=[],samples=Number(process.env.PERF_SAMPLES??3);
const callback=`(id,phase,actualDuration,baseDuration,startTime,commitTime)=>{((globalThis as any).__reactProfile??=[]).push({id,phase,actualDuration,baseDuration,startTime,commitTime});}`;
try{
 for(const [variant,root] of [['before',path.resolve(process.env.PERF_BASE_SOURCE)],['after',process.cwd()]]as const){
  const dist=await mkdtemp(path.join(tmpdir(),'finanzas-5e-react-profile-')),patched=new Set<string>();
  try{
   await build({root,base:'/',configFile:path.join(root,'vite.config.ts'),logLevel:'silent',plugins:[{name:'isolated-react-profiling-only',enforce:'pre',transform(source,id){
    const file=id.split('?')[0];if(file===path.join(root,'src/main.tsx')){patched.add('renderer');return "import React from 'react';\n"+source.replace("from 'react-dom/client'","from 'react-dom/profiling'").replace('<Root />',`<React.Profiler id="root" onRender={${callback}}><Root /></React.Profiler>`);}
    if(file===path.join(root,'src/App.tsx')){const matches=source.match(/<TransactionsView\b[\s\S]*?\/>/g);if(matches?.length!==1)throw Error('Expected exactly one ledger surface');patched.add('ledger');return source.replace(matches[0],`<React.Profiler id="ledger" onRender={${callback}}>${matches[0]}</React.Profiler>`);}
   }}],build:{outDir:dist,emptyOutDir:true,reportCompressedSize:false}});
   assert.equal(patched.size,2);const app=express();app.use(express.static(dist));app.get('*',(_q,r)=>r.sendFile(path.join(dist,'index.html')));const server=await new Promise<ReturnType<typeof app.listen>>(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));}),origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
   try{
    for(const [width,cpu]of [[390,4],[1280,1]])for(let sample=0;sample<samples;sample++){
     const context=await browser.newContext({viewport:{width,height:900},timezoneId:'Europe/Madrid',serviceWorkers:'block'});
     try{
      const raw=JSON.stringify(volumeFixture(1000));await context.addInitScript(({key,raw})=>{(window as any).__name=(fn:unknown)=>fn;localStorage.setItem(key,raw);localStorage.setItem('finanzas.ui.language','es');(window as any).__writes=[];const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k!=='finanzas.ui.language')(window as any).__writes.push(k);return set.call(this,k,v);};},{key:DATA_KEY,raw});
      const page=await context.newPage();page.setDefaultTimeout(15000);const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpu});await page.goto(origin+'/app');await page.locator('.home-quick').waitFor();await page.evaluate(()=>(window as any).__reactProfile=[]);await navigateModule(page,'Movimientos');await page.waitForFunction(()=>document.querySelectorAll('.movement-row').length===1000);await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
      const mount=await page.evaluate(()=>(window as any).__reactProfile);assert.ok(mount.some((c:any)=>c.id==='ledger'&&c.actualDuration>0),'Profiling renderer must record real React durations');await page.evaluate(()=>(window as any).__reactProfile=[]);await page.getByRole('textbox',{name:'Buscar movimientos',exact:true}).fill('needle');await page.waitForFunction(()=>document.querySelectorAll('.movement-row').length===99);await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));const filter=await page.evaluate(()=>(window as any).__reactProfile);assert.equal(await page.evaluate(k=>localStorage.getItem(k),DATA_KEY),raw);assert.deepEqual(await page.evaluate(()=>(window as any).__writes),[]);rows.push({variant,width,cpu,sample,count:1000,mount,filter});console.log(JSON.stringify({variant,width,sample,mount:mount.filter((c:any)=>c.id==='ledger'),filter:filter.filter((c:any)=>c.id==='ledger')}));
     }finally{await context.close();}
    }
   }finally{await new Promise<void>(r=>server.close(()=>r()));}
  }finally{await rm(dist,{recursive:true,force:true});}
 }
}finally{await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify({schemaVersion:1,browser:browser.version(),samples,method:'Separate temporary production-mode builds with existing react-dom/profiling renderer and React.Profiler around Root and the ledger. No source/config/dependency edits.3 samples at390/CPU4× and1280/CPU1×; unthrottled local network. Profiling overhead applies to both builds; these are React render/commit observations, NOT regular production FCP/INP or native DOM commit totals. Every action is read-only and preserves raw financial bytes.',rows},null,2)+'\n');await browser.close();}
