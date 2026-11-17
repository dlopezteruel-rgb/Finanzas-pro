/** Production UI capability/focus/export regression; no regression-fixture storage adapter. */
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import path from 'node:path';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {DATA_KEY,makeBackup,parseBackup} from '../src/utils/backup';
import {intelligentFixture} from './intelligentFixture';
import {languages,translatorFor,type Language} from '../src/i18n';
import {assertNoSpanishOwnedText} from './i18n/residuals';

test('WEB-001: five-language capability gates, preserved forms, keyboard and strict axe',{timeout:300000},async t=>{
 const app=express();app.use(express.static(path.resolve('dist')));app.get('*',(_q,r)=>r.sendFile(path.resolve('dist/index.html')));
 const server=await new Promise<ReturnType<typeof app.listen>>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise<void>(r=>server.close(()=>r())));
 const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`,browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
 const dir=path.resolve(process.env.CI_ARTIFACT_DIR??'ci-artifacts','browser'),axe=await readFile('node_modules/axe-core/axe.min.js','utf8'),observations:any[]=[];await mkdir(dir,{recursive:true});
 t.after(()=>writeFile(path.join(dir,'web-storage-ui.json'),JSON.stringify({fixtureOnly:true,observations,scope:'Production UI. Strict capability rejection injected into the actual native transaction; not an unsupported-browser runtime or screen-reader certification.'},null,2)+'\n'));
 for(const language of Object.keys(languages) as Language[])for(const width of [390,768,1280])for(const theme of ['light','dark'] as const)await t.test(`${language}/${width}/${theme}: strict unavailable blocks writes and retains readable/exportable data`,async()=>{
  const tr=translatorFor(language),fixture=makeBackup({...intelligentFixture(),theme}),raw=JSON.stringify(fixture),context=await browser.newContext({viewport:{width,height:1000},isMobile:width===390,hasTouch:width===390,acceptDownloads:true,timezoneId:'Europe/Madrid'});
  try{
   await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
   await context.addInitScript(({key,raw,language})=>{(window as any).__name=(f:unknown)=>f;localStorage.setItem(key,raw);localStorage.setItem('finanzas.ui.language',language);const original=IDBDatabase.prototype.transaction;IDBDatabase.prototype.transaction=function(...args:any[]){const tx=original.apply(this,args as any);if(args[1]==='readwrite')Object.defineProperty(tx,'durability',{value:'default'});return tx;};},{key:DATA_KEY,raw,language});
   const page=await context.newPage();page.setDefaultTimeout(8000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(origin+'/app');await page.locator('.home-quick').waitFor();const reason=tr('webStore.strictUnavailable');await page.getByRole('alert').filter({hasText:reason}).waitFor();
   await page.getByRole('navigation',{name:tr('nav.label')}).filter({visible:true}).getByRole('button',{name:tr('nav.accounts'),exact:true}).click();await page.getByRole('button',{name:tr('wallets.nueva_cuenta'),exact:true}).click();
   const form=page.getByRole('dialog',{name:tr('wallet.cartera'),exact:true}),input=form.getByLabel(tr('form.walletName'),{exact:true});await input.fill('Formulario personal NO TRADUCIR');await form.locator('button[type=submit]').click();await form.getByRole('alert').filter({hasText:reason}).waitFor();assert.equal(await input.inputValue(),'Formulario personal NO TRADUCIR');
   for(const key of ['Tab','Tab','Shift+Tab']){await page.keyboard.press(key);assert.equal(await form.evaluate(el=>el.contains(document.activeElement)),true);}
   assert.equal(await page.evaluate(k=>localStorage.getItem(k),DATA_KEY),raw);
   await page.addScriptTag({content:axe});const result=await page.evaluate(async()=>{const r=await (window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return {violations:r.violations,incomplete:r.incomplete};});observations.push({language,width,theme,surface:'strict-unavailable-preserved-form',...result});assert.deepEqual(result.violations,[]);await assertNoSpanishOwnedText(page,language,fixture);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
   if(language==='en'&&theme==='light')await page.screenshot({path:path.join(dir,`web001-readonly-${width}.png`)});
   await page.keyboard.press('Escape');await form.waitFor({state:'hidden'});assert.equal(await page.locator('#root').evaluate(el=>el.contains(document.activeElement)),true);
   await page.getByRole('button',{name:tr('options.title'),exact:true}).click();const downloaded=page.waitForEvent('download');await page.getByRole('button',{name:tr('options.export'),exact:true}).click();const file=await downloaded,exported=parseBackup(await readFile((await file.path())!,'utf8'));
   const {exportedAt:oldTimestamp,...expected}=fixture,{exportedAt:newTimestamp,...actual}=exported;assert.deepEqual(actual,expected);assert.equal(await page.evaluate(k=>localStorage.getItem(k),DATA_KEY),raw);
   const count=await page.evaluate(()=>new Promise<number>((resolve,reject)=>{const request=indexedDB.open('finanzas-pro-web-v1');request.onerror=()=>reject(request.error);request.onsuccess=()=>{const db=request.result,tx=db.transaction('finance','readonly'),r=tx.objectStore('finance').count();tx.oncomplete=()=>{db.close();resolve(r.result);};tx.onabort=()=>reject(tx.error);};}));assert.equal(count,0);assert.deepEqual(errors,[]);
  }finally{await context.close();}
 });
});
