import {assertNoSpanishOwnedText} from './i18n/residuals';
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import path from 'node:path';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {DATA_KEY,makeBackup} from '../src/utils/backup';
import {catalogArchiveFixture} from './catalogArchiveFixture';
import {LANGUAGE_KEY,languages,translatorFor,type Language} from '../src/i18n';
import {i18nTestBuild} from './i18n/preview';

test('5B catálogo: archivo explícito y subítems en cinco idiomas, tres anchos y ambos temas; vista previa parcial',{timeout:300000},async t=>{
 const bundle=await i18nTestBuild();t.after(bundle.dispose);const app=express();app.use(express.static(bundle.dist));app.get('*',(_q,r)=>r.sendFile(path.join(bundle.dist,'index.html')));
 const server=await new Promise<ReturnType<typeof app.listen>>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise<void>(r=>server.close(()=>r())));
 const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`,browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
 const observations:any[]=[],axe=await readFile('node_modules/axe-core/axe.min.js','utf8'),dir=path.resolve(process.env.CI_ARTIFACT_DIR??'ci-artifacts','browser');await mkdir(dir,{recursive:true});
 t.after(async()=>{await writeFile(path.join(dir,'translated-catalog.json'),JSON.stringify({isolatedPreview:bundle.preview,productionAvailability:bundle.availability,scope:'Catalogue labels, archive confirmation, cross-tab language, history preservation, subitems and keyboard cancellation. Domain error presentation and full-language readiness remain pending.',observations},null,2)+'\n');});
 for(const language of Object.keys(languages) as Language[])for(const width of [390,768,1280])for(const theme of ['light','dark'] as const)await t.test(`${language}, ${width}px, ${theme}: archivo, reactivación y dependencias conservadas`,async()=>{
  const data={...catalogArchiveFixture(),theme},backup=makeBackup(data),c=await browser.newContext({viewport:{width,height:1000},isMobile:width===390,hasTouch:width===390,locale:'de-DE',timezoneId:'Europe/Madrid',serviceWorkers:'block'});
  const started=performance.now(),timings:{stage:string;ms:number}[]=[];const mark=(stage:string)=>timings.push({stage,ms:performance.now()-started});
  try{
   const errors:string[]=[],external:string[]=[];await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(external.push(r.request().url()),r.abort()));
   await c.addInitScript(({key,value,pref,language})=>{(window as any).__name=(fn:unknown)=>fn;if(localStorage.getItem(key)===null)localStorage.setItem(key,value);if(localStorage.getItem(pref)===null)localStorage.setItem(pref,language);},{key:DATA_KEY,value:JSON.stringify(backup),pref:LANGUAGE_KEY,language});
   const p=await c.newPage();p.setDefaultTimeout(8000);p.on('pageerror',e=>errors.push(e.message));await p.clock.setFixedTime(new Date('2026-11-13T12:00:00Z'));await p.goto(origin+'/app');const tr=translatorFor(language);
   await p.getByRole('navigation',{name:tr('nav.label')}).filter({visible:true}).getByRole('button',{name:tr('nav.budgets'),exact:true}).click();await p.getByRole('tab',{name:tr('budget_workspace.catalogo_y_detalle_de_partidas'),exact:true}).click();
   await p.locator('.catalog-manager > summary').click();mark('catalog-ready');const before=await p.evaluate(k=>localStorage.getItem(k),DATA_KEY);
   await p.evaluate(key=>{(window as any).__financialWrites=0;const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)(window as any).__financialWrites++;return original.call(this,k,v);};},DATA_KEY);
   await p.getByRole('button',{name:tr('catalog_manager.eliminar_familia',{name:'Gastos ficticios'}),exact:true}).click();
   const removal=p.getByRole('dialog',{name:tr('catalog_manager.deleteFamilyTitle'),exact:true});await removal.getByText(tr('catalog_manager.blockedRemoval',{dependencies:tr('catalog_manager.familyNotEmpty')}),{exact:true}).waitFor();assert.equal(await removal.getByRole('button',{name:tr('catalog_manager.confirmar_eliminacion'),exact:true}).isDisabled(),true);
   await p.keyboard.press('Escape');await removal.waitFor({state:'hidden'});assert.equal(await p.evaluate(k=>localStorage.getItem(k),DATA_KEY),before);
   const archive=p.getByRole('button',{name:tr('catalog_manager.archiveItem',{name:'Ocio ficticio'}),exact:true}),opener=await archive.elementHandle();await archive.click();
   const dialog=p.getByRole('dialog',{name:tr('catalog_manager.confirmar_archivo_con_reglas_activas'),exact:true});await dialog.waitFor();const node=await dialog.elementHandle(),focused=await p.locator(':focus').elementHandle();
   assert.equal(await dialog.locator('li').count(),2);await dialog.getByText('Periódico afectado',{exact:true}).waitFor();await dialog.getByText('Automatización afectada',{exact:true}).waitFor();await dialog.getByText(tr('catalog_manager.las_reglas_se_conservaran_activas_sin_borrarlas_desactivarlas_ni'),{exact:true}).waitFor();
   mark('archive-open');await p.addScriptTag({content:axe});async function inspect(surface:string){const result=await p.evaluate(async()=>{const r=await (window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return {violations:r.violations,incomplete:r.incomplete.map((v:any)=>({id:v.id,nodes:v.nodes.length}))};});observations.push({language,width,theme,surface,...result});assert.deepEqual(result.violations,[]);await assertNoSpanishOwnedText(p,language,data);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);}
   await inspect('archive-confirmation-original-language');mark('axe-original');
   if(width===390&&theme==='light')await p.screenshot({path:path.join(dir,`catalog-archive-preview-${language}-${width}-${theme}.png`)});
   const next:Language=language==='en'?'fr':'en',nt=translatorFor(next),other=await c.newPage();await other.goto(origin+'/app');await other.evaluate(({key,value})=>localStorage.setItem(key,value),{key:LANGUAGE_KEY,value:next});await p.waitForFunction(locale=>document.documentElement.lang===locale,languages[next].locale);await p.bringToFront();
   const translatedDialog=p.getByRole('dialog',{name:nt('catalog_manager.confirmar_archivo_con_reglas_activas'),exact:true});await translatedDialog.getByText(nt('catalog_manager.las_reglas_se_conservaran_activas_sin_borrarlas_desactivarlas_ni'),{exact:true}).waitFor();assert.equal(await node!.evaluate(el=>el.isConnected),true);assert.equal(await focused!.evaluate(el=>el===document.activeElement),true);
   assert.equal(await p.evaluate(k=>localStorage.getItem(k),DATA_KEY),before);assert.equal(await p.evaluate(()=>(window as any).__financialWrites),0);await inspect('archive-confirmation-after-cross-tab');mark('axe-cross-tab');
   for(let step=0;step<4;step++){await p.keyboard.press(step%2?'Shift+Tab':'Tab');assert.equal(await translatedDialog.evaluate(el=>el.contains(document.activeElement)),true);}
   await p.keyboard.press('Escape');await translatedDialog.waitFor({state:'hidden'});assert.equal(await opener!.evaluate(el=>el===document.activeElement),true);assert.equal(await p.evaluate(k=>localStorage.getItem(k),DATA_KEY),before);
   await other.evaluate(({key,value})=>localStorage.setItem(key,value),{key:LANGUAGE_KEY,value:language});await p.waitForFunction(locale=>document.documentElement.lang===locale,languages[language].locale);await p.bringToFront();
   await archive.click();await dialog.getByRole('button',{name:tr('catalog_manager.confirmar_archivo'),exact:true}).click();await dialog.waitFor({state:'hidden'});
   let saved=JSON.parse((await p.evaluate(k=>localStorage.getItem(k),DATA_KEY))!);assert.equal(saved.budgetGroups.flatMap((g:any)=>g.partidas).find((item:any)=>item.code==='V.001.002').archived,true);
   for(const key of ['transactions','budgetPlans','planningMonths','budgetSubitems','planningAutomation','intelligentFinance','wallets','loans'] as const)assert.deepEqual(saved[key],backup[key]);assert.equal(await p.evaluate(()=>(window as any).__financialWrites),1);
   await p.getByRole('button',{name:tr('catalog_manager.reactivateItem',{name:'Ocio ficticio'}),exact:true}).click();await archive.waitFor();saved=JSON.parse((await p.evaluate(k=>localStorage.getItem(k),DATA_KEY))!);assert.equal(saved.budgetGroups.flatMap((g:any)=>g.partidas).find((item:any)=>item.code==='V.001.002').archived,false);assert.equal(await p.evaluate(()=>(window as any).__financialWrites),2);
   await p.locator('.catalog-manager > summary').click();await p.getByRole('button',{name:tr('budgets.ver_partida',{name:'Ocio ficticio'}),exact:true}).click();const detail=p.getByRole('dialog',{name:tr('partida_detail.detalle_de_partida'),exact:true});await detail.getByText(tr('subitem_selector.sin_subitem'),{exact:true}).waitFor();await detail.locator('.subitem-breakdown').getByText('Cine ficticio',{exact:true}).waitFor();await detail.locator('.subitem-breakdown').getByText('Cultura ficticia',{exact:true}).waitFor();
   mark('subitems-inspected');await p.keyboard.press('Escape');await detail.waitFor({state:'hidden'});const after=await p.evaluate(k=>localStorage.getItem(k),DATA_KEY);await p.reload();await p.getByRole('navigation',{name:tr('nav.label')}).filter({visible:true}).waitFor();assert.equal(await p.evaluate(k=>localStorage.getItem(k),DATA_KEY),after);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);mark('complete');if(language==='es'&&width===390&&theme==='light')console.log('Catalogue stage timings:',JSON.stringify(timings));
  }catch(error){console.error(`Catalogue case ${language}/${width}/${theme}:`,error);throw error;}finally{await c.close();}
 });
});
