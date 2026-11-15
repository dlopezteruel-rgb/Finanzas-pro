import express from 'express';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {chromium} from 'playwright-core';
import {DATA_KEY} from '../../src/utils/backup';
import {volumeFixture} from './fixture';
import {navigateModule} from '../browserNavigation';
const dist=path.resolve(process.env.PERF_DIST??'dist'),output=path.resolve(process.env.PERF_OUTPUT??'ci-artifacts/5f-ledger-trace.json.gz'),app=express();
app.use(express.static(dist));app.get('*',(_q,r)=>r.sendFile(path.join(dist,'index.html')));
const server=await new Promise<ReturnType<typeof app.listen>>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));}),origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']}),count=5000;
try{
 const c=await browser.newContext({viewport:{width:390,height:900},timezoneId:'Europe/Madrid',serviceWorkers:'block'}),raw=JSON.stringify(volumeFixture(count));
 await c.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
 await c.addInitScript(({key,raw})=>{(window as any).__name=(fn:unknown)=>fn;localStorage.setItem(key,raw);localStorage.setItem('finanzas.ui.language','es');(window as any).__writes=[];const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){(window as any).__writes.push(k);return set.call(this,k,v);};},{key:DATA_KEY,raw});
 const p=await c.newPage();p.setDefaultTimeout(120000);const cdp=await c.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await p.goto(origin+'/app');await p.locator('.home-quick').waitFor();
 const completed=new Promise<{stream:string}>(resolve=>cdp.once('Tracing.tracingComplete',event=>resolve(event as {stream:string})));
 await cdp.send('Tracing.start',{categories:'devtools.timeline,v8.execute,blink.user_timing',transferMode:'ReturnAsStream'});
 await p.evaluate(()=>performance.mark('5f-ledger-start'));await navigateModule(p,'Movimientos');await p.waitForFunction(n=>document.querySelectorAll('.movement-row').length===n,count);await p.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));await p.evaluate(()=>performance.mark('5f-ledger-ready'));
 await cdp.send('Tracing.end');const {stream}=await completed;let text='';
 for(;;){const chunk=await cdp.send('IO.read',{handle:stream});text+=chunk.base64Encoded?Buffer.from(chunk.data,'base64').toString('utf8'):chunk.data;if(chunk.eof)break;}await cdp.send('IO.close',{handle:stream});
 const trace=JSON.parse(text),events=trace.traceEvents as any[],names=['Layout','UpdateLayoutTree','Paint','PrePaint','Commit','UpdateLayer','FunctionCall','RunTask','MinorGC','MajorGC','V8.GCScavenger'];
 const phases=Object.fromEntries(names.map(name=>{const items=events.filter(e=>e.name===name&&e.ph==='X'&&Number.isFinite(e.dur));return [name,{events:items.length,totalMs:items.reduce((n,e)=>n+e.dur,0)/1000,maxMs:Math.max(0,...items.map(e=>e.dur))/1000}];}));
 const state=await p.evaluate(key=>({stored:localStorage.getItem(key),writes:(window as any).__writes}),DATA_KEY);if(state.stored!==raw||state.writes.length)throw Error('Trace must preserve fictional finance bytes without writes.');
 await mkdir(path.dirname(output),{recursive:true});await writeFile(output,gzipSync(text));await writeFile(output.replace(/\.json\.gz$/,'.summary.json'),JSON.stringify({source:process.env.PERF_SOURCE_SHA??null,browser:browser.version(),count,cpu:4,width:390,samples:1,method:'Exploratory actual production DevTools timeline, isolated fixture, CPU4x; not an acceptance timing sample. Event totals can overlap across categories. Root data and all5000 DOM rows ready before ending; no grouping exists in the current flat ledger. No API requests or financial writes.',phases},null,2)+'\n');console.log(JSON.stringify(phases));await c.close();
}finally{await browser.close();await new Promise<void>(r=>server.close(()=>r()));}
