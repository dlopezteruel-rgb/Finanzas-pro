import test from 'node:test';
import assert from 'node:assert/strict';
import { activeLanguage, languages, presentationMoney, presentationDate } from './index';
test('i18n: solo español está disponible; idiomas incompletos y desconocidos no se anuncian traducidos', () => {
  assert.equal(activeLanguage('es'), 'es');
  for (const language of ['en', 'it', 'fr', 'pt', 'xx']) assert.equal(activeLanguage(language), 'es');
  assert.equal(Object.keys(languages).length, 5);
});
test('i18n: presentación en cinco locales conserva EUR y los importes de origen', () => {
  const amount = 1234.56;
  for (const language of Object.keys(languages) as (keyof typeof languages)[]) {
    const parts = new Intl.NumberFormat(languages[language].locale, { style: 'currency', currency: 'EUR' }).formatToParts(amount);
    assert.equal(parts.find(p => p.type === 'currency')!.value, '€');
    assert.equal(presentationMoney(amount, language), parts.map(p => p.value).join(''));
  }
  assert.equal(amount, 1234.56);
});
test('i18n: fecha de presentación mantiene Madrid al cruzar medianoche sin cambiar el instante', () => {
  const date = new Date('2026-11-30T23:30:00Z'), before = date.toISOString();
  assert.match(presentationDate(date, 'es'), /1 de diciembre de 2026/);
  assert.match(presentationDate(date, 'en'), /1 December 2026/);
  assert.equal(date.toISOString(), before);
});

import { dictionaries, es, translate, translateFrom, validateDictionary, pluralCategory, LANGUAGE_KEY, readLanguagePreference, writeLanguagePreference } from './index';
import { readFileSync } from 'node:fs';
import { makeBackup, parseBackup, DATA_KEY } from '../utils/backup';
import {editCatalog} from '../utils/budgetCatalog';
import { intelligentFixture } from '../../scripts/intelligentFixture';
test('i18n: diccionario completo, sin duplicados y con parámetros compatibles', () => {
  assert.deepEqual(validateDictionary(Object.entries(es)), []);
  for(const dictionary of Object.values(dictionaries)) assert.deepEqual(validateDictionary(Object.entries(dictionary)), []);
  assert.ok(validateDictionary([...Object.entries(es), ['common.cancel','Cancelar']]).some(e=>e.startsWith('Duplicate')));
  assert.ok(validateDictionary(Object.entries(es).filter(([k])=>k!=='common.cancel')).some(e=>e==='Missing: common.cancel'));
  assert.ok(validateDictionary([...Object.entries(es), ['theme.switch','Modo {otro}']]).some(e=>e==='Incompatible: theme.switch'));
  assert.ok(validateDictionary([...Object.entries(es), ['unknown','No']]).some(e=>e.startsWith('Unknown')));
  const source = readFileSync(new URL('./es.ts',import.meta.url),'utf8');
  const keys = [...source.matchAll(/'([^']+)'\s*:/g)].map(m=>m[1]);
  assert.equal(keys.length, new Set(keys).size);
});
test('i18n: fallback español e interpolación literal segura, sin evaluación recursiva',()=>{
  assert.equal(translateFrom({},'common.cancel'),'Cancelar');
  assert.equal(translateFrom({'common.cancel':''},'common.cancel'),'Cancelar');
  assert.equal(translate('theme.switch',{mode:'<img onerror=x>{mode}$&'}),'Cambiar a modo <img onerror=x>{mode}$&');
  assert.equal(translateFrom({},'theme.switch'),'Cambiar a modo {mode}');
  assert.equal(pluralCategory(1),'one'); assert.equal(pluralCategory(2),'other');
});
test('i18n: preferencias estrictas sin detección de navegador ni reescritura de valores corruptos',()=>{
  const values=new Map<string,string>(), writes:string[]=[];
  const storage={getItem:(k:string)=>values.get(k)??null,setItem:(k:string,v:string)=>{values.set(k,v);writes.push(k);}};
  assert.equal(readLanguagePreference(storage),'es');
  for(const value of ['en','it','fr','pt','xx','ES','__proto__','{"language":"es"}','']) {
    values.set(LANGUAGE_KEY,value); assert.equal(readLanguagePreference(storage),'es');assert.equal(writeLanguagePreference(value,storage),false);assert.equal(values.get(LANGUAGE_KEY),value);
  }
  assert.deepEqual(writes,[]); assert.equal(writeLanguagePreference('es',storage),true);assert.equal(readLanguagePreference(storage),'es');assert.deepEqual(writes,[LANGUAGE_KEY]);
});
test('i18n: almacenamiento ausente, lectura y cuota denegadas conservan un resultado predecible',()=>{
  const blocked={getItem(){throw Error('denied');},setItem(){throw Error('quota');}};
  assert.equal(readLanguagePreference(null),'es');assert.equal(readLanguagePreference(blocked),'es');
  assert.equal(writeLanguagePreference('es',null),false);assert.equal(writeLanguagePreference('es',blocked),false);
  assert.equal(readLanguagePreference(),'es'); // Node has no browser storage
});
test('i18n: preferencia y presentación no modifican FinanceStore, números, fechas o JSON',()=>{
  const data=editCatalog(intelligentFixture(),{kind:'createFamily',type:'GASTO',name:'Familia personal ficticia',id:'i18n'}),before=JSON.stringify(data),backup=makeBackup(data),raw=JSON.stringify(backup);
  assert.equal(backup.version,'3.4');
  const entries=new Map([[DATA_KEY,raw]]), storage={getItem:(k:string)=>entries.get(k)??null,setItem:(k:string,v:string)=>{entries.set(k,v);}};
  writeLanguagePreference('es',storage);
  for(const language of Object.keys(languages) as (keyof typeof languages)[]) { presentationMoney(1234.56,language);presentationDate(new Date('2026-10-31T23:30:00Z'),language); }
  assert.equal(entries.get(DATA_KEY),raw);assert.equal(JSON.stringify(data),before);assert.deepEqual(parseBackup(raw),parseBackup(JSON.stringify(backup)));
  assert.equal(raw.includes(LANGUAGE_KEY),false);assert.notEqual(LANGUAGE_KEY,DATA_KEY);
});

// Compile-only contracts, verified by npm run lint; never executed by the runtime suite.
if (false) {
  // @ts-expect-error Unknown message keys must be rejected.
  translate('missing.key');
  // @ts-expect-error Required interpolation values must be provided.
  translate('theme.switch');
  // @ts-expect-error A differently named interpolation parameter is incompatible.
  translate('theme.switch', { other: 'oscuro' });
}
