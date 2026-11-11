import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { readFile } from 'node:fs/promises';
import { chromium,type Page } from 'playwright-core';
import { DATA_KEY,RECOVERY_PREFIX,makeBackup,type FinanceData } from '../src/utils/backup';
import { savePlanning,planningScope } from '../src/utils/planning';
import { STORAGE_LOCK } from '../src/utils/financeStore';
import { chartFixture } from './chartFixture';

const lines=[{type:'INGRESO' as const,code:'i',amountCents:300000},{type:'GASTO' as const,code:'g',amountCents:220000}];
function initialData(){const d=chartFixture();return savePlanning(d,'2028-02',lines,60000,planningScope(d,'2028-02'))}
const nav=(page:Page,name:string)=>page.getByRole('button',{name:new RegExp('^(?:\\d+\\s*)?'+name+'(?:\\s*\\d+)?$')}).first().click();
const planner=(page:Page)=>page.getByRole('region',{name:'Planificación financiera',exact:true});
const operations=(page:Page)=>planner(page).getByRole('region',{name:'Automatización de planificación',exact:true});
const preview=(page:Page)=>page.getByRole('dialog',{name:'Confirmar operación de planificación',exact:true});
const snapshot=(page:Page)=>page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
const data=(page:Page)=>page.evaluate(key=>JSON.parse(localStorage.getItem(key)!),DATA_KEY);
async function showCopy(page:Page,first='2028-03',last='2028-04') {
  await operations(page).getByRole('button',{name:'Copiar planificación',exact:true}).click();
  const form=page.getByRole('dialog',{name:'Copiar planificación',exact:true});await form.getByLabel('Primer mes destino',{exact:true}).fill(first);await form.getByLabel('Último mes destino',{exact:true}).fill(last);await form.getByRole('button',{name:'Previsualizar copia',exact:true}).click();await preview(page).waitFor();return form;
}
async function confirm(page:Page){await preview(page).getByRole('button',{name:'Confirmar cambios de planificación',exact:true}).click();await preview(page).waitFor({state:'hidden'});await operations(page).getByText('Operación de planificación guardada.',{exact:true}).waitFor()}
async function addRule(page:Page,name:string,target:string,frequency:string) {
  await operations(page).getByRole('button',{name:'Reglas recurrentes',exact:true}).click();const form=page.getByRole('dialog',{name:'Reglas recurrentes',exact:true});
  await form.getByLabel('Nombre de regla',{exact:true}).fill(name);await form.getByLabel('Destino de regla',{exact:true}).selectOption(target);await form.getByLabel('Importe de regla (€)',{exact:true}).fill(target==='SAVINGS'?'600':'3000');await form.getByLabel('Frecuencia',{exact:true}).selectOption(frequency);await form.getByLabel('Inicio de regla',{exact:true}).fill('2028-12');await form.getByLabel('Fin de regla (opcional)',{exact:true}).fill('2029-12');await form.getByRole('button',{name:'Previsualizar regla',exact:true}).click();await confirm(page);
}

test('3B Automatización: copia, reglas, arrastre, historia y recuperación en Chromium', {timeout:240000},async t=>{
  const listener=createServer();await new Promise<void>(r=>listener.listen(0,'127.0.0.1',r));const port=(listener.address() as {port:number}).port;await new Promise<void>(r=>listener.close(()=>r()));
  const server=spawn(process.execPath,['--import','tsx','server.ts'],{env:{...process.env,PORT:String(port),NODE_ENV:'production'},stdio:'pipe'});let log='';server.stdout.on('data',c=>log+=c);server.stderr.on('data',c=>log+=c);t.after(()=>{server.kill()});
  const url=`http://127.0.0.1:${port}/app`;let ready=false;for(let i=0;i<100;i++){if(server.exitCode!==null)throw new Error(log);try{if((await fetch(url)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}assert.ok(ready,log);
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
  async function setup(mobile=false,theme:'dark'|'light'='dark',initial=initialData(),month='2028-02') {
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:1000},isMobile:mobile,hasTouch:mobile});
    await context.route('**/*',route=>new URL(route.request().url()).origin===new URL(url).origin?route.continue():route.abort());
    await context.addInitScript(({key,value})=>{if(localStorage.getItem(key)===null)localStorage.setItem(key,value)},{key:DATA_KEY,value:JSON.stringify(makeBackup({...initial,theme}))});
    const page=await context.newPage();page.setDefaultTimeout(7000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);await nav(page,'Presupuestos');await planner(page).getByLabel('Mes de planificación',{exact:true}).fill(month);
    return {page,context,close:async()=>{await context.close();assert.deepEqual(errors,[])}};
  }
  for(const mobile of [false,true])for(const theme of ['dark','light'] as const)await t.test(`copia con vista previa, cancelación, teclado y escritura única: ${mobile?'390px':'escritorio'}, ${theme}`,async()=>{
    const s=await setup(mobile,theme);const {page}=s;try{
      const before=await snapshot(page),source=(await data(page)).planningMonths.find((m:any)=>m.monthYear==='2028-02');await showCopy(page);
      assert.equal(await preview(page).getByRole('table').locator('tbody tr').count(),6);assert.match(await preview(page).innerText(),/Resumen 2028-03.*3\.000,00.*2\.200,00.*600,00.*200,00/s);assert.deepEqual(await snapshot(page),before);
      const tableScroll=preview(page).getByRole('region',{name:'Diferencias de planificación desplazables',exact:true});
      await tableScroll.focus();if(mobile){assert.equal(await tableScroll.evaluate(el=>el.scrollWidth>el.clientWidth),true);await page.keyboard.press('ArrowRight');await page.waitForFunction(()=>document.activeElement?.scrollLeft!>0);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true)}
      for(let i=0;i<4;i++){await page.keyboard.press(i%2?'Shift+Tab':'Tab');assert.equal(await preview(page).evaluate(el=>el.contains(document.activeElement)),true)}
      if(process.env.AUTOMATION_ARTIFACT_DIR)await page.screenshot({path:`${process.env.AUTOMATION_ARTIFACT_DIR}/copy-${mobile?'mobile':'desktop'}-${theme}.png`});
      await page.keyboard.press('Escape');await preview(page).waitFor({state:'hidden'});await page.keyboard.press('Escape');assert.deepEqual(await snapshot(page),before);
      await showCopy(page);
      await page.evaluate(async lock=>{let enter!:()=>void;const ready=new Promise<void>(r=>enter=r);(window as any).held=navigator.locks.request(lock,async()=>{enter();await new Promise<void>(r=>(window as any).releaseAutomation=r)});await ready},STORAGE_LOCK);
      await page.evaluate(key=>{const set=Storage.prototype.setItem;(window as any).automationWrites=0;Storage.prototype.setItem=function(k,v){if(k===key)(window as any).automationWrites++;return set.call(this,k,v)}},DATA_KEY);
      await preview(page).getByRole('button',{name:'Confirmar cambios de planificación',exact:true}).evaluate(el=>{(el as HTMLButtonElement).click();(el as HTMLButtonElement).click()});
      await page.waitForFunction(()=>document.querySelector('[role=dialog] button:disabled')!==null);assert.equal(await preview(page).getByRole('button',{name:'Cancelar',exact:true}).isDisabled(),true);await page.keyboard.press('Escape');assert.equal(await preview(page).count(),1);assert.deepEqual(await snapshot(page),before);
      await page.evaluate(()=>(window as any).releaseAutomation());await preview(page).waitFor({state:'hidden'});assert.equal(await page.evaluate(()=>(window as any).automationWrites),1);
      const result=await data(page);assert.equal(result.version,'3.0');assert.deepEqual(result.transactions,JSON.parse(before[DATA_KEY]).transactions);assert.deepEqual(result.planningMonths.find((m:any)=>m.monthYear==='2028-02'),source);assert.equal(result.planningMonths.find((m:any)=>m.monthYear==='2028-03').approval,undefined);assert.equal(result.budgetPlans.filter((p:any)=>p.monthYear==='2028-04').length,2);
      await showCopy(page);assert.equal(await preview(page).getByRole('button',{name:'Confirmar cambios de planificación',exact:true}).isDisabled(),true);assert.match(await preview(page).innerText(),/Omitido/);
      await page.keyboard.press('Escape');await page.keyboard.press('Escape');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);assert.equal(await page.locator('#root').evaluate(el=>el.contains(document.activeElement)),true);
    }finally{await s.close()}
  });
  await t.test('borrador local bloquea automatización y destinos existentes/protegidos exigen resolución',async()=>{
    let initial=initialData();initial=savePlanning(initial,'2028-03',[{type:'GASTO',code:'g',amountCents:100}],100,planningScope(initial,'2028-03'));initial=savePlanning(initial,'2028-04',lines,60000,planningScope(initial,'2028-04'),true);
    const s=await setup(false,'dark',initial);const {page}=s;try{
      const photo=(await data(page)).planningMonths.find((m:any)=>m.monthYear==='2028-04').approval;
      await planner(page).getByRole('textbox',{name:'Previsto GASTO Comida ficticia',exact:true}).fill('2300');assert.equal(await operations(page).getByRole('button',{name:'Copiar planificación',exact:true}).isDisabled(),true);
      await planner(page).getByRole('button',{name:'Descartar cambios',exact:true}).click();await showCopy(page);assert.match(await preview(page).innerText(),/Bloqueado.*aprobado/s);assert.match(await preview(page).innerText(),/Omitido/);
      assert.equal(await preview(page).getByRole('checkbox',{name:/2028-04/}).count(),0);
      await preview(page).getByRole('checkbox',{name:'Autorizar mezcla de partidas seleccionadas en borrador 2028-03',exact:true}).check();await confirm(page);
      assert.deepEqual((await data(page)).planningMonths.find((m:any)=>m.monthYear==='2028-04').approval,photo);assert.equal((await data(page)).budgetPlans.find((p:any)=>p.monthYear==='2028-03'&&p.type==='GASTO').plannedAmount,2200);
    }finally{await s.close()}
  });
  await t.test('reglas mensuales, trimestrales, anuales: CRUD sin generar y aplicación manual idempotente',async()=>{
    const s=await setup();const {page}=s;try{
      const original=(await data(page)).budgetPlans;await addRule(page,'Nómina ficticia','INGRESO:i','monthly');await addRule(page,'Seguro ficticio','GASTO:g','quarterly');await addRule(page,'Objetivo ficticio','SAVINGS','yearly');assert.deepEqual((await data(page)).budgetPlans,original);
      await operations(page).getByRole('button',{name:'Aplicar recurrencias',exact:true}).click();const form=page.getByRole('dialog',{name:'Aplicar recurrencias',exact:true});await form.getByLabel('Primer mes destino',{exact:true}).fill('2028-12');await form.getByLabel('Último mes destino',{exact:true}).fill('2029-01');await form.getByRole('button',{name:'Previsualizar recurrencias',exact:true}).click();assert.equal(await preview(page).getByRole('table').locator('tbody tr').count(),4);await confirm(page);
      const result=await data(page);assert.equal(result.budgetPlans.filter((p:any)=>p.monthYear==='2028-12').length,2);assert.equal(result.budgetPlans.filter((p:any)=>p.monthYear==='2029-01').length,1);assert.equal(result.planningMonths.find((m:any)=>m.monthYear==='2028-12').savingsCents,60000);
      await operations(page).getByRole('button',{name:'Reglas recurrentes',exact:true}).click();const edit=page.getByRole('dialog',{name:'Reglas recurrentes'});await edit.getByRole('button',{name:'Editar regla Nómina ficticia',exact:true}).click();await edit.getByLabel('Importe de regla (€)',{exact:true}).fill('3100');await edit.getByRole('button',{name:'Previsualizar regla',exact:true}).click();await confirm(page);assert.deepEqual((await data(page)).budgetPlans,result.budgetPlans);
      await operations(page).getByRole('button',{name:'Reglas recurrentes',exact:true}).click();await page.getByRole('dialog',{name:'Reglas recurrentes'}).getByRole('button',{name:'Pausar regla Nómina ficticia',exact:true}).click();await confirm(page);assert.equal((await data(page)).planningAutomation.rules.find((r:any)=>r.name==='Nómina ficticia').active,false);
      await operations(page).getByRole('button',{name:'Reglas recurrentes',exact:true}).click();await page.getByRole('dialog',{name:'Reglas recurrentes'}).getByRole('button',{name:'Eliminar regla Seguro ficticio',exact:true}).click();await confirm(page);assert.deepEqual((await data(page)).budgetPlans,result.budgetPlans);
      await operations(page).getByRole('button',{name:'Aplicar recurrencias',exact:true}).click();const again=page.getByRole('dialog',{name:'Aplicar recurrencias'});await again.getByLabel('Primer mes destino',{exact:true}).fill('2028-12');await again.getByLabel('Último mes destino',{exact:true}).fill('2029-01');await again.getByRole('button',{name:'Previsualizar recurrencias',exact:true}).click();assert.equal(await preview(page).getByRole('button',{name:'Confirmar cambios de planificación',exact:true}).isDisabled(),true);
    }finally{await s.close()}
  });
  await t.test('remanente 50 separado, gráfico efectivo, revisión de origen y eliminación con foto conservada',async()=>{
    const initial=chartFixture();const shared=initial.transactions.find(t=>t.id==='shared')!;initial.transactions=[{...shared,date:'2026-09-01',amount:600,splitInfo:{...shared.splitInfo!,myShare:150,totalOwedToMe:450,participants:initial.contacts.map(c=>({contactId:c.id,contactName:c.name,amount:150,isPaid:false})),settlements:[],distribution:{method:'equal'}}}];initial.budgetPlans=[{monthYear:'2026-09',type:'GASTO',code:'g',plannedAmount:200},{monthYear:'2026-10',type:'GASTO',code:'g',plannedAmount:200}];
    const s=await setup(true,'light',initial,'2026-10');const {page}=s;try{
      const bank=(await data(page)).transactions;await operations(page).getByRole('button',{name:'Arrastrar remanentes',exact:true}).click();const form=page.getByRole('dialog',{name:'Arrastrar remanentes'});await form.getByLabel('Mes de origen del remanente',{exact:true}).fill('2026-09');assert.match(await form.innerText(),/Base 200,00.*procesado 150,00.*remanente 50,00/s);await form.getByRole('checkbox',{name:'Seleccionar remanente g',exact:true}).check();await form.getByRole('button',{name:'Previsualizar arrastre',exact:true}).click();assert.match(await preview(page).innerText(),/250,00/);await confirm(page);
      assert.equal((await data(page)).budgetPlans.find((p:any)=>p.monthYear==='2026-10').plannedAmount,200);assert.deepEqual((await data(page)).transactions,bank);assert.match(await planner(page).getByRole('group',{name:'Arrastre de Comida ficticia',exact:true}).innerText(),/50,00.*Presupuesto efectivo: 250,00/s);assert.equal(await planner(page).getByRole('textbox',{name:'Previsto GASTO Comida ficticia',exact:true}).inputValue(),'200');
      const baseInput=planner(page).getByRole('textbox',{name:'Previsto GASTO Comida ficticia',exact:true});const activeBeforeOverflow=await snapshot(page);await baseInput.fill('90071992547409.91');await planner(page).getByRole('alert').first().waitFor();assert.equal(await planner(page).getByRole('button',{name:'Guardar borrador',exact:true}).isDisabled(),true);assert.deepEqual(await snapshot(page),activeBeforeOverflow);await baseInput.fill('200');
      await page.getByText('Gráficos de Planificación',{exact:true}).click();const graph=planner(page).getByRole('region',{name:'Previsión guardada, ejecución y última aprobación',exact:true});await graph.getByRole('table').waitFor();assert.match(await graph.getByRole('table').innerText(),/250,00.*200,00.*50,00/s);
      await planner(page).getByLabel('Mes de planificación',{exact:true}).fill('2026-09');await planner(page).getByRole('textbox',{name:'Previsto GASTO Comida ficticia',exact:true}).fill('220');await planner(page).getByRole('button',{name:'Guardar borrador',exact:true}).click();await planner(page).getByText('Borrador guardado.',{exact:true}).waitFor();assert.match(await operations(page).innerText(),/potencialmente desactualizado/);
      await operations(page).getByRole('button',{name:'Revisar este arrastre',exact:true}).click();await confirm(page);assert.doesNotMatch(await operations(page).innerText(),/potencialmente desactualizado/);
      await planner(page).getByLabel('Mes de planificación',{exact:true}).fill('2026-10');await planner(page).getByRole('button',{name:'Revisar y aprobar previsión',exact:true}).click();const review=page.getByRole('dialog',{name:'Revisar y aprobar previsión',exact:true});await review.getByRole('checkbox').check();await review.getByRole('button',{name:'Confirmar aprobación',exact:true}).click();await review.waitFor({state:'hidden'});const approved=(await data(page)).planningMonths.find((m:any)=>m.monthYear==='2026-10').approval;assert.equal(approved.carryLines[0].amountCents,5000);
      await operations(page).getByRole('button',{name:'Eliminar este arrastre',exact:true}).click();await confirm(page);assert.deepEqual((await data(page)).planningMonths.find((m:any)=>m.monthYear==='2026-10').approval,approved);assert.match(await planner(page).innerText(),/Modificada desde la última aprobación/);
    }finally{await s.close()}
  });
  await t.test('importación 2.9 con única aprobación n.º 2 preserva historia real y comparación',async()=>{
    let initial=initialData();initial=savePlanning(initial,'2028-02',lines,60000,planningScope(initial,'2028-02'),true);initial.planningMonths![0].approval!.number=2;
    const s=await setup(false,'dark',initial);const {page}=s;try{
      assert.equal((await data(page)).version,'2.9');const before=await snapshot(page);await operations(page).getByRole('button',{name:'Historial de aprobaciones',exact:true}).click();let history=page.getByRole('dialog',{name:'Historial de aprobaciones'});assert.match(await history.innerText(),/Aprobación n.º 2/);assert.doesNotMatch(await history.innerText(),/Aprobación n.º 1/);await page.keyboard.press('Escape');assert.deepEqual(await snapshot(page),before);
      await planner(page).getByRole('textbox',{name:'Previsto GASTO Comida ficticia',exact:true}).fill('2300');await planner(page).getByRole('button',{name:'Revisar y aprobar previsión',exact:true}).click();const review=page.getByRole('dialog',{name:'Revisar y aprobar previsión',exact:true});await review.getByRole('button',{name:'Confirmar aprobación',exact:true}).click();await review.waitFor({state:'hidden'});assert.equal((await data(page)).version,'3.0');assert.equal((await data(page)).planningAutomation.history[0].approvals[0].number,2);
      await operations(page).getByRole('button',{name:'Historial de aprobaciones',exact:true}).click();history=page.getByRole('dialog',{name:'Historial de aprobaciones'});assert.match(await history.innerText(),/Aprobación n.º 2.*Aprobación n.º 3/s);assert.match(await history.getByRole('table').innerText(),/2\.200,00.*2\.300,00.*100,00/s);
    }finally{await s.close()}
  });
  for(const failure of ['quota','recovery','verification','locks'] as const)await t.test(`confirmación ${failure} conserva modal, propuesta y datos; reintento exitoso`,async()=>{
    const s=await setup();const {page}=s;try{const before=(await snapshot(page))[DATA_KEY];await showCopy(page);
      await page.evaluate(({key,prefix,failure})=>{const set=Storage.prototype.setItem,get=Storage.prototype.getItem,request=navigator.locks.request.bind(navigator.locks);(window as any).failAutomation=true;Storage.prototype.setItem=function(k,v){if((window as any).failAutomation&&((failure==='quota'&&k===key)||(failure==='recovery'&&k.startsWith(prefix))))throw new DOMException('Cuota ficticia','QuotaExceededError');return set.call(this,k,v)};Storage.prototype.getItem=function(k){return (window as any).failAutomation&&failure==='verification'&&k.startsWith(prefix)?'{}':get.call(this,k)};navigator.locks.request=((...args:any[])=>{if((window as any).failAutomation&&failure==='locks')return Promise.reject(new Error('Web Locks denegado'));return (request as any)(...args)}) as typeof navigator.locks.request},{key:DATA_KEY,prefix:RECOVERY_PREFIX,failure});
      await preview(page).getByRole('button',{name:'Confirmar cambios de planificación',exact:true}).click();await preview(page).getByRole('alert').waitFor();assert.equal((await snapshot(page))[DATA_KEY],before);assert.equal(await preview(page).getByRole('table').locator('tbody tr').count(),6);
      await page.evaluate(()=>(window as any).failAutomation=false);await confirm(page);assert.equal((await data(page)).version,'3.0');
    }finally{await s.close()}
  });
  await t.test('dos pestañas rechazan preview obsoleta sin sobrescribir origen ni crear destino',async()=>{
    const s=await setup();const {page,context}=s;try{await showCopy(page);const other=await context.newPage();await other.goto(url);await nav(other,'Presupuestos');await planner(other).getByLabel('Mes de planificación',{exact:true}).fill('2028-02');await planner(other).getByRole('textbox',{name:'Previsto GASTO Comida ficticia',exact:true}).fill('2100');await planner(other).getByRole('button',{name:'Guardar borrador',exact:true}).click();await planner(other).getByText('Borrador guardado.',{exact:true}).waitFor();const latest=(await snapshot(other))[DATA_KEY];
      await preview(page).getByRole('button',{name:'Confirmar cambios de planificación',exact:true}).click();await preview(page).getByRole('alert').waitFor();assert.match(await preview(page).getByRole('alert').innerText(),/Otra pestaña/);assert.equal((await snapshot(page))[DATA_KEY],latest);assert.equal((await data(page)).budgetPlans.some((p:any)=>p.monthYear==='2028-03'),false);
    }finally{await s.close()}
  });
  await t.test('exportar/importar 3.0, cancelación, recovery anterior y limpieza selectiva completa',async()=>{
    const s=await setup();const {page}=s;try{
      await showCopy(page);await confirm(page);await addRule(page,'Regla para exportar','INGRESO:i','monthly');const initial=await data(page);await page.getByRole('button',{name:'Opciones y datos',exact:true}).click();const download=page.waitForEvent('download');await page.getByRole('button',{name:'Exportar JSON',exact:true}).click();const content=await readFile((await (await download).path())!,'utf8');assert.equal(JSON.parse(content).version,'3.0');
      await page.locator('input[type=file]').setInputFiles({name:'ficticio-3.0.json',mimeType:'application/json',buffer:Buffer.from(content)});let modal=page.getByRole('dialog');await modal.waitFor();assert.match(await modal.innerText(),/Formato 3.0/);await modal.getByRole('button',{name:'Cancelar',exact:true}).click();
      await page.getByRole('button',{name:'Opciones y datos',exact:true}).click();await page.getByRole('button',{name:'Limpiar todo (Borrar datos)',exact:true}).click();modal=page.getByRole('dialog',{name:'Borrar datos',exact:true});await modal.getByRole('button',{name:'Deseleccionar',exact:true}).click();await modal.getByRole('button',{name:'Borrar planes presupuestarios',exact:true}).click();await modal.getByRole('button',{name:/Borrar seleccionados/}).click();const clear=page.getByRole('dialog',{name:'Confirmar borrado seleccionado',exact:true});assert.match(await clear.innerText(),/Reglas de planificación a eliminar/);await clear.getByLabel('Escribe BORRAR para confirmar').fill('BORRAR');await clear.getByRole('button',{name:'Confirmar eliminación',exact:true}).click();await clear.waitFor({state:'hidden'});assert.equal((await data(page)).planningAutomation,undefined);assert.deepEqual((await data(page)).transactions,initial.transactions);
      await page.locator('input[type=file]').setInputFiles({name:'ficticio-3.0.json',mimeType:'application/json',buffer:Buffer.from(content)});modal=page.getByRole('dialog');await modal.getByRole('button',{name:'Confirmar sustitución',exact:true}).click();await modal.waitFor({state:'hidden'});assert.deepEqual((await data(page)).planningAutomation,initial.planningAutomation);
      const previous=await page.evaluate(prefix=>Object.entries(localStorage).filter(([key])=>key.startsWith(prefix)).map(([,value])=>JSON.parse(value)).find(v=>v.version==='2.9'),RECOVERY_PREFIX);assert.ok(previous);await page.locator('input[type=file]').setInputFiles({name:'copia-anterior-ficticia.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(previous))});modal=page.getByRole('dialog');await modal.getByRole('button',{name:'Confirmar sustitución',exact:true}).click();await modal.waitFor({state:'hidden'});assert.equal((await data(page)).planningAutomation,undefined);assert.equal((await data(page)).version,'2.9');
    }finally{await s.close()}
  });
});
