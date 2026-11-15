import test from 'node:test';
import assert from 'node:assert/strict';
import {dictionaries,isDictionaryLoaded,loadDictionary,translatorFor,type Messages} from './messages';
test('5E: carga deduplicada, validación y caché inmutable conservan el contrato síncrono del traductor',async()=>{
 const catalog=dictionaries as Partial<Record<string,Messages>>,previous=catalog.en;
 try{delete catalog.en;assert.equal(isDictionaryLoaded('en'),false);assert.throws(()=>translatorFor('en')('common.cancel'),/Load the dictionary/);const a=loadDictionary('en'),b=loadDictionary('en');assert.equal(a,b);const loaded=await a;assert.ok(Object.isFrozen(loaded));assert.equal(isDictionaryLoaded('en'),true);assert.equal(await loadDictionary('en'),loaded);assert.equal(translatorFor('en')('common.cancel'),'Cancel');}finally{catalog.en=previous;}
});
test('5E: un idioma desconocido nunca se descarga ni se aplica',async()=>{await assert.rejects(loadDictionary('xx' as never),/not available/);});

import {presentationDate,presentationISODate,presentationMonth} from './presentation';
import {languages} from './messages';
for(const language of ['es','en','it','fr','pt'] as const)test(`5E: cache Intl ${language} conserva fechas, Madrid, opciones y excepciones`,()=>{
 const instant=new Date('2026-10-24T23:30:00Z'),before=instant.toISOString();
 const options:Intl.DateTimeFormatOptions[]=[{day:'2-digit',month:'2-digit',year:'numeric'},{year:'numeric',month:'long',day:'numeric'},{hour:'2-digit',minute:'2-digit',timeZoneName:'short'},{dateStyle:'full'},{weekday:'long',hourCycle:'h23',hour:'numeric'}];
 for(let repeat=0;repeat<3;repeat++)for(const option of options){const old=JSON.stringify(option),expected=new Intl.DateTimeFormat(languages[language].locale,{...option,timeZone:'Europe/Madrid'}).format(instant);assert.equal(presentationDate(instant,language,option),expected);assert.equal(presentationDate(instant,language,Object.fromEntries(Object.entries(option).reverse())),expected);assert.equal(JSON.stringify(option),old);}
 const mutable:Intl.DateTimeFormatOptions={year:'numeric'};assert.equal(presentationDate(instant,language,mutable),new Intl.DateTimeFormat(languages[language].locale,{...mutable,timeZone:'Europe/Madrid'}).format(instant));mutable.month='long';assert.equal(presentationDate(instant,language,mutable),new Intl.DateTimeFormat(languages[language].locale,{...mutable,timeZone:'Europe/Madrid'}).format(instant));
 assert.equal(presentationISODate('2026-10-25',language,{hour:'numeric'}),new Intl.DateTimeFormat(languages[language].locale,{year:'numeric',month:'long',day:'numeric',timeZone:'Europe/Madrid'}).format(new Date('2026-10-25T12:00:00Z')));assert.equal(presentationISODate('invalid',language),'invalid');assert.equal(instant.toISOString(),before);assert.ok(presentationMonth('0001-01',language));
 assert.throws(()=>presentationDate(new Date(NaN),language),RangeError);assert.throws(()=>presentationDate(instant,language,{dateStyle:'full',year:'numeric'}),TypeError);
});
