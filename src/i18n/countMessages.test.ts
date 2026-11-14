import test from 'node:test';
import assert from 'node:assert/strict';
import {languages,translatorFor,pluralCategory,type Language} from './messages';
import {presentationFormatters} from './presentation';
import {legacyTransferNotice,legacySharedNotice,subitemsRestoreNotice,sharedReceiptsNotice,chartMovementCount} from './countMessages';
import {backupWarningText} from './storageMessages';
for(const language of Object.keys(languages) as Language[])test(`contadores ${language}: dos plurales independientes, ejemplos numéricos y conservación de registros originales`,()=>{
 const t=translatorFor(language),format=presentationFormatters(language),rule=(count:number)=>pluralCategory(count,language)==='one'?'one':'other';
 for(const a of [0,1,2,1000000])for(const b of [0,1,2,1000000]){
  const before=JSON.stringify({a,b}),transfer=legacyTransferNotice(a,b,language,t,format.formatNumber),shared=legacySharedNotice(a,b,language,t,format.formatNumber);
  assert.equal(transfer,t(`app.legacyTransfers.${rule(a)}_${rule(b)}`,{unambiguousPairs:format.formatNumber(a),pendingRecords:format.formatNumber(b)}));assert.equal(shared,t(`app.legacyShared.${rule(a)}_${rule(b)}`,{verifiableExpenses:format.formatNumber(a),reviewCases:format.formatNumber(b)}));assert.equal(subitemsRestoreNotice(a,b,language,t,format.formatNumber),t(`restoration.subitems.${rule(b)}`,{items:format.formatNumber(a),months:format.formatNumber(b)}));assert.equal(JSON.stringify({a,b}),before);
 }
 for(const count of [0,1,2,1000000]){
  const values={description:'Nombre personal {count}$&',amount:format.formatMoney(1234.56),myShare:format.formatMoney(617.28)};assert.equal(sharedReceiptsNotice(count,values,language,t,format.formatNumber),t(`restoration.sharedReceipts.${rule(count)}`,{...values,count:format.formatNumber(count)}));assert.ok(sharedReceiptsNotice(count,values,language,t,format.formatNumber).includes(values.description));assert.equal(chartMovementCount(count,language,t,format.formatNumber),t(`chart.movementCount.${rule(count)}`,{count:format.formatNumber(count)}));
 }
 assert.equal(format.formatNumber(0,{minimumFractionDigits:2,maximumFractionDigits:2}),language==='en'?'0.00':'0,00');assert.equal(format.formatPercent(90,0),new Intl.NumberFormat(languages[language].locale,{style:'unit',unit:'percent',minimumFractionDigits:0,maximumFractionDigits:0}).format(90));assert.equal(format.formatPercent(1.15),new Intl.NumberFormat(languages[language].locale,{style:'unit',unit:'percent',minimumFractionDigits:1,maximumFractionDigits:1}).format(1.1),'the prior toFixed rounding remains unchanged');
 const original='1 traspasos históricos inequívocos: sus importes se excluyen de ingresos y gastos, sin reescribir los originales.';assert.equal(backupWarningText(original,language,t),t('storage.warning.transferPairs.one',{count:format.formatNumber(1)}));assert.equal(original.endsWith('los originales.'),true);
 if(language==='es'){assert.match(legacyTransferNotice(1,1,language,t,format.formatNumber),/1 par inequívoco y 1 registro pendiente/);assert.match(legacySharedNotice(1,1,language,t,format.formatNumber),/1 gasto verificable y 1 caso/);assert.ok(backupWarningText(original,language,t).endsWith('los originales.'));}
});
