import test from 'node:test';
import assert from 'node:assert/strict';
import {storageOwnedText,restorationTitleText,backupWarningText,deletionReportForDisplay} from './storageMessages';
import {translatorFor,languages,type Language} from './messages';
import {presentationFormatters,presentationMoney} from './presentation';
import {parseBackup,makeBackup,backupWarnings,type Backup} from '../utils/backup';
import {deletionReport,deleteEntity} from '../utils/deletion';
import {saveErrorMessage} from '../utils/saveResult';
import {intelligentFixture} from '../../scripts/intelligentFixture';
const all=Object.keys(languages) as Language[];
test('diagnósticos de almacenamiento: causas y envoltorios nativos sin modificar el error ni interpolar valores',()=>{
 const error=new DOMException('private diagnostic','QuotaExceededError'),raw=saveErrorMessage(error),unknown='<img>{reason}$&';
 for(const language of all){const t=translatorFor(language),translated=t('storage_message.no_hay_espacio_disponible_en_el_almacenamiento_del_navegador_los_datos_anteriores');assert.equal(storageOwnedText(raw,t),translated);assert.equal(storageOwnedText('No se ha aplicado el borrado. '+raw,t),t('storage.wrap.clear',{reason:translated}));assert.equal(storageOwnedText(unknown,t),unknown);assert.equal(restorationTitleText('Importar «'+unknown+'»',t),t('storage.title.import',{file:unknown}));}
 assert.equal(error.message,'private diagnostic');assert.equal(error.name,'QuotaExceededError');assert.equal(saveErrorMessage(error),raw);
});
test('JSON inválido: campo técnico y dato original intactos, razones de validación localizadas',()=>{
 const original=makeBackup(intelligentFixture()),invalid={...original,'contacto {path}$&':'literal'},raw=JSON.stringify(invalid);let error='';try{parseBackup(raw);}catch(e){error=(e as Error).message;}
 assert.equal(error,'Archivo.contacto {path}$&: campo no reconocido.');
 for(const language of all){const t=translatorFor(language);assert.equal(storageOwnedText(error+' No se ha modificado ningún dato.',t),t('storage.wrap.import',{reason:t('storage.backup.path',{path:'Archivo.contacto {path}$&',reason:t('storage_message.campo_no_reconocido')})}));assert.equal(storageOwnedText('planningMonths[0].revision: debe ser un número entero válido, mayor o igual que 1.',t),t('storage.backup.path',{path:'planningMonths[0].revision',reason:t('storage.backup.integer',{minimum:'1'})}));}
 assert.equal(JSON.stringify(invalid),raw);assert.deepEqual(parseBackup(JSON.stringify(original)),original);
});
test('eliminación: informe y operación originales conservados, nombres e importes no se reconstruyen desde texto',()=>{
 const data=intelligentFixture();data.wallets[0].name='Eliminar contacto';data.wallets[0].initialBalance=1.005;const target={kind:'wallet' as const,id:'bank'},report=deletionReport(data,target),before=JSON.stringify(data),reportBefore=JSON.stringify(report);
 for(const language of all){const t=translatorFor(language),shown=deletionReportForDisplay(report,{data,target},language,t,presentationFormatters(language));assert.equal(shown.name,'Eliminar contacto');assert.equal(shown.exists,report.exists);assert.deepEqual(shown.blockers,report.blockers);assert.equal(shown.notices[0],t('storage.deletion.wallet',{amount:presentationMoney(1.005,language)}));assert.ok(shown.notices[0].includes(language==='en'?'1.01':'1,01'));}
 assert.equal(JSON.stringify(data),before);assert.equal(JSON.stringify(report),reportBefore);assert.equal(deleteEntity(data,target).wallets.length,0);assert.equal(JSON.stringify(data),before);
});
test('avisos de importación: singular/plural nativo y JSON 2.5–3.4 independientes de la presentación',()=>{
 for(const version of ['2.5','2.6','2.7','2.8','2.9','3.0','3.1','3.2','3.3','3.4'] as const){
  const raw:Backup={...makeBackup(intelligentFixture()),version,...((version==='2.9'||version==='3.0')?{planningMonths:[{monthYear:'2026-11',savingsCents:0,revision:1}]}:{}),...(version==='3.0'?{planningAutomation:{rules:[{id:'fixture-rule',name:'Regla ficticia',target:'SAVINGS',amountCents:100,frequency:'monthly',startMonth:'2026-11',active:true}],carryovers:[],origins:[],history:[]}}:{}),...(version==='3.1'?{intelligentFinance:{recurringRules:[],occurrences:[],obligations:[]}}:{}),...(version==='3.2'?{defaultWalletId:null}:{}),...(version==='3.3'?{budgetSubitems:{items:[],months:[]}}:{})},text=JSON.stringify(raw),parsed=parseBackup(text),before=JSON.stringify(parsed),warnings=backupWarnings(parsed);
  for(const language of all){const t=translatorFor(language);for(const warning of warnings)assert.equal(typeof backupWarningText(warning,language,t),'string');for(const count of [1,2]){const warning=`${count} traspasos históricos inequívocos: sus importes se excluyen de ingresos y gastos, sin reescribir los originales.`;assert.equal(backupWarningText(warning,language,t),t(count===1?'storage.warning.transferPairs.one':'storage.warning.transferPairs',{count:String(count)}));}}
  assert.equal(JSON.stringify(parsed),before);assert.equal(JSON.stringify(raw),text);assert.equal(parsed.version,version);
 }
});
