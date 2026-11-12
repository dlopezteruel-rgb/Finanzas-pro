import { selectPlanningArea } from './browserNavigation';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,readFile} from 'node:fs/promises';
import {chromium,type Page} from 'playwright-core';
import {DATA_KEY,RECOVERY_PREFIX,makeBackup,parseBackup,type FinanceData} from '../src/utils/backup';
import {budgetSubitemFixture as fixture,demoParent,demoMonth} from './budgetSubitemFixture';
import {navigateModule as nav} from './browserNavigation';
import {STORAGE_LOCK} from '../src/utils/financeStore';
import {textContrast} from './presentationChecks';

const raw=(p:Page)=>p.evaluate(key=>localStorage.getItem(key),DATA_KEY);
const saved=async(p:Page)=>JSON.parse((await raw(p))!);
const planner=(p:Page)=>p.getByRole('region',{name:'Planificación financiera',exact:true});
const detail=(p:Page)=>p.getByRole('dialog',{name:'Detalle de partida',exact:true});
const guard=(p:Page)=>p.getByRole('dialog',{name:'Cambios de planificación sin guardar',exact:true});
const movement=(p:Page)=>p.getByRole('dialog',{name:'Movimiento',exact:true});
async function openDetail(p:Page){await nav(p,'Presupuestos');await planner(p).getByRole('button',{name:'Detalle Ocio ficticio',exact:true}).click();await detail(p).waitFor();}
async function openSubitems(p:Page){const d=planner(p).getByRole('group',{name:'Subítems de Ocio ficticio',exact:true});await d.locator('summary').click();return d;}
async function amounts(p:Page,a:string,b:string){await planner(p).getByLabel('Previsto subítem Cine ficticio',{exact:true}).fill(a);await planner(p).getByLabel('Previsto subítem Cultura ficticia',{exact:true}).fill(b);}
async function save(p:Page){await planner(p).getByRole('button',{name:'Guardar borrador',exact:true}).click();await planner(p).getByText('Borrador guardado.',{exact:true}).waitFor();}
async function approve(p:Page){await planner(p).getByRole('button',{name:'Revisar y aprobar previsión',exact:true}).click();const d=p.getByRole('dialog',{name:'Revisar y aprobar previsión',exact:true});await d.getByRole('button',{name:'Confirmar aprobación',exact:true}).click();await d.waitFor({state:'hidden'});}

test('subítems: catálogo, meses, movimientos y persistencia en Chromium aislado',{timeout:300000},async t=>{
  const listener=createServer();await new Promise<void>(r=>listener.listen(0,'127.0.0.1',r));const port=(listener.address() as {port:number}).port;await new Promise<void>(r=>listener.close(()=>r()));
  const server=spawn(process.execPath,['--import','tsx','server.ts'],{env:{...process.env,NODE_ENV:'production',PORT:String(port),APP_BASE_PATH:'/',GEMINI_API_KEY:'',GOOGLE_API_KEY:''},stdio:'pipe'});let log='';server.stdout.on('data',c=>log+=c);server.stderr.on('data',c=>log+=c);t.after(()=>{server.kill();});
  const origin=`http://127.0.0.1:${port}`,url=origin+'/app';let ready=false;for(let i=0;i<100;i++){try{if((await fetch(url)).ok){ready=true;break;}}catch{}await new Promise(r=>setTimeout(r,100));}assert.ok(ready,log);
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
  async function setup(width:number,data=fixture()){
    parseBackup(JSON.stringify(makeBackup(data)));
    const c=await browser.newContext({viewport:{width,height:width<768?844:1000},isMobile:width<768,hasTouch:width<768,locale:'es-ES',timezoneId:'Europe/Madrid',serviceWorkers:'block',acceptDownloads:true});
    const errors:string[]=[],blocked:string[]=[];await c.route('**/*',route=>new URL(route.request().url()).origin===origin?route.continue():(blocked.push(route.request().url()),route.abort()));
    await c.addInitScript(({key,value})=>{(window as any).__name=(fn:unknown)=>fn;if(localStorage.getItem(key)===null)localStorage.setItem(key,value);},{key:DATA_KEY,value:JSON.stringify(makeBackup(data))});
    const p=await c.newPage();p.setDefaultTimeout(7000);p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await p.clock.setFixedTime(new Date('2026-11-11T12:00:00Z'));await p.goto(url);await p.getByLabel('Seleccionar periodo contable').waitFor();
    return {p,c,close:async()=>{await c.close();assert.deepEqual(errors,[]);assert.deepEqual(blocked,[]);}};
  }
  for(const width of [390,1280]){
    await t.test(`${width}px: cero, uno y varios; crear, renombrar, ordenar, archivar y retirar sin cambiar históricos`,async()=>{
      const base=fixture(false),s=await setup(width,base),{p}=s;try{
        const before=await raw(p);await openDetail(p);await detail(p).getByRole('group',{name:'Gestión de subítems'}).locator('summary').click();assert.equal(await raw(p),before);
        for(const name of ['Cine nuevo','Cultura nueva']){await detail(p).getByLabel('Nombre del nuevo subítem').fill(name);await detail(p).getByRole('button',{name:'Crear subítem',exact:true}).click();await p.waitForFunction(({key,name})=>JSON.parse(localStorage.getItem(key)!).budgetSubitems?.items.some((i:any)=>i.name===name),{key:DATA_KEY,name});}
        const data=await saved(p),ids=data.budgetSubitems.items.map((i:any)=>i.id);assert.equal(data.version,'3.3');assert.deepEqual(data.budgetPlans,base.budgetPlans);assert.deepEqual(data.transactions,base.transactions);assert.deepEqual(data.budgetSubitems.months,[]);assert.notEqual(ids[0],ids[1]);
        assert.equal(await p.evaluate(prefix=>Object.keys(localStorage).filter(k=>k.startsWith(prefix)).length,RECOVERY_PREFIX),1);
        await detail(p).getByRole('button',{name:'Renombrar Cine nuevo',exact:true}).click();await detail(p).getByLabel('Nuevo nombre de Cine nuevo').fill('Cine renombrado');await detail(p).getByRole('button',{name:'Guardar nombre',exact:true}).click();const longName='FICTICIO'.repeat(12);await detail(p).getByRole('button',{name:'Renombrar Cine renombrado',exact:true}).click();await detail(p).getByLabel('Nuevo nombre de Cine renombrado').fill(longName);await detail(p).getByRole('button',{name:'Guardar nombre',exact:true}).click();assert.equal(await detail(p).evaluate(el=>el.scrollWidth<=el.clientWidth+1),true);await detail(p).getByRole('button',{name:`Renombrar ${longName}`,exact:true}).click();await detail(p).getByLabel(`Nuevo nombre de ${longName}`).fill('Cine renombrado');await detail(p).getByRole('button',{name:'Guardar nombre',exact:true}).click();await detail(p).getByRole('button',{name:'Subir Cultura nueva',exact:true}).click();
        await detail(p).getByRole('button',{name:'Archivar Cine renombrado',exact:true}).click();await detail(p).getByRole('button',{name:'Reactivar Cine renombrado',exact:true}).waitFor();assert.equal((await saved(p)).budgetSubitems.items.find((i:any)=>i.id===ids[0]).archived,true);
        await detail(p).getByRole('button',{name:'Eliminar Cultura nueva',exact:true}).click();await detail(p).getByRole('button',{name:'Confirmar eliminación de Cultura nueva',exact:true}).click();await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)!).budgetSubitems.items.some((i:any)=>i.deleted),DATA_KEY);
        assert.equal((await saved(p)).budgetSubitems.items.find((i:any)=>i.id===ids[1]).deleted,true);await p.keyboard.press('Escape');await p.reload();await openDetail(p);assert.match(await detail(p).innerText(),/Cine renombrado/);
      }finally{await s.close();}
    });
    await t.test(`${width}px: desglose explícito, céntimos, guardar/descartar/conservar y aprobación inmutable`,async()=>{
      const s=await setup(width),{p}=s;try{
        await nav(p,'Presupuestos');const before=await raw(p);await openSubitems(p);assert.equal(await raw(p),before);await planner(p).getByRole('button',{name:'Distribuir Ocio ficticio este mes',exact:true}).click();assert.equal(await planner(p).getByRole('button',{name:'Guardar borrador',exact:true}).isDisabled(),true);
        await amounts(p,'21,10','78,901');assert.equal(await planner(p).getByLabel('Previsto subítem Cultura ficticia').getAttribute('aria-invalid'),'true');await amounts(p,'21,10','78,90');assert.equal(await planner(p).getByLabel('Previsto GASTO Ocio ficticio',{exact:true}).inputValue(),'100');assert.equal(await planner(p).getByLabel('Previsto GASTO Ocio ficticio',{exact:true}).getAttribute('readonly'),'');
        await nav(p,'Cuentas');await guard(p).getByRole('button',{name:'Seguir editando',exact:true}).click();assert.equal(await planner(p).getByLabel('Previsto subítem Cine ficticio').inputValue(),'21,10');
        await nav(p,'Cuentas');await guard(p).getByRole('button',{name:'Descartar y continuar',exact:true}).click();assert.equal(await raw(p),before);
        await nav(p,'Presupuestos');await openSubitems(p);await planner(p).getByRole('button',{name:'Distribuir Ocio ficticio este mes',exact:true}).click();await amounts(p,'21,10','78,90');await nav(p,'Cuentas');await guard(p).getByRole('button',{name:'Guardar y continuar',exact:true}).click();await guard(p).waitFor({state:'hidden'});assert.equal((await saved(p)).budgetSubitems.months[0].lines.find((l:any)=>l.subitemId==='demo-cine').amountCents,2110);
        await nav(p,'Presupuestos');await openSubitems(p);await approve(p);const photo=(await saved(p)).planningMonths[0].approval;await amounts(p,'50','50');await save(p);assert.match(await planner(p).innerText(),/Modificada desde la última aprobación/);assert.deepEqual((await saved(p)).planningMonths[0].approval,photo);await approve(p);assert.deepEqual((await saved(p)).planningAutomation.history[0].approvals[0],photo);
        await p.reload();await nav(p,'Presupuestos');await openSubitems(p);assert.equal(await planner(p).getByLabel('Previsto subítem Cine ficticio').inputValue(),'50');
      }finally{await s.close();}
    });
    await t.test(`${width}px: movimiento imputado y sin subítem, edición, compartido y archivo consultable`,async()=>{
      const s=await setup(width,fixture(true,true)),{p}=s;try{
        await openDetail(p);await detail(p).getByRole('button',{name:'Registrar en Cine ficticio',exact:true}).click();assert.equal(await movement(p).getByLabel('Subítem (opcional)').inputValue(),'demo-cine');await movement(p).getByLabel('Importe Total (€)').fill('60');await movement(p).getByLabel('Concepto',{exact:true}).fill('Comida ficticia compartida');await movement(p).getByLabel('Gasto compartido',{exact:true}).check();await movement(p).getByRole('button',{name:'Amistad ficticia',exact:true}).click();await movement(p).getByRole('button',{name:'Guardar Movimiento',exact:true}).click();await movement(p).waitFor({state:'hidden'});
        const created=(await saved(p)).transactions.find((tx:any)=>tx.description==='Comida ficticia compartida');assert.equal(created.subitemId,'demo-cine');assert.equal(created.splitInfo.myShare,30);assert.match(await detail(p).getByRole('region',{name:'Desglose de subítems'}).innerText(),/Ejecutado: 30,00/);
        await detail(p).getByRole('button',{name:'Ver movimientos de Cine ficticio',exact:true}).click();assert.equal(await detail(p).locator('[data-movement-id]').count(),1);await detail(p).getByRole('button',{name:'Editar movimiento',exact:true}).click();assert.equal(await movement(p).getByLabel('Subítem (opcional)').inputValue(),'demo-cine');await movement(p).getByLabel('Concepto',{exact:true}).fill('Comida ficticia corregida');await movement(p).getByRole('button',{name:'Guardar Cambios',exact:true}).click();await movement(p).waitFor({state:'hidden'});assert.equal((await saved(p)).transactions.find((tx:any)=>tx.id===created.id).subitemId,'demo-cine');
        await detail(p).getByRole('group',{name:'Gestión de subítems'}).locator('summary').click();assert.equal(await detail(p).getByRole('button',{name:'Eliminar Cine ficticio',exact:true}).count(),0);await detail(p).getByRole('button',{name:'Archivar Cine ficticio',exact:true}).click();await detail(p).getByRole('button',{name:'Reactivar Cine ficticio',exact:true}).waitFor();
        await detail(p).getByRole('button',{name:'Ver todos los movimientos de la partida',exact:true}).click();await detail(p).getByRole('button',{name:'Ver movimientos de Sin subítem',exact:true}).click();assert.equal(await detail(p).locator('[data-movement-id]').count(),1);
        await detail(p).getByRole('button',{name:'Registrar en Sin subítem',exact:true}).click();assert.equal(await movement(p).getByLabel('Subítem (opcional)').inputValue(),'');assert.equal(await movement(p).getByLabel('Subítem (opcional)').locator('option[value="demo-cine"]').count(),0);await movement(p).getByLabel('Importe Total (€)').fill('5');await movement(p).getByRole('button',{name:'Guardar Movimiento',exact:true}).click();await movement(p).waitFor({state:'hidden'});assert.equal((await saved(p)).transactions[0].subitemId,undefined);
      }finally{await s.close();}
    });
    await t.test(`${width}px: rápido y chat requieren atribución expresa; duplicar partida genera IDs nuevos`,async()=>{
      const s=await setup(width),{p}=s;try{
        await p.getByPlaceholder(/^Registrar:/).fill('Compra de comida por 8');assert.equal(await p.getByLabel('Partida del registro rápido').inputValue(),'');await p.getByLabel('Partida del registro rápido').selectOption(demoParent.code);assert.equal(await p.getByLabel('Subítem (opcional)').inputValue(),'');await p.getByLabel('Subítem (opcional)').selectOption('demo-cine');await p.getByRole('button',{name:'Registrar',exact:true}).click();await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)!).transactions.length===2,DATA_KEY);assert.equal((await saved(p)).transactions[0].subitemId,'demo-cine');
        await nav(p,'Asistente');await p.getByRole('textbox',{name:'Mensaje para el asistente'}).fill('Registra un gasto de 9');await p.getByRole('button',{name:'Enviar',exact:true}).click();const proposal=p.getByRole('dialog',{name:'Revisar propuesta de movimiento',exact:true});await proposal.getByLabel('Categoría',{exact:true}).selectOption(demoParent.code);assert.equal(await proposal.getByLabel('Subítem (opcional)').inputValue(),'');await proposal.getByLabel('Subítem (opcional)').selectOption('demo-cultura');await proposal.getByRole('button',{name:'Confirmar y registrar',exact:true}).click();await proposal.waitFor({state:'hidden'});assert.equal((await saved(p)).transactions[0].subitemId,'demo-cultura');
        await nav(p,'Presupuestos');await p.getByRole('tab',{name:'Catálogo y detalle de partidas',exact:true}).click();await p.getByRole('button',{name:'Duplicar partida Ocio ficticio',exact:true}).click();await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)!).budgetSubitems.items.length===4,DATA_KEY);const items=(await saved(p)).budgetSubitems.items;assert.equal(new Set(items.map((i:any)=>i.id)).size,4);assert.equal(items.filter((i:any)=>i.code!==demoParent.code).length,2);
      }finally{await s.close();}
    });
    await t.test(`${width}px: copiar desglose revisable, regla global bloqueada y arrastre sin asignación ficticia`,async()=>{
      const data=fixture(true,true);data.planningAutomation={rules:[{id:'global',name:'Global ficticia',target:'GASTO',code:demoParent.code,amountCents:12000,frequency:'monthly',startMonth:demoMonth,active:true}],carryovers:[],origins:[],history:[]};
      const s=await setup(width,data),{p}=s;try{
        await nav(p,'Presupuestos');await selectPlanningArea(p, 'Multiperiodo'); await planner(p).getByRole('button',{name:'Copiar planificación',exact:true}).click();const copy=p.getByRole('dialog',{name:'Copiar planificación',exact:true});await copy.getByLabel('Primer mes destino').fill('2026-12');await copy.getByLabel('Último mes destino').fill('2026-12');await copy.getByRole('button',{name:'Previsualizar copia',exact:true}).click();
        const review=p.getByRole('dialog',{name:'Confirmar operación de planificación',exact:true});await review.getByText(/^Desglose de la copia/).click();assert.match(await review.innerText(),/Cine ficticio.*60,00/s);await review.getByRole('button',{name:'Confirmar cambios de planificación',exact:true}).click();await review.waitFor({state:'hidden'});const copied=await saved(p);assert.deepEqual(copied.budgetSubitems.months.find((m:any)=>m.monthYear==='2026-12').lines,copied.budgetSubitems.months.find((m:any)=>m.monthYear===demoMonth).lines);
        const before=await raw(p);await selectPlanningArea(p, 'Multiperiodo'); await planner(p).getByRole('button',{name:'Aplicar recurrencias',exact:true}).click();await p.getByRole('dialog',{name:'Aplicar recurrencias',exact:true}).getByRole('button',{name:'Previsualizar recurrencias',exact:true}).click();assert.match(await review.innerText(),/Desglose mensual activo/);assert.equal(await review.getByRole('button',{name:'Confirmar cambios de planificación',exact:true}).isDisabled(),true);await p.keyboard.press('Escape');await p.keyboard.press('Escape');
        await p.clock.setFixedTime(new Date('2026-12-02T12:00:00Z'));await selectPlanningArea(p, 'Multiperiodo'); await planner(p).getByRole('button',{name:'Arrastrar remanentes',exact:true}).click();const carry=p.getByRole('dialog',{name:'Arrastrar remanentes',exact:true});await carry.getByLabel('Mes de origen del remanente').fill(demoMonth);await carry.getByLabel('Seleccionar remanente GASTO · Ocio ficticio',{exact:true}).check();await carry.getByRole('button',{name:'Previsualizar arrastre',exact:true}).click();assert.match(await review.innerText(),/Arrastre global bloqueado/);assert.equal(await review.getByRole('button',{name:'Confirmar cambios de planificación',exact:true}).isDisabled(),true);assert.equal(await raw(p),before);
      }finally{await s.close();}
    });
    for(const theme of ['light','dark'] as const)await t.test(`${width}px ${theme}: lectura, contraste, foco, desglose mensual y captura ficticia`,async()=>{
      const data={...fixture(true,true),theme},s=await setup(width,data),{p}=s;try{
        const before=await raw(p);await nav(p,'Presupuestos');await openSubitems(p);const field=planner(p).getByLabel('Previsto subítem Cine ficticio');await field.focus();assert.equal(await field.evaluate(el=>document.activeElement===el),true);assert.ok(await textContrast(field)>=4.5);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
        if(process.env.BUDGET_SUBITEM_ARTIFACT_DIR){await mkdir(process.env.BUDGET_SUBITEM_ARTIFACT_DIR,{recursive:true});await p.evaluate(()=>window.scrollTo(0,0));await p.screenshot({fullPage:true,path:`${process.env.BUDGET_SUBITEM_ARTIFACT_DIR}/${width}-${theme}-planificacion.jpg`,type:'jpeg',quality:85,animations:'disabled'});await planner(p).getByRole('button',{name:'Detalle Ocio ficticio',exact:true}).click();await detail(p).evaluate(el=>el.scrollTop=0);await p.screenshot({path:`${process.env.BUDGET_SUBITEM_ARTIFACT_DIR}/${width}-${theme}-detalle.jpg`,type:'jpeg',quality:85,animations:'disabled'});await p.keyboard.press('Escape');}
        assert.equal(await raw(p),before);
      }finally{await s.close();}
    });
  }
  for(const failure of ['copy','active','conflict'] as const)await t.test(`persistencia ${failure}: conserva edición, rechaza escrituras y evita doble creación`,async()=>{
    const s=await setup(390,fixture(false)),{p,c}=s;try{
      await openDetail(p);await detail(p).getByRole('group',{name:'Gestión de subítems'}).locator('summary').click();await detail(p).getByLabel('Nombre del nuevo subítem').fill('Subítem pendiente');
      let before=await raw(p);
      if(failure==='conflict'){const other=await c.newPage();await other.goto(url);await nav(other,'Presupuestos');await planner(other).getByLabel('Ahorro objetivo (€)').fill('10');await save(other);before=await raw(other);}
      else await p.evaluate(({key,prefix,failure})=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(failure==='copy'&&k.startsWith(prefix)||failure==='active'&&k===key)throw new DOMException('Cuota ficticia','QuotaExceededError');return original.call(this,k,v);};},{key:DATA_KEY,prefix:RECOVERY_PREFIX,failure});
      await detail(p).getByRole('button',{name:'Crear subítem',exact:true}).click();await detail(p).getByRole('alert').first().waitFor();assert.equal(await detail(p).getByLabel('Nombre del nuevo subítem').inputValue(),'Subítem pendiente');assert.equal(await raw(p),before);
    }finally{await s.close();}
  });
  await t.test('Web Lock: doble clic crea una sola identidad; exportación/recarga/restauración 3.3',async()=>{
    const s=await setup(390,fixture(false)),{p}=s;try{
      await openDetail(p);await detail(p).getByRole('group',{name:'Gestión de subítems'}).locator('summary').click();await detail(p).getByLabel('Nombre del nuevo subítem').fill('Solo una vez');
      await p.evaluate(async lock=>{let ready!:()=>void;const entered=new Promise<void>(r=>ready=r);(window as any).held=navigator.locks.request(lock,async()=>{ready();await new Promise<void>(r=>(window as any).releaseSubitem=r);});await entered;},STORAGE_LOCK);
      await detail(p).getByRole('button',{name:'Crear subítem',exact:true}).evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click();});await p.keyboard.press('Escape');assert.equal(await detail(p).count(),1);await p.evaluate(()=>(window as any).releaseSubitem());await p.waitForFunction(key=>JSON.parse(localStorage.getItem(key)!).budgetSubitems?.items.length===1,DATA_KEY);await p.keyboard.press('Escape');
      await p.getByRole('button',{name:'Opciones y datos',exact:true}).click();const download=p.waitForEvent('download');await p.getByRole('button',{name:'Exportar JSON',exact:true}).click();const exported=parseBackup(await readFile((await (await download).path())!,'utf8'));assert.equal(exported.version,'3.3');await p.reload();assert.equal((await saved(p)).budgetSubitems.items.length,1);
      for(const backup of [makeBackup(fixture(false)),exported]){await p.locator('input[type=file]').setInputFiles({name:'fixture.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(backup))});const confirm=p.getByRole('dialog').filter({hasText:'Se sustituirán todos los datos por esta copia.'});await confirm.getByRole('button',{name:'Confirmar sustitución',exact:true}).click();await confirm.waitFor({state:'hidden'});assert.deepEqual((await saved(p)).budgetSubitems,backup.budgetSubitems);}
    }finally{await s.close();}
  });
});
