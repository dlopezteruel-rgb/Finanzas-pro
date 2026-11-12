import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import path from 'node:path';
import {buildSync} from 'esbuild';
import {chromium} from 'playwright-core';
import {DATA_KEY,makeBackup} from '../src/utils/backup';
import {catalogClassificationFixture} from './catalogClassificationFixture';
import {navigateModule} from './browserNavigation';
const probe=buildSync({stdin:{resolveDir:process.cwd(),contents:`
import {FinanceStore,browserExclusiveWrite} from './src/utils/financeStore';
import {DATA_KEY,makeBackup} from './src/utils/backup';
import {budgetSubitemFixture,demoParent} from './scripts/budgetSubitemFixture';
globalThis.phase4aStoreProbe=async()=>{
 const results=[];
 for(const mode of ['throw','validation','quota','archived','restore','valid','noop']){
  const d=budgetSubitemFixture(false),values=new Map([[DATA_KEY,JSON.stringify(makeBackup(d))]]);let fail=false,writes=0;
  const storage={get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>{if(fail)throw new Error('Cuota ficticia');writes++;values.set(k,v)}};
  const store=new FinanceStore(storage,d,browserExclusiveWrite);
  if(mode==='archived')await store.mutate({catalog:{kind:'archivePartida',parent:demoParent,archived:true}});
  const before=JSON.stringify(store.data),raw=storage.getItem(DATA_KEY),oldWrites=writes;let error='';
  try{
   if(mode==='restore')await store.restore(d=>{d.wallets[0].initialBalance++;throw new Error('Cancelado')});
   else if(mode==='archived')await store.mutate(d=>{d.budgetPlans[0].plannedAmount++;return d});
   else if(mode==='noop')await store.mutate(d=>d);
   else {fail=mode==='quota';await store.mutate(d=>{d.wallets[0].initialBalance=mode==='validation'?NaN:d.wallets[0].initialBalance+1;if(mode==='throw')throw new Error('Cancelado');return d;});}
  }catch(e){error=e.message;}
  results.push({mode,error,memoryUnchanged:JSON.stringify(store.data)===before,diskUnchanged:storage.getItem(DATA_KEY)===raw,writes:writes-oldWrites});
 }
 return results;
};`},bundle:true,write:false,format:'iife',platform:'browser',target:'es2022'}).outputFiles[0].text;
test('Fase 4A: seguridad de callbacks y registro natural',{timeout:180000},async t=>{
 const app=express(),dist=path.resolve(process.env.PHASE4A_DIST??'dist');app.use(express.static(dist));app.get('*',(_q,r)=>r.sendFile(path.join(dist,'index.html')));
 const server=await new Promise<ReturnType<typeof app.listen>>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise<void>(r=>server.close(()=>r())));
 const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`,browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
 for(const width of [390,1280])for(const theme of ['light','dark'] as const)await t.test(`${width}px ${theme}: consultas, negaciones, importes/fechas dudosos y corrección expresa`,async()=>{
  const c=await browser.newContext({viewport:{width,height:900},isMobile:width===390,hasTouch:width===390,locale:'es-ES',timezoneId:'Europe/Madrid',serviceWorkers:'block'}),errors:string[]=[];
  try{
   await c.route('**/*',r=>new URL(r.request().url()).origin!==origin?r.abort():new URL(r.request().url()).pathname.startsWith('/api/')?r.fulfill({json:{success:true,reply:'Consulta ficticia; no se registra nada.'}}):r.continue());
   const fixture=catalogClassificationFixture(theme);await c.addInitScript(({key,value})=>{(window as any).__name=(fn:unknown)=>fn;if(localStorage.getItem(key)===null)localStorage.setItem(key,value);},{key:DATA_KEY,value:JSON.stringify(makeBackup(fixture))});
   const p=await c.newPage();p.setDefaultTimeout(7000);p.on('pageerror',e=>errors.push(e.message));await p.clock.setFixedTime(new Date('2026-11-11T23:30:00Z'));await p.goto(origin+'/app');const raw=()=>p.evaluate(k=>localStorage.getItem(k),DATA_KEY),before=await raw();
   const quick=p.getByPlaceholder(/^Registrar:/),root=p.locator('.home-quick');
   for(const text of ['No registres 15 en senderismo','¿Cuánto gasté 15 en senderismo?','Gasté -15 en senderismo','Nómina 2.650 €','Gasté 10 y 20 en senderismo','El 31/02 gasté 15 en senderismo']){
    await quick.fill(text);const register=root.getByRole('button',{name:'Registrar',exact:true});assert.ok(await register.count()===0||await register.isDisabled(),text);await quick.press('Enter');assert.equal(await raw(),before);assert.match(await root.innerText(),/manual|asistente/i);
   }
   await quick.fill('Hoy gasté 15 en senderismo');assert.match(await root.innerText(),/2026-11-12/);await root.getByRole('button',{name:'Registrar',exact:true}).click();await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)!).transactions.length===2,DATA_KEY);let data=JSON.parse((await raw())!);assert.equal(data.transactions[0].amount,15);assert.equal(data.transactions[0].date,'2026-11-12');assert.deepEqual(data.transactions[1],fixture.transactions[0]);const afterQuick=await raw();
   await navigateModule(p,'Asistente');const input=p.getByRole('textbox',{name:'Mensaje para el asistente'}),send=p.getByRole('button',{name:'Enviar',exact:true}),proposal=p.getByRole('dialog',{name:'Revisar propuesta de movimiento',exact:true});
   for(const text of ['No registres 50 en senderismo','Registra un gasto de -15 en senderismo','Registra un gasto de 1.000,50 en senderismo','Registra un gasto de 10 y 20 en senderismo','Registra un gasto de 15 en senderismo el 31/02']){await input.fill(text);await send.click();await p.waitForTimeout(40);assert.equal(await proposal.count(),0,text);assert.equal(await raw(),afterQuick);}
   await input.fill('Registra un gasto de 12,50 en senderismo');await send.click();await proposal.waitFor();await proposal.getByLabel('Importe (€)',{exact:true}).fill('13.25');await proposal.getByRole('button',{name:'Confirmar y registrar',exact:true}).click();await proposal.waitFor({state:'hidden'});data=JSON.parse((await raw())!);assert.equal(data.transactions.length,3);assert.equal(data.transactions[0].amount,13.25);assert.equal(data.transactions[0].code,'partida-ticket');assert.deepEqual(data.budgetPlans,fixture.budgetPlans);assert.deepEqual(errors,[]);
  }finally{await c.close();}
 });
 await t.test('FinanceStore real en Chromium: callback fallido, cuota, archivo, restauración, éxito y no-op',async()=>{
  const c=await browser.newContext();try{const p=await c.newPage();await p.goto(origin+'/app');await p.addScriptTag({content:probe});const results=await p.evaluate(()=>(globalThis as any).phase4aStoreProbe());
   for(const r of results){if(r.mode==='valid'){assert.equal(r.error,'');assert.equal(r.diskUnchanged,false);assert.equal(r.writes,1);}else {assert.equal(r.memoryUnchanged,true,r.mode);assert.equal(r.diskUnchanged,true,r.mode);assert.equal(r.writes,0,r.mode);if(r.mode!=='noop')assert.ok(r.error,r.mode);}}
  }finally{await c.close();}
 });
});
