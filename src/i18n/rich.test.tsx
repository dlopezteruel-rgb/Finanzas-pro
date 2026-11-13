import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {I18nProvider,I18nText,es} from './index';
import {p1} from './es.p1';
import {readFileSync} from 'node:fs';
test('i18n rich: los datos del usuario se escapan y no se vuelven a interpretar como placeholders',()=>{
 const html=renderToStaticMarkup(<I18nProvider><I18nText id="confirm_delete_dialog.se_eliminara" values={{name:<strong>{'<img onerror=x>{mode}'}</strong>}} /></I18nProvider>);
 assert.equal(html,'Se eliminará: <strong>&lt;img onerror=x&gt;{mode}</strong>.');
});
test('i18n rich: la frase completa conserva nodos y los valores financieros sin parsearlos',()=>{
 const amount=1234.56,date='2026-11-30';
 const html=renderToStaticMarkup(<I18nProvider><I18nText id="restoration.cartera_fecha" values={{wallet:<b>Cuenta personal</b>,date}} /></I18nProvider>);
 assert.equal(html,'Cartera: <b>Cuenta personal</b> · Fecha: 2026-11-30');assert.equal(amount,1234.56);assert.equal(date,'2026-11-30');
});
test('i18n P1: las claves de módulos son únicas y no sobrescriben el diccionario existente',()=>{
 const source=readFileSync(new URL('./es.ts',import.meta.url),'utf8'),own=[...source.matchAll(/'([^']+)'\s*:/g)].map(m=>m[1]);
 for(const key of Object.keys(p1)){assert.equal(own.includes(key),false,key);assert.equal(es[key as keyof typeof p1],p1[key as keyof typeof p1]);}
});
// Checked by the same TypeScript lint command as the application.
if(false){
 // @ts-expect-error Rich messages require their named slots.
 const missing=<I18nText id="confirm_delete_dialog.se_eliminara" />;
 // @ts-expect-error Unrecognised slot names are rejected.
 const wrong=<I18nText id="confirm_delete_dialog.se_eliminara" values={{wrong:'Cuenta'}} />;
 void missing;void wrong;
}

import {PlanningSection} from '../components/PlanningSection';
import {pluralText,translatorFor} from './index';
test('planificación: el resumen usa plurales completos al plegar importes inválidos y conserva datos y nodos',()=>{
 const title='MIS PARTIDAS {count} <datos>',planned=123456,executed=789;
 for(const open of [true,false])for(const count of [1,2]){
  const html=renderToStaticMarkup(<I18nProvider><PlanningSection title={title} open={open} onToggle={()=>{}} planned={planned} executed={executed} count={count} invalidCount={count}><input value="1234.56" readOnly /></PlanningSection></I18nProvider>);
  assert.ok(html.includes(`${count} ${count===1?'partida':'partidas'} · Previsto: <strong>1.234,56 €</strong>`));
  assert.ok(html.includes(`${count} ${count===1?'importe inválido':'importes inválidos'}${open?'':count===1?' oculto':' ocultos'}. Revisa las partidas antes de guardar.`));
  assert.ok(html.includes('MIS PARTIDAS {count} &lt;datos&gt;'));assert.ok(html.includes('value="1234.56"'));
 }
 assert.equal(title,'MIS PARTIDAS {count} <datos>');assert.equal(planned,123456);assert.equal(executed,789);
});
test('planificación: plurales extranjeros expresan el error oculto como frase completa, sin fragmentos españoles',()=>{
 assert.equal(pluralText('en','invalidAmountsHidden',1),'1 hidden invalid amount. Check the budget items before saving.');
 assert.equal(pluralText('it','invalidAmountsHidden',2),'2 importi non validi nascosti. Controlla le voci prima di salvare.');
 assert.equal(pluralText('fr','invalidAmountsVisible',1),'1 montant non valide. Vérifiez les postes avant d’enregistrer.');
 assert.equal(pluralText('pt','invalidAmountsVisible',2),'2 montantes inválidos. Reveja as rubricas antes de guardar.');
 const userName='GASTO personalizado {name}',code='GASTO';
 assert.equal(translatorFor('en')('planning.previsto',{type:translatorFor('en')('planning.expenseType'),name:userName}),'Planned EXPENSE GASTO personalizado {name}');
 assert.equal(code,'GASTO');assert.equal(userName,'GASTO personalizado {name}');
});
