import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import path from 'node:path';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {build} from 'vite';
import {chromium,type Page} from 'playwright-core';
import {DATA_KEY,parseBackup,makeBackup} from '../src/utils/backup';
import {multilingualCatalogFixture} from './multilingualCatalogFixture';
import {translatorFor,languages,type Language} from '../src/i18n';
import {navigateModule} from './browserNavigation';

// Production native resources in Chromium are adapter evidence, never Android/iOS certification.
test('5G: prototipo local y adaptadores en Chromium; no es ejecución nativa',{timeout:180000},async t=>{
 const root=path.resolve(process.env.CI_ARTIFACT_DIR??'ci-artifacts'),nativeDir=path.join(root,'native-preview'),reports=path.join(root,'browser');
 await mkdir(reports,{recursive:true});
 await build({configFile:'vite.native.config.ts',build:{outDir:nativeDir,emptyOutDir:true}});
 async function serve(directory:string){
  const app=express();app.get('/__axe.js',(_q,r)=>r.sendFile(path.resolve('node_modules/axe-core/axe.min.js')));app.use(express.static(directory));app.get('*',(_q,r)=>r.sendFile(path.join(directory,'index.html')));
  const server=await new Promise<ReturnType<typeof app.listen>>(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});
  return {origin:`http://127.0.0.1:${(server.address() as {port:number}).port}`,close:()=>new Promise<void>(r=>server.close(()=>r()))};
 }
 const native=await serve(nativeDir),web=await serve(path.resolve('dist'));t.after(native.close);t.after(web.close);
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
 async function setup(width=390,language:Language='es',theme='dark',wrongBuild=false){
  const c=await browser.newContext({viewport:{width,height:900},hasTouch:width===390,isMobile:width===390,locale:languages[language].locale,timezoneId:'Europe/Madrid',serviceWorkers:'block',acceptDownloads:true});
  const errors:string[]=[],remote:string[]=[],api:string[]=[];
  await c.route('**/*',route=>{const url=new URL(route.request().url());if(![native.origin,web.origin].includes(url.origin)){remote.push(url.origin);return route.abort();}if(url.pathname.startsWith('/api/'))api.push(url.pathname);return route.continue();});
  await c.addInitScript(({key,language,theme,wrongBuild})=>{
   (window as any).__name=(fn:unknown)=>fn;
   const get=Storage.prototype.getItem,set=Storage.prototype.setItem;
   if(get.call(localStorage,key)===null)set.call(localStorage,key,'SYNTHETIC_PRIVATE_PROFILE_MUST_NOT_BE_READ');
   set.call(localStorage,'finanzas.ui.language',language);set.call(localStorage,'finanzas.ui.theme',theme);
   (window as any).__financialReads=[];(window as any).__financialWrites=[];
   (window as any).__savedProfile=()=>get.call(localStorage,key);
   Storage.prototype.getItem=function(k){if(k.startsWith('finanzas_pro_'))(window as any).__financialReads.push(k);return get.call(this,k);};
   Storage.prototype.setItem=function(k,v){if(k.startsWith('finanzas_pro_'))(window as any).__financialWrites.push(k);return set.call(this,k,v);};
   if(wrongBuild)(window as any).Capacitor={getPlatform:()=> 'android',isNativePlatform:()=>true};
  },{key:DATA_KEY,language,theme,wrongBuild});
  const p=await c.newPage();p.setDefaultTimeout(8000);p.on('pageerror',e=>errors.push(e.message));
  await p.goto((wrongBuild?web.origin+'/app':native.origin));
  await p.getByRole('heading',{name:translatorFor(language)('native.title'),exact:true}).waitFor();
  return {c,p,errors,api,close:async()=>{const observed=await p.evaluate(()=>({reads:(window as any).__financialReads,writes:(window as any).__financialWrites,profile:(window as any).__savedProfile()}));assert.deepEqual(observed,{reads:[],writes:[],profile:'SYNTHETIC_PRIVATE_PROFILE_MUST_NOT_BE_READ'});assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);assert.deepEqual(api,[]);await c.close();}};
 }
 async function enter(p:Page,language:Language='es'){
  const tr=translatorFor(language);await p.getByRole('checkbox',{name:tr('native.acknowledge'),exact:true}).check();await p.getByRole('button',{name:tr('native.enter'),exact:true}).click();await p.locator('.home-quick').waitFor();
 }
 const back=(p:Page)=>p.evaluate(()=>document.dispatchEvent(new Event('finanzas-prototype-back')));
 async function exported(p:Page){
  await p.locator('header').getByRole('button',{name:translatorFor('es')('options.title'),exact:true}).click();const pending=p.waitForEvent('download');await p.getByRole('button',{name:translatorFor('es')('options.export'),exact:true}).click();const file=await pending;return parseBackup(await readFile((await file.path())!,'utf8'));
 }
 await t.test('el consentimiento precede al App y un perfil WebView previo nunca se carga',async()=>{
  const s=await setup();try{assert.equal(await s.p.getByRole('button',{name:'Entrar con datos ficticios'}).isDisabled(),true);assert.equal(await s.p.locator('.finance-app').count(),0);await enter(s.p);await s.p.getByText(translatorFor('es')('native.sessionNotice'),{exact:true}).waitFor();}finally{await s.close();}
 });
 await t.test('sesión financiera3.5, exportación completa, idiomas y reinicio desechable',async()=>{
  const s=await setup(1280);try{
   const {p}=s;await enter(p);await navigateModule(p,'Cuentas');await p.getByRole('button',{name:'Nueva Cuenta',exact:true}).click();const form=p.getByRole('dialog',{name:'Cartera',exact:true});await form.getByLabel('Nombre de la cuenta',{exact:true}).fill('Cuenta ficticia de sesión');await form.locator('button[type=submit]').click();await form.waitFor({state:'hidden'});
   const original=await exported(p);assert.equal(original.version,'3.5');assert.ok(original.wallets.some(w=>w.name==='CUENTA FICTICIA DE SESIÓN'));
   for(const language of ['en','it','fr','pt','es'] as Language[]){
    const current=await p.evaluate(()=>document.documentElement.lang);const previous=(Object.entries(languages).find(([,x])=>x.locale===current)?.[0]??'es') as Language;
    await p.locator('header').getByRole('button',{name:translatorFor(previous)('options.title'),exact:true}).click();await p.locator('#ui-language').selectOption(language);await p.waitForFunction(locale=>document.documentElement.lang===locale,languages[language].locale);await p.keyboard.press('Escape');await p.getByText('CUENTA FICTICIA DE SESIÓN',{exact:true}).first().waitFor();
   }
   const after=await exported(p);const withoutTime=({exportedAt,...rest}:any)=>rest;assert.deepEqual(withoutTime(after),withoutTime(original));
   await p.reload();await p.getByRole('heading',{name:'Prototipo FinanZas Pro',exact:true}).waitFor();await enter(p);const reset=await exported(p);assert.ok(!reset.wallets.some(w=>w.name==='CUENTA FICTICIA DE SESIÓN'));
  }finally{await s.close();}
 });
 await t.test('Atrás y reanudar conservan campos, foco y diálogos financieros',async()=>{
  const s=await setup();try{const {p}=s;await enter(p);await p.getByRole('button',{name:'Añadir',exact:true}).click();const form=p.getByRole('dialog',{name:'Movimiento',exact:true}),field=form.getByLabel('Concepto',{exact:true});await field.fill('Borrador ficticio protegido');await field.focus();await back(p);assert.equal(await field.inputValue(),'Borrador ficticio protegido');assert.equal(await field.evaluate(el=>document.activeElement===el),true);await p.evaluate(()=>document.dispatchEvent(new Event('finanzas-prototype-resume')));assert.equal(await field.inputValue(),'Borrador ficticio protegido');await p.keyboard.press('Tab');assert.equal(await form.evaluate(el=>el.contains(document.activeElement)),true);await p.keyboard.press('Shift+Tab');assert.equal(await form.evaluate(el=>el.contains(document.activeElement)),true);await p.keyboard.press('Escape');await form.waitFor({state:'hidden'});
  }finally{await s.close();}
 });
 await t.test('Atrás conserva el registro rápido y el mensaje del asistente sin enviar',async()=>{
  const s=await setup();try{const {p}=s;await enter(p);const quick=p.locator('.home-quick input');await quick.fill('Borrador ficticio');await back(p);assert.equal(await quick.inputValue(),'Borrador ficticio');await quick.fill('');await navigateModule(p,'Asistente');await p.getByText(translatorFor('es')('native.remoteUnavailable'),{exact:true}).waitFor();const input=p.locator('.assistant-chat form input');await input.fill('Mensaje ficticio sin enviar');await back(p);assert.equal(await input.inputValue(),'Mensaje ficticio sin enviar');await input.fill('consulta general de prueba');const replies=await p.locator('.assistant-message').count();await input.press('Enter');await p.waitForFunction(count=>document.querySelectorAll('.assistant-message').length===count+2,replies);assert.equal(await input.inputValue(),'');assert.deepEqual(s.api,[]);
  }finally{await s.close();}
 });
 await t.test('Atrás reutiliza la confirmación de planificación y no descarta el borrador',async()=>{
  const s=await setup(1280);try{const {p}=s;await enter(p);await navigateModule(p,'Presupuestos');const planning=p.getByRole('region',{name:'Planificación financiera',exact:true});await planning.waitFor();const amount=planning.getByRole('textbox',{name:/^Previsto GASTO/}).first();await amount.fill('123.45');await back(p);const guard=p.getByRole('dialog',{name:'Cambios de planificación sin guardar',exact:true});await guard.waitFor();await guard.getByRole('button',{name:'Seguir editando',exact:true}).click();assert.equal(await amount.inputValue(),'123.45');
  }finally{await s.close();}
 });
 await t.test('importación externa bloqueada por botón y File programático, sin preview ni reemplazo',async()=>{
  const s=await setup();try{const {p}=s;await enter(p);await p.locator('header').getByRole('button',{name:translatorFor('es')('options.title'),exact:true}).click();await p.getByRole('button',{name:translatorFor('es')('options.import'),exact:true}).click();await p.getByText(translatorFor('es')('native.importBlocked'),{exact:true}).waitFor();await p.locator('input[type=file]').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(makeBackup(multilingualCatalogFixture())))});assert.equal(await p.getByRole('dialog').count(),0);assert.equal(await p.locator('.home-quick').count(),1);
  }finally{await s.close();}
 });
 await t.test('un fallo al exportar conserva la sesión y permite continuar',async()=>{
  const s=await setup();try{const {p}=s;await enter(p);await p.evaluate(()=>{URL.createObjectURL=()=>{throw Error('Synthetic blocked export');};});await p.locator('header').getByRole('button',{name:translatorFor('es')('options.title'),exact:true}).click();await p.getByRole('button',{name:translatorFor('es')('options.export'),exact:true}).click();await p.getByText(translatorFor('es')('native.exportFailed'),{exact:true}).waitFor();assert.equal(await p.locator('.home-quick').count(),1);
  }finally{await s.close();}
 });
 await t.test('un contenedor que empaqueta por error el build web falla cerrado',async()=>{
  const s=await setup(390,'es','dark',true);try{await s.p.getByText(translatorFor('es')('native.packagingError'),{exact:true}).waitFor();assert.equal(await s.p.locator('.finance-app').count(),0);}finally{await s.close();}
 });
 await t.test('áreas seguras y teclado: CSS emulado, sin afirmar teclado o notch nativos',async()=>{
  const s=await setup();try{
   const {p,c}=s,cdp=await c.newCDPSession(p);await cdp.send('Emulation.setSafeAreaInsetsOverride',{insets:{top:24,right:0,bottom:16,left:0}});
   await enter(p);assert.equal(await p.evaluate(()=>getComputedStyle(document.body).paddingTop),'24px');
   const navigation=p.locator('.mobile-navigation');assert.equal(await navigation.isVisible(),true);
   const input=p.locator('.home-quick input');await input.fill('Borrador con teclado');await input.focus();
   await p.evaluate(()=>document.documentElement.dataset.nativeKeyboard='open');assert.equal(await navigation.isVisible(),false);
   assert.equal(await input.inputValue(),'Borrador con teclado');assert.equal(await input.evaluate(el=>document.activeElement===el),true);
   await p.evaluate(()=>delete document.documentElement.dataset.nativeKeyboard);assert.equal(await navigation.isVisible(),true);
   await p.getByRole('button',{name:'Añadir',exact:true}).click();const dialog=p.getByRole('dialog',{name:'Movimiento',exact:true});
   assert.equal(await dialog.evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=24&&r.bottom<=innerHeight-16;}),true);
  }finally{await s.close();}
 });
 for(const language of Object.keys(languages) as Language[]){
  const observations:any[]=[];
  for(const width of [390,768,1280])for(const theme of ['dark','light'])await t.test(`${language}/${width}/${theme}: shell de navegador, teclado, idioma, reflow y axe`,async()=>{
   const s=await setup(width,language,theme);try{const {p}=s;await p.addScriptTag({url:native.origin+'/__axe.js'});const gate=await p.evaluate(async()=>await (window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));observations.push({surface:'native-prototype-consent-browser-preview',platform:'Chromium adapter preview,not Android/iOS',language,width,theme,violations:gate.violations,incomplete:gate.incomplete});assert.deepEqual(gate.violations,[]);await enter(p,language);assert.equal(await p.evaluate(()=>document.documentElement.lang),languages[language].locale);const backButton=p.locator('.native-prototype-bar button');assert.equal(await backButton.evaluate(el=>document.activeElement===el),true);await p.keyboard.press('Tab');assert.notEqual(await p.evaluate(()=>document.activeElement?.tagName),'BODY');await p.keyboard.press('Shift+Tab');assert.equal(await backButton.evaluate(el=>document.activeElement===el),true);const result=await p.evaluate(async()=>await (window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));observations.push({surface:'native-prototype-browser-preview',platform:'Chromium adapter preview,not Android/iOS',language,width,theme,violations:result.violations,incomplete:result.incomplete});assert.deepEqual(result.violations,[]);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),true);await p.evaluate(()=>document.documentElement.style.fontSize='125%');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),true);await p.evaluate(()=>document.documentElement.style.fontSize='');if(width===390)await p.screenshot({path:path.join(reports,`native-preview-${language}-${theme}.png`)});
   }finally{await s.close();}
  });
  await writeFile(path.join(reports,`translated-native-preview-${language}.json`),JSON.stringify({scope:'Production native build in Chromium only. No device,WebView or durable native storage validation.',observations},null,2)+'\n');
 }
});

import './identityFoundationCases';

import "./auth0Access.browser";
