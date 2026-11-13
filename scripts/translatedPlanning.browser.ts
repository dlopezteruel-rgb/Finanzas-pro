import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import path from 'node:path';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {chromium} from 'playwright-core';
import {DATA_KEY,makeBackup,type FinanceData} from '../src/utils/backup';
import {LANGUAGE_KEY,languages,translatorFor,type Language} from '../src/i18n';
import {i18nTestBuild} from './i18n/preview';

const synthetic:FinanceData={theme:'dark',transactions:[],budgetPlans:[],contacts:[],loans:[],wallets:[{id:'test-bank',name:'CUENTA NO TRADUCIR',type:'BANK',initialBalance:1234.56,color:'#ffffff'}],budgetGroups:[
 {code:'I',name:'FAMILIA INGRESOS PERSONAL',type:'INGRESO',partidas:[{code:'i',name:'SUELDO NO TRADUCIR',groupCode:'I',groupName:'FAMILIA INGRESOS PERSONAL',type:'INGRESO',keywords:[]}]},
 {code:'G',name:'FAMILIA GASTOS PERSONAL',type:'GASTO',partidas:[{code:'g',name:'GASTO NO TRADUCIR',groupCode:'G',groupName:'FAMILIA GASTOS PERSONAL',type:'GASTO',keywords:[]}]},
]};

test('5B planificación: cinco idiomas previstos, 390/768/1280 px y dos temas; no certifica cobertura integral',{timeout:300000},async t=>{
 const bundle=await i18nTestBuild();t.after(bundle.dispose);
 const app=express();app.use(express.static(bundle.dist));app.get('*',(_q,r)=>r.sendFile(path.join(bundle.dist,'index.html')));
 const server=await new Promise<ReturnType<typeof app.listen>>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise<void>(r=>server.close(()=>r())));
 const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
 const observations:any[]=[];const axe=await readFile('node_modules/axe-core/axe.min.js','utf8');
 const dir=path.resolve(process.env.CI_ARTIFACT_DIR??'ci-artifacts','browser');await mkdir(dir,{recursive:true});
 t.after(async()=>{await writeFile(path.join(dir,'translated-planning.json'),JSON.stringify({isolatedPreview:bundle.preview,productionAvailability:bundle.availability,scope:'Planning labels, deficit approval, canonical inputs, persistence and keyboard; utility error translations, automation, subitems and full UI readiness still pending',observations},null,2)+'\n');});
 for(const language of Object.keys(languages) as Language[])for(const width of [390,768,1280])for(const theme of ['light','dark'] as const)await t.test(`${language}, ${width}px, ${theme}: borrador y aprobación deficitaria sin alterar datos`,async()=>{
  const backup=makeBackup({...synthetic,theme}),c=await browser.newContext({viewport:{width,height:1000},locale:'de-DE',timezoneId:'Europe/Madrid',serviceWorkers:'block',hasTouch:width===390,isMobile:width===390});
  try{
   const external:string[]=[],errors:string[]=[];
   await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():(external.push(r.request().url()),r.abort()));
   await c.addInitScript(({key,value,preference,language})=>{(window as any).__name=(fn:unknown)=>fn;if(!localStorage.getItem(key))localStorage.setItem(key,value);if(!localStorage.getItem(preference))localStorage.setItem(preference,language);},{key:DATA_KEY,value:JSON.stringify(backup),preference:LANGUAGE_KEY,language});
   const p=await c.newPage();p.setDefaultTimeout(8000);p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/app');const tr=translatorFor(language);
   await p.getByRole('navigation',{name:tr('nav.label')}).filter({visible:true}).getByRole('button',{name:tr('nav.budgets'),exact:true}).click();
   const editor=p.getByRole('region',{name:tr('planning.planificacion_financiera'),exact:true});await editor.getByLabel(tr('planning.mes_de_planificacion_358662'),{exact:true}).fill('2028-02');
   const before=await p.evaluate(k=>localStorage.getItem(k),DATA_KEY);
   await p.evaluate(key=>{(window as any).__financialWrites=0;const original=Storage.prototype.setItem;Storage.prototype.setItem=function(k,v){if(k===key)(window as any).__financialWrites++;return original.call(this,k,v);};},DATA_KEY);
   await editor.getByRole('tab',{name:tr('planning.ingresos'),exact:true}).click();
   const incomeName=tr('planning.previsto',{type:tr('planning.incomeType'),name:'SUELDO NO TRADUCIR'});
   await editor.getByRole('textbox',{name:incomeName,exact:true}).fill('3000.01');
   await editor.getByRole('tab',{name:tr('planning.gastos'),exact:true}).click();
   const expense=editor.getByRole('textbox',{name:tr('planning.previsto',{type:tr('planning.expenseType'),name:'GASTO NO TRADUCIR'}),exact:true});
   await expense.fill('1000');await editor.getByRole('textbox',{name:tr('planning.ahorro_objetivo_a54274'),exact:true}).fill('2500');
   await editor.getByText(tr('planning.advertencia_deficit_de_asignacion_o_ahorro_objetivo_superior_a'),{exact:true}).waitFor();
   assert.equal(await p.evaluate(k=>localStorage.getItem(k),DATA_KEY),before);assert.equal(await p.evaluate(()=>(window as any).__financialWrites),0);
   await p.addScriptTag({content:axe});
   async function inspect(surface:string){const result=await p.evaluate(async()=>{const r=await (window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return{violations:r.violations,incomplete:r.incomplete.map((v:any)=>({id:v.id,nodes:v.nodes.length}))};});observations.push({language,width,theme,surface,...result});assert.deepEqual(result.violations,[]);assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);}
   const labelClearance=await editor.getByRole('textbox',{name:tr('planning.ahorro_objetivo_a54274'),exact:true}).evaluate(el=>{
    const range=document.createRange();range.selectNode(el.parentElement!.firstChild!);
    const text=range.getBoundingClientRect(),field=el.getBoundingClientRect();
    return text.right+7.5<=field.left||field.right+7.5<=text.left||text.bottom+7.5<=field.top||field.bottom+7.5<=text.top;
   });assert.equal(labelClearance,true,'The focus outline must not obscure the translated savings label');
   await inspect('planning-deficit-draft');
   if((width===390&&theme==='light')||(width===1280&&theme==='dark'))await p.screenshot({path:path.join(dir,`planning-preview-${language}-${width}-${theme}.png`),fullPage:true});
   const opener=editor.getByRole('button',{name:tr('planning.revisar_y_aprobar_prevision'),exact:true});const handle=await opener.elementHandle();await opener.click();
   const dialog=p.getByRole('dialog',{name:tr('planning.revisar_y_aprobar_prevision'),exact:true});await dialog.waitFor();
   const confirm=dialog.getByRole('button',{name:tr('planning.confirmar_aprobacion'),exact:true});assert.equal(await confirm.isDisabled(),true);
   await dialog.getByRole('checkbox',{name:tr('planning.acepto_aprobar_conscientemente_esta_prevision_con_deficit').trim(),exact:true}).check();assert.equal(await confirm.isEnabled(),true);
   await inspect('explicit-deficit-approval');
   for(let step=0;step<4;step++){await p.keyboard.press(step%2?'Shift+Tab':'Tab');assert.equal(await dialog.evaluate(el=>el.contains(document.activeElement)),true);}
   await p.keyboard.press('Escape');await dialog.waitFor({state:'hidden'});assert.equal(await handle!.evaluate(el=>el===document.activeElement),true);assert.equal(await expense.inputValue(),'1000');assert.equal(await p.evaluate(k=>localStorage.getItem(k),DATA_KEY),before);
   await opener.click();await dialog.getByRole('checkbox').check();await dialog.getByRole('button',{name:tr('planning.confirmar_aprobacion'),exact:true}).click();await dialog.waitFor({state:'hidden'});
   const saved=JSON.parse((await p.evaluate(k=>localStorage.getItem(k),DATA_KEY))!);const approval=saved.planningMonths.find((m:any)=>m.monthYear==='2028-02').approval;
   assert.equal(approval.totals.income,300001);assert.equal(approval.totals.expenses,100000);assert.equal(approval.totals.savings,250000);assert.equal(approval.number,1);
   assert.deepEqual(saved.transactions,backup.transactions);assert.deepEqual(saved.wallets,backup.wallets);assert.deepEqual(saved.budgetGroups,backup.budgetGroups);assert.equal(await p.evaluate(()=>(window as any).__financialWrites),1);
   await p.reload();await p.getByRole('navigation',{name:tr('nav.label')}).filter({visible:true}).getByRole('button',{name:tr('nav.budgets'),exact:true}).click();await editor.getByLabel(tr('planning.mes_de_planificacion_358662'),{exact:true}).fill('2028-02');await editor.getByText(tr('planning.approvedNotice'),{exact:true}).waitFor({state:'hidden'});
   assert.ok((await editor.locator('[role=status]').allTextContents()).some(value=>value===tr('planning.approvedStatus')));assert.equal(JSON.parse((await p.evaluate(k=>localStorage.getItem(k),DATA_KEY))!).planningMonths.find((m:any)=>m.monthYear==='2028-02').approval.number,1);
   assert.deepEqual(errors,[]);assert.deepEqual(external,[]);
  }finally{await c.close();}
 });
});
