import express from 'express';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {chromium,type Page,type CDPSession} from 'playwright-core';
import {DATA_KEY} from '../../src/utils/backup';
import {volumeFixture} from './fixture';
import {navigateModule} from '../browserNavigation';
const dist=path.resolve(process.env.PERF_DIST??'dist'),output=path.resolve(process.env.PERF_OUTPUT??'ci-artifacts/intent-performance.json'),samples=Number(process.env.PERF_SAMPLES??3);
const profiles=[{name:'mobile',width:390,cpu:4,latency:80,mbps:1.6},{name:'tablet',width:768,cpu:2,latency:40,mbps:5},{name:'desktop',width:1280,cpu:1,latency:20,mbps:10},{name:'fast-mobile',width:390,cpu:4,latency:80,mbps:5}].filter(p=>!process.env.PERF_PROFILE||p.name===process.env.PERF_PROFILE);
const modes=(process.env.PERF_MODES??'cold,intent,saveData,disabled').split(','),app=express(),cache=new Map<string,Buffer>();
app.get(/\.(?:js|css)$/,async(req,res,next)=>{try{const file=path.resolve(dist,'.'+req.path);if(!file.startsWith(dist+path.sep))return res.sendStatus(403);let b=cache.get(file);if(!b){b=gzipSync(await readFile(file));cache.set(file,b);}res.set({'Content-Type':file.endsWith('.js')?'text/javascript':'text/css','Content-Encoding':'gzip','Cache-Control':'public,max-age=3600','Vary':'Accept-Encoding'}).send(b);}catch{next();}});app.use(express.static(dist));app.get('*',(_q,r)=>r.sendFile(path.join(dist,'index.html')));
const server=await new Promise<ReturnType<typeof app.listen>>(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));}),origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox','--enable-precise-memory-info']}),rows:any[]=[],errors:string[]=[],external:string[]=[],raw=JSON.stringify(volumeFixture(100));
const frame=(p:Page)=>p.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
async function snapshot(p:Page,cdp:CDPSession){
 await frame(p);const metrics=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
 const state=await p.evaluate(key=>{const n=navigator as any,js=(performance.getEntriesByType('resource') as PerformanceResourceTiming[]).filter(r=>/\.js(?:\?|$)/.test(r.name));return {raw:localStorage.getItem(key),writes:(window as any).__writes,connection:n.connection?{effectiveType:n.connection.effectiveType,downlink:n.connection.downlink,rtt:n.connection.rtt,saveData:n.connection.saveData}:null,cores:n.hardwareConcurrency,memory:n.deviceMemory??null,idleAvailable:typeof window.requestIdleCallback==='function',js:js.map(r=>({file:new URL(r.name).pathname,encoded:r.encodedBodySize,decoded:r.decodedBodySize,start:r.startTime,duration:r.duration})),overflow:document.documentElement.scrollWidth>innerWidth+1};},DATA_KEY);
 assert.equal(state.raw,raw);assert.deepEqual(state.writes,[]);const {raw:stored,...result}=state;return {...result,financialHash:createHash('sha256').update(stored!).digest('hex'),metrics};
}
try{
 for(const profile of profiles)for(let sample=0;sample<samples;sample++)for(const module of ['planning','catalog','assistant'])for(const mode of modes){
  const c=await browser.newContext({viewport:{width:profile.width,height:900},hasTouch:profile.width===390,isMobile:profile.width===390,timezoneId:'Europe/Madrid',serviceWorkers:'block'});
  try{
   await c.addInitScript(({key,raw,mode})=>{(window as any).__name=(fn:unknown)=>fn;localStorage.setItem(key,raw);localStorage.setItem('finanzas.ui.language','es');(window as any).__writes=[];const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k!=='finanzas.ui.language')(window as any).__writes.push(k);return set.call(this,k,v);};if(mode==='saveData'&&(navigator as any).connection)Object.defineProperty((navigator as any).connection,'saveData',{get:()=>true});if(mode==='disabled')Object.defineProperty(navigator,'connection',{value:undefined});},{key:DATA_KEY,raw,mode});
   const p=await c.newPage();p.setDefaultTimeout(30000);p.on('pageerror',e=>errors.push(e.message));p.on('request',r=>{if(new URL(r.url()).origin!==origin)external.push(r.url());});await p.clock.setFixedTime(new Date('2026-11-14T12:00:00Z'));
   const cdp=await c.newCDPSession(p);await cdp.send('Network.enable');await cdp.send('Network.setBlockedURLs',{urls:['https://*']});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:profile.latency,downloadThroughput:profile.mbps*1000000/8,uploadThroughput:profile.mbps*1000000/8});await cdp.send('Emulation.setCPUThrottlingRate',{rate:profile.cpu});await cdp.send('Performance.enable');
   const entryStart=performance.now();await p.goto(origin+'/app');await p.locator('.home-quick').waitFor();const initial=await snapshot(p,cdp),entryMs=performance.now()-entryStart;assert.equal(initial.js.some(r=>/\/(PlanningView|CatalogManager|AssistantChatView)-/.test(r.file)),false,'No target may load before a valid intent');
   async function source(){if(module==='catalog'){await navigateModule(p,'Presupuestos');await p.locator('.planning').first().waitFor();}if(module==='assistant'&&profile.width<768)await p.getByRole('button',{name:/^Más/}).click();}
   const target=()=>module==='catalog'?p.getByRole('tab',{name:'Catálogo y detalle de partidas',exact:true}):p.getByRole('button',{name:module==='planning'?/^Presupuestos/:/^Asistente/}).first();
   const ready=()=>module==='planning'?p.locator('.planning').first().waitFor():module==='catalog'?p.locator('.catalog-manager').waitFor():p.getByRole('region',{name:'Historial del asistente',exact:true}).waitFor();
   await source();const before=await snapshot(p,cdp);const intentionStart=performance.now();if(mode!=='cold'){if(profile.width===390)await target().dispatchEvent('pointerdown',{pointerType:'touch',isPrimary:true});else{await p.keyboard.press('Tab');await target().focus();}await p.evaluate(()=>new Promise(r=>setTimeout(r,500)));}
   const hinted=await snapshot(p,cdp),clickStart=performance.now();await target().click();await ready();const first=await snapshot(p,cdp),firstReady=performance.now();
   await navigateModule(p,'Inicio');await p.locator('.home-quick').waitFor();await source();const warmStart=performance.now();await target().click();await ready();const second=await snapshot(p,cdp),secondMs=performance.now()-warmStart;
   const row={profile:profile.name,sample,module,mode,entryMs,intentLeadMs:clickStart-intentionStart,clickToReadyMs:firstReady-clickStart,intentToReadyMs:firstReady-intentionStart,secondMs,initial,before,hinted,first,second};rows.push(row);console.log(JSON.stringify({profile:profile.name,sample,module,mode,entryMs,clickMs:row.clickToReadyMs,totalIntentMs:row.intentToReadyMs,secondMs}));
  }finally{await c.close();}
 }
}finally{await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify({schemaVersion:1,sourceCommit:process.env.PERF_SOURCE_SHA??null,dist,samples,profiles,modes,environment:{node:process.version,browser:browser.version(),cpus:os.cpus().length,cpu:os.cpus()[0]?.model,memory:os.totalmem()},method:'Matched production gzip, fresh contexts,100 fictitious records,3 samples. cold = ordinary navigation without intentional dwell; intent/saveData/disabled = SAME500ms touch hold or keyboard focus lead in BOTH revisions. Reports click AND intent-to-ready, lead, resources before/after, exact stored hash and zero writes. saveData/disabled explicitly control only browser capability signals; network/CPU are real CDP throttles. Native hints recorded. fast-mobile supplements, never replaces390/CPU4/1.6Mbps. No forcedGC; heap approximate. Two frames included, not physical-device INP. No concurrent local browser workloads allowed for published comparisons.',rows,errors,external},null,2)+'\n');await browser.close();await new Promise<void>(r=>server.close(()=>r()));}
assert.deepEqual(errors,[]);assert.deepEqual(external,[]);assert.equal(rows.length,profiles.length*samples*3*modes.length);
