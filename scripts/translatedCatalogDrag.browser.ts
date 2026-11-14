import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {DATA_KEY,makeBackup} from '../src/utils/backup';
import {catalogReorderFixture} from './catalogReorderFixture';
import {LANGUAGE_KEY,languages,translatorFor,type Language} from '../src/i18n';
import {i18nTestBuild} from './i18n/preview';

test('5B arrastre: idiomas, cambio cross-tab, teclado, ratón y tacto emulado sin traducir identidades',{timeout:180000},async t=>{
 const bundle=await i18nTestBuild();t.after(bundle.dispose);const app=express();app.use(express.static(bundle.dist));app.get('*',(_q,r)=>r.sendFile(path.join(bundle.dist,'index.html')));
 const server=await new Promise<ReturnType<typeof app.listen>>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise<void>(r=>server.close(()=>r())));
 const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`,browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
 for(const language of Object.keys(languages) as Language[])for(const mode of ['mouse','touch'] as const)await t.test(`${language}/${mode}: anuncios nativos, cancelación sin escrituras y orden confirmado`,async()=>{
  const backup=makeBackup(catalogReorderFixture()),width=mode==='touch'?390:1280,c=await browser.newContext({viewport:{width,height:950},isMobile:mode==='touch',hasTouch:mode==='touch',locale:'de-DE',timezoneId:'Europe/Madrid',serviceWorkers:'block'});
  try{
   const errors:string[]=[],external:string[]=[];await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(external.push(r.request().url()),r.abort()));
   await c.addInitScript(({key,value,pref,language})=>{(window as any).__name=(fn:unknown)=>fn;if(localStorage.getItem(key)===null)localStorage.setItem(key,value);if(localStorage.getItem(pref)===null)localStorage.setItem(pref,language);},{key:DATA_KEY,value:JSON.stringify(backup),pref:LANGUAGE_KEY,language});
   const p=await c.newPage();p.setDefaultTimeout(8000);p.on('pageerror',e=>errors.push(e.message));await p.clock.setFixedTime(new Date('2026-11-13T12:00:00Z'));await p.goto(origin+'/app');const tr=translatorFor(language);
   await p.getByRole('navigation',{name:tr('nav.label')}).filter({visible:true}).getByRole('button',{name:tr('nav.budgets'),exact:true}).click();await p.getByRole('tab',{name:tr('budget_workspace.catalogo_y_detalle_de_partidas'),exact:true}).click();
   const raw=()=>p.evaluate(k=>localStorage.getItem(k),DATA_KEY),before=await raw();
   await p.evaluate(key=>{(window as any).__financialWrites=0;const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)(window as any).__financialWrites++;return original.call(this,k,v);};},DATA_KEY);
   const other=await c.newPage();await other.goto(origin+'/app');await p.bringToFront();
   const grip=p.getByRole('button',{name:tr('use_catalog_drag.arrastrar',{label:tr('drag.family',{name:'Viajes ficticios'})}),exact:true}),handle=await grip.elementHandle();await grip.focus();await p.keyboard.press('Space');await p.keyboard.press('Home');
   const status=p.locator('.catalog-drag-status');assert.equal(await status.innerText(),tr('drag.destination',{target:'Gastos ficticios'}));
   const next:Language=language==='en'?'fr':'en',nt=translatorFor(next);await other.evaluate(({key,value})=>localStorage.setItem(key,value),{key:LANGUAGE_KEY,value:next});await p.waitForFunction(locale=>document.documentElement.lang===locale,languages[next].locale);await p.bringToFront();
   assert.equal(await status.innerText(),nt('drag.destination',{target:'Gastos ficticios'}));assert.equal(await handle!.evaluate(el=>el.isConnected&&el===document.activeElement),true);assert.equal(await handle!.getAttribute('aria-label'),nt('use_catalog_drag.arrastrar',{label:nt('drag.family',{name:'Viajes ficticios'})}));
   await p.keyboard.press('Escape');assert.equal(await status.innerText(),nt('drag.cancelled'));assert.equal(await raw(),before);assert.equal(await p.evaluate(()=>(window as any).__financialWrites),0);
   await other.evaluate(({key,value})=>localStorage.setItem(key,value),{key:LANGUAGE_KEY,value:language});await p.waitForFunction(locale=>document.documentElement.lang===locale,languages[language].locale);await p.bringToFront();
   await grip.focus();await p.keyboard.press('Space');await p.keyboard.press('Home');await p.keyboard.press('Enter');await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)!).budgetGroups.filter((g:any)=>g.type==='GASTO')[0].code==='family-travel',DATA_KEY);await status.getByText(tr('drag.saved',{source:tr('drag.family',{name:'Viajes ficticios'})}),{exact:true}).waitFor();assert.equal(await grip.isEnabled(),true);assert.equal(await handle!.evaluate(el=>el===document.activeElement),true);assert.equal(await status.innerText(),tr('drag.saved',{source:tr('drag.family',{name:'Viajes ficticios'})}));
   const from=p.getByRole('button',{name:tr('use_catalog_drag.arrastrar',{label:tr('drag.item',{name:'Comida ficticia'})}),exact:true}),to=p.getByRole('button',{name:tr('budgets.ver_partida',{name:'Ocio ficticio'}),exact:true}).locator('xpath=ancestor::*[@data-catalog-drop][1]');await from.scrollIntoViewIfNeeded();const start=(await from.boundingBox())!,a={x:start.x+start.width/2,y:start.y+start.height/2};
   if(mode==='mouse'){
    await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(a.x+10,a.y);await to.scrollIntoViewIfNeeded();const end=(await to.boundingBox())!;await p.mouse.move(end.x+end.width/2,Math.max(170,Math.min(750,end.y+Math.min(80,end.height/2))),{steps:8});await p.locator('.catalog-drag-preview').waitFor();assert.equal(await status.innerText(),tr('drag.pointer',{source:tr('drag.item',{name:'Comida ficticia'})}));await p.mouse.up();
   }else{
    const cdp=await c.newCDPSession(p);await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[a]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+10,y:a.y}]});await to.scrollIntoViewIfNeeded();const end=(await to.boundingBox())!,b={x:end.x+end.width/2,y:Math.max(170,Math.min(750,end.y+Math.min(80,end.height/2)))};
    for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:a.x+(b.x-a.x)*i/8,y:a.y+(b.y-a.y)*i/8}]});await p.locator('.catalog-drag-preview').waitFor();assert.equal(await status.innerText(),tr('drag.pointer',{source:tr('drag.item',{name:'Comida ficticia'})}));await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
   }
   await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)!).budgetGroups.find((g:any)=>g.code==='G').partidas[0].code==='partida-food',DATA_KEY);const saved=JSON.parse((await raw())!);
   for(const key of ['transactions','budgetPlans','planningMonths','planningAutomation','wallets','loans'] as const)assert.deepEqual(saved[key],backup[key]);assert.deepEqual(saved.budgetSubitems.months,backup.budgetSubitems!.months);assert.equal(await p.evaluate(()=>(window as any).__financialWrites),2);
   const identity=(groups:typeof backup.budgetGroups)=>groups.flatMap(g=>[{type:g.type,code:g.code,name:g.name},...g.partidas.map(item=>({type:item.type,code:item.code,name:item.name}))]).sort((a,b)=>`${a.type}:${a.code}`.localeCompare(`${b.type}:${b.code}`));assert.deepEqual(identity(saved.budgetGroups),identity(backup.budgetGroups));
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  }catch(error){console.error(`Drag case ${language}/${mode}:`,error);throw error;}finally{await c.close();}
 });
});
