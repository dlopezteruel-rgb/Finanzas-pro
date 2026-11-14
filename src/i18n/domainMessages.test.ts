import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parseSync} from 'rolldown/utils';
import {inventory} from '../../scripts/i18n/inventory.mjs';
import {es,languages,translatorFor,type Language} from './messages';
import {presentationFormatters} from './presentation';
import {storageOwnedText} from './storageMessages';
import {chartOwnedText} from './chartMessages';
import {naturalInputText} from './naturalMessages';
import {walletTypeText,rememberHistoricalPartida,partidaDisplayName,partidaDisplayFamily,assistantItemName} from './labels';
import {assistantPresentation,adviceForDisplay} from './assistantMessages';
import {financialAssistantContext,localFinancialAdvice,assistantServiceContext} from '../utils/financialAssistant';
import {changePartidaGroup} from '../utils/budgetChanges';
import {createSubitem} from '../utils/budgetSubitems';
import {assertCatalogTransition} from '../utils/budgetCatalog';
import {chartFixture} from '../../scripts/chartFixture';
const errorOf=(run:()=>unknown)=>{try{run();assert.fail('fixture must reject the original operation');}catch(error){assert.ok(error instanceof Error);return error.message;}};
for(const language of Object.keys(languages) as Language[])test(`P3 ${language}: errores originales, tipos y nombres históricos sin mutaciones ni traducción de datos personales`,()=>{
 const t=translatorFor(language),format=presentationFormatters(language),data=chartFixture();data.budgetPlans.push({monthYear:'2026-10',type:'GASTO',code:'g',plannedAmount:100});const partida=data.budgetGroups[1].partidas[0],before=JSON.stringify(data);
 const invalidFamily=errorOf(()=>changePartidaGroup(data,partida,'absent'));assert.equal(invalidFamily,'La partida o el paquete de destino ya no existe.');assert.equal(storageOwnedText(invalidFamily,t),t('domain.la_partida_o_el_paquete_de_destino_ya_no_b55bb'));
 const crossType=errorOf(()=>changePartidaGroup(data,partida,data.budgetGroups[0].code));assert.equal(storageOwnedText(crossType,t),t('domain.no_se_permite_cambiar_entre_ingresos_y_gastos_desde_b65d6'));
 const invalidName=errorOf(()=>createSubitem(data,{type:'GASTO',code:'g'},' '));assert.equal(storageOwnedText(invalidName,t),t('domain.el_nombre_del_subitem_debe_tener_entre_1_y_850ca'));
 const archived=structuredClone(data);archived.budgetGroups[1].partidas[0].archived=true;const changed=structuredClone(archived),plan=changed.budgetPlans.find(p=>p.code==='g')!;plan.plannedAmount+=1;const archivedBefore=JSON.stringify(archived),changedBefore=JSON.stringify(changed);const immutable=errorOf(()=>assertCatalogTransition(archived,changed));assert.equal(storageOwnedText(immutable,t),t('domain.catalogo_la_prevision_de_una_partida_o_familia_archivada_51024'));assert.equal(JSON.stringify(archived),archivedBefore);assert.equal(JSON.stringify(changed),changedBefore);
 assert.equal(storageOwnedText('Catálogo: tiene dependencias: Movimientos (también pendientes), Previsiones mensuales. Utiliza Archivar.',t),t('domain.catalogDependencies',{dependencies:[t('catalog_dependency.transactions'),t('catalog_dependency.monthlyPlans')].join(', ')}));assert.equal(storageOwnedText('Catálogo: tiene dependencias: Nombre personal {amount}$&. Utiliza Archivar.',t),'Catálogo: tiene dependencias: Nombre personal {amount}$&. Utiliza Archivar.');
 for(const type of ['BANK','NEOBANK','CASH','SAVINGS','INVESTMENT'] as const)assert.equal(walletTypeText(type,t),t(`walletType.${type}`));assert.equal(storageOwnedText('BANK',t),'BANK');
 const personal={...partida,name:'Partida histórica 1000',groupName:'Fuera del catálogo'},raw=JSON.stringify(personal);assert.equal(partidaDisplayName(personal,t,format.formatNumber),personal.name);assert.equal(partidaDisplayFamily(personal,t),personal.groupName);
 const synthetic=rememberHistoricalPartida({...personal,groupCode:'historical'},1000),syntheticRaw=JSON.stringify(synthetic);assert.equal(partidaDisplayName(synthetic,t,format.formatNumber),t('planning.historicalItemNumber',{number:format.formatNumber(1000)}));assert.equal(partidaDisplayFamily(synthetic,t),t('chart.row.outsideCatalog'));assert.equal(JSON.stringify(synthetic),syntheticRaw);assert.equal(JSON.stringify(personal),raw);assert.deepEqual(Object.keys(synthetic),Object.keys(personal));const historicalUser=rememberHistoricalPartida({...personal,groupCode:'historical'});assert.equal(partidaDisplayName(historicalUser,t,format.formatNumber),personal.name);
 const source=structuredClone(data);source.budgetGroups[1].partidas[0].name='Partida histórica 1';source.budgetPlans.push({monthYear:'2026-10',type:'GASTO',code:'orphan',plannedAmount:10});source.transactions.push({...source.transactions.find(tx=>tx.id==='income')!,id:'old-wallet-{amount}$&',wallet:'CARTERA AUSENTE',date:'2026-11-14',processed:false,description:'Concepto personal {amount}$&'});const context=financialAssistantContext(source,'2026-10','2026-11-13'),contextBefore=JSON.stringify(context),sourceBefore=JSON.stringify(source),payload=assistantServiceContext(context),legacy=localFinancialAdvice(context,'resumen'),current=structuredClone(source);current.transactions=current.transactions.filter(tx=>tx.id!=='old-wallet-{amount}$&');
 const view=assistantPresentation(t,format,current),warning=t('treasury.warning.wallet',{id:'old-wallet-{amount}$&'});assert.ok(adviceForDisplay(context,'disponible',view,source)!.includes(warning));if(language!=='es')assert.ok(!adviceForDisplay(context,'disponible',view,source)!.includes('cartera no disponible; excluido de la proyección.'));const own=context.partidas.find(p=>p.code==='orphan')!;assert.match(own.name,/^Partida histórica \d+$/);assert.equal(assistantItemName(own,source,t,format.formatNumber),t('planning.historicalItemNumber',{number:format.formatNumber(Number(own.name.match(/\d+$/)![0]))}));assert.equal(assistantItemName({type:'GASTO',code:'g',name:'Partida histórica 1'},source,t,format.formatNumber),'Partida histórica 1');assert.ok(adviceForDisplay(context,'resumen',view,source)!.includes('Partida histórica 1'));assert.equal(localFinancialAdvice(context,'resumen'),legacy);assert.deepEqual(assistantServiceContext(context),payload);assert.equal(JSON.stringify(context),contextBefore);assert.equal(JSON.stringify(source),sourceBefore);assert.equal(JSON.stringify(data),before);
});
test('P3 cobertura: cada diagnóstico estático de catálogo, subítems y reordenación tiene presentación nativa',()=>{
 const t=translatorFor('en');let checked=0;
 for(const [file,prefix] of [['src/utils/budgetCatalog.ts','Catálogo: '],['src/utils/budgetSubitems.ts','Subítems: '],['src/utils/catalogReorder.ts','']] as const){const source=readFileSync(file,'utf8'),ast=parseSync(file,source,{lang:'ts'}).program;
  function visit(node:any){if(!node||typeof node!=='object')return;if(node.type==='CallExpression'&&node.callee.name==='check'&&node.arguments[1]?.type==='Literal'){const message=prefix+node.arguments[1].value;assert.notEqual(storageOwnedText(message,t),message,`${file}: ${message}`);checked++;}for(const [key,value]of Object.entries(node)){if(['type','start','end','raw','loc','comments'].includes(key))continue;for(const child of Array.isArray(value)?value:[value])if(child&&typeof child==='object')visit(child);}}visit(ast);
 }assert.ok(checked>=60);
 const prefix:Record<string,string>={'src/utils/budgetCatalog.ts':'Catálogo: ','src/utils/budgetSubitems.ts':'Subítems: ','src/utils/intelligentValidation.ts':'Finanzas inteligentes: ','src/utils/planningAutomationValidation.ts':'Automatización: '};let complete=0;
 for(const row of inventory()){
  if(row.classification!=='ui-message-candidate'||row.kind!=='Literal'||Object.hasOwn(es,row.text)||!/\s|[áéíóúñ]/.test(row.text)||row.ancestors.includes('TemplateLiteral'))continue;
  // API/tooling diagnostics are not rendered UI and their contracts are protected.
  if(row.file==='server.ts'||row.file==='config/appPaths.ts'||row.file==='src/components/AssistantChatView.tsx'&&row.text==='No reply')continue;
  const candidates=[row.text,...(prefix[row.file]?[prefix[row.file]+row.text]:[])];
  const render=row.file==='src/utils/naturalInput.ts'?naturalInputText:row.file.startsWith('src/components/charts/')||row.file==='src/utils/chartData.ts'?chartOwnedText:storageOwnedText;
  assert.ok(candidates.some(message=>render(message,t)!==message),`${row.file}:${row.line}: unmapped owned diagnostic ${row.text}`);complete++;
 }assert.ok(complete>=checked);

});
