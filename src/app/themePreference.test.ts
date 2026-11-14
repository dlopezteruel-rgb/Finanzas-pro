import test from 'node:test';
import assert from 'node:assert/strict';
import {THEME_KEY,readThemePreference,writeThemePreference} from './themePreference';
import {DATA_KEY} from '../utils/backup';
test('5E: tema visual estricto e independiente; lectura antigua/corrupta no escribe ni migra',()=>{
 for(const value of [null,'invalid','{"theme":"dark"}','LIGHT','']){let writes=0;assert.equal(readThemePreference({getItem:()=>value,setItem:()=>{writes++;}}),undefined);assert.equal(writes,0);}for(const value of ['dark','light']as const)assert.equal(readThemePreference({getItem:()=>value,setItem:()=>{throw Error('unexpected');}}),value);
});
test('5E: elegir tema solo escribe su preferencia y conserva el JSON financiero',()=>{
 const entries=new Map([[DATA_KEY,'original financial bytes']]),writes:string[]=[],storage={getItem:(k:string)=>entries.get(k)??null,setItem:(k:string,v:string)=>{entries.set(k,v);writes.push(k);}};for(const theme of ['light','dark']as const){assert.equal(writeThemePreference(theme,storage),true);assert.equal(readThemePreference(storage),theme);}assert.deepEqual(writes,[THEME_KEY,THEME_KEY]);assert.equal(entries.get(DATA_KEY),'original financial bytes');assert.equal(writeThemePreference('invalid'as never,storage),false);
});
test('5E: tema con almacenamiento inaccesible/cuota denegada mantiene fallback y fallo explícito',()=>{
 const blocked={getItem(){throw Error('denied');},setItem(){throw Error('quota');}};assert.equal(readThemePreference(blocked),undefined);assert.equal(readThemePreference(null),undefined);assert.equal(readThemePreference(),undefined);assert.equal(writeThemePreference('light',blocked),false);assert.equal(writeThemePreference('light',null),false);
});
