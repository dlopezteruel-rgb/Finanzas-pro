import test from 'node:test';
import {readdirSync,readFileSync} from 'node:fs';
import {inventoryFile} from '../../scripts/i18n/inventory.mjs';
import assert from 'node:assert/strict';
import {dictionaries,es,languages,validateDictionary,translateFrom,translatorFor,languageReadiness,isLanguageAvailable,activeLanguage,writeLanguagePreference,type Messages,type Language} from './index';
const lexicalExceptions=JSON.parse(readFileSync('docs/phase-5b-lexical-exceptions.json','utf8')).exceptions as Record<string,{key:string;text:string;reason:string}[]>;
for(const language of ['en','it','fr','pt'] as const)test(`diccionario ${languages[language].locale}: claves completas, parámetros seguros y flujos revisados`,()=>{
 const dictionary=dictionaries[language]!;
 const keys=inventoryFile(`src/i18n/${language}.ts`).filter(row=>row.role==='key').map(row=>row.text);
 assert.equal(keys.length,new Set(keys).size);assert.deepEqual(keys.sort(),Object.keys(es).sort());
 assert.deepEqual(validateDictionary(Object.entries(dictionary)),[]);
 assert.deepEqual(Object.keys(dictionary).sort(),Object.keys(es).sort());
 const identical=Object.keys(es).filter(key=>es[key as keyof typeof es]===dictionary[key as keyof typeof es]).sort();
 assert.deepEqual(identical,lexicalExceptions[language].map(entry=>entry.key).sort(),'Identical Spanish spelling requires explicit native/invariant review');
 for(const entry of lexicalExceptions[language]){assert.equal(dictionary[entry.key as keyof typeof es],entry.text);assert.ok(entry.reason);}
 assert.equal(languageReadiness[language].uiComplete,true);assert.equal(languageReadiness[language].flowsVerified,true);
 assert.equal(isLanguageAvailable(language),true);assert.equal(activeLanguage(language),language);
 const writes:[string,string][]=[];assert.equal(writeLanguagePreference(language,{getItem:()=>null,setItem:(key,value)=>{writes.push([key,value]);}}),true);assert.deepEqual(writes,[['finanzas.ui.language',language]]);
 const value='<script>{mode}$&</script>';
 assert.equal(translatorFor(language)('theme.switch',{mode:value}),dictionary['theme.switch'].replace('{mode}',()=>value));
 assert.equal(translateFrom({},'common.cancel'),es['common.cancel']);
});
test('la guarda sigue rechazando diccionarios incompletos, flujos no revisados y estados previstos, sin escribir preferencias',()=>{
 // Fault injection is confined to this sequential test; original module values are restored.
 const registry=languages as unknown as Record<Language,{locale:string;label:string;status:string}>,readiness=languageReadiness as Record<Language,{uiComplete:boolean;flowsVerified:boolean}>,catalog=dictionaries as Record<Language,Messages>;
 const original={entry:registry.en,readiness:readiness.en,dictionary:catalog.en};
 const reject=()=>{let writes=0;assert.equal(isLanguageAvailable('en'),false);assert.equal(activeLanguage('en'),'es');assert.equal(writeLanguagePreference('en',{getItem:()=>null,setItem:()=>{writes++;}}),false);assert.equal(writes,0);};
 try{
  catalog.en={...original.dictionary,'common.cancel':''};reject();catalog.en=original.dictionary;
  readiness.en={uiComplete:false,flowsVerified:true};reject();readiness.en={uiComplete:true,flowsVerified:false};reject();readiness.en=original.readiness;
  registry.en={...original.entry,status:'planned'};reject();
 }finally{registry.en=original.entry;readiness.en=original.readiness;catalog.en=original.dictionary;}
 assert.equal(isLanguageAvailable('en'),true);
});
test('cuatro variantes regionales específicas, sin confundir pt-PT con pt-BR',()=>{
 assert.equal(languages.en.locale,'en-GB');assert.equal(languages.it.locale,'it-IT');assert.equal(languages.fr.locale,'fr-FR');assert.equal(languages.pt.locale,'pt-PT');
 assert.equal(dictionaries.en!['wallet.color_de_la_tarjeta'],'Card colour');
 assert.equal(dictionaries.pt!['nav.contacts'],'Contactos');assert.equal(dictionaries.pt!['options.recovery'],'Cópias de recuperação');
 assert.equal(dictionaries.pt!['restoration.las_copias_se_descargan_desde_el_menu_copias_de'].includes('descarregadas'),true);
});

import {pluralText,pluralFamilies,pluralCategory} from './index';
for(const language of ['es','en','it','fr','pt'] as const)test(`plurales ${languages[language].locale}: cero, uno, varios y cantidades grandes con Intl`,()=>{
 for(const family of Object.keys(pluralFamilies) as (keyof typeof pluralFamilies)[])for(const count of [0,1,2,5,1000000]){
  const before=count,rule=pluralCategory(count,language),key=pluralFamilies[family][rule==='one'?'one':'other'];
  const expected=dictionaries[language]![key].replace('{count}',()=>new Intl.NumberFormat(languages[language].locale).format(count));
  assert.equal(pluralText(language,family,count),expected);assert.equal(count,before);assert.equal(pluralText(language,family,count).includes('{count}'),false);
 }
 assert.equal(pluralCategory(1,language),'one');
});

test('los módulos canónicos no duplican claves al combinarse',()=>{
 const files=readdirSync('src/i18n').filter(name=>/^es(?:\.[\w-]+)?\.ts$/.test(name));
 const keys=files.flatMap(file=>inventoryFile(`src/i18n/${file}`).filter(row=>row.role==='key').map(row=>row.text));
 assert.equal(keys.length,new Set(keys).size);assert.deepEqual(keys.sort(),Object.keys(es).sort());
});

test('los metadatos HTML de arranque coinciden con la referencia española',()=>{
 const html=readFileSync('index.html','utf8');
 assert.equal(/<title>([^<]+)<\/title>/.exec(html)?.[1],es['document.title']);
 assert.equal(/name="description" content="([^"]+)"/.exec(html)?.[1],es['document.description']);
});
