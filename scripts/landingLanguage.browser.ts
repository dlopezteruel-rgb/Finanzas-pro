import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import path from 'node:path';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium,type Page} from 'playwright-core';
import {LANGUAGE_KEY,languages,translatorFor,type Language} from '../src/i18n';
import {DATA_KEY,makeBackup,type FinanceData} from '../src/utils/backup';
import {responsiveFixture} from './responsiveFixture';
import {chartFixture} from './chartFixture';
import {assertNoSpanishOwnedText} from './i18n/residuals';

test('5C: idioma desde landing, navegación, accesibilidad y conservación financiera',{timeout:300000},async t=>{
  const app=express(),dist=path.resolve('dist');app.use(express.static(dist));app.get('*',(_q,r)=>r.sendFile(path.join(dist,'index.html')));
  const server=await new Promise<ReturnType<typeof app.listen>>(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});t.after(()=>new Promise<void>(r=>server.close(()=>r())));
  const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`,browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
  const axe=await readFile('node_modules/axe-core/axe.min.js','utf8'),observations:any[]=[],dir=path.resolve(process.env.CI_ARTIFACT_DIR??'ci-artifacts','browser');await mkdir(dir,{recursive:true});
  t.after(()=>writeFile(path.join(dir,'landing-language.json'),JSON.stringify({fixtureOnly:true,scope:'Production build; landing has its existing light palette, app is checked in both themes',observations},null,2)+'\n'));
  async function context(width=390,theme:'light'|'dark'='light',language:string='es',seed=true,fixture?:FinanceData){
    const c=await browser.newContext({viewport:{width,height:900},locale:'de-DE',timezoneId:'Europe/Madrid',serviceWorkers:'block'}),writes:string[]=[],errors:string[]=[],external:string[]=[];
    await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(external.push(r.request().url()),r.abort()));
    await c.exposeBinding('__recordFinancialMutation',(_source,operation:string)=>writes.push(operation));
    await c.addInitScript(({key,pref,value,language,seed})=>{
      (window as any).__name=(fn:unknown)=>fn;
      if(seed&&localStorage.getItem(key)===null){localStorage.setItem(key,value);localStorage.setItem(pref,language);}
      const set=Storage.prototype.setItem,remove=Storage.prototype.removeItem,clear=Storage.prototype.clear;
      Storage.prototype.setItem=function(k,v){if(this===localStorage&&k!==pref)void(window as any).__recordFinancialMutation(`set:${k}`);return set.call(this,k,v);};
      Storage.prototype.removeItem=function(k){if(this===localStorage&&k!==pref)void(window as any).__recordFinancialMutation(`remove:${k}`);return remove.call(this,k);};
      Storage.prototype.clear=function(){if(this===localStorage)void(window as any).__recordFinancialMutation('clear');return clear.call(this);};
    },{key:DATA_KEY,pref:LANGUAGE_KEY,value:JSON.stringify(makeBackup({...fixture??responsiveFixture(),theme})),language,seed});
    const page=async()=>{const p=await c.newPage();p.setDefaultTimeout(8000);p.on('pageerror',e=>errors.push(e.message));await p.clock.setFixedTime(new Date('2026-10-31T12:00:00Z'));return p;};
    return {c,page,writes,errors,external};
  }
  const raw=(p:Page)=>p.evaluate(k=>localStorage.getItem(k),DATA_KEY);
  async function changed(p:Page,language:Language){await p.waitForFunction(locale=>document.documentElement.lang===locale,languages[language].locale);assert.equal(await p.locator('#landing-language').inputValue(),language);}
  async function audit(p:Page,language:Language,width:number,theme:string,surface:string){
    await p.addScriptTag({content:axe});const result=await p.evaluate(async()=>{const r=await(window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return {violations:r.violations,incomplete:r.incomplete};});
    observations.push({language,width,theme,surface,...result});assert.deepEqual(result.violations,[],`${surface}: strict axe`);
    assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),true,`${surface}: overflow`);
  }
  for(const language of Object.keys(languages) as Language[])for(const width of [390,768,1280])for(const theme of ['light','dark'] as const)await t.test(`${language}/${width}/${theme}: selector nativo, teclado, ida/vuelta y cero escrituras`,async()=>{
    const {c,page,writes,errors,external}=await context(width,theme,language);try{
      const p=await page(),tr=translatorFor(language);await p.goto(origin+'/');await p.getByLabel(tr('language.label'),{exact:true}).waitFor();const select=p.locator('#landing-language'),before=await raw(p);
      assert.deepEqual(await select.locator('option').allTextContents(),Object.values(languages).map(l=>l.label));assert.equal(await select.locator('option:disabled').count(),0);
      assert.equal(await select.getAttribute('aria-describedby'),'landing-language-help');assert.equal(await p.locator('#landing-language-help').innerText(),tr('language.help'));
      assert.equal(await p.getByText(tr('language.label'),{exact:true}).isVisible(),true);
      await select.focus();const handle=await select.elementHandle();await p.keyboard.press('Tab');assert.equal(await p.locator('.landing-header .button-primary').evaluate(el=>el===document.activeElement),true);await p.keyboard.press('Shift+Tab');assert.equal(await handle!.evaluate(el=>el===document.activeElement),true);
      await p.keyboard.press('Home');await p.keyboard.press('ArrowDown');await p.keyboard.press('Enter');await changed(p,'en');
      await p.evaluate(()=>(window as any).__languageDocument='same');
      for(const next of Object.keys(languages) as Language[]){await select.selectOption(next);await changed(p,next);assert.equal(await p.evaluate(()=>(window as any).__languageDocument),'same');assert.equal(await handle!.evaluate(el=>el===document.activeElement),true);assert.equal(await raw(p),before);}
      await select.selectOption(language);await changed(p,language);assert.equal(await p.title(),tr('document.title'));await assertNoSpanishOwnedText(p,language,JSON.parse(before!));await audit(p,language,width,theme,'landing-selector');
      const boxes=await p.locator('.landing-header').evaluate(header=>[...header.querySelectorAll('.brand,select,.button-primary')].map(el=>{const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};}));
      for(let i=0;i<boxes.length;i++){assert.ok(boxes[i].left>=0&&boxes[i].right<=width);for(let j=i+1;j<boxes.length;j++){const a=boxes[i],b=boxes[j];assert.ok(a.right<=b.left||b.right<=a.left||a.bottom<=b.top||b.bottom<=a.top,'Header controls must not overlap');}}
      if(width>=768)assert.ok(boxes[1].top<boxes[2].bottom&&boxes[2].top<boxes[1].bottom,'Selector and primary action share the available desktop/tablet row');
      assert.ok(boxes[1].height>=44);assert.ok(parseFloat(await select.evaluate(el=>getComputedStyle(el).fontSize))>=16);
      if(theme==='light'&&['fr','pt'].includes(language))await p.screenshot({path:path.join(dir,`landing-${language}-${width}.png`),fullPage:true,animations:'disabled'});
      await p.locator('.landing-header .button-primary').click();await p.getByRole('group',{name:tr('app.secciones_de_inicio'),exact:true}).waitFor();await p.getByRole('button',{name:tr('options.title'),exact:true}).click();assert.equal(await p.locator('#ui-language').inputValue(),language);assert.equal(await p.locator('html').getAttribute('data-theme'),theme);assert.equal(await raw(p),before);
      const next:Language=language==='fr'?'pt':'fr';await p.locator('#ui-language').selectOption(next);await p.getByLabel(translatorFor(next)('language.label'),{exact:true}).waitFor();assert.equal(await raw(p),before);
      await p.goBack();await changed(p,next);assert.equal(await raw(p),before);await p.reload();await changed(p,next);assert.equal(await p.evaluate(k=>localStorage.getItem(k),LANGUAGE_KEY),next);assert.equal(await raw(p),before);assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    }finally{await c.close();}
  });
  await t.test('dos pestañas reales: landing/app, borrador pendiente, foco y cambios repetidos',async()=>{
    const {c,page,writes,errors}=await context();try{
      const p=await page(),other=await page();await p.goto(origin+'/');await other.goto(origin+'/app');await other.getByRole('button',{name:'Añadir',exact:true}).click();
      const dialog=other.getByRole('dialog').last(),es=translatorFor('es'),concept=dialog.getByLabel(es('transaction.concepto'),{exact:true}),amount=dialog.getByLabel(es('transaction.importe_total'),{exact:true});await concept.fill('Borrador literal {count}');await amount.fill('1234.56');await concept.focus();const focus=await concept.elementHandle(),before=await raw(p);
      for(const next of ['en','fr','pt','it','es','fr','en'] as Language[]){await p.locator('#landing-language').selectOption(next);await changed(p,next);await other.waitForFunction(locale=>document.documentElement.lang===locale,languages[next].locale);assert.equal(await focus!.evaluate(el=>el===document.activeElement),true);assert.equal(await dialog.getByLabel(translatorFor(next)('transaction.concepto'),{exact:true}).inputValue(),'Borrador literal {count}');assert.equal(await dialog.getByLabel(translatorFor(next)('transaction.importe_total'),{exact:true}).inputValue(),'1234.56');assert.equal(await raw(other),before);}
      const en=translatorFor('en'),trigger=dialog.getByRole('button',{name:en('partida_selector.seleccionar_partida_presupuestaria'),exact:true});assert.equal(await trigger.getAttribute('aria-controls'),null);await trigger.click();
      const list=dialog.getByRole('listbox');await list.waitFor();assert.equal(await trigger.getAttribute('aria-controls'),await list.getAttribute('id'));await dialog.getByRole('group',{name:en('partida_selector.partidas_recientes'),exact:true}).waitFor();await audit(other,'en',390,'light','movement-listbox-open');await other.keyboard.press('Escape');await list.waitFor({state:'hidden'});assert.equal(await trigger.getAttribute('aria-controls'),null);assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);assert.equal(await dialog.isVisible(),true);
      await other.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});await other.getByRole('button',{name:translatorFor('en')('options.title'),exact:true}).click();await other.locator('#ui-language').selectOption('pt');await changed(p,'pt');assert.equal(await raw(p),before);
      await other.evaluate(k=>localStorage.removeItem(k),LANGUAGE_KEY);await changed(p,'es');assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);
    }finally{await c.close();}
  });
  for(const language of Object.keys(languages) as Language[])await t.test(`${language}: grupos con nombre accesible en movimientos, reparto, borrado y deudas`,async()=>{
    const {c,page,writes,errors,external}=await context(390,'light',language,true,chartFixture());try{
      const p=await page(),tr=translatorFor(language);await p.goto(origin+'/app');await p.getByRole('button',{name:tr('options.title'),exact:true}).waitFor();const before=await raw(p);
      async function nav(key:'nav.movements'|'nav.contacts'|'nav.debts'){
        const n=p.getByRole('navigation',{name:tr('nav.label')}).filter({visible:true}),button=n.getByRole('button',{name:new RegExp('^'+tr(key))});
        if(await button.count())await button.click();else{await n.getByRole('button',{name:new RegExp('^'+tr('nav.more'))}).click();await p.getByRole('dialog',{name:tr('nav.moreTitle'),exact:true}).getByRole('button',{name:new RegExp('^'+tr(key))}).click();}
      }
      await nav('nav.movements');await p.getByRole('group',{name:tr('app.secciones_de_movimientos'),exact:true}).waitFor();await audit(p,language,390,'light','named-movement-sections');
      await p.getByRole('button',{name:tr('transactions.ver_reparto'),exact:true}).click();assert.equal(await p.getByRole('group',{name:tr('shared_expense_detail.registro_de_liquidacion'),exact:true}).count(),2);await audit(p,language,390,'light','named-shared-settlements');await p.keyboard.press('Escape');
      await p.getByRole('button',{name:tr('transactions.editar_movimiento_e09265',{description:'Cena ficticia'}),exact:true}).click();await p.getByRole('group',{name:tr('transaction.desglose_del_reparto'),exact:true}).waitFor();await audit(p,language,390,'light','named-shared-breakdown');await p.keyboard.press('Escape');
      await nav('nav.contacts');await p.getByRole('button',{name:tr('contacts.detalle_de',{name:'Contacto ficticio ana'}),exact:true}).click();await p.getByRole('button',{name:tr('contacts.eliminar_contacto',{name:'Contacto ficticio ana'}),exact:true}).click();await p.getByRole('group',{name:tr('confirm_delete_dialog.relaciones_y_alcance_de_la_eliminacion'),exact:true}).waitFor();await audit(p,language,390,'light','named-deletion-impact');await p.keyboard.press('Escape');
      await nav('nav.debts');await p.getByRole('group',{name:tr('debts_workspace.direccion_de_deuda'),exact:true}).waitFor();await audit(p,language,390,'light','named-debt-direction');assert.equal(await raw(p),before);assert.deepEqual(writes,[]);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    }finally{await c.close();}
  });
  await t.test('preferencia inválida: fallback español sin reparación ni escrituras financieras',async()=>{
    const {c,page,writes}=await context(390,'light','{"invalid":true}');try{const p=await page();await p.goto(origin+'/');await changed(p,'es');assert.equal(await p.evaluate(k=>localStorage.getItem(k),LANGUAGE_KEY),'{"invalid":true}');assert.deepEqual(writes,[]);}finally{await c.close();}
  });
  await t.test('cuota denegada: cambio en memoria, aviso nativo y preferencia original conservada',async()=>{
    const {c,page,writes}=await context();try{await c.addInitScript(key=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('quota','QuotaExceededError');return set.call(this,k,v);};},LANGUAGE_KEY);const p=await page();await p.goto(origin+'/');await p.locator('#landing-language').selectOption('fr');await changed(p,'fr');await p.getByRole('status').getByText(translatorFor('fr')('language.storageError'),{exact:true}).waitFor();assert.equal(await p.evaluate(k=>localStorage.getItem(k),LANGUAGE_KEY),'es');await audit(p,'fr',390,'light','landing-storage-error');assert.deepEqual(writes,[]);}finally{await c.close();}
  });
  await t.test('lectura denegada: español seguro y selección de idioma independiente',async()=>{
    const {c,page,writes}=await context(390,'light','pt');try{await c.addInitScript(key=>{const get=Storage.prototype.getItem;Storage.prototype.getItem=function(k){if(k===key)throw new DOMException('denied','SecurityError');return get.call(this,k);};},LANGUAGE_KEY);const p=await page();await p.goto(origin+'/');await changed(p,'es');await p.locator('#landing-language').selectOption('it');await changed(p,'it');assert.deepEqual(writes,[]);}finally{await c.close();}
  });
  await t.test('localStorage inaccesible: landing usable sin recarga y aviso accesible',async()=>{
    const c=await browser.newContext({viewport:{width:390,height:900},serviceWorkers:'block'});try{await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());await c.addInitScript(()=>{(window as any).__name=(fn:unknown)=>fn;Object.defineProperty(window,'localStorage',{get(){throw new DOMException('denied','SecurityError');}});});const p=await c.newPage();p.setDefaultTimeout(8000);await p.goto(origin+'/');await changed(p,'es');await p.locator('#landing-language').selectOption('pt');await changed(p,'pt');await p.getByRole('status').getByText(translatorFor('pt')('language.storageError'),{exact:true}).waitFor();await p.reload();await changed(p,'es');}finally{await c.close();}
  });
  await t.test('visita nueva: elegir idioma no crea almacenamiento financiero',async()=>{
    const {c,page,writes}=await context(390,'light','es',false);try{const p=await page();await p.goto(origin+'/');await changed(p,'es');for(const language of Object.keys(languages) as Language[]){await p.locator('#landing-language').selectOption(language);await changed(p,language);assert.equal(await raw(p),null);}assert.deepEqual(await p.evaluate(()=>Object.keys(localStorage)),[LANGUAGE_KEY]);assert.deepEqual(writes,[]);}finally{await c.close();}
  });
});
