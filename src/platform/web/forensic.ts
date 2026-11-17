import {isGuard,legacyInventory} from './legacy';
import {DATA_KEY,RECOVERY_PREFIX} from '../../utils/backup';
import {WEB_DATABASE,WebStorageError,type Forensic,type WebDriver} from './protocol';
import type {SyncFinanceStorage} from '../financeBinding';

/** Read unknown/corrupt schemas as raw records; never upgrade, clear or recreate them. */
async function rawDatabase():Promise<Record<string,unknown[]>>{
 const db=await new Promise<IDBDatabase>((resolve,reject)=>{
  let settled=false;const request=indexedDB.open(WEB_DATABASE);
  const deadline=setTimeout(()=>fail(new WebStorageError('WEB_OPEN_BLOCKED')),10000);
  const fail=(error:unknown)=>{if(!settled){settled=true;clearTimeout(deadline);reject(error);}};
  request.onupgradeneeded=()=>request.transaction!.abort();
  request.onblocked=()=>fail(new WebStorageError('WEB_OPEN_BLOCKED'));
  request.onerror=()=>fail(request.error);
  request.onsuccess=()=>{if(settled)request.result.close();else{settled=true;clearTimeout(deadline);resolve(request.result);}};
 });
 try{
  const names=Array.from(db.objectStoreNames);if(!names.length)return {};
  return await new Promise<Record<string,unknown[]>>((resolve,reject)=>{
   const tx=db.transaction(names,'readonly'),result:Record<string,unknown[]>={};
   tx.onabort=()=>reject(tx.error);tx.oncomplete=()=>resolve(result);
   for(const name of names){result[name]=[];const request=tx.objectStore(name).openCursor();request.onsuccess=()=>{const c=request.result;if(c){result[name].push({key:c.key,value:c.value});c.continue();}};}
  });
 }finally{db.close();}
}
export function hasForensicData(report:Forensic):boolean{
 const legacy=Object.entries(report.legacy).some(([key,value])=>value.length>0&&(key!==DATA_KEY||!isGuard(value)));
 const records=(report.database.finance??[]) as {key?:unknown;value?:unknown}[];
 const current=records.some(row=>row.key===DATA_KEY||typeof row.key==='string'&&row.key.startsWith(RECOVERY_PREFIX));
 const archived=(report.database.metadata??[]).some((row:any)=>row.key==='migration'&&row.value?.source&&Object.keys(row.value.source).length>0);
 const unknown=Object.entries(report.database).some(([name,rows])=>!['finance','metadata','operations'].includes(name)&&rows.length>0);
 return legacy||current||archived||unknown;
}
export async function exportWebForensic(storage:()=>SyncFinanceStorage,driver?:WebDriver):Promise<string>{
 const report:Forensic={kind:'finanzas-web-forensic',schema:1,complete:true,errors:[],legacy:{},database:{}};
 try{report.legacy=legacyInventory(storage());}catch{report.complete=false;report.errors.push('LEGACY_UNREADABLE');}
 try{report.database=driver?await driver.forensic():await rawDatabase();}catch{report.complete=false;report.errors.push('DATABASE_UNREADABLE');}
 if(!hasForensicData(report))throw new WebStorageError('WEB_FORENSIC_EMPTY');
 return JSON.stringify(report,null,2);
}
