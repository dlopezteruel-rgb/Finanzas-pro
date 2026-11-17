import type {Page} from 'playwright-core';
import {DATA_KEY} from '../src/utils/backup';
import {WEB_DATABASE,WEB_RECORDS,WEB_META} from '../src/platform/web/protocol';

/** Real committed IndexedDB reads. No synchronous shadow or app-state cache. */
export async function readFinancialRecords(page:Page):Promise<Record<string,string>>{
 return page.evaluate(async({database,records,meta,key})=>{
  (window as any).__name??=(fn:unknown)=>fn;
  const legacy:Record<string,string>={};try{for(const [k,v]of Object.entries(localStorage))if(k.startsWith('finanzas_pro_')&&!k.startsWith('finanzas_pro_web_'))legacy[k]=v;}catch{}
  const db=await new Promise<IDBDatabase|null>(resolve=>{const r=indexedDB.open(database);r.onupgradeneeded=()=>r.transaction!.abort();r.onerror=()=>resolve(null);r.onblocked=()=>resolve(null);r.onsuccess=()=>resolve(r.result);});
  if(!db)return legacy;
  try{
   if(!db.objectStoreNames.contains(records)||!db.objectStoreNames.contains(meta))return legacy;
   return await new Promise<Record<string,string>>((resolve,reject)=>{
    const tx=db.transaction([records,meta],'readonly'),migration=tx.objectStore(meta).get('migration'),values:Record<string,string>={};
    const r=tx.objectStore(records).openCursor();r.onsuccess=()=>{const c=r.result;if(c){values[String(c.key)]=c.value;c.continue();}};
    tx.onabort=()=>reject(tx.error);tx.oncomplete=()=>{
     if(migration.result?.status!=='active'){resolve(legacy);return;}
     delete legacy[key];resolve({...legacy,...values});
    };
   });
  }finally{db.close();}
 },{database:WEB_DATABASE,records:WEB_RECORDS,meta:WEB_META,key:DATA_KEY});
}
export async function readFinancialSnapshot(page:Page):Promise<string|null>{return (await readFinancialRecords(page))[DATA_KEY]??null;}
