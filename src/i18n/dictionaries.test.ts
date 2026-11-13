import test from 'node:test';
import {readdirSync} from 'node:fs';
import {inventoryFile} from '../../scripts/i18n/inventory.mjs';
import assert from 'node:assert/strict';
import {dictionaries,es,languages,validateDictionary,translateFrom,translatorFor,languageReadiness,isLanguageAvailable,activeLanguage,writeLanguagePreference} from './index';
for(const language of ['en','it','fr','pt'] as const)test(`diccionario ${languages[language].locale}: claves completas y parámetros seguros, sin activación prematura`,()=>{
 const dictionary=dictionaries[language]!;
 const keys=inventoryFile(`src/i18n/${language}.ts`).filter(row=>row.role==='key').map(row=>row.text);
 assert.equal(keys.length,new Set(keys).size);assert.deepEqual(keys.sort(),Object.keys(es).sort());
 assert.deepEqual(validateDictionary(Object.entries(dictionary)),[]);
 assert.deepEqual(Object.keys(dictionary).sort(),Object.keys(es).sort());
 assert.equal(languageReadiness[language].uiComplete,false);assert.equal(languageReadiness[language].flowsVerified,false);
 assert.equal(isLanguageAvailable(language),false);assert.equal(activeLanguage(language),'es');
 let writes=0;assert.equal(writeLanguagePreference(language,{getItem:()=>null,setItem:()=>{writes++;}}),false);assert.equal(writes,0);
 const value='<script>{mode}$&</script>';
 assert.equal(translatorFor(language)('theme.switch',{mode:value}),dictionary['theme.switch'].replace('{mode}',()=>value));
 assert.equal(translateFrom({},'common.cancel'),es['common.cancel']);
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
