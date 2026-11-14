import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import path from 'node:path';
import {mkdir} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {DATA_KEY,makeBackup} from '../src/utils/backup';
import {chartFixture} from './chartFixture';
import {navigateModule,selectPlanningArea} from './browserNavigation';
import {textContrast} from './presentationChecks';

test('Checkpoint A: presentación personal y borrador compartido', {timeout:180000}, async t => {
  const app=express(); app.use(express.static(path.resolve('dist'))); app.get('*',(_q,r)=>r.sendFile(path.resolve('dist/index.html')));
  const server=await new Promise<ReturnType<typeof app.listen>>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
  t.after(()=>new Promise<void>(resolve=>server.close(()=>resolve())));
  const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']}); t.after(()=>browser.close());
  for(const width of [390,768,1280])for(const theme of ['light','dark'] as const)await t.test(`${width}px ${theme}: pestañas, errores ocultos, gráficos y Contactos`,async()=>{
    const context=await browser.newContext({viewport:{width,height:900},isMobile:width<768,hasTouch:width<768,locale:'es-ES',timezoneId:'Europe/Madrid',serviceWorkers:'block'});
    const errors:string[]=[],external:string[]=[];
    try{
      await context.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(external.push(r.request().url()),r.abort()));
      await context.addInitScript(({key,value})=>{(window as any).__name=(fn:unknown)=>fn;if(localStorage.getItem(key)===null)localStorage.setItem(key,value)}, {key:DATA_KEY,value:JSON.stringify(makeBackup({...chartFixture(),theme}))});
      const p=await context.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
      const capture=async(name:string)=>{const dir=process.env.CATALOG_PRESENTATION_ARTIFACT_DIR;if(dir){await mkdir(dir,{recursive:true});await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({path:path.join(dir,`${width}-${theme}-${name}.jpg`),type:'jpeg',quality:85,fullPage:true,animations:'disabled'});}};
      await p.clock.setFixedTime(new Date('2026-10-31T12:00:00Z'));await p.goto(origin+'/app');
      const snapshot=()=>p.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
      const before=await snapshot();
      await navigateModule(p,'Presupuestos');
      const planner=p.getByRole('region',{name:'Planificación financiera',exact:true});
      const tabs=planner.getByRole('tablist',{name:'Áreas de planificación',exact:true});
      assert.equal(await tabs.getByRole('tab').count(),width<768?3:2);
      assert.equal(await tabs.getByRole('tab',{name:'Gastos',exact:true}).getAttribute('aria-selected'),'true');
      await capture('planificacion');
      const expense=planner.getByLabel('Previsto GASTO Comida ficticia',{exact:true});await expense.fill('123,45');
      await selectPlanningArea(p,'Ingresos');const income=planner.getByLabel('Previsto INGRESO Salario ficticio',{exact:true});await income.fill('1,234');
      await selectPlanningArea(p,'Gastos');assert.equal(await expense.inputValue(),'123,45');
      assert.equal(await planner.getByRole('button',{name:'Guardar borrador',exact:true}).isDisabled(),true);
      assert.equal(await planner.getByRole('button',{name:'Revisar y aprobar previsión',exact:true}).isDisabled(),true);
      assert.match(await tabs.innerText(),/Ingresos · Revisar importes/);
      await selectPlanningArea(p,'Multiperiodo');assert.equal(await planner.getByRole('button',{name:'Copiar planificación',exact:true}).isDisabled(),true);
      await selectPlanningArea(p,'Ingresos');assert.equal(await income.inputValue(),'1,234');await income.fill('2000');
      await selectPlanningArea(p,'Gastos');assert.equal(await planner.getByRole('button',{name:'Guardar borrador',exact:true}).isEnabled(),true);
      // Roving focus and manual activation keep the draft and do not write.
      await tabs.getByRole('tab',{name:'Gastos',exact:true}).focus();await p.keyboard.press('ArrowRight');await p.keyboard.press('Enter');
      assert.equal(await income.isVisible(),true);assert.equal(await income.inputValue(),'2000');
      await p.setViewportSize({width:width<768?1280:390,height:900});await selectPlanningArea(p,'Gastos');assert.equal(await expense.inputValue(),'123,45');
      await p.setViewportSize({width,height:900});await planner.getByRole('button',{name:'Descartar cambios',exact:true}).click();assert.deepEqual(await snapshot(),before);
      await planner.locator('summary').filter({hasText:'Gráficos de Planificación'}).click();
      const annual=p.getByRole('region',{name:'Evolución anual de planificación',exact:true});await annual.getByRole('checkbox').first().waitFor();
      assert.equal(await annual.getByRole('checkbox',{checked:true}).count(),3);assert.equal(await annual.getByRole('checkbox').count(),9);
      for(const checkbox of await annual.getByRole('checkbox').all()){
        const box=(await checkbox.boundingBox())!,target=(await checkbox.locator('..').boundingBox())!;
        assert.ok(box.width>=18&&box.width<=20&&box.height>=18&&box.height<=20,JSON.stringify(box));assert.ok(target.height>=44&&target.width>=44);
      }
      const last=annual.getByRole('checkbox').last();await last.check();assert.equal(await annual.getByRole('checkbox',{checked:true}).count(),4);await last.uncheck();
      assert.ok(await textContrast(annual.locator('.chart-series-label').first())>=4.5);
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));
      await capture('graficos');
      await p.getByRole('tab',{name:'Catálogo y detalle de partidas',exact:true}).click();
      const opener=p.getByRole('button',{name:'Ver partida Comida ficticia',exact:true});await opener.click();
      const detail=p.getByRole('dialog',{name:'Detalle de partida',exact:true});assert.ok(!(await detail.innerText()).includes('[g]'));await p.keyboard.press('Escape');
      await capture('catalogo');
      await navigateModule(p,'Contactos');await p.getByRole('button',{name:'Detalle de Contacto ficticio ana',exact:true}).click();
      const interior=p.locator('.contact-interior');await interior.waitFor();
      assert.ok(await textContrast(interior)>=4.5);
      await capture('contactos');
      if(theme==='light')assert.ok(await interior.evaluate(el=>{const canvas=document.createElement('canvas'),ctx=canvas.getContext('2d')!;ctx.fillStyle=getComputedStyle(el).backgroundColor;ctx.fillRect(0,0,1,1);return ctx.getImageData(0,0,1,1).data[0]>200}));
      await p.getByRole('button',{name:'Detalle de Contacto ficticio bea',exact:true}).click();
      assert.match(await interior.innerText(),/15,00/);assert.match(await interior.innerText(),/Cena ficticia/);
      assert.ok(await textContrast(interior)>=4.5);
      assert.ok(await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1));assert.deepEqual(await snapshot(),before);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    }finally{await context.close();}
  });
});
