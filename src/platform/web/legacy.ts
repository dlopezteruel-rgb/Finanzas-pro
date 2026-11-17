import {DATA_KEY,RECOVERY_PREFIX,type FinanceData} from '../../utils/backup';
import {loadFinanceData} from '../../utils/financeStore';
import type {SyncFinanceStorage} from '../financeBinding';
import {WEB_INTERNAL_PREFIX,WebStorageError,digest,type LegacySource,type Migration} from './protocol';

export function legacyInventory(storage:SyncFinanceStorage):LegacySource{
 const source:LegacySource={};
 for(let i=0;i<storage.length;i++){
  const key=storage.key(i);
  if(key?.startsWith('finanzas_pro_')&&!key.startsWith(WEB_INTERNAL_PREFIX)){
   const value=storage.getItem(key);if(value!==null)source[key]=value;
  }
 }
 return Object.fromEntries(Object.entries(source).sort(([a],[b])=>a<b?-1:a>b?1:0));
}
export const sourceHash=(source:LegacySource)=>digest(JSON.stringify(Object.fromEntries(Object.entries(source).sort(([a],[b])=>a<b?-1:a>b?1:0))));
export function sourceData(source:LegacySource,defaults:FinanceData):FinanceData{
 // Original legacy parser and provenance rules, with no mutation of its values.
 return loadFinanceData({getItem:key=>source[key]??null},defaults);
}
export function sourceCopies(source:LegacySource){return Object.entries(source).filter(([key])=>key.startsWith(RECOVERY_PREFIX)).map(([key,content])=>({key,content}));}
export function isGuard(raw:string|null):boolean{
 try{return JSON.parse(raw??'null')?.finanzasWebStorage==='indexeddb-strict-v1';}catch{return false;}
}
export async function verifyLegacy(storage:SyncFinanceStorage,migration:Migration,repair:boolean){
 const current=legacyInventory(storage),raw=current[DATA_KEY]??null;
 if(raw===migration.guard){
  // Ignore only our own guard. Every other original financial key remains protected.
  if(migration.source[DATA_KEY]===undefined)delete current[DATA_KEY];else current[DATA_KEY]=migration.source[DATA_KEY];
 }else if(!repair||isGuard(raw))throw new WebStorageError('WEB_LEGACY_DIVERGED');
 if(await sourceHash(Object.fromEntries(Object.entries(current).sort(([a],[b])=>a<b?-1:a>b?1:0)))!==migration.sourceHash)throw new WebStorageError('WEB_LEGACY_DIVERGED');
 if(raw!==migration.guard){
  // This fences live older clients; it is NOT the financial durability confirmation.
  storage.setItem(DATA_KEY,migration.guard);
  if(storage.getItem(DATA_KEY)!==migration.guard)throw new WebStorageError('WEB_LEGACY_DIVERGED');
 }
}
