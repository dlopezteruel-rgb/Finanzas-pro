import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import path from 'node:path';
import {mkdir} from 'node:fs/promises';
import {chromium,type Page,type Locator,type BrowserContext} from 'playwright-core';
import {DATA_KEY,makeBackup} from '../src/utils/backup';
import {catalogReorderFixture} from './catalogReorderFixture';
import {demoParent} from './budgetSubitemFixture';
import {navigateModule} from './browserNavigation';

const raw=(p:Page)=>p.evaluate(k=>localStorage.getItem(k),DATA_KEY);
const saved=async(p:Page)=>JSON.parse((await raw(p))!);
const grip=(p:Page,name:string)=>p.getByRole('button',{name:`Arrastrar ${name}`,exact:true});
const family=(p:Page,name:string)=>p.locator('.catalog-view [data-catalog-drop]').filter({has:p.getByRole('button',{name:`Familia ${name}`,exact:true})}).first();
const row=(p:Page,name:string)=>p.getByRole('button',{name:`Ver partida ${name}`,exact:true}).locator('xpath=ancestor::*[@data-catalog-drop][1]');
async function mouse(p:Page,from:Locator,to:Locator,cancel=false,capture?:string){
  await from.scrollIntoViewIfNeeded();const start=(await from.boundingBox())!;await p.mouse.move(start.x+start.width/2,start.y+start.height/2);await p.mouse.down();await p.mouse.move(start.x+start.width/2+10,start.y+start.height/2);await to.scrollIntoViewIfNeeded();const end=(await to.boundingBox())!;await p.mouse.move(end.x+end.width/2,Math.max(170,Math.min(750,end.y+Math.min(80,end.height/2))),{steps:8});await p.locator('.catalog-drag-preview').waitFor();
  if(capture){await mkdir(capture,{recursive:true});await p.screenshot({path:path.join(capture,'1280-mouse-drag.jpg'),type:'jpeg',quality:85});}
  if(cancel)await p.keyboard.press('Escape');await p.mouse.up();
}
async function touch(p:Page,c:BrowserContext,from:Locator,to:Locator){
  await from.scrollIntoViewIfNeeded();const a=(await from.boundingBox())!;const cdp=await c.newCDPSession(p);const start={x:a.x+a.width/2,y:a.y+a.height/2};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[start]});await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+10,y:start.y}]});await to.scrollIntoViewIfNeeded();const b=(await to.boundingBox())!,end={x:b.x+b.width/2,y:Math.max(170,Math.min(750,b.y+Math.min(80,b.height/2)))};
  for(let i=1;i<=8;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:start.x+(end.x-start.x)*i/8,y:start.y+(end.y-start.y)*i/8}]});
  await p.locator('.catalog-drag-preview').waitFor();await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});await cdp.detach();
}
test('Checkpoint C: ratón, tacto, teclado y persistencia del arrastre', {timeout:180000},async t=>{
  const app=express();app.use(express.static(path.resolve('dist')));app.get('*',(_q,r)=>r.sendFile(path.resolve('dist/index.html')));
  const server=await new Promise<ReturnType<typeof app.listen>>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise<void>(r=>server.close(()=>r())));
  const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`,browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
  async function setup(width=1280,theme:'light'|'dark'='light'){
    const c=await browser.newContext({viewport:{width,height:900},isMobile:width<768,hasTouch:width<768,locale:'es-ES',timezoneId:'Europe/Madrid',serviceWorkers:'block'}),errors:string[]=[],external:string[]=[];
    await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(external.push(r.request().url()),r.abort()));
    await c.addInitScript(({key,value})=>{(window as any).__name=(fn:unknown)=>fn;if(localStorage.getItem(key)===null)localStorage.setItem(key,value);},{key:DATA_KEY,value:JSON.stringify(makeBackup(catalogReorderFixture(theme)))});
    const p=await c.newPage();p.setDefaultTimeout(7000);p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});await p.clock.setFixedTime(new Date('2026-11-11T12:00:00Z'));await p.goto(origin+'/app');await navigateModule(p,'Presupuestos');await p.getByRole('tab',{name:'Catálogo y detalle de partidas',exact:true}).click();
    return {p,c,close:async()=>{await c.close();assert.deepEqual(errors,[]);assert.deepEqual(external,[]);}};
  }
  for(const mode of ['mouse','touch'] as const)for(const theme of ['light','dark'] as const)await t.test(`${mode} ${theme}: familia, partida, traslado y subítem con recarga e históricos intactos`,async()=>{
    const s=await setup(mode==='touch'?390:1280,theme),{p,c}=s;const drag=(a:Locator,b:Locator)=>mode==='touch'?touch(p,c,a,b):mouse(p,a,b,false,process.env.CATALOG_DRAG_ARTIFACT_DIR);
    try{const original=await saved(p);await drag(grip(p,'familia Viajes ficticios'),family(p,'Gastos ficticios'));await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)!).budgetGroups.filter((g:any)=>g.type==='GASTO')[0].code==='family-travel',DATA_KEY);
      await drag(grip(p,'partida Comida ficticia'),row(p,'Ocio ficticio'));await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)!).budgetGroups.find((g:any)=>g.code==='G').partidas[0].code==='partida-food',DATA_KEY);
      await drag(grip(p,'partida Ocio ficticio'),family(p,'Viajes ficticios'));await p.waitForFunction(({key,code})=>JSON.parse(localStorage.getItem(key)!).budgetGroups.find((g:any)=>g.code==='family-travel').partidas.some((i:any)=>i.code===code),{key:DATA_KEY,code:demoParent.code});
      let data=await saved(p);assert.equal(data.budgetGroups.flatMap((g:any)=>g.partidas).filter((i:any)=>i.code===demoParent.code).length,1);
      await p.getByRole('button',{name:'Ver partida Ocio ficticio',exact:true}).click();const detail=p.getByRole('dialog',{name:'Detalle de partida',exact:true});await detail.getByRole('group',{name:'Gestión de subítems',exact:true}).locator('summary').click();
      const dest=detail.getByRole('button',{name:'Renombrar Cine ficticio',exact:true}).locator('xpath=ancestor::*[@data-catalog-drop][1]');await drag(grip(p,'subítem Cultura ficticia'),dest);await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)!).budgetSubitems.items.find((i:any)=>i.id==='demo-cultura').order===0,DATA_KEY);
      data=await saved(p);for(const field of ['transactions','budgetPlans','planningMonths','planningAutomation','loans','wallets'])assert.deepEqual(data[field],original[field]);assert.deepEqual(data.budgetSubitems.months,original.budgetSubitems.months);
      await p.reload();await navigateModule(p,'Presupuestos');await p.getByRole('tab',{name:'Catálogo y detalle de partidas',exact:true}).click();assert.equal((await saved(p)).budgetGroups.filter((g:any)=>g.type==='GASTO')[0].code,'family-travel');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth+1),true);
    }finally{await s.close();}
  });
  await t.test('teclado: Espacio/flechas/Enter, cancelación, foco y botones alternativos',async()=>{const s=await setup(),{p}=s;try{
    const before=await raw(p);await grip(p,'familia Viajes ficticios').focus();await p.keyboard.press('Space');await p.keyboard.press('Home');await p.keyboard.press('Escape');assert.equal(await raw(p),before);
    await grip(p,'familia Viajes ficticios').focus();await p.keyboard.press('Space');await p.keyboard.press('Home');await p.keyboard.press('Enter');await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)!).budgetGroups.filter((g:any)=>g.type==='GASTO')[0].code==='family-travel',DATA_KEY);await p.locator('.catalog-drag-status').getByText('Orden guardado: familia Viajes ficticios.',{exact:true}).waitFor();assert.equal(await grip(p,'familia Viajes ficticios').isEnabled(),true);assert.equal(await grip(p,'familia Viajes ficticios').evaluate(el=>el===document.activeElement),true);
    await grip(p,'partida Ocio ficticio').focus();await p.keyboard.press('Space');await p.keyboard.press('Home');for(let i=0;i<12&&!(await p.locator('.catalog-drag-status').innerText()).includes('Destino: Billetes ficticios');i++)await p.keyboard.press('ArrowDown');assert.match(await p.locator('.catalog-drag-status').innerText(),/Destino: Billetes ficticios/);await p.keyboard.press('Enter');await p.waitForFunction(({key,code})=>JSON.parse(localStorage.getItem(key)!).budgetGroups.find((g:any)=>g.code==='family-travel').partidas[0].code===code,{key:DATA_KEY,code:demoParent.code});
    await p.getByRole('button',{name:'Bajar partida Ocio ficticio',exact:true}).click();await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)!).budgetGroups.find((g:any)=>g.code==='family-travel').partidas[0].code==='partida-ticket',DATA_KEY);
  }finally{await s.close();}});
  await t.test('ratón: Escape cancela y el desplazamiento automático no guarda por sí mismo',async()=>{const s=await setup(390),{p}=s;try{const before=await raw(p);await mouse(p,grip(p,'familia Viajes ficticios'),family(p,'Gastos ficticios'),true);assert.equal(await raw(p),before);
    await grip(p,'partida Ocio ficticio').scrollIntoViewIfNeeded();const a=(await grip(p,'partida Ocio ficticio').boundingBox())!;await p.mouse.move(a.x+20,a.y+20);await p.mouse.down();await p.mouse.move(a.x+30,880,{steps:8});const start=await p.evaluate(()=>scrollY);await p.waitForTimeout(350);assert.ok(await p.evaluate(y=>scrollY>y,start));await p.keyboard.press('Escape');await p.mouse.up();assert.equal(await raw(p),before);
  }finally{await s.close();}});
  await t.test('destino archivado: resaltado inválido, cancelación sin escrituras ni identidades perdidas',async()=>{const s=await setup(),{p}=s;try{await p.locator('.catalog-manager > summary').click();await p.getByRole('button',{name:'Archivar familia Viajes ficticios',exact:true}).click();await p.getByRole('button',{name:'Reactivar familia Viajes ficticios',exact:true}).waitFor();await p.locator('.catalog-manager > summary').click();const before=await raw(p);await mouse(p,grip(p,'partida Ocio ficticio'),family(p,'Viajes ficticios'));assert.equal(await raw(p),before);assert.match(await p.locator('.catalog-drag-status').innerText(),/Destino no válido/);}finally{await s.close();}});
  for(const failure of ['quota','conflict'] as const)await t.test(`${failure}: no hay orden optimista, duplicados ni guardados parciales`,async()=>{const s=await setup(),{p,c}=s;try{const before=await raw(p);
    if(failure==='quota')await p.evaluate(k=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key:string,v:string){if(key===k)throw new DOMException('Cuota ficticia','QuotaExceededError');return original.call(this,key,v)};(window as any).restoreReorderStorage=()=>Storage.prototype.setItem=original;},DATA_KEY);
    else{const other=await c.newPage();await other.goto(origin+'/app');await navigateModule(other,'Presupuestos');await other.getByRole('region',{name:'Planificación financiera',exact:true}).getByLabel('Ahorro objetivo (€)').fill('1');await other.getByRole('button',{name:'Guardar borrador',exact:true}).click();await other.getByText('Borrador guardado.',{exact:true}).waitFor();}
    const current=await raw(p);await mouse(p,grip(p,'familia Viajes ficticios'),family(p,'Gastos ficticios'));await p.locator('.catalog-drag-error').waitFor();assert.equal(await raw(p),failure==='quota'?before:current);
    if(failure==='quota'){await p.evaluate(()=>(window as any).restoreReorderStorage());await mouse(p,grip(p,'familia Viajes ficticios'),family(p,'Gastos ficticios'));await p.waitForFunction(k=>JSON.parse(localStorage.getItem(k)!).budgetGroups.filter((g:any)=>g.type==='GASTO')[0].code==='family-travel',DATA_KEY);assert.equal((await saved(p)).budgetGroups.filter((g:any)=>g.code==='family-travel').length,1);}
  }finally{await s.close();}});
});
