import test from 'node:test';
import assert from 'node:assert/strict';
import {dictionaries,isDictionaryLoaded,loadDictionary,translatorFor,type Messages} from './messages';
test('5E: carga deduplicada, validación y caché inmutable conservan el contrato síncrono del traductor',async()=>{
 const catalog=dictionaries as Partial<Record<string,Messages>>,previous=catalog.en;
 try{delete catalog.en;assert.equal(isDictionaryLoaded('en'),false);assert.throws(()=>translatorFor('en')('common.cancel'),/Load the dictionary/);const a=loadDictionary('en'),b=loadDictionary('en');assert.equal(a,b);const loaded=await a;assert.ok(Object.isFrozen(loaded));assert.equal(isDictionaryLoaded('en'),true);assert.equal(await loadDictionary('en'),loaded);assert.equal(translatorFor('en')('common.cancel'),'Cancel');}finally{catalog.en=previous;}
});
test('5E: un idioma desconocido nunca se descarga ni se aplica',async()=>{await assert.rejects(loadDictionary('xx' as never),/not available/);});
