import {STORAGE_LOCK} from '../src/utils/financeStore';
import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import path from 'node:path';
import {readFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {DATA_KEY,RECOVERY_PREFIX,makeBackup,parseBackup} from '../src/utils/backup';
import {budgetSubitemFixture,demoParent} from './budgetSubitemFixture';
import {navigateModule} from './browserNavigation';

test('Checkpoint B: catálogo editable, archivo e identidades recuperables', {timeout:180000},async t=>{
  const app=express();app.use(express.static(path.resolve('dist')));app.get('*',(_q,r)=>r.sendFile(path.resolve('dist/index.html')));
  const server=await new Promise<ReturnType<typeof app.listen>>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise<void>(r=>server.close(()=>r())));
  const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
  async function setup(width=390){const c=await browser.newContext({viewport:{width,height:1000},isMobile:width<768,hasTouch:width<768,locale:'es-ES',timezoneId:'Europe/Madrid',serviceWorkers:'block',acceptDownloads:true});const external:string[]=[],errors:string[]=[];
    await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(external.push(r.request().url()),r.abort()));
    await c.addInitScript(({key,value})=>{(window as any).__name=(fn:unknown)=>fn;if(localStorage.getItem(key)===null)localStorage.setItem(key,value);},{key:DATA_KEY,value:JSON.stringify(makeBackup(budgetSubitemFixture(true,true)))});
    const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});p.setDefaultTimeout(7000);await p.clock.setFixedTime(new Date('2026-11-11T12:00:00Z'));await p.goto(origin+'/app');
    await navigateModule(p,'Presupuestos');await p.getByRole('tab',{name:'Catálogo y detalle de partidas',exact:true}).click();await p.locator('.catalog-manager > summary').click();
    return {p,c,close:async()=>{await c.close();assert.deepEqual(errors,[]);assert.deepEqual(external,[]);}};
  }
  for(const width of [390,1280])await t.test(`${width}px: crear/editar, ordenar, archivar, proteger dependencias, retirar, recargar y exportar 3.4`,async()=>{
    const s=await setup(width),{p}=s;const raw=()=>p.evaluate(k=>localStorage.getItem(k),DATA_KEY);const saved=async()=>JSON.parse((await raw())!);const dialog=(title:string)=>p.getByRole('dialog',{name:title,exact:true});
    async function save(title:string){await dialog(title).getByRole('button',{name:'Guardar catálogo',exact:true}).click();await dialog(title).waitFor({state:'hidden'});}
    try{
      const original=await saved(),before=await raw();assert.equal(original.version,'3.3');assert.equal(await raw(),before);
      await p.getByRole('button',{name:'Crear familia',exact:true}).click();await dialog('Crear familia').getByLabel('Nombre del catálogo').fill('Viajes ficticios');await save('Crear familia');
      let data=await saved();const family=data.budgetGroups.find((g:any)=>g.name==='Viajes ficticios');assert.equal(data.version,'3.4');
      const copies=await p.evaluate(prefix=>Object.entries(localStorage).filter(([k])=>k.startsWith(prefix)),RECOVERY_PREFIX);assert.equal(copies.length,1);assert.deepEqual(parseBackup(copies[0][1]).budgetGroups,original.budgetGroups);
      await p.getByRole('button',{name:'Crear partida',exact:true}).click();await dialog('Crear partida').getByLabel('Nombre del catálogo').fill('Excursión ficticia');await dialog('Crear partida').getByLabel('Familia de la partida').selectOption(family.code);await dialog('Crear partida').getByLabel('Descripción de partida').fill('Solo fixtures');await dialog('Crear partida').getByLabel('Palabras clave de partida').fill('excursión, trekking');await save('Crear partida');
      data=await saved();const item=data.budgetGroups.find((g:any)=>g.code===family.code).partidas[0];assert.ok(item.code.startsWith('partida-'));assert.deepEqual(item.keywords,['excursión','trekking']);
      await p.getByRole('button',{name:'Editar partida Excursión ficticia',exact:true}).click();await dialog('Editar partida').getByLabel('Nombre del catálogo').fill('Senderismo ficticio');await save('Editar partida');assert.equal((await saved()).budgetGroups.find((g:any)=>g.code===family.code).partidas[0].code,item.code);
      await p.getByRole('button',{name:'Archivar partida Senderismo ficticio',exact:true}).click();await p.getByRole('button',{name:'Reactivar partida Senderismo ficticio',exact:true}).waitFor();
      await p.getByRole('button',{name:'Reactivar partida Senderismo ficticio',exact:true}).click();await p.getByRole('button',{name:'Archivar partida Senderismo ficticio',exact:true}).waitFor();
      await p.getByRole('button',{name:'Archivar familia Viajes ficticios',exact:true}).click();await p.getByRole('button',{name:'Reactivar familia Viajes ficticios',exact:true}).waitFor();await p.getByRole('button',{name:'Reactivar familia Viajes ficticios',exact:true}).click();await p.getByRole('button',{name:'Archivar familia Viajes ficticios',exact:true}).waitFor();
      await p.getByRole('button',{name:'Subir familia Viajes ficticios',exact:true}).click();await p.waitForFunction(({key,code})=>JSON.parse(localStorage.getItem(key)!).budgetGroups.filter((g:any)=>g.type==='GASTO')[0].code===code,{key:DATA_KEY,code:family.code});
      await p.getByRole('button',{name:'Eliminar partida Ocio ficticio',exact:true}).click();assert.equal(await dialog('Eliminar partida').getByRole('button',{name:'Confirmar eliminación',exact:true}).isDisabled(),true);assert.match(await dialog('Eliminar partida').innerText(),/Movimientos|Previsiones|subítems/);await p.keyboard.press('Escape');
      const beforeDelete=await raw();await p.getByRole('button',{name:'Eliminar partida Senderismo ficticio',exact:true}).click();await dialog('Eliminar partida').getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(await raw(),beforeDelete);
      await p.getByRole('button',{name:'Eliminar partida Senderismo ficticio',exact:true}).click();await dialog('Eliminar partida').getByRole('button',{name:'Confirmar eliminación',exact:true}).click();await dialog('Eliminar partida').waitFor({state:'hidden'});assert.equal((await saved()).budgetGroups.find((g:any)=>g.code===family.code).partidas[0].deleted,true);
      await p.getByRole('button',{name:'Eliminar familia Viajes ficticios',exact:true}).click();await dialog('Eliminar familia').getByRole('button',{name:'Confirmar eliminación',exact:true}).click();await dialog('Eliminar familia').waitFor({state:'hidden'});data=await saved();assert.equal(data.budgetGroups.find((g:any)=>g.code===family.code).deleted,true);
      for(const field of ['transactions','budgetPlans','budgetSubitems','planningMonths'])assert.deepEqual(data[field],original[field]);
      await p.reload();await navigateModule(p,'Presupuestos');await p.getByRole('tab',{name:'Catálogo y detalle de partidas',exact:true}).click();assert.equal(await p.getByRole('button',{name:'Ver partida Senderismo ficticio',exact:true}).count(),0);
      await p.getByRole('button',{name:'Opciones y datos',exact:true}).click();const download=p.waitForEvent('download');await p.getByRole('button',{name:'Exportar JSON',exact:true}).click();const exported=parseBackup(await readFile((await (await download).path())!,'utf8'));assert.equal(exported.version,'3.4');assert.deepEqual(exported.budgetGroups,data.budgetGroups);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    }finally{await s.close();}
  });
  for(const failure of ['copy','active','conflict'] as const)await t.test(`persistencia ${failure}: conserva campos, bloquea cierre y permite recuperación sin duplicar`,async()=>{
    const s=await setup(),{p,c}=s;try{
      const before=await p.evaluate(k=>localStorage.getItem(k),DATA_KEY);await p.getByRole('button',{name:'Crear familia',exact:true}).click();const d=p.getByRole('dialog',{name:'Crear familia',exact:true});await d.getByLabel('Nombre del catálogo').fill('Pendiente ficticia');
      if(failure==='conflict'){const other=await c.newPage();await other.goto(origin+'/app');await navigateModule(other,'Presupuestos');await other.getByRole('region',{name:'Planificación financiera',exact:true}).getByLabel('Ahorro objetivo (€)').fill('1');await other.getByRole('button',{name:'Guardar borrador',exact:true}).click();await other.getByText('Borrador guardado.',{exact:true}).waitFor();}
      else await p.evaluate(({key,prefix,failure})=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k:string,v:string){if(failure==='copy'&&k.startsWith(prefix)||failure==='active'&&k===key)throw new DOMException('Cuota ficticia','QuotaExceededError');return original.call(this,k,v)};(window as any).restoreCatalogStorage=()=>{Storage.prototype.setItem=original};},{key:DATA_KEY,prefix:RECOVERY_PREFIX,failure});
      const current=await p.evaluate(k=>localStorage.getItem(k),DATA_KEY);await d.getByRole('button',{name:'Guardar catálogo',exact:true}).click();await d.getByRole('alert').waitFor();assert.equal(await d.getByLabel('Nombre del catálogo').inputValue(),'Pendiente ficticia');assert.equal(await p.evaluate(k=>localStorage.getItem(k),DATA_KEY),failure==='conflict'?current:before);
      if(failure!=='conflict'){await p.evaluate(()=>(window as any).restoreCatalogStorage());await p.evaluate(async lock=>{let entered!:()=>void;const ready=new Promise<void>(r=>entered=r);(window as any).heldCatalog=navigator.locks.request(lock,async()=>{entered();await new Promise<void>(r=>(window as any).releaseCatalog=r)});await ready;},STORAGE_LOCK);await d.getByRole('button',{name:'Guardar catálogo',exact:true}).evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click()});assert.equal(await d.getByRole('button',{name:'Cancelar',exact:true}).isDisabled(),true);await p.keyboard.press('Escape');assert.equal(await d.isVisible(),true);await p.evaluate(()=>(window as any).releaseCatalog());await d.waitFor({state:'hidden'});assert.equal(await p.evaluate(k=>JSON.parse(localStorage.getItem(k)!).budgetGroups.filter((g:any)=>g.name==='Pendiente ficticia').length,DATA_KEY),1);}
    }finally{await s.close();}
  });
});
