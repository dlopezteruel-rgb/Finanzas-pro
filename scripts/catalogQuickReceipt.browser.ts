import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {DATA_KEY,makeBackup} from '../src/utils/backup';
import {LANGUAGE_KEY,languages,translatorFor,presentationFormatters,type Language} from '../src/i18n';
import {catalogPresentation} from '../src/i18n/catalogNames';
import {multilingualCatalogFixture} from './multilingualCatalogFixture';

test('5D: confirmación de registro rápido con nombres de sistema y movimiento original',{timeout:60000},async t=>{
 const app=express();app.use(express.static('dist'));app.get('*',(_q,r)=>r.sendFile(path.resolve('dist/index.html')));
 const server=await new Promise<ReturnType<typeof app.listen>>(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});t.after(()=>new Promise<void>(r=>server.close(()=>r())));
 const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`,browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
 for(const l of Object.keys(languages) as Language[])await t.test(`${l}: recibo nativo sin traducir el registro persistido`,async()=>{
  const data=multilingualCatalogFixture(),tr=translatorFor(l),format=presentationFormatters(l),names=catalogPresentation(data,tr),c=await browser.newContext({viewport:{width:390,height:1000},locale:'de-DE',timezoneId:'Europe/Madrid',serviceWorkers:'block'}),external:string[]=[],errors:string[]=[];
  try{
   await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(external.push(r.request().url()),r.abort()));await c.addInitScript(({key,value,pref,l})=>{(window as any).__name=(fn:unknown)=>fn;localStorage.setItem(key,value);localStorage.setItem(pref,l);},{key:DATA_KEY,value:JSON.stringify(makeBackup(data)),pref:LANGUAGE_KEY,l});const p=await c.newPage();p.setDefaultTimeout(8000);p.on('pageerror',e=>errors.push(e.message));await p.clock.setFixedTime(new Date('2026-11-13T12:00:00Z'));await p.goto(origin+'/app');const quick=p.locator('.home-quick');await quick.getByRole('textbox',{name:tr('quick.label'),exact:true}).fill('Gasté 5 en gasolina con BANCO');await quick.getByLabel(tr('quick_natural_language_input.partida_del_registro_rapido'),{exact:true}).selectOption('V.002.001');await quick.getByLabel(tr('quick_natural_language_input.cartera_del_registro_rapido'),{exact:true}).selectOption('BANCO');await quick.getByRole('button',{name:tr('quick_natural_language_input.registrar'),exact:true}).click();const receipt=quick.locator('.quick-entry-notice');await receipt.waitFor();assert.equal((await receipt.innerText()).trim(),tr('quick.saved',{type:tr('quick_natural_language_input.gasto'),amount:format.formatMoney(5),name:names.itemRef('GASTO','V.002.001')}));
   const saved=JSON.parse((await p.evaluate(k=>localStorage.getItem(k),DATA_KEY))!),created=saved.transactions.filter((tx:any)=>!data.transactions.some(old=>old.id===tx.id));assert.equal(created.length,1);const original=data.budgetGroups.flatMap(g=>g.partidas).find(p=>p.type==='GASTO'&&p.code==='V.002.001')!;assert.equal(created[0].amount,5);assert.equal(created[0].code,original.code);assert.equal(created[0].subcategoryName,original.name);assert.equal(created[0].categoryName,original.groupName);assert.equal(created[0].wallet,'BANCO');assert.equal(created[0].date,'2026-11-13');for(const field of ['budgetGroups','catalogNames','budgetPlans','planningMonths','budgetSubitems','wallets'] as const)assert.deepEqual(saved[field],data[field]);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  }finally{await c.close();}
 });
});
