import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {chromium} from 'playwright-core';
import {DATA_KEY,parseBackup} from '../src/utils/backup';
import {volumeFixture} from './performance/fixture';
import {navigateModule} from './browserNavigation';
import {economicTransactions} from '../src/utils/transfers';
import {presentationFormatters} from '../src/i18n';

test('5E: volumen, filtros, céntimos, orden y persistencia sin virtualizar ni limitar datos',{timeout:120000},async t=>{
 const app=express();app.use(express.static('dist'));app.get('*',(_q,r)=>r.sendFile(path.resolve('dist/index.html')));const server=await new Promise<ReturnType<typeof app.listen>>(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});t.after(()=>new Promise<void>(r=>server.close(()=>r())));const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`,browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
 for(const [count,width]of [[100,390],[1000,768],[5000,1280]])await t.test(`${count} registros/${width}px: resultados íntegros con búsqueda, foco y recarga`,async()=>{
  const backup=volumeFixture(count),raw=JSON.stringify(backup),parsed=parseBackup(raw),hash=createHash('sha256').update(raw).digest('hex'),c=await browser.newContext({viewport:{width,height:900},timezoneId:'Europe/Madrid',serviceWorkers:'block'});
  try{await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await c.addInitScript(({key,raw})=>{(window as any).__name=(fn:unknown)=>fn;if(localStorage.getItem(key)===null)localStorage.setItem(key,raw);localStorage.setItem('finanzas.ui.language','es');(window as any).__writes=[];const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k!=='finanzas.ui.language')(window as any).__writes.push(k);return set.call(this,k,v);};},{key:DATA_KEY,raw});const p=await c.newPage();p.setDefaultTimeout(15000);const errors:string[]=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/app');await p.locator('.home-quick').waitFor();await navigateModule(p,'Movimientos');await p.waitForFunction(n=>document.querySelectorAll('.movement-row').length===n,count);
   const expected=[...parsed.transactions].sort((a,b)=>new Date(b.date).getTime()-new Date(a.date).getTime());assert.deepEqual(await p.locator('.movement-row span[title]').evaluateAll(nodes=>nodes.map(el=>el.getAttribute('title'))),expected.map(t=>t.description));const field=p.getByRole('textbox',{name:'Buscar movimientos',exact:true}),handle=await field.elementHandle();await field.fill('needle');await p.waitForFunction(n=>document.querySelectorAll('.movement-row').length===n,Math.floor((count-1)/10));assert.equal(await handle!.evaluate(el=>el===document.activeElement),true);
   const filtered=expected.filter(t=>t.description.includes('needle'));assert.deepEqual(await p.locator('.movement-row span[title]').evaluateAll(nodes=>nodes.map(el=>el.getAttribute('title'))),filtered.map(t=>t.description));const economic=economicTransactions(parsed.transactions).filter(t=>filtered.some(f=>f.id===t.id)),format=presentationFormatters('es');for(const type of ['INGRESO','GASTO']){const amount=economic.filter(t=>t.type===type&&t.processed).reduce((n,t)=>n+t.amount,0);assert.ok((await p.locator('.transactions-view').innerText()).includes(format.formatMoney(amount)));}
   await p.keyboard.press('Tab');await p.keyboard.press('Shift+Tab');assert.equal(await handle!.evaluate(el=>el===document.activeElement),true);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);assert.deepEqual(await p.evaluate(()=>(window as any).__writes),[]);assert.equal(createHash('sha256').update((await p.evaluate(k=>localStorage.getItem(k),DATA_KEY))!).digest('hex'),hash);await p.reload();await p.locator('.home-quick').waitFor();assert.equal(await p.evaluate(k=>localStorage.getItem(k),DATA_KEY),raw);assert.deepEqual(await p.evaluate(()=>(window as any).__writes),[]);assert.deepEqual(errors,[]);
  }finally{await c.close();}
 });
});
