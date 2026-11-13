import test from 'node:test';
import assert from 'node:assert/strict';
import {translatorFor,type Language} from './messages';
import {planningOwnedText,automationReasonText} from './planningMessages';
import {planningStatusText} from './presenters';
import {planningDraftPreview} from '../components/planningPreview';
import {parsePlanningMoney} from '../utils/planningMoney';
import {previewAutomation,applyAutomationPreview} from '../utils/planningAutomation';
import {planningKey} from '../utils/planning';
import {budgetSubitemFixture,demoParent} from '../../scripts/budgetSubitemFixture';

test('i18n planificación: traducir errores no cambia el parser, el borrador ni los céntimos',()=>{
 const input={type:'GASTO' as const,code:'raw-code',input:'3.000'},draft=planningDraftPreview([input],'-1',[]),before=JSON.stringify(draft);
 for(const language of ['es','en','it','fr','pt'] as Language[]){
  const tr=translatorFor(language);assert.equal(parsePlanningMoney('15.50'),1550);assert.equal(parsePlanningMoney('15,50'),1550);assert.equal(parsePlanningMoney('90071992547409.91'),Number.MAX_SAFE_INTEGER);
  for(const value of ['3.000','-1','1.001'])assert.throws(()=>parsePlanningMoney(value),{message:'Usa un importe no negativo con hasta dos decimales (15,50 o 15.50).'});
  assert.equal(planningOwnedText(draft.errors['GASTO:raw-code'],tr),tr('planning_message.usa_un_importe_no_negativo_con_hasta_dos_decimales_15'));
  assert.equal(planningOwnedText('Automatización: falta raw_field{field}',tr),tr('automation.missingField',{field:'raw_field{field}'}));
  assert.equal(planningOwnedText('Automatización: campo no reconocido <raw>',tr),tr('automation.unknownField',{field:'<raw>'}));
  assert.equal(planningOwnedText('Diagnóstico desconocido {field}',tr),'Diagnóstico desconocido {field}');
 }
 assert.equal(JSON.stringify(draft),before);assert.equal(input.input,'3.000');assert.equal(draft.totals,null);
 assert.equal(planningStatusText('Aprobado',translatorFor('en')),'Approved');assert.equal(planningStatusText('Estado histórico desconocido',translatorFor('fr')),'Estado histórico desconocido');
});
test('i18n automatizaciones: motivos completos con desglose y nombres personales sin modificar la propuesta',()=>{
 const now=new Date('2026-11-20T12:00:00Z');
 for(const monthly of [false,true]){
  const data=budgetSubitemFixture(true,monthly),preview=previewAutomation(data,{kind:'copy',source:'2026-11',first:'2026-12',last:'2026-12',keys:[planningKey(demoParent)],savings:false,overwrite:[]},now);
  const before=JSON.stringify({data,preview}),row=preview.rows[0];assert.equal(row.status,'apply');assert.equal(automationReasonText(data,preview,row,translatorFor('es')),row.reason);
  for(const language of ['es','en','it','fr','pt'] as Language[]){const tr=translatorFor(language);assert.equal(automationReasonText(data,preview,row,tr),tr(monthly?'automation.reason.copyDistributed':'automation.reason.copyPending'));}
  assert.equal(JSON.stringify({data,preview}),before);
 }
 const data=budgetSubitemFixture(true),name='Regla {frequency} (mensual).';data.planningAutomation={rules:[{id:'rule',name,target:'GASTO',code:demoParent.code,amountCents:1234,frequency:'monthly',startMonth:'2026-12',active:true}],origins:[],carryovers:[],history:[]};
 const preview=previewAutomation(data,{kind:'recurrences',first:'2026-12',last:'2026-12',overwrite:[]},now),before=JSON.stringify(preview);
 const tr=translatorFor('fr');assert.equal(automationReasonText(data,preview,preview.rows[0],tr),`Règle ${name} (mensuelle). Détail en attente : le total est conservé sans inventer d’affectations.`);
 assert.equal(JSON.stringify(preview),before);assert.equal(data.planningAutomation.rules[0].name,name);
});
test('i18n arrastre: la presentación consume céntimos originales y nunca se devuelve al cálculo',()=>{
 const data=budgetSubitemFixture(false),now=new Date('2026-11-20T12:00:00Z');data.budgetPlans.push({...demoParent,monthYear:'2026-10',plannedAmount:100});
 const preview=previewAutomation(data,{kind:'carry',source:'2026-10',amounts:[{code:demoParent.code,amountCents:1234}]},now),before=JSON.stringify({data,preview}),applied=applyAutomationPreview(data,preview,now);
 assert.equal(automationReasonText(data,preview,preview.rows[0],translatorFor('es')),preview.rows[0].reason);
 for(const language of ['es','en','it','fr','pt'] as Language[]){
  const values:number[]=[],text=automationReasonText(data,preview,preview.rows[0],translatorFor(language),value=>{values.push(value);return `[${value}]`;});
  assert.deepEqual(values,[10000,0,10000,1234]);assert.ok(text.includes('[1234]'));assert.ok(text.includes('[10000]'));assert.equal(JSON.stringify({data,preview}),before);assert.deepEqual(applyAutomationPreview(data,preview,now),applied);
 }
 assert.equal(applied.planningAutomation!.carryovers[0].amountCents,1234);
});
