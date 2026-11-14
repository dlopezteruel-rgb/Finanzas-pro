import { selectPlanningArea } from './browserNavigation';
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFile } from 'node:fs/promises';
import { chromium, type Page } from 'playwright-core';
import { DATA_KEY, RECOVERY_PREFIX, makeBackup, type FinanceData } from '../src/utils/backup';
import { STORAGE_LOCK } from '../src/utils/financeStore';

const fixture = (theme: 'light' | 'dark' = 'dark'): FinanceData => ({ theme, transactions: [], budgetPlans: [], contacts: [], loans: [], wallets: [{ id:'bank',name:'BANCO FICTICIO',type:'BANK',initialBalance:1000,color:'#fff' }],
  budgetGroups: [
    {code:'I',name:'Ingresos ficticios',type:'INGRESO',partidas:[{code:'i',name:'Sueldo ficticio',groupCode:'I',groupName:'Ingresos ficticios',type:'INGRESO',keywords:[]}]},
    {code:'G',name:'Gastos ficticios',type:'GASTO',partidas:[{code:'g',name:'Comida ficticia',groupCode:'G',groupName:'Gastos ficticios',type:'GASTO',keywords:[]},{code:'r',name:'Alquiler ficticio',groupCode:'G',groupName:'Gastos ficticios',type:'GASTO',keywords:[]}]},
  ] });
const nav=(page:Page,name:string)=>page.getByRole('button',{name:new RegExp('^'+name+'(?:\\s*\\d+)?$')}).first().click();
const editor=(page:Page)=>page.getByRole('region',{name:'Planificación financiera'});
const raw=(page:Page)=>page.evaluate(key=>localStorage.getItem(key),DATA_KEY);
const saved=async(page:Page)=>JSON.parse((await raw(page))!);
const dialog=(page:Page)=>page.getByRole('dialog',{name:'Revisar y aprobar previsión',exact:true});
async function fill(page:Page, savings='600') {
  await selectPlanningArea(page,'Ingresos');
  await editor(page).getByRole('textbox',{name:'Previsto INGRESO Sueldo ficticio',exact:true}).fill('3.000,00');
  await selectPlanningArea(page,'Gastos');
  await editor(page).getByRole('textbox',{name:'Previsto GASTO Comida ficticia',exact:true}).fill('200.00');
  await editor(page).getByRole('textbox',{name:'Previsto GASTO Alquiler ficticio',exact:true}).fill('2000');
  await editor(page).getByRole('textbox',{name:'Ahorro objetivo (€)',exact:true}).fill(savings);
}
async function review(page:Page) {await editor(page).getByRole('button',{name:'Revisar y aprobar previsión',exact:true}).click();await dialog(page).waitFor();}
async function approve(page:Page) {await review(page);await dialog(page).getByRole('button',{name:'Confirmar aprobación',exact:true}).click();await dialog(page).waitFor({state:'hidden'});}

test('3A: planificación, aprobación y compatibilidad en Chromium aislado', {timeout:180000}, async t=>{
  const listener=createServer();await new Promise<void>(r=>listener.listen(0,'127.0.0.1',r));const port=(listener.address() as {port:number}).port;await new Promise<void>(r=>listener.close(()=>r()));
  const server=spawn(process.execPath,['--import','tsx','server.ts'],{env:{...process.env,PORT:String(port),NODE_ENV:'production'},stdio:'pipe'});let log='';server.stdout.on('data',c=>log+=c);server.stderr.on('data',c=>log+=c);t.after(()=>{server.kill()});
  const url=`http://127.0.0.1:${port}/app`;let ready=false;for(let i=0;i<100;i++){if(server.exitCode!==null)throw new Error(log);try{if((await fetch(url)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}assert.ok(ready,log);
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
  async function setup(mobile=false,theme:'dark'|'light'='dark',initial=fixture(theme)) {
    const context=await browser.newContext(mobile?{viewport:{width:390,height:844},isMobile:true,hasTouch:true}:{viewport:{width:1280,height:1000}});
    await context.addInitScript(({key,value})=>{if(localStorage.getItem(key)===null)localStorage.setItem(key,value)}, {key:DATA_KEY,value:JSON.stringify(makeBackup(initial))});
    const page=await context.newPage();page.setDefaultTimeout(7000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await nav(page,'Presupuestos');
    await editor(page).getByLabel('Mes de planificación').fill('2028-02');
    return {page,context,close:async()=>{await context.close();assert.deepEqual(errors,[])}};
  }
  await t.test('borrador local, errores inline, navegación sin escrituras, salir/seguir y descartar',async()=>{
    const s=await setup();try{const {page}=s;const before=await raw(page);await fill(page);
      const totals=editor(page).locator('.planning-totals').first();for(const expected of ['3.000,00 €','2.200,00 €','600,00 €','200,00 €','0,00 €'])assert.ok((await totals.textContent())!.includes(expected));
      assert.equal(await raw(page),before);
      await selectPlanningArea(page,'Ingresos'); const income=editor(page).getByRole('textbox',{name:'Previsto INGRESO Sueldo ficticio',exact:true});await income.fill('3.000');assert.equal(await income.getAttribute('aria-invalid'),'true');assert.equal(await editor(page).getByRole('button',{name:'Guardar borrador',exact:true}).isDisabled(),true);await income.fill('-1');assert.equal(await income.getAttribute('aria-invalid'),'true');await income.fill('3000');
      await nav(page,'Cuentas');const guard=page.getByRole('dialog',{name:'Cambios de planificación sin guardar'});await guard.waitFor();await guard.getByRole('button',{name:'Seguir editando'}).click();assert.equal(await income.inputValue(),'3000');
      await editor(page).getByLabel('Mes de planificación').fill('2030-01');await guard.waitFor();await guard.getByRole('button',{name:'Descartar y continuar'}).click();assert.equal(await editor(page).getByLabel('Mes de planificación').inputValue(),'2030-01');assert.equal(await raw(page),before);
      await editor(page).getByRole('button',{name:'Ver resumen anual'}).click();assert.match((await editor(page).textContent()) ?? '',/Cobertura 0\/12/);assert.equal(await editor(page).getByRole('table').locator('tbody tr').count(),12);assert.equal(await raw(page),before);
    }finally{await s.close()}
  });
  for(const mobile of [false,true])for(const theme of ['dark','light'] as const)await t.test(`aprobación atómica, teclado y diálogo superior: ${mobile?'móvil':'escritorio'}, ${theme}`,async()=>{
    const s=await setup(mobile,theme);try{const {page}=s;const before=await saved(page);await fill(page);await review(page);
      assert.equal(await page.getByRole('dialog').count(),1);assert.equal(await dialog(page).evaluate(el=>el.contains(document.activeElement)),true);assert.equal(await page.locator('#root').evaluate(el=>(el as HTMLElement).inert),true);
      for(let i=0;i<5;i++){await page.keyboard.press(i%2?'Shift+Tab':'Tab');assert.equal(await dialog(page).evaluate(el=>el.contains(document.activeElement)),true)}
      assert.equal(await dialog(page).evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),true);
      await page.keyboard.press('Escape');await dialog(page).waitFor({state:'hidden'});assert.deepEqual(await saved(page),before);await review(page);
      await page.evaluate(async lock=>{let entered!:()=>void;const ready=new Promise<void>(r=>entered=r);(window as any).held=navigator.locks.request(lock,async()=>{entered();await new Promise<void>(r=>(window as any).releasePlan=r)});await ready},STORAGE_LOCK);
      await dialog(page).getByRole('button',{name:'Confirmar aprobación',exact:true}).evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click()});
      assert.equal(await dialog(page).getByRole('button',{name:'Cancelar',exact:true}).isDisabled(),true);await page.keyboard.press('Escape');assert.equal(await dialog(page).count(),1);assert.deepEqual(await saved(page),before);
      await page.evaluate(()=>(window as any).releasePlan());await dialog(page).waitFor({state:'hidden'});const result=await saved(page);assert.equal(result.version,'2.9');assert.equal(result.planningMonths[0].approval.number,1);assert.equal(result.planningMonths[0].approval.totals.margin,20000);assert.deepEqual(result.transactions,before.transactions);assert.deepEqual(result.wallets,before.wallets);
      assert.equal(await page.evaluate(prefix=>Object.keys(localStorage).filter(k=>k.startsWith(prefix)).length,RECOVERY_PREFIX),1);
      await editor(page).getByRole('button',{name:'Ver resumen anual'}).click();assert.match((await editor(page).textContent()) ?? '',/Cobertura 1\/12/);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth),true,'sin desbordamiento horizontal global');
      await page.reload();await nav(page,'Presupuestos');await editor(page).getByLabel('Mes de planificación').fill('2028-02');assert.match((await editor(page).textContent()) ?? '',/Aprobado/);assert.equal((await saved(page)).planningMonths[0].approval.number,1);
    }finally{await s.close()}
  });
  await t.test('guardar borrador, aprobación deficitaria explícita y edición antigua invalida sin perder fotografía',async()=>{
    const s=await setup();try{const {page}=s;await fill(page,'900');await editor(page).getByRole('button',{name:'Guardar borrador',exact:true}).click();await editor(page).getByText('Borrador guardado.',{exact:true}).waitFor();assert.equal((await saved(page)).planningMonths[0].approval,undefined);
      await review(page);const confirm=dialog(page).getByRole('button',{name:'Confirmar aprobación',exact:true});assert.equal(await confirm.isDisabled(),true);await dialog(page).getByRole('checkbox').check();await confirm.click();await dialog(page).waitFor({state:'hidden'});const snapshot=(await saved(page)).planningMonths[0].approval;
      await editor(page).getByRole('button',{name:'Detalle Comida ficticia',exact:true}).click();const panel=page.getByRole('dialog',{name:'Detalle de partida',exact:true});await panel.getByTitle('Editar previsto').click();await panel.getByRole('textbox',{name:'Previsto de la partida'}).fill('250,01');await panel.getByRole('button',{name:'Guardar previsto de la partida'}).click();await panel.getByRole('textbox',{name:'Previsto de la partida'}).waitFor({state:'hidden'});await page.keyboard.press('Escape');
      assert.match((await editor(page).textContent()) ?? '',/Modificada desde la última aprobación/);assert.deepEqual((await saved(page)).planningMonths[0].approval,snapshot);
      await editor(page).getByRole('textbox',{name:'Ahorro objetivo (€)',exact:true}).fill('600');await approve(page);assert.equal((await saved(page)).planningMonths[0].approval.number,2);
      await editor(page).getByRole('textbox',{name:'Ahorro objetivo (€)',exact:true}).fill('1');await editor(page).getByRole('button',{name:'Descartar cambios'}).click();assert.equal(await editor(page).getByRole('textbox',{name:'Ahorro objetivo (€)',exact:true}).inputValue(),'600');
    }finally{await s.close()}
  });
  await t.test('exportar/importar 2.9, cancelar y restaurar copia anterior desde la interfaz',async()=>{
    const source=await setup(),target=await setup();try{
      await fill(source.page);await approve(source.page);const approved=await saved(source.page);
      await source.page.getByRole('button',{name:'Opciones y datos',exact:true}).click();const download=source.page.waitForEvent('download');await source.page.getByRole('button',{name:'Exportar JSON',exact:true}).click();const content=await readFile((await (await download).path())!,'utf8');assert.equal(JSON.parse(content).version,'2.9');
      const original=await raw(target.page);const importFile=()=>target.page.locator('input[type=file]').setInputFiles({name:'ficticio-2.9.json',mimeType:'application/json',buffer:Buffer.from(content)});
      await importFile();let preview=target.page.getByRole('dialog');await preview.waitFor();assert.match(await preview.innerText(),/Formato 2.9/);assert.match(await preview.innerText(),/Objetivos y aprobaciones mensuales/);await preview.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(await raw(target.page),original);
      await importFile();preview=target.page.getByRole('dialog');await preview.getByRole('button',{name:'Confirmar sustitución',exact:true}).click();await preview.waitFor({state:'hidden'});assert.deepEqual((await saved(target.page)).planningMonths,approved.planningMonths);assert.deepEqual((await saved(target.page)).budgetPlans,approved.budgetPlans);
      const prior=await source.page.evaluate(prefix=>Object.entries(localStorage).find(([k])=>k.startsWith(prefix))![1],RECOVERY_PREFIX);assert.equal(JSON.parse(prior).version,'2.5');await source.page.locator('input[type=file]').setInputFiles({name:'copia-anterior-ficticia.json',mimeType:'application/json',buffer:Buffer.from(prior)});preview=source.page.getByRole('dialog');await preview.getByRole('button',{name:'Confirmar sustitución',exact:true}).click();await preview.waitFor({state:'hidden'});assert.equal((await saved(source.page)).planningMonths,undefined);assert.equal((await saved(source.page)).budgetPlans.length,0);assert.deepEqual((await saved(source.page)).wallets,approved.wallets);
    }finally{await source.close();await target.close()}
  });
  for(const failure of ['quota','recovery','verification','locks'] as const)await t.test(`aprobación con ${failure}: conserva modal/importes/datos y permite reintentar`,async()=>{
    const s=await setup();try{const {page}=s;await fill(page);const before=await raw(page);await review(page);
      await page.evaluate(({key,prefix,failure})=>{
        const original=Storage.prototype.setItem, get=Storage.prototype.getItem, request=navigator.locks.request.bind(navigator.locks);
        (window as any).failPlan=true;
        Storage.prototype.setItem=function(k,v){if((window as any).failPlan && ((failure==='quota'&&k===key)||(failure==='recovery'&&k.startsWith(prefix))))throw new DOMException('Cuota simulada','QuotaExceededError');return original.call(this,k,v)};
        Storage.prototype.getItem=function(k){if((window as any).failPlan&&failure==='verification'&&k.startsWith(prefix))return '{}';return get.call(this,k)};
        navigator.locks.request=((...args:any[])=>{if((window as any).failPlan&&failure==='locks')return Promise.reject(new Error('Web Locks denegado'));return (request as any)(...args)}) as typeof navigator.locks.request;
      },{key:DATA_KEY,prefix:RECOVERY_PREFIX,failure});
      await dialog(page).getByRole('button',{name:'Confirmar aprobación',exact:true}).click();await dialog(page).getByRole('alert').waitFor();assert.equal(await raw(page),before);assert.equal(await dialog(page).getByRole('button',{name:'Confirmar aprobación',exact:true}).isEnabled(),true);
      await page.evaluate(()=>(window as any).failPlan=false);await dialog(page).getByRole('button',{name:'Confirmar aprobación',exact:true}).click();await dialog(page).waitFor({state:'hidden'});assert.equal((await saved(page)).planningMonths[0].approval.number,1);
    }finally{await s.close()}
  });
  await t.test('dos pestañas: rechazo obsoleto mantiene aprobación abierta y edición local',async()=>{
    const s=await setup();try{const {page,context}=s;await fill(page);await review(page);const other=await context.newPage();await other.goto(url);await nav(other,'Presupuestos');await editor(other).getByLabel('Mes de planificación').fill('2028-02');await fill(other,'500');await editor(other).getByRole('button',{name:'Guardar borrador',exact:true}).click();await editor(other).getByText('Borrador guardado.',{exact:true}).waitFor();const rawOther=await raw(other);
      await dialog(page).getByRole('button',{name:'Confirmar aprobación',exact:true}).click();await dialog(page).getByRole('alert').waitFor();assert.match((await dialog(page).getByRole('alert').textContent()) ?? '',/pestaña/);assert.equal(await raw(page),rawOther);await dialog(page).getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(await editor(page).getByRole('textbox',{name:'Ahorro objetivo (€)',exact:true}).inputValue(),'600');
    }finally{await s.close()}
  });
});
