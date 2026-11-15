import {browserExclusiveWrite,type ExclusiveWrite} from '../utils/financeStore';
import {browserStorageSupportError} from '../utils/storageSupport';
import {DATA_KEY} from '../utils/backup';

/** Returning undefined (not void) also rejects Promise-returning setters in TypeScript. */
export interface SyncFinanceStorage {
 getItem(key:string):string|null;
 setItem(key:string,value:string):undefined;
 key(index:number):string|null;
 readonly length:number;
}
export type FinanceBinding={getStorage:()=>SyncFinanceStorage;exclusive:ExclusiveWrite;supportError:()=>string;subscribe:(check:()=>void)=>()=>void;permanence:'browser'|'disposable-session'};

export function memoryFinanceStorage():SyncFinanceStorage{
 const entries=new Map<string,string>();
 return {getItem:key=>entries.get(key)??null,setItem:(key,value)=>{entries.set(key,value);return undefined;},key:index=>[...entries.keys()][index]??null,get length(){return entries.size;}};
}
function browserStorage():SyncFinanceStorage{
 // Access stays lazy: landing/platform detection must never read financial storage.
 const raw=window.localStorage;
 return {getItem:key=>raw.getItem(key),setItem:(key,value)=>{raw.setItem(key,value);return undefined;},key:index=>raw.key(index),get length(){return raw.length;}};
}
function focusSubscription(check:()=>void){window.addEventListener('focus',check);return()=>window.removeEventListener('focus',check);}
export const webFinanceBinding:FinanceBinding={
 getStorage:browserStorage,exclusive:browserExclusiveWrite,supportError:browserStorageSupportError,permanence:'browser',
 subscribe:check=>{const changed=(e:StorageEvent)=>{try{if(e.storageArea===window.localStorage&&(e.key===null||e.key===DATA_KEY))check();}catch{/* Initialization surfaces a denied store. */}};
  window.addEventListener('storage',changed);const stop=focusSubscription(check);return()=>{window.removeEventListener('storage',changed);stop();};},
};
export function prototypeFinanceBinding():FinanceBinding{
 const session=memoryFinanceStorage();
 return {getStorage:()=>session,exclusive:browserExclusiveWrite,supportError:browserStorageSupportError,subscribe:focusSubscription,permanence:'disposable-session'};
}
