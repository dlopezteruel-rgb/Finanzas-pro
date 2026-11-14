import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import path from 'node:path';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {DATA_KEY,makeBackup} from '../src/utils/backup';
import {responsiveFixture} from './responsiveFixture';
import {navigateModule,selectPlanningArea} from './browserNavigation';
const observations:any[]=[];
const auditOnly=process.env.PHASE4A_AUDIT_ONLY==='1';
const axe=await readFile(process.env.AXE_CORE_PATH??path.resolve('node_modules/axe-core/axe.min.js'),'utf8');
const captures=process.env.PHASE4A_CAPTURE_DIR;
test('Fase 4A: auditoría de siete módulos, diálogos y accesibilidad',{timeout:300000},async t=>{
  const app=express(),dist=path.resolve(process.env.PHASE4A_DIST??'dist');app.use(express.static(dist));app.get('*',(_q,r)=>r.sendFile(path.join(dist,'index.html')));
  const server=await new Promise<ReturnType<typeof app.listen>>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise<void>(r=>server.close(()=>r())));
  const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`,browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
  t.after(async()=>{if(process.env.PHASE4A_AUDIT_REPORT)await writeFile(process.env.PHASE4A_AUDIT_REPORT,JSON.stringify({axeVersion:'4.14.0',fixtureOnly:true,observations},null,2)+'\n');});
  for(const width of [390,768,1280,1920])for(const theme of ['light','dark'] as const)await t.test(`${width}px ${theme}: módulos, paneles, teclado, scroll y consulta sin escrituras`,async()=>{
    const c=await browser.newContext({viewport:{width,height:width===390?844:1000},isMobile:width===390,hasTouch:width<=768,locale:'es-ES',timezoneId:'Europe/Madrid',serviceWorkers:'block'}),errors:string[]=[],external:string[]=[];
    try{
      await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(external.push(r.request().url()),r.abort()));
      await c.addInitScript(({key,value})=>{(window as any).__name=(fn:unknown)=>fn;if(localStorage.getItem(key)===null)localStorage.setItem(key,value);},{key:DATA_KEY,value:JSON.stringify(makeBackup({...responsiveFixture(),theme}))});
      const p=await c.newPage();p.setDefaultTimeout(8000);p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});await p.clock.setFixedTime(new Date('2026-10-31T12:00:00Z'));await p.goto(origin+'/app');await p.getByLabel('Seleccionar periodo contable').waitFor();await p.addScriptTag({content:axe});
      const before=await p.evaluate(k=>localStorage.getItem(k),DATA_KEY);
      async function inspect(surface:string){
        const result=await p.evaluate(async()=>{const r=await (window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return {headings:[...document.querySelectorAll('h1,h2,h3,h4,h5,h6')].filter(el=>el.getClientRects().length&&!el.closest('[inert]')).map(el=>({level:Number(el.tagName.slice(1)),text:el.textContent?.trim()})),smallButtons:[...document.querySelectorAll('button')].filter(el=>!el.disabled&&!el.closest('[inert]')&&el.getClientRects().length).map(el=>({name:el.getAttribute('aria-label')||el.getAttribute('title')||el.textContent?.trim(),width:el.getBoundingClientRect().width,height:el.getBoundingClientRect().height})).filter(b=>b.width<44||b.height<44),violations:r.violations.map((v:any)=>({id:v.id,impact:v.impact,help:v.help,nodes:v.nodes.map((n:any)=>({target:n.target,summary:n.failureSummary}))})),incomplete:r.incomplete.map((v:any)=>({id:v.id,nodes:v.nodes.length}))};});
        observations.push({width,theme,surface,...result});
        assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),true,`${surface}: overflow`);
        if(!auditOnly)assert.deepEqual(result.violations,[],`${surface}: axe violations`);
        if(captures){await mkdir(captures,{recursive:true});await p.screenshot({path:path.join(captures,`${width}-${theme}-${surface}.jpg`),type:'jpeg',quality:80,animations:'disabled'});}
      }
      async function dialog(openerName:string,surface:string){
        const opener=p.getByRole('button',{name:openerName,exact:true});await opener.click();const d=p.getByRole('dialog').last();await d.waitFor();
        await inspect(surface);
        for(const key of ['Tab','Tab','Shift+Tab','Shift+Tab']){await p.keyboard.press(key);assert.equal(await d.evaluate(el=>el.contains(document.activeElement)),true);}
        await p.keyboard.press('Escape');await d.waitFor({state:'hidden'});assert.equal(await opener.evaluate(el=>el===document.activeElement),true,`${surface}: restore focus`);
      }
      for(const name of ['Inicio','Movimientos','Presupuestos','Cuentas','Contactos','Deudas','Asistente']){
        await navigateModule(p,name);await p.evaluate(()=>scrollTo(0,0));await inspect(name);
        if(name==='Inicio')await dialog('Añadir','Movimiento');
        if(name==='Presupuestos'){
          await selectPlanningArea(p,'Ingresos');await inspect('Planificacion-ingresos');await selectPlanningArea(p,'Multiperiodo');await inspect('Multiperiodo');await selectPlanningArea(p,'Gastos');
          await p.getByRole('tab',{name:'Catálogo y detalle de partidas',exact:true}).click();await inspect('Catalogo');await p.locator('.catalog-manager > summary').click();await dialog('Crear familia','Editor-catalogo');
        }
        if(name==='Cuentas')await dialog('Nueva Cuenta','Cartera');
        if(name==='Contactos'){
          const card=p.getByRole('button',{name:/^Detalle de /}).first();await card.click();await inspect('Contacto-expandido');await card.click();await dialog('Nuevo Contacto','Contacto');
        }
        if(name==='Deudas')await dialog('Nuevo Préstamo','Prestamo');
      }
      // Resize without reloading while a local field remains pending.
      await navigateModule(p,'Inicio');await p.getByRole('button',{name:'Añadir',exact:true}).click();const movement=p.getByRole('dialog',{name:'Movimiento',exact:true});await movement.getByLabel('Concepto',{exact:true}).fill('Borrador ficticio conservado');await p.setViewportSize({width:width===390?1920:390,height:900});assert.equal(await movement.getByLabel('Concepto',{exact:true}).inputValue(),'Borrador ficticio conservado');await p.keyboard.press('Escape');
      assert.equal(await p.evaluate(k=>localStorage.getItem(k),DATA_KEY),before);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    }finally{await c.close();}
  });
});
