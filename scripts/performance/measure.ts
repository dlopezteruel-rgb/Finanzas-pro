import express from 'express';
import path from 'node:path';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {chromium,type Page,type CDPSession} from 'playwright-core';
import {DATA_KEY} from '../../src/utils/backup';
import {volumeFixture} from './fixture';
import {LANGUAGE_KEY} from '../../src/i18n/preference';
import {navigateModule} from '../browserNavigation';
import {observePersistence} from './persistenceProbe';
if(process.env.PERF_BACKEND==='indexeddb')await import('../webStorageBrowserPrelude.mjs');

const dist=path.resolve(process.env.PERF_DIST??'dist'),output=path.resolve(process.env.PERF_OUTPUT??'ci-artifacts/performance.json'),samples=Number(process.env.PERF_SAMPLES??3);
const profiles=[{name:'mobile',width:390,cpu:4,latency:80,mbps:1.6},{name:'tablet',width:768,cpu:2,latency:40,mbps:5},{name:'desktop',width:1280,cpu:1,latency:20,mbps:10}].filter(p=>!process.env.PERF_PROFILE||p.name===process.env.PERF_PROFILE);
const app=express(),compressed=new Map<string,Buffer>();
app.get(/\.(?:js|css)$/,async(req,res,next)=>{try{const file=path.resolve(dist,'.'+req.path);if(!file.startsWith(dist+path.sep))return res.sendStatus(403);let body=compressed.get(file);if(!body){body=gzipSync(await readFile(file));compressed.set(file,body);}res.set({'Content-Type':file.endsWith('.js')?'text/javascript':'text/css','Content-Encoding':'gzip','Cache-Control':'public,max-age=3600','Vary':'Accept-Encoding'}).send(body);}catch{next();}});
app.use(express.static(dist));app.get('*',(_q,r)=>r.sendFile(path.join(dist,'index.html')));
const server=await new Promise<ReturnType<typeof app.listen>>(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));}),origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox','--enable-precise-memory-info']});
const rows:any[]=[],errors:string[]=[],external:string[]=[],traces:any[]=[];
async function instrumentation(page:Page){await page.addInitScript(()=>{
 (window as any).__name=(fn:unknown)=>fn;(window as any).__perf={longTasks:[],cls:0,lcp:null};
 for(const type of ['longtask','layout-shift','largest-contentful-paint'])try{new PerformanceObserver(list=>{for(const e of list.getEntries() as any){const p=(window as any).__perf;if(type==='longtask')p.longTasks.push(e.duration);if(type==='layout-shift'&&!e.hadRecentInput)p.cls+=e.value;if(type==='largest-contentful-paint')p.lcp=e.startTime;}}).observe({type,buffered:true});}catch{/* Unsupported metrics remain unavailable. */}
 });}
async function snapshot(page:Page,cdp:CDPSession,scenario:string,profile:any,sample:number,start?:number){
 await page.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
 const metrics=await cdp.send('Performance.getMetrics'),m=Object.fromEntries(metrics.metrics.map(x=>[x.name,x.value]));
 const observed=await page.evaluate(()=>{const p=(window as any).__perf,resources=performance.getEntriesByType('resource') as PerformanceResourceTiming[],js=resources.filter(r=>/\.js(?:\?|$)/.test(r.name));return {...p,fcp:performance.getEntriesByName('first-contentful-paint')[0]?.startTime??null,jsEncoded:js.reduce((n,r)=>n+r.encodedBodySize,0),jsDecoded:js.reduce((n,r)=>n+r.decodedBodySize,0),jsTransfer:js.reduce((n,r)=>n+r.transferSize,0),jsResources:js.map(r=>({file:new URL(r.name).pathname,transfer:r.transferSize,encoded:r.encodedBodySize,decoded:r.decodedBodySize})),requests:resources.length,domRows:document.querySelectorAll('.movement-row').length,dataRecords:document.querySelector('.transactions-view')?.getAttribute('data-ledger-records')??null,filteredRecords:document.querySelector('.transactions-view')?.getAttribute('data-ledger-results')??null,horizontalOverflow:document.documentElement.scrollWidth>innerWidth+1,financialWrites:(window as any).__writes??[],persistenceTrace:(window as any).__persistenceTrace??[],migrationRequests:window.__fixtureIo?.migrationRequests??0,guardSignals:window.__fixtureIo?.guardSignals??0};});
 if(process.env.PERF_SCREENSHOTS&&sample===0&&['application-cold','planning-first-open'].includes(scenario)){await mkdir(process.env.PERF_SCREENSHOTS,{recursive:true});await page.screenshot({path:path.join(process.env.PERF_SCREENSHOTS,`${profile.name}-${scenario}.png`)});}
 const stored=await page.evaluate(async key=>window.__fixtureStorage?await window.__fixtureStorage.getItem(key):localStorage.getItem(key),DATA_KEY);
 const row={financialHash:stored===null?null:createHash('sha256').update(stored).digest('hex'),scenario,profile:profile.name,width:profile.width,sample,interactionMs:start===undefined?null:performance.now()-start,scriptDurationMs:m.ScriptDuration*1000,taskDurationMs:m.TaskDuration*1000,heapUsedBytes:m.JSHeapUsedSize,nodes:m.Nodes,...observed};rows.push(row);console.log(JSON.stringify({scenario,profile:profile.name,sample,interactionMs:row.interactionMs,jsEncoded:row.jsEncoded,longTasks:row.longTasks.length}));return row;
}
async function fixturePage(profile:any,language='es',count=100,empty=false){
 const c=await browser.newContext({viewport:{width:profile.width,height:900},isMobile:profile.width===390,hasTouch:profile.width===390,locale:'de-DE',timezoneId:'Europe/Madrid',serviceWorkers:'block'});
 // Browser routing is deliberately NOT enabled: it disables HTTP cache and invalidates warm measurements.
 const page=await c.newPage();page.setDefaultTimeout(count===5000?120000:30000);page.on('pageerror',e=>errors.push(e.message));
 page.on('request',r=>{if(new URL(r.url()).origin!==origin)external.push(r.url());});
 const cdp=await c.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setBlockedURLs',{urls:['https://*','http://fonts.*']});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:profile.latency,downloadThroughput:profile.mbps*1000000/8,uploadThroughput:profile.mbps*1000000/8});await cdp.send('Emulation.setCPUThrottlingRate',{rate:profile.cpu});await cdp.send('Performance.enable');
 await c.addInitScript(({key,pref,value,language})=>{if(!sessionStorage.getItem('perf-seeded')){if(value)localStorage.setItem(key,value);localStorage.setItem(pref,language);sessionStorage.setItem('perf-seeded','1');}(window as any).__writes=[];const set=Storage.prototype.setItem,remove=Storage.prototype.removeItem;Storage.prototype.setItem=function(k,v){if(k!==pref&&!window.__fixtureIo?.isGuardWrite(k,v))(window as any).__writes.push(`set:${k}`);return set.call(this,k,v);};Storage.prototype.removeItem=function(k){if(k!==pref)(window as any).__writes.push(`remove:${k}`);return remove.call(this,k);};},{key:DATA_KEY,pref:LANGUAGE_KEY,value:empty?null:JSON.stringify(volumeFixture(count)),language});await c.addInitScript(observePersistence);await c.addInitScript(()=>{if(window.__fixtureIo)window.__fixtureIo.mutated=e=>(window as any).__writes.push('idb:'+e.store+':'+e.key);});await instrumentation(page);return {c,page,cdp};
}
try{
 for(const profile of profiles)for(let sample=0;sample<samples;sample++){
  for(const language of ['es','en']){const {c,page,cdp}=await fixturePage(profile,language,100,true);try{const start=performance.now();await page.goto(origin+'/');await page.locator('#landing-language').waitFor();await page.waitForFunction(l=>document.documentElement.lang===l,language==='es'?'es-ES':'en-GB');await snapshot(page,cdp,`landing-${language}-cold`,profile,sample,start);}finally{await c.close();}}
  {const {c,page,cdp}=await fixturePage(profile,'es',100,true);try{const start=performance.now();await page.goto(origin+'/app');await page.locator('.home-quick').waitFor();await snapshot(page,cdp,'application-empty-cold',profile,sample,start);}finally{await c.close();}}
  const {c,page,cdp}=await fixturePage(profile);try{
   let start=performance.now();await page.goto(origin+'/app');await page.locator('.home-quick').waitFor();await snapshot(page,cdp,'application-cold',profile,sample,start);
   start=performance.now();await page.reload();await page.locator('.home-quick').waitFor();await snapshot(page,cdp,'application-warm',profile,sample,start);
   start=performance.now();await page.locator('.financial-charts summary').first().click();await page.locator('.chart-controls').first().waitFor();await snapshot(page,cdp,'chart-first-open',profile,sample,start);
   start=performance.now();await navigateModule(page,'Presupuestos');await page.locator('.planning').first().waitFor();await snapshot(page,cdp,'planning-first-open',profile,sample,start);
   start=performance.now();await page.getByRole('tab',{name:'Catálogo y detalle de partidas',exact:true}).click();await page.locator('.catalog-manager').waitFor();await snapshot(page,cdp,'catalog-first-open',profile,sample,start);
   start=performance.now();await navigateModule(page,'Movimientos');await page.locator('.movement-row').first().waitFor();await snapshot(page,cdp,'ledger-100-first-open',profile,sample,start);
   start=performance.now();await page.getByRole('textbox',{name:'Buscar movimientos',exact:true}).fill('needle');await page.waitForFunction(()=>document.querySelectorAll('.movement-row').length===9);await snapshot(page,cdp,'ledger-100-filter',profile,sample,start);
   start=performance.now();await page.getByRole('button',{name:'Opciones y datos',exact:true}).click();await page.locator('#ui-language').selectOption('fr');await page.waitForFunction(()=>document.documentElement.lang==='fr-FR');await snapshot(page,cdp,'language-first-fr',profile,sample,start);
   start=performance.now();await page.locator('#ui-language').selectOption('es');await page.waitForFunction(()=>document.documentElement.lang==='es-ES');await snapshot(page,cdp,'language-cached-es',profile,sample,start);
  }finally{await c.close();}
  for(const count of [1000,5000]){
   const {c,page,cdp}=await fixturePage(profile,'es',count);try{
    await page.goto(origin+'/app');await page.locator('.home-quick').waitFor();await cdp.send('Profiler.enable');await cdp.send('Profiler.start');let start=performance.now();await navigateModule(page,'Movimientos');await page.waitForFunction(n=>document.querySelector('.transactions-view')?.getAttribute('data-ledger-results')===String(n)?document.querySelectorAll('.movement-row').length===50:document.querySelectorAll('.movement-row').length===n,count);await snapshot(page,cdp,`ledger-${count}-first-open`,profile,sample,start);
    const cpu=await cdp.send('Profiler.stop');if(sample===0)traces.push({profile:profile.name,count,cpu:cpu.profile});
    start=performance.now();await page.getByRole('textbox',{name:'Buscar movimientos',exact:true}).fill('needle');await page.waitForFunction(n=>document.querySelector('.transactions-view')?.getAttribute('data-ledger-results')===String(n)?document.querySelectorAll('.movement-row').length===(n>200?50:n):document.querySelectorAll('.movement-row').length===n,Math.floor((count-1)/10));await snapshot(page,cdp,`ledger-${count}-filter`,profile,sample,start);
   }finally{await c.close();}
  }
 }
}finally{
 await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify({schemaVersion:1,backend:process.env.PERF_BACKEND??'legacy',dist,sourceCommit:process.env.PERF_SOURCE_SHA??null,samples,profiles,environment:{node:process.version,browser:browser.version(),platform:process.platform,cpus:os.cpus().length,cpu:os.cpus()[0]?.model,memory:os.totalmem()},method:'Production assets served with gzip. Isolated contexts for cold loads; reload within same context for warm. CDP CPU/network controls. Interactions include Playwright dispatch and two animation frames; not real-device INP. When paging is present, ledger readiness requires the COMPLETE filtered count and50 mounted rows; baseline requires all DOM rows. First presentation includes all data/totals, not all DOM. No deferred data processing. ScriptDuration is cumulative execution, not parsing bytes. Heap is CDP approximate live heap without forced GC. LCP is last observation at snapshot, not a final Core Web Vital. Encoded resource body is measured gzip; transfer includes protocol overhead. No routing (preserves HTTP cache).',rows,errors,external},null,2)+'\n');for(const trace of traces)await writeFile(output.replace(/\.json$/,`-${trace.profile}-${trace.count}.cpuprofile`),JSON.stringify(trace.cpu));await browser.close();await new Promise<void>(r=>server.close(()=>r()));
}
if(errors.length||external.length||rows.some(r=>r.financialWrites.length))throw Error('Unexpected console errors, external requests or financial writes; inspect report.');
