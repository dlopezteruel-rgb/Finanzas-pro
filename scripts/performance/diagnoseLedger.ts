import {build} from 'vite';
import {parseSync} from 'rolldown/utils';
import express from 'express';
import path from 'node:path';
import {mkdtemp,mkdir,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {DATA_KEY,parseBackup} from '../../src/utils/backup';
import {volumeFixture} from './fixture';
import {economicTransactions} from '../../src/utils/transfers';
import {presentationFormatters} from '../../src/i18n';
import {navigateModule} from '../browserNavigation';

const output=path.resolve(process.env.PERF_OUTPUT??'ci-artifacts/5f-diagnosis.json'),root=process.cwd(),count=5000;
const raw=JSON.stringify(volumeFixture(count)),data=parseBackup(raw),format=presentationFormatters('es');
const expected=economicTransactions(data.transactions),totals=['INGRESO','GASTO'].map(type=>format.formatMoney(expected.filter(t=>t.type===type&&t.processed).reduce((n,t)=>n+t.amount,0)));
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox','--enable-precise-memory-info']}),rows:any[]=[];
const profileCallback=`(id,phase,actualDuration,baseDuration)=>{((globalThis as any).__ledgerProfile??=[]).push({id,phase,actualDuration,baseDuration});}`;
const collect=(label:string,expression:string)=>`(()=>{const start=performance.now();const value=${expression};((globalThis as any).__ledgerCosts??=[]).push({label:${JSON.stringify(label)},ms:performance.now()-start});return value;})()`;
try{
 for(const variant of ['full','content-visibility','bounded-prototype'] as const){
  const dist=await mkdtemp(path.join(tmpdir(),'finanzas-5f-diagnosis-'));let patched=0;
  try{
   await build({logLevel:'silent',plugins:[{name:'5f-isolated-diagnostic',enforce:'pre',transform(source,id){
    const file=id.split('?')[0];
    if(file===path.join(root,'src/main.tsx'))return "import React from 'react';\n"+source.replace("from 'react-dom/client'","from 'react-dom/profiling'");
    if(file===path.join(root,'src/App.tsx')){const matches=source.match(/<TransactionsView\b[\s\S]*?\/>/g);assert.equal(matches?.length,1);return source.replace(matches![0],`<React.Profiler id="ledger" onRender={${profileCallback}}>${matches![0]}</React.Profiler>`);}
    if(file!==path.join(root,'src/components/TransactionsView.tsx'))return;
    const ast=parseSync(file,source,{lang:'tsx'});assert.equal(ast.errors.length,0);const changes:{start:number;end:number;text:string}[]=[];
    const visit=(node:any)=>{
     if(!node||typeof node!=='object')return;
     const mapBody=node.type==='CallExpression'?node.arguments[0]?.body:undefined;
     if(node.type==='CallExpression'&&node.callee?.type==='MemberExpression'&&node.callee.object?.name==='filtered'&&node.callee.property?.name==='map'&&(mapBody?.type==='JSXElement'||mapBody?.type==='ParenthesizedExpression'&&mapBody.expression?.type==='JSXElement')){
      const original=source.slice(node.start,node.end),expression=variant==='bounded-prototype'?original.replace('filtered.map','filtered.slice(0,50).map'):original;
      changes.push({start:node.start,end:node.end,text:collect('row-elements-and-formatting',expression)});
     }
     if(node.type==='CallExpression'&&node.callee?.name==='useMemo'){
      const arrow=node.arguments[0];if(arrow?.type==='ArrowFunctionExpression'){
       const body=source.slice(arrow.body.start,arrow.body.end);
       if(body.includes('transactions.filter')&&body.includes('.sort('))changes.push({start:arrow.body.start,end:arrow.body.end,text:collect('filter-and-sort',`(()=>${body})()`)});
       if(body.includes('visibleEconomicTotals('))changes.push({start:arrow.body.start,end:arrow.body.end,text:collect('economic-projection-and-totals',body)});
      }
     }
     for(const [key,value] of Object.entries(node)){if(['start','end','type','loc','comments'].includes(key))continue;if(Array.isArray(value))for(const child of value)visit(child);else if(value&&typeof value==='object')visit(value);}
    };visit(ast.program);assert.equal(changes.length,3,'Exactly the existing filter, totals and row construction expressions');patched++;
    for(const c of changes.sort((a,b)=>b.start-a.start))source=source.slice(0,c.start)+c.text+source.slice(c.end);return source;
   }}],build:{outDir:dist,emptyOutDir:true,reportCompressedSize:false}});assert.equal(patched,1);
   const app=express();app.use(express.static(dist));app.get('*',(_q,res)=>res.sendFile(path.join(dist,'index.html')));
   const server=await new Promise<ReturnType<typeof app.listen>>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));}),origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
   try{
    const c=await browser.newContext({viewport:{width:390,height:900},locale:'es-ES',timezoneId:'Europe/Madrid',serviceWorkers:'block'});
    try{
     await c.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():route.abort());
     await c.addInitScript(({key,raw})=>{(window as any).__name=(fn:unknown)=>fn;localStorage.setItem(key,raw);localStorage.setItem('finanzas.ui.language','es');(window as any).__writes=[];const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){(window as any).__writes.push(k);return set.call(this,k,v);};},{key:DATA_KEY,raw});
     const p=await c.newPage();p.setDefaultTimeout(120000);const cdp=await c.newCDPSession(p);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});await cdp.send('Performance.enable');
     await p.goto(origin+'/app');await p.locator('.home-quick').waitFor();
     if(variant==='content-visibility')await p.addStyleTag({content:'.movement-row { content-visibility:auto; contain-intrinsic-size:auto 90px; }'});
     await p.evaluate(()=>{(window as any).__ledgerCosts=[];(window as any).__ledgerProfile=[];});
     const before=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
     const start=performance.now();await navigateModule(p,'Movimientos');await p.waitForFunction(n=>document.querySelectorAll('.movement-row').length===n,variant==='bounded-prototype'?50:count);await p.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));
     const usefulMs=performance.now()-start,after=Object.fromEntries((await cdp.send('Performance.getMetrics')).metrics.map(m=>[m.name,m.value]));
     const state=await p.evaluate(key=>({costs:(window as any).__ledgerCosts,react:(window as any).__ledgerProfile,domRows:document.querySelectorAll('.movement-row').length,stored:localStorage.getItem(key),writes:(window as any).__writes}),DATA_KEY);
     for(const amount of totals)assert.ok((await p.locator('.movement-stats').innerText()).includes(amount));assert.equal(state.stored,raw);assert.deepEqual(state.writes,[]);
     const delta=Object.fromEntries(['ScriptDuration','TaskDuration','LayoutDuration','RecalcStyleDuration','LayoutCount','RecalcStyleCount','Nodes','JSHeapUsedSize'].map(key=>[key,after[key]-before[key]]));
     const row={variant,records:count,domRows:state.domRows,usefulMs,fullDataTotals:totals,rawFinancialHash:createHash('sha256').update(state.stored!).digest('hex'),costs:state.costs,react:state.react,delta};rows.push(row);console.log(JSON.stringify(row));
    }finally{await c.close();}
   }finally{await new Promise<void>(r=>server.close(()=>r()));}
  }finally{await rm(dist,{recursive:true,force:true});}
 }
}finally{
 await mkdir(path.dirname(output),{recursive:true});await writeFile(output,JSON.stringify({schemaVersion:1,browser:browser.version(),records:count,cpu:4,samplesPerVariant:1,method:'Exploratory temporary production-mode builds with react-dom/profiling and three timing spans; not final production timing. Same complete data, filters/sort/economic projection/totals. Variants: unchanged full DOM; CSS content-visibility; diagnostic50-row bound WITHOUT pagination controls (not a deliverable).CDP delta durations may overlap; do not sum categories as exclusive CPU costs. React render duration excludes native DOM commit/layout. All money reductions and stored bytes verified. No source/config/dependency changes; temporary builds removed.',rows},null,2)+'\n');await browser.close();
}
