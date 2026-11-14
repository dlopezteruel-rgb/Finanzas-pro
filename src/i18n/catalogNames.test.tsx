import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {I18nProvider,languages,translatorFor,dictionaries,type Language} from './index';
import {CatalogNamesProvider,catalogPresentation,catalogNamesDiagnostic} from './catalogNames';
import {catalogNameKeys} from './catalogKeys';
import {BUDGET_GROUPS} from '../constants/categories';
import {systemCatalogNames,defaultSubgroups} from '../utils/catalogNames';
import {editCatalog} from '../utils/budgetCatalog';
import {DATA_KEY,makeBackup,parseBackup,type FinanceData} from '../utils/backup';
import {calculateWalletBalances} from '../utils/finance';
import {planningBudgetRows} from '../utils/planningBasis';
import {planningChartData} from '../utils/chartData';
import {planningComparisonForDisplay,chartFamilyForDisplay} from './chartMessages';
import {PartidaSelector} from '../components/PartidaSelector';
import {CatalogManager} from '../components/CatalogManager';
import {TransactionsView} from '../components/TransactionsView';
import {storageOwnedText,backupWarningText} from './storageMessages';
import {assistantItemName} from './labels';
import {budgetSubitemFixture} from '../../scripts/budgetSubitemFixture';

const fixture=():FinanceData=>({...budgetSubitemFixture(true,true),budgetGroups:structuredClone(BUDGET_GROUPS),catalogNames:systemCatalogNames()});
for(const language of Object.keys(languages) as Language[]){
 test(`5D ${language}: la etiqueta documental personal conserva todos sus dos puntos y caracteres de código`,()=>{
  const data=fixture(),tx={...data.transactions[0],subcategoryName:'F.001.001 · Nombre personal: primera parte: segunda parte'},before=JSON.stringify(tx),noop=()=>{};
  const html=renderToStaticMarkup(<I18nProvider requested={language}><TransactionsView transactions={[tx]} onToggleProcessed={noop} onDeleteTransaction={noop} onEditTransaction={noop} onOpenNewTransaction={noop}/></I18nProvider>);
  assert.ok(html.includes(tx.subcategoryName));assert.equal(JSON.stringify(tx),before);
 });
 test(`5D ${language}: las 120 identidades tienen claves explícitas, traducciones y fallback tipados`,()=>{
  const data=fixture(),before=JSON.stringify(data),t=translatorFor(language),view=catalogPresentation(data,t);
  assert.equal(Object.values(catalogNameKeys).reduce((n,keys)=>n+Object.keys(keys).length,0),120);
  for(const g of data.budgetGroups){assert.equal(view.family(g),dictionaries[language]![catalogNameKeys.family[g.code as keyof typeof catalogNameKeys.family]]);for(const p of g.partidas){const key=`${p.type}:${p.code}` as keyof typeof catalogNameKeys.item;assert.equal(view.item(p),dictionaries[language]![catalogNameKeys.item[key]]);assert.equal(view.itemRef(p.type,p.code),view.item(p));if(language!=='es'&&p.code==='F.001.001')assert.notEqual(view.item(p),p.name);}}
  for(const original of defaultSubgroups.values()){const p=data.budgetGroups.flatMap(g=>g.partidas).find(p=>p.type===original.type&&p.groupCode===original.code)!;assert.equal(view.subgroup(p),dictionaries[language]![catalogNameKeys.subgroup[`${p.type}:${p.groupCode}` as keyof typeof catalogNameKeys.subgroup]]);}
  assert.equal(view.itemRef('GASTO','absent'),t('partida_selector.partida_historica_fuera_del_catalogo'));assert.equal(view.itemRef('GASTO','absent','Texto personal F.001.001'),'Texto personal F.001.001');assert.equal(JSON.stringify(data),before);
 });
 test(`5D ${language}: nombres personales, importados y renombrados permanecen literales`,()=>{
  const data=fixture(),p=data.budgetGroups.find(g=>g.code==='F_EXP')!.partidas[0];
  const renamed=editCatalog(editCatalog(data,{kind:'renameFamily',code:'F_EXP',name:'F.001.001 · mi casa {name}'}),{kind:'updatePartida',parent:p,name:'F.001.001',description:'Privada',keywords:[],personalizeName:true}),view=catalogPresentation(renamed,translatorFor(language));
  assert.equal(view.family(renamed.budgetGroups.find(g=>g.code==='F_EXP')!),'F.001.001 · mi casa {name}');assert.equal(view.itemRef(p.type,p.code),'F.001.001');
  const ambiguous={...data,catalogNames:undefined},legacy=catalogPresentation(ambiguous,translatorFor(language));for(const g of ambiguous.budgetGroups){assert.equal(legacy.family(g),g.name);for(const p of g.partidas){assert.equal(legacy.item(p),p.name);assert.equal(legacy.subgroup(p),p.groupName);}}
  const sameSpelling=editCatalog(data,{kind:'updatePartida',parent:p,name:p.name,description:'',keywords:[],personalizeName:true});assert.equal(catalogPresentation(sameSpelling,translatorFor(language)).itemRef(p.type,p.code),p.name);
 });
 test(`5D ${language}: catálogo, selector, gráficos y asistente usan presentación sin alterar finanzas`,()=>{
  const data=fixture(),before=JSON.stringify(data),rawBalances=calculateWalletBalances(data.wallets,data.transactions),rawRows=planningBudgetRows(data,'2026-11',data.budgetGroups.flatMap(g=>g.partidas)),rawCharts=planningChartData(data,'2026-11','partida'),t=translatorFor(language),view=catalogPresentation(data,t),g=data.budgetGroups.find(g=>g.code==='F_EXP')!,p=g.partidas[0];
  const html=renderToStaticMarkup(<I18nProvider requested={language}><CatalogNamesProvider value={data}><CatalogManager data={data} onEdit={async()=>({ok:true})}/><PartidaSelector groups={data.budgetGroups} transactions={data.transactions} type={p.type} value={p.code} onChange={()=>{throw Error('Rendering must not select');}}/></CatalogNamesProvider></I18nProvider>);
  assert.ok(html.includes(view.family(g)));assert.ok(html.includes(view.item(p)));assert.ok(!html.includes(`>${p.code}<`));assert.ok(!html.includes(`>${g.code}<`));
  assert.equal(chartFamilyForDisplay({id:`${g.type}:${g.code}`,label:g.name},t,data).label,view.family(g));
  const displayCharts=planningComparisonForDisplay(rawCharts.comparison,data,t);assert.deepEqual(displayCharts.map(r=>[r.id,r.values]),rawCharts.comparison.map(r=>[r.id,r.values]));assert.equal(assistantItemName(p,data,t,String),view.item(p));
  assert.deepEqual(calculateWalletBalances(data.wallets,data.transactions),rawBalances);assert.deepEqual(planningBudgetRows(data,'2026-11',data.budgetGroups.flatMap(g=>g.partidas)),rawRows);assert.equal(JSON.stringify(data),before);assert.deepEqual(parseBackup(JSON.stringify(makeBackup(data))).catalogNames,data.catalogNames);
 });
 test(`5D ${language}: diagnósticos y JSON 3.5 nativos sin exponer códigos`,()=>{
  const t=translatorFor(language);assert.equal(storageOwnedText('Nombres del catálogo: selección inválida.',t),t('catalog.names.invalidSelection'));assert.equal(catalogNamesDiagnostic('Nombres del catálogo: el catálogo ha cambiado. Vuelve a revisar los nombres antes de confirmar.',t),t('catalog.names.staleReview'));
  assert.equal(backupWarningText('JSON 3.5: nombres de catálogo de sistema elegidos explícitamente. Las copias anteriores conservan sus nombres; utiliza la copia recuperable previa para volver atrás.',language,t),t('catalog.names.backup35'));assert.equal(catalogNamesDiagnostic('Mi F.001.001',t),undefined);
  const data=fixture(),rows=planningComparisonForDisplay([{id:'GASTO:SECRET-CODE',label:'GASTO · Fotografía SECRET-CODE',values:{approved:12}},{id:'GASTO:orphan',label:'Gasto · Partida orphan',values:{planned:10}}],{...data,budgetPlans:[...data.budgetPlans,{monthYear:'2026-11',type:'GASTO',code:'orphan',plannedAmount:10}]},t);assert.ok(rows.every(r=>!r.label.includes('SECRET-CODE')&&!r.label.includes('orphan')));assert.deepEqual(rows.map(r=>r.values),[{approved:12},{planned:10}]);
 });
}
test('5D: cambiar presentación repetidamente nunca escribe claves de datos ni transforma fechas, céntimos o fotografías',()=>{
 const data=fixture(),before=JSON.stringify(data),backup=JSON.stringify(makeBackup(data));
 // The resolver has no storage argument or side effects. Exercise every name repeatedly on the same data.
 for(let pass=0;pass<4;pass++)for(const language of Object.keys(languages) as Language[]){const view=catalogPresentation(data,translatorFor(language));for(const g of data.budgetGroups){view.family(g);for(const p of g.partidas){view.item(p);view.subgroup(p);}}}
 assert.equal(JSON.stringify(data),before);assert.ok(!backup.includes('Housing:'));assert.equal(DATA_KEY,'finanzas_pro_data_v1');
});
