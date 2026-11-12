import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import path from 'node:path';
import {buildSync} from 'esbuild';
import {chromium} from 'playwright-core';
import {DATA_KEY,makeBackup} from '../src/utils/backup';
import {catalogArchiveFixture} from './catalogArchiveFixture';
import {navigateModule} from './browserNavigation';

// Test-only bundle exercises the actual domain/FinanceStore in Chromium. No production hook.
const probe=buildSync({stdin:{resolveDir:process.cwd(),contents:`
  import {demoParent} from './scripts/budgetSubitemFixture';
  import {FinanceStore,browserExclusiveWrite} from './src/utils/financeStore';
  import {DATA_KEY,parseSnapshot} from './src/utils/backup';
  import {catalogArchiveImpact,catalogEntry,editCatalog} from './src/utils/budgetCatalog';
  globalThis.runArchiveProbe=async(mode,kind='partida')=>{
    const initial=parseSnapshot(localStorage.getItem(DATA_KEY)),parent=demoParent;
    const target=kind==='familia'?{kind:'archiveFamily',code:catalogEntry(initial,parent).group.code}:{kind:'archivePartida',parent};
    let release;const gate=new Promise(r=>release=r);
    const store=new FinanceStore(localStorage,initial,mode==='queued'?async write=>{await gate;return browserExclusiveWrite(write)}:browserExclusiveWrite);
    const raw=()=>localStorage.getItem(DATA_KEY);
    const attempt=async action=>{const before=raw();try{await action();return {rejected:false,unchanged:raw()===before}}catch(e){return {rejected:true,error:e.message,unchanged:raw()===before}}};
    if(mode==='queued'){
      const scope=catalogArchiveImpact(store.data,target).scope;
      const first=store.mutate(d=>({...d,planningAutomation:{...d.planningAutomation,rules:d.planningAutomation.rules.map(r=>r.id==='active'?{...r,amountCents:r.amountCents+1}:r)}}));
      const second=store.mutate({catalog:{...target,archived:true,scope}}).then(()=>null,e=>e.message);
      release();await first;const afterFirst=raw(),error=await second;
      return {error,unchanged:raw()===afterFirst,archived:!!catalogEntry(store.data,parent)[kind==='familia'?'group':'item'].archived};
    }
    const change=d=>({...d,budgetPlans:d.budgetPlans.map(p=>p.code===parent.code?{...p,plannedAmount:p.plannedAmount+1}:p),budgetSubitems:d.budgetSubitems?{...d.budgetSubitems,months:d.budgetSubitems.months.map(m=>({...m,lines:m.lines.map((l,i)=>({...l,amountCents:l.amountCents+(i===0?100:0)}))}))}:undefined});
    const results=[await attempt(()=>store.mutate(change)),await attempt(()=>store.update('budgetPlans',p=>p.filter(p=>p.code!==parent.code))),await attempt(()=>store.mutate(d=>change(editCatalog(d,{...target,archived:false}))))];
    if(store.data.budgetSubitems?.months.length){
      results.push(await attempt(()=>store.update('budgetSubitems',s=>({...s,months:s.months.map(m=>({...m,lines:m.lines.map((l,i)=>({...l,amountCents:l.amountCents+(i===0?100:-100)}))}))}))));
      results.push(await attempt(()=>store.update('budgetSubitems',s=>({...s,months:[]}))));
    }
    return results;
  };
`},bundle:true,write:false,platform:'browser',format:'iife',target:'es2022'}).outputFiles[0].text;

test('Revisión PR #22: archivo económico y confirmación de reglas activas',{timeout:240000},async t=>{
  const app=express();app.use(express.static(path.resolve('dist')));app.get('*',(_q,r)=>r.sendFile(path.resolve('dist/index.html')));
  const server=await new Promise<ReturnType<typeof app.listen>>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise<void>(r=>server.close(()=>r())));
  const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`,browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
  async function setup(width:number,monthly=true){
    const c=await browser.newContext({viewport:{width,height:950},isMobile:width<768,hasTouch:width<768,locale:'es-ES',timezoneId:'Europe/Madrid',serviceWorkers:'block'}),errors:string[]=[],external:string[]=[];
    await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(external.push(r.request().url()),r.abort()));
    await c.addInitScript(({key,value})=>{(window as any).__name=(fn:unknown)=>fn;if(localStorage.getItem(key)===null)localStorage.setItem(key,value);},{key:DATA_KEY,value:JSON.stringify(makeBackup(catalogArchiveFixture(monthly)))});
    const p=await c.newPage();p.setDefaultTimeout(7000);p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});await p.clock.setFixedTime(new Date('2026-11-11T12:00:00Z'));await p.goto(origin+'/app');
    await navigateModule(p,'Presupuestos');await p.getByRole('tab',{name:'Catálogo y detalle de partidas',exact:true}).click();await p.locator('.catalog-manager > summary').click();
    await p.addScriptTag({content:probe});
    return {p,c,close:async()=>{await c.close();assert.deepEqual(errors,[]);assert.deepEqual(external,[]);}};
  }
  for(const width of [390,1280])for(const kind of ['partida','familia'])for(const monthly of [false,true])await t.test(`${width}px ${kind} desglose=${monthly}: revisar, cancelar, confirmar, proteger importes y reactivar`,async()=>{
    const s=await setup(width,monthly),{p}=s;try{
      const name=kind==='familia'?'Gastos ficticios':'Ocio ficticio',raw=()=>p.evaluate(k=>localStorage.getItem(k),DATA_KEY),original=JSON.parse((await raw())!);
      const archive=p.getByRole('button',{name:`Archivar ${kind} ${name}`,exact:true}),dialog=p.getByRole('dialog',{name:'Confirmar archivo con reglas activas',exact:true});
      const before=await raw();await archive.click();await dialog.waitFor();assert.equal(await raw(),before);
      const text=await dialog.innerText();assert.match(text,/Periódico afectado/);assert.match(text,/Automatización afectada/);assert.match(text,/sin borrarlas, desactivarlas ni reasignarlas/);assert.match(text,/solo lectura/);assert.doesNotMatch(text,/inactivo|inactiva|retirado|Ahorro independiente/);
      assert.equal(await dialog.locator('li').count(),kind==='familia'?4:2);
      await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();assert.equal(await raw(),before);
      await archive.click();await p.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await raw(),before);
      await archive.click();await dialog.getByRole('button',{name:'Confirmar archivo',exact:true}).click();await dialog.waitFor({state:'hidden'});await p.getByRole('button',{name:`Reactivar ${kind} ${name}`,exact:true}).waitFor();
      const archived=JSON.parse((await raw())!);for(const field of ['transactions','budgetPlans','budgetSubitems','planningAutomation','intelligentFinance'])assert.deepEqual(archived[field],original[field]);
      const results=await p.evaluate(kind=>(globalThis as any).runArchiveProbe('economics',kind),kind);for(const result of results){assert.equal(result.rejected,true);assert.equal(result.unchanged,true);assert.match(result.error,/solo lectura/);}
      await p.getByRole('button',{name:`Reactivar ${kind} ${name}`,exact:true}).click();await archive.waitFor();const active=JSON.parse((await raw())!);for(const field of ['transactions','budgetPlans','budgetSubitems','planningAutomation','intelligentFinance'])assert.deepEqual(active[field],original[field]);
      assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);
    }finally{await s.close();}
  });
  await t.test('alcance obsoleto: dos mutaciones del mismo FinanceStore en cola bajo Web Locks',async()=>{
    for(const kind of ['partida','familia']){const s=await setup(1280);try{const result=await s.p.evaluate(kind=>(globalThis as any).runArchiveProbe('queued',kind),kind);assert.match(result.error,/alcance.*cambiado/);assert.equal(result.unchanged,true);assert.equal(result.archived,false);}finally{await s.close();}}
  });
  await t.test('otra pestaña cambia una regla durante la revisión: la confirmación conserva estado y muestra conflicto',async()=>{
    const s=await setup(390),{p,c}=s;try{
      const before=await p.evaluate(k=>localStorage.getItem(k),DATA_KEY);await p.getByRole('button',{name:'Archivar familia Gastos ficticios',exact:true}).click();const dialog=p.getByRole('dialog',{name:'Confirmar archivo con reglas activas',exact:true});await dialog.waitFor();
      const other=await c.newPage();await other.goto(origin+'/app');await other.addScriptTag({content:probe});await other.evaluate(()=>(globalThis as any).runArchiveProbe('queued','partida'));const updated=await other.evaluate(k=>localStorage.getItem(k),DATA_KEY);assert.notEqual(updated,before);
      await dialog.getByRole('button',{name:'Confirmar archivo',exact:true}).click();await dialog.getByRole('alert').waitFor();assert.match(await dialog.getByRole('alert').innerText(),/pestaña|actualizad|recarg/i);assert.equal(await p.evaluate(k=>localStorage.getItem(k),DATA_KEY),updated);assert.equal(await dialog.isVisible(),true);await dialog.getByRole('button',{name:'Cancelar',exact:true}).click();
    }finally{await s.close();}
  });
});
