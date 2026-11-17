import {browserExclusiveWrite,type ExclusiveWrite} from '../utils/financeStore';
import {browserStorageSupportError} from '../utils/storageSupport';
import {DATA_KEY,type FinanceData} from '../utils/backup';
import type {WebFinanceController} from './web/protocol';

/** Returning undefined (not void) also rejects Promise-returning setters in TypeScript. */
export interface SyncFinanceStorage {
 getItem(key:string):string|null;
 setItem(key:string,value:string):undefined;
 key(index:number):string|null;
 readonly length:number;
}
export type FinanceBinding={open?:(defaults:FinanceData,progress:(state:'loading'|'migrating')=>void)=>Promise<WebFinanceController>;getStorage:()=>SyncFinanceStorage;exclusive:ExclusiveWrite;supportError:()=>string;subscribe:(check:()=>void)=>()=>void;permanence:'browser'|'disposable-session'};

export function memoryFinanceStorage():SyncFinanceStorage{
 const entries=new Map<string,string>();
 return {getItem:key=>entries.get(key)??null,setItem:(key,value)=>{entries.set(key,value);return undefined;},key:index=>[...entries.keys()][index]??null,get length(){return entries.size;}};
}
function browserStorage():SyncFinanceStorage{
 // Access stays lazy: landing/platform detection must never read financial storage.
 // A denied legacy source must not prevent opening an independently readable
 // confirmed database in consultation mode. Every access remains permission-checked.
 return {getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>{window.localStorage.setItem(key,value);return undefined;},key:index=>window.localStorage.key(index),get length(){return window.localStorage.length;}};
}
function focusSubscription(check:()=>void){window.addEventListener('focus',check);return()=>window.removeEventListener('focus',check);}
export const webFinanceBinding:FinanceBinding={
 open:async(defaults,progress)=>(await import('./web/openFinance')).openWebFinance(defaults,browserStorage(),progress),
 getStorage:browserStorage,exclusive:browserExclusiveWrite,supportError:browserStorageSupportError,permanence:'browser',
 subscribe:check=>{const changed=(e:StorageEvent)=>{try{if(e.storageArea===window.localStorage&&(e.key===null||e.key.startsWith('finanzas_pro_')))check();}catch{/* Initialization surfaces a denied store. */}};
  let channel:BroadcastChannel|undefined;try{channel=new BroadcastChannel('finanzas-pro-web-commits-v1');channel.onmessage=()=>check();}catch{/* Focus and transactional CAS remain available. */}
  window.addEventListener('storage',changed);const stop=focusSubscription(check);return()=>{window.removeEventListener('storage',changed);stop();channel?.close();};},
};
export function prototypeFinanceBinding():FinanceBinding{
 const session=memoryFinanceStorage();
 return {getStorage:()=>session,exclusive:browserExclusiveWrite,supportError:browserStorageSupportError,subscribe:focusSubscription,permanence:'disposable-session'};
}
