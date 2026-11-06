import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import { chromium, type Page } from 'playwright-core';
import { DATA_KEY, makeBackup } from '../src/utils/backup';
import { chartFixture } from './chartFixture';
import { planningScope, savePlanning } from '../src/utils/planning';

const nav=(page:Page,name:string)=>page.getByRole('button',{name:new RegExp('^(?:\\d+\\s*)?'+name+'(?:\\s*\\d+)?$')}).first().click();
const allStorage=(page:Page)=>page.evaluate(()=>Object.fromEntries(Object.entries(localStorage)));
const panel=(page:Page)=>page.locator('details.financial-charts:visible');
const chart=(page:Page,name:string)=>panel(page).getByRole('region',{name,exact:true});
async function open(page:Page,name:string) { await page.getByText(name,{exact:true}).click(); await panel(page).getByRole('combobox').first().waitFor(); }

test('Gráficos financieros locales: interacción, contabilidad y solo lectura', {timeout:180000},async t=>{
  const listener=createServer();await new Promise<void>(r=>listener.listen(0,'127.0.0.1',r));const port=(listener.address() as {port:number}).port;await new Promise<void>(r=>listener.close(()=>r()));
  const server=spawn(process.execPath,['--import','tsx','server.ts'],{env:{...process.env,PORT:String(port),NODE_ENV:'production'},stdio:'pipe'});let log='';server.stdout.on('data',c=>log+=c);server.stderr.on('data',c=>log+=c);t.after(()=>{server.kill()});
  const url=`http://127.0.0.1:${port}`;let ready=false;for(let i=0;i<100;i++){if(server.exitCode!==null)throw new Error(log);try{if((await fetch(url)).ok){ready=true;break}}catch{}await new Promise(r=>setTimeout(r,100))}assert.ok(ready,log);
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
  async function setup(mobile=false,theme:'dark'|'light'='dark',initial=chartFixture()) {
    const context=await browser.newContext({viewport:mobile?{width:390,height:844}:{width:1280,height:1000},isMobile:mobile,hasTouch:mobile});
    await context.route('**/*',route=>new URL(route.request().url()).origin===url?route.continue():route.abort());
    await context.addInitScript(({key,value})=>{if(localStorage.getItem(key)===null)localStorage.setItem(key,value)},{key:DATA_KEY,value:JSON.stringify(makeBackup({...initial,theme}))});
    const page=await context.newPage();page.setDefaultTimeout(7000);const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.goto(url);
    const external:string[]=[];page.on('request',request=>{if(new URL(request.url()).origin!==url)external.push(request.url())});
    return {page,close:async()=>{await context.close();assert.deepEqual(errors,[]);assert.deepEqual(external,[],'los gráficos no añaden peticiones externas')}};
  }
  for(const mobile of [false,true])for(const theme of ['dark','light'] as const)await t.test(`cuatro módulos, clic/tap, tablas y filtros sin guardar: ${mobile?'390px':'escritorio'}, ${theme}`,async()=>{
    const s=await setup(mobile,theme);const {page}=s;try{
      const before=await allStorage(page);await open(page,'Gráficos de Inicio');
      const income=chart(page,'Ingresos y gastos reales por periodo');
      const table=income.getByRole('table');const october=table.getByRole('row').filter({has:page.getByRole('rowheader',{name:'2026-10',exact:true})});
      assert.match(await october.innerText(),/3\.000,00.*15,00/s);
      const distribution=chart(page,'Distribución del gasto económico');assert.match(await distribution.getByRole('table').innerText(),/15,00.*100\.0/s);
      const slice=distribution.locator('svg [data-chart-point]').first();await slice.evaluate(el=>el.scrollIntoView({block:'center'}));const box=(await slice.boundingBox())!;const position={x:box.width*.9,y:box.height*.5};if(mobile)await slice.tap({position});else await slice.click({position});
      assert.match(await distribution.locator('.chart-readout').innerText(),/15,00/);
      if(process.env.CHART_ARTIFACT_DIR)await page.screenshot({path:`${process.env.CHART_ARTIFACT_DIR}/home-${mobile?'mobile':'desktop'}-${theme}.png`});
      assert.match(await panel(page).getByRole('region',{name:'Detalle económico seleccionado'}).innerText(),/Cena ficticia.*15,00.*60,00/s);
      await income.getByRole('combobox',{name:'Seleccionar dato: Ingresos y gastos reales por periodo',exact:true}).selectOption('2026-10-01');
      await panel(page).getByRole('button',{name:'Ver este análisis en Movimientos'}).click();
      await panel(page).getByLabel('Desde (gráficos)',{exact:true}).waitFor();assert.equal(await panel(page).getByLabel('Desde (gráficos)',{exact:true}).inputValue(),'2026-10-01');
      await panel(page).getByLabel('Estado económico').selectOption('pending');assert.match(await panel(page).innerText(),/no son ejecución ni saldo/);assert.match(await chart(page,'Ingresos y gastos pendientes por periodo').getByRole('table').innerText(),/999,00/);
      await panel(page).getByLabel('Estado económico').selectOption('processed');await panel(page).getByLabel('Familia de gráficos').selectOption('GASTO:G');assert.match(await chart(page,'Ingresos y gastos reales por periodo').getByRole('table').innerText(),/15,00/);
      await panel(page).getByLabel('Granularidad de gráficos').selectOption('week');assert.match(await chart(page,'Ingresos y gastos reales por periodo').getByRole('table').innerText(),/Semana/);
      await nav(page,'Presupuestos');await open(page,'Gráficos de Planificación');assert.match(await panel(page).innerText(),/Sin plan/);
      const annual=chart(page,'Evolución anual de planificación');assert.equal(await annual.getByRole('table').locator('tbody tr').count(),12);assert.match(await annual.getByRole('table').innerText(),/Sin plan/);
      if(process.env.CHART_ARTIFACT_DIR){await annual.locator('svg').scrollIntoViewIfNeeded();await page.screenshot({path:`${process.env.CHART_ARTIFACT_DIR}/planning-${mobile?'mobile':'desktop'}-${theme}.png`})}
      await panel(page).getByLabel('Mes del gráfico de planificación').fill('2030-01');assert.match(await panel(page).innerText(),/Sin plan/);
      await page.getByRole('tab',{name:'Catálogo y detalle de partidas',exact:true}).click();assert.equal(await page.getByText('Gráficos de Planificación',{exact:true}).isVisible(),false);
      await nav(page,'Cuentas');await open(page,'Gráficos de Cuentas');const balances=chart(page,'Comparación de saldos actuales');assert.match(await balances.getByRole('table').innerText(),/BANCO.*3\.925,00/s);assert.match(await balances.getByRole('table').innerText(),/NEGATIVA.*-50,00/s);
      assert.equal(await balances.getByRole('combobox',{name:'Tipo de gráfico: Comparación de saldos actuales'}).getByRole('option',{name:'Anillo',exact:true}).count(),0);
      assert.match(await panel(page).innerText(),/no tienen fecha de referencia/);await panel(page).getByLabel('Cartera de gráficos').selectOption('OTRA');assert.match(await chart(page,'Variación bancaria acumulada registrada (no saldo histórico)').getByRole('table').innerText(),/25,00/);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
      assert.deepEqual(await allStorage(page),before);
      if(process.env.CHART_ARTIFACT_DIR){await chart(page,'Variación bancaria acumulada registrada (no saldo histórico)').locator('svg').scrollIntoViewIfNeeded();await page.screenshot({path:`${process.env.CHART_ARTIFACT_DIR}/wallets-${mobile?'mobile':'desktop'}-${theme}.png`})}
    }finally{await s.close()}
  });
  await t.test('teclado, leyenda, tipo y periodos inválidos/vacíos mantienen almacenamiento intacto',async()=>{
    const s=await setup();const {page}=s;try{
      const before=await allStorage(page);await open(page,'Gráficos de Inicio');const c=chart(page,'Ingresos y gastos reales por periodo');
      await c.getByLabel('Tipo de gráfico: Ingresos y gastos reales por periodo',{exact:true}).selectOption('line');
      const point=c.locator('svg [data-chart-point]').first();await point.focus();await page.keyboard.press('End');await page.keyboard.press('Enter');assert.match(await c.locator('.chart-readout').innerText(),/2026-10/);
      await c.getByRole('checkbox',{name:'Gastos económicos',exact:true}).uncheck();assert.equal(await c.getByRole('columnheader',{name:'Gastos económicos',exact:true}).count(),0);
      await c.getByRole('checkbox',{name:'Ingresos económicos',exact:true}).uncheck();assert.match(await c.innerText(),/Activa una serie/);
      await panel(page).getByLabel('Desde (gráficos)',{exact:true}).fill('2030-01-01');assert.match(await panel(page).getByRole('alert').innerText(),/rango/);
      await panel(page).getByLabel('Hasta (gráficos)',{exact:true}).fill('2030-01-31');assert.match(await panel(page).innerText(),/Sin datos/);
      assert.deepEqual(await allStorage(page),before);
    }finally{await s.close()}
  });
  await t.test('plan aprobado vs modificado, huecos y borrador local no guardado',async()=>{
    let initial=chartFixture();initial=savePlanning(initial,'2026-10',[{type:'INGRESO',code:'i',amountCents:300000},{type:'GASTO',code:'g',amountCents:220000}],60000,planningScope(initial,'2026-10'),true);
    initial=savePlanning(initial,'2026-10',[{type:'GASTO',code:'g',amountCents:230000}],60000,planningScope(initial,'2026-10'));
    const s=await setup(false,'dark',initial);const {page}=s;try{
      await nav(page,'Presupuestos');const before=await allStorage(page);await open(page,'Gráficos de Planificación');assert.match(await panel(page).innerText(),/Modificada desde la última aprobación/);
      const c=chart(page,'Previsión guardada, ejecución y última aprobación');assert.match(await c.getByRole('table').innerText(),/Gasto.*2\.300,00.*15,00.*2\.200,00/s);
      await page.getByRole('textbox',{name:'Previsto GASTO Comida ficticia',exact:true}).fill('999');await panel(page).getByLabel('Agrupar comparación').selectOption('partida');assert.match(await c.getByRole('table').innerText(),/2\.300,00/);
      await chart(page,'Evolución anual de planificación').getByRole('combobox',{name:'Seleccionar dato: Evolución anual de planificación',exact:true}).selectOption('2026-01');assert.match(await panel(page).innerText(),/Estado de la previsión guardada: Sin plan/);
      await page.getByRole('tab',{name:'Catálogo y detalle de partidas',exact:true}).click();await page.getByRole('dialog',{name:'Cambios de planificación sin guardar'}).getByRole('button',{name:'Seguir editando'}).click();assert.equal(await page.getByRole('textbox',{name:'Previsto GASTO Comida ficticia',exact:true}).inputValue(),'999');
      assert.deepEqual(await allStorage(page),before);
    }finally{await s.close()}
  });
  await t.test('cartera sin movimientos y contexto vacío no crean historia ni planes',async()=>{
    const initial=chartFixture();initial.transactions=[];const s=await setup(false,'light',initial);const {page}=s;try{const before=await allStorage(page);await nav(page,'Cuentas');await open(page,'Gráficos de Cuentas');assert.match(await panel(page).innerText(),/Sin datos/);assert.match(await chart(page,'Comparación de saldos actuales').getByRole('table').innerText(),/NEGATIVA.*-50,00/s);assert.deepEqual(await allStorage(page),before)}finally{await s.close()}
  });
});
