import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assistantContexts} from '../../scripts/assistantFixture';
import {financialAssistantContext,localFinancialAdvice,assistantServiceContext} from '../utils/financialAssistant';
import {languages,translatorFor,type Language} from './messages';
import {presentationFormatters} from './presentation';
import {assistantPresentation,assistantPrompts,quickEntryPrompts} from './assistantMessages';
import {naturalInputText} from './naturalMessages';
import {readNaturalInput} from '../utils/naturalInput';
import {classifyChatIntent,proposeChatMovement} from '../utils/chatRegistration';
const baseline=JSON.parse(readFileSync('src/i18n/fixtures/assistant-legacy.json','utf8'));
test('asistente: los dos argumentos conservan exactamente respuestas originales y payload del servicio',()=>{
 const {data,contexts}=assistantContexts(),before=JSON.stringify({data,contexts});
 for(const row of baseline.rows)assert.equal(localFinancialAdvice(contexts[row.scenario as keyof typeof contexts],row.query),row.text,`${row.scenario}/${row.query}`);
 for(const [scenario,c]of Object.entries(contexts))assert.deepEqual(assistantServiceContext(c),baseline.serviceContexts[scenario]);
 assert.equal(JSON.stringify({data,contexts}),before);
});
for(const language of Object.keys(languages) as Language[])test(`asistente ${language}: presentación nativa con los mismos céntimos, intención/payload y datos personales`,()=>{
 const {data,contexts}=assistantContexts(),before=JSON.stringify({data,contexts}),t=translatorFor(language),format=presentationFormatters(language),view=assistantPresentation(t,format,data);
 for(const row of baseline.rows){const moneyCents:number[]=[],context=contexts[row.scenario as keyof typeof contexts];const native=localFinancialAdvice(context,row.query,{...view,money:cents=>{moneyCents.push(cents);return view.money(cents);}});assert.deepEqual(moneyCents,row.moneyCents,`${row.scenario}/${row.query}: native display receives the exact original monetary arguments`);assert.equal(native===null,row.text===null);if(native){assert.ok(native.startsWith(t('assistant.advice.prefix',{month:view.month(context.month),status:view.status(context.status),asOf:view.date(context.asOf)})));if(row.text.includes('Nombre personal {amount}$&'))assert.ok(native.includes('Nombre personal {amount}$&'));}}
 assert.deepEqual(assistantPrompts.map(p=>p.text),['¿Cuánto tengo realmente disponible?','¿Qué gastos puedo reducir para ahorrar 150 € más?','¿Qué pagos y cobros se aproximan?','¿Qué partidas están en alerta?','Ayer cené fuera por 15,50 € con Openbank','Resumen de mis préstamos y deudas']);
 assert.deepEqual(quickEntryPrompts.map(p=>p.text),['Ayer cené fuera por 15,50 € con Openbank','Nómina mensual cobrada 2650 € en Santander','Compra supermercado 84,30 € con Openbank','Gasolina Repsol 55 € con Revolut','Compré libros por 42 € en efectivo']);
 for(const text of ['No registres un gasto de 15 €','¿He gastado 15 €?','Registra un gasto de 1.500 €','Registra un gasto de 5 € ayer y hoy']){const raw=readNaturalInput(text,new Date('2026-11-13T12:00:00Z'));assert.equal(raw.ok,false);if(!raw.ok){assert.equal(naturalInputText(raw.error,t).includes('{reason}'),false);assert.equal(naturalInputText(raw.error,t).length>0,true);}assert.equal(proposeChatMovement(text,data.wallets,data.budgetGroups.flatMap(g=>g.partidas)),null);}
 assert.equal(classifyChatIntent(assistantPrompts[0].text),'query');assert.equal(classifyChatIntent(assistantPrompts[4].text),'registration');assert.equal(naturalInputText('Dato personal {amount}$&',t),'Dato personal {amount}$&');assert.deepEqual(assistantServiceContext(contexts.standard),baseline.serviceContexts.standard);assert.equal(JSON.stringify({data,contexts}),before);
});
