import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {editCatalog} from '../src/utils/budgetCatalog';
import {DATA_KEY,makeBackup} from '../src/utils/backup';
import {LANGUAGE_KEY} from '../src/i18n/preference';
import {responsiveFixture} from './responsiveFixture';
test('5A: idioma visual aislado de finanzas',{timeout:120000},async t=>{
  const dist=path.resolve(process.env.PHASE5A_DIST??'dist');
  const app=express();app.use(express.static(dist));app.get('*',(_q,r)=>r.sendFile(path.join(dist,'index.html')));
  const server=await new Promise<ReturnType<typeof app.listen>>(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});t.after(()=>new Promise<void>(r=>server.close(()=>r())));
  const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
  const axe=await readFile('node_modules/axe-core/axe.min.js','utf8');
  for(const width of [390,768,1280])for(const theme of ['light','dark'] as const)await t.test(`${width}px ${theme}: teclado, disponibilidad, preferencia, tema, axe y cero escrituras financieras`,async()=>{
    const c=await browser.newContext({viewport:{width,height:900},locale:'fr-FR',serviceWorkers:'block'});try{
      await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());
      await c.addInitScript(({key,value})=>{(window as any).__name=(fn:unknown)=>fn;if(!localStorage.getItem(key))localStorage.setItem(key,value);
        const sample=()=>{if(!document.querySelector('.finance-app')){requestAnimationFrame(sample);return;}(window as any).__firstTheme=document.documentElement.getAttribute('data-theme');};requestAnimationFrame(sample);
      },{key:DATA_KEY,value:JSON.stringify(makeBackup({...responsiveFixture(),theme}))});
      const p=await c.newPage();await p.goto(origin+'/app');const menu=p.getByRole('button',{name:'Opciones y datos',exact:true});await menu.waitFor();
      await p.waitForFunction(()=>(window as any).__firstTheme!==undefined);assert.equal(await p.evaluate(()=>(window as any).__firstTheme),theme);
      const before=await p.evaluate(k=>localStorage.getItem(k),DATA_KEY);
      await p.evaluate(key=>{(window as any).__financialWrites=[];const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)(window as any).__financialWrites.push(v);return set.call(this,k,v);};},DATA_KEY);
      await menu.focus();await p.keyboard.press('Enter');await p.getByLabel('Idioma',{exact:true}).waitFor();
      assert.equal(await p.getByRole('button',{name:'Exportar JSON',exact:true}).evaluate(e=>e===document.activeElement),true);
      for(let i=0;i<5;i++)await p.keyboard.press('Tab');
      const select=p.getByLabel('Idioma',{exact:true});await p.keyboard.press('Shift+Tab');await p.keyboard.press('Tab');assert.equal(await select.evaluate(e=>e===document.activeElement),true);
      assert.equal(await select.inputValue(),'es');assert.equal(await select.locator('option').count(),5);
      for(const lang of ['en','it','fr','pt'])assert.equal(await select.locator(`option[value=${lang}]`).isDisabled(),true);
      assert.match(await select.innerText(),/Español — disponible/);assert.match(await select.innerText(),/Português — próximamente/);
      await select.selectOption('es');assert.equal(await p.evaluate(k=>localStorage.getItem(k),LANGUAGE_KEY),'es');
      assert.equal(await p.evaluate(()=>document.documentElement.lang),'es-ES');
      await p.addScriptTag({content:axe});const violations=await p.evaluate(async()=> (await (window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}})).violations);assert.deepEqual(violations,[]);
      assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
      await p.keyboard.press('Escape');await select.waitFor({state:'hidden'});assert.equal(await menu.evaluate(e=>e===document.activeElement),true);
      assert.equal(await p.evaluate(k=>localStorage.getItem(k),DATA_KEY),before);assert.deepEqual(await p.evaluate(()=>(window as any).__financialWrites),[]);
      await p.getByRole('button',{name:/Cambiar a modo/}).click();assert.equal(await p.evaluate(k=>localStorage.getItem(k),LANGUAGE_KEY),'es');
      await p.reload();await menu.click();assert.equal(await select.inputValue(),'es');assert.equal(await p.evaluate(()=>document.documentElement.lang),'es-ES');
    }finally{await c.close();}
  });
  await t.test('lectura corrupta, cambios entre pestañas y cuota denegada no escriben datos ni rompen la vista',async()=>{
    const c=await browser.newContext();try{
      await c.addInitScript(({key,language,value})=>{if(!sessionStorage.getItem('seed')){localStorage.setItem(key,value);localStorage.setItem(language,'{"unknown":true}');sessionStorage.setItem('seed','1');}},{key:DATA_KEY,language:LANGUAGE_KEY,value:JSON.stringify(makeBackup(responsiveFixture()))});
      const p=await c.newPage();await p.goto(origin+'/app');await p.getByRole('button',{name:'Opciones y datos'}).click();const before=await p.evaluate(k=>localStorage.getItem(k),DATA_KEY);
      assert.equal(await p.getByLabel('Idioma',{exact:true}).inputValue(),'es');assert.equal(await p.evaluate(k=>localStorage.getItem(k),LANGUAGE_KEY),'{"unknown":true}');
      await p.evaluate(key=>{(window as any).__languageEvents=0;addEventListener('storage',event=>{if(event.key===key)(window as any).__languageEvents++;});},LANGUAGE_KEY);
      const other=await c.newPage();await other.goto(origin+'/app');await other.evaluate(k=>localStorage.setItem(k,'en'),LANGUAGE_KEY);
      await p.waitForFunction(()=>(window as any).__languageEvents===1);
      assert.equal(await p.getByLabel('Idioma',{exact:true}).inputValue(),'es');
      await p.evaluate(key=>{const set=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('quota','QuotaExceededError');return set.call(this,k,v);};},LANGUAGE_KEY);
      await p.getByLabel('Idioma',{exact:true}).selectOption('es');await p.getByRole('status').filter({hasText:'no se ha podido guardar'}).waitFor();
      assert.equal(await p.evaluate(k=>localStorage.getItem(k),DATA_KEY),before);
    }finally{await c.close();}
  });
  await t.test('lectura de preferencia denegada mantiene español sin tocar almacenamiento financiero',async()=>{
    const c=await browser.newContext();try{
      await c.addInitScript(({key,language,value})=>{localStorage.setItem(key,value);const get=Storage.prototype.getItem;Storage.prototype.getItem=function(k){if(k===language)throw new DOMException('denied','SecurityError');return get.call(this,k);};},{key:DATA_KEY,language:LANGUAGE_KEY,value:JSON.stringify(makeBackup(responsiveFixture()))});
      const p=await c.newPage();await p.goto(origin+'/app');await p.getByRole('button',{name:'Opciones y datos'}).click();assert.equal(await p.getByLabel('Idioma',{exact:true}).inputValue(),'es');assert.equal(await p.evaluate(()=>document.documentElement.lang),'es-ES');
    }finally{await c.close();}
  });
  await t.test('importar, restaurar y exportar conserva preferencia separada y registros ficticios exactos',async()=>{
    const c=await browser.newContext({acceptDownloads:true});try{
      const data=editCatalog(responsiveFixture(),{kind:'createFamily',type:'GASTO',name:'Familia personal ficticia',id:'i18n'}),backup=makeBackup(data),raw=JSON.stringify(backup);
      await c.addInitScript(({key,language,value})=>{if(!localStorage.getItem(key)){localStorage.setItem(key,value);localStorage.setItem(language,'es');}},{key:DATA_KEY,language:LANGUAGE_KEY,value:raw});
      const p=await c.newPage();await p.goto(origin+'/app');await p.getByRole('button',{name:'Opciones y datos'}).waitFor();
      await p.locator('input[type=file]').setInputFiles({name:'ficticio.json',mimeType:'application/json',buffer:Buffer.from(raw)});
      await p.getByRole('button',{name:'Confirmar sustitución',exact:true}).click();await p.getByRole('dialog').waitFor({state:'hidden'});
      const saved=await p.evaluate(k=>JSON.parse(localStorage.getItem(k)!),DATA_KEY);assert.deepEqual(saved.transactions,backup.transactions);assert.deepEqual(saved.wallets,backup.wallets);assert.deepEqual(saved.budgetGroups,backup.budgetGroups);
      assert.equal(await p.evaluate(k=>localStorage.getItem(k),LANGUAGE_KEY),'es');assert.equal(JSON.stringify(saved).includes(LANGUAGE_KEY),false);
      await p.getByRole('button',{name:'Opciones y datos'}).click();const pending=p.waitForEvent('download');await p.getByRole('button',{name:'Exportar JSON',exact:true}).click();const download=await pending;const exported=JSON.parse(await readFile((await download.path())!,'utf8'));assert.deepEqual(exported.transactions,backup.transactions);assert.equal(JSON.stringify(exported).includes(LANGUAGE_KEY),false);
    }finally{await c.close();}
  });
});
