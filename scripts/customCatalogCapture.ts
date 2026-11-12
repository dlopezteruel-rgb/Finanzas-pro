import express from 'express';
import path from 'node:path';
import {mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
import {chromium,type Locator} from 'playwright-core';
import {DATA_KEY,makeBackup,parseBackup} from '../src/utils/backup';
import {customCatalogCaptureFixture,CATALOG_CAPTURE_TIME} from './customCatalogCaptureFixture';
import {navigateModule,selectPlanningArea} from './browserNavigation';
const output=process.env.CUSTOM_CATALOG_CAPTURE_DIR??'docs/assets/custom-budget-catalog';
await mkdir(output,{recursive:true});
const app=express();app.use(express.static(path.resolve('dist')));app.get('*',(_q,r)=>r.sendFile(path.resolve('dist/index.html')));
const server=await new Promise<ReturnType<typeof app.listen>>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});
const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox','--disable-background-networking']});
const captures:unknown[]=[];
try{
  for(const width of [390,768,1280])for(const theme of ['light','dark'] as const){
    const height=width===390?844:1000,data=customCatalogCaptureFixture(theme);parseBackup(JSON.stringify(makeBackup(data)));
    const c=await browser.newContext({viewport:{width,height},isMobile:width<768,hasTouch:width<768,locale:'es-ES',timezoneId:'Europe/Madrid',serviceWorkers:'block'}),errors:string[]=[],external:string[]=[];
    try{
      await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(external.push(r.request().url()),r.abort()));
      await c.addInitScript(({key,value})=>{(window as any).__name=(fn:unknown)=>fn;if(localStorage.getItem(key)===null)localStorage.setItem(key,value);},{key:DATA_KEY,value:JSON.stringify({...makeBackup(data),exportedAt:CATALOG_CAPTURE_TIME})});
      const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});await p.clock.setFixedTime(new Date(CATALOG_CAPTURE_TIME));await p.goto(origin+'/app');await p.getByLabel('Seleccionar periodo contable').waitFor();
      const before=await p.evaluate(k=>localStorage.getItem(k),DATA_KEY);
      async function capture(surface:string,target?:Locator){
        if(target)await target.evaluate(el=>window.scrollTo(0,Math.max(0,el.getBoundingClientRect().top+scrollY-150)));else await p.evaluate(()=>window.scrollTo(0,0));
        await p.waitForTimeout(80);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`${width} ${theme} ${surface}: overflow`);
        const file=`${width}-${theme}-${surface}.jpg`,buffer=await p.screenshot({path:path.join(output,file),type:'jpeg',quality:85,animations:'disabled'});
        captures.push({file,surface,width,height,theme,bytes:buffer.length,sha256:createHash('sha256').update(buffer).digest('hex'),fixtureOnly:true});
      }
      await navigateModule(p,'Presupuestos');await capture('planificacion');
      const areas=p.getByRole('tablist',{name:'Áreas de planificación',exact:true});await capture('planificacion-gastos',areas);
      await selectPlanningArea(p,'Ingresos');await capture('planificacion-ingresos',areas);
      await selectPlanningArea(p,'Multiperiodo');await capture('multiperiodo',p.locator('.planning-multiperiod'));
      await selectPlanningArea(p,'Gastos');await p.getByText('Gráficos de Planificación',{exact:true}).click();await p.locator('.finance-chart').first().waitFor();await capture('graficos',p.locator('.finance-chart').first());
      await p.getByRole('tab',{name:'Catálogo y detalle de partidas',exact:true}).click();await capture('catalogo',p.getByRole('button',{name:'Familia Gastos ficticios',exact:true}));
      await p.locator('.catalog-manager > summary').click();await p.getByRole('button',{name:'Editar partida Billetes ficticios',exact:true}).click();await capture('catalogo-editor');await p.keyboard.press('Escape');await p.locator('.catalog-manager > summary').click();
      const grip=p.getByRole('button',{name:'Arrastrar partida Ocio ficticio',exact:true});await grip.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));const start=(await grip.boundingBox())!;await p.mouse.move(start.x+20,start.y+20);await p.mouse.down();await p.mouse.move(start.x+30,start.y+20);await p.locator('.catalog-drag-preview').waitFor();
      const target=p.locator('.catalog-view [data-catalog-drop]').filter({has:p.getByRole('button',{name:'Familia Viajes ficticios',exact:true})}).first();await target.evaluate(el=>el.scrollIntoView({block:'center',behavior:'instant'}));const end=(await target.boundingBox())!;await p.mouse.move(end.x+end.width/2,Math.max(170,Math.min(height-150,end.y+80)),{steps:8});await p.locator('.catalog-drag-preview').waitFor();
      const dragFile=`${width}-${theme}-arrastre.jpg`,drag=await p.screenshot({path:path.join(output,dragFile),type:'jpeg',quality:85,animations:'disabled'});captures.push({file:dragFile,surface:'arrastre',width,height,theme,bytes:drag.length,sha256:createHash('sha256').update(drag).digest('hex'),fixtureOnly:true});await p.keyboard.press('Escape');await p.mouse.up();
      await navigateModule(p,'Contactos');await p.getByRole('button',{name:'Detalle de Ana ficticia',exact:true}).click();await capture('contactos-saldado',p.getByRole('button',{name:'Detalle de Ana ficticia',exact:true}));
      await p.getByRole('button',{name:'Detalle de Bea ficticia',exact:true}).click();await capture('contactos-pendiente',p.getByRole('button',{name:'Detalle de Bea ficticia',exact:true}));
      assert.equal(await p.evaluate(k=>localStorage.getItem(k),DATA_KEY),before);assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
    }finally{await c.close();}
  }
  await writeFile(path.join(output,'manifest.json'),JSON.stringify({capturedAt:new Date().toISOString(),fixture:'customCatalogCaptureFixture; exclusivamente ficticia',fixtureClock:CATALOG_CAPTURE_TIME,sourceParentCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),sourceUncommittedAtCapture:true,financialSnapshotUnchanged:true,captures},null,2)+'\n');
  console.log(`${captures.length} capturas reales de fixtures; sin escrituras, errores ni solicitudes externas.`);
}finally{await browser.close();await new Promise<void>(r=>server.close(()=>r()));}
