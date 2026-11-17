import {DATA_KEY,serializeSnapshot,type FinanceData} from '../../utils/backup';
import {STORAGE_LOCK} from '../../utils/financeStore';
import {browserStorageSupportError} from '../../utils/storageSupport';
import type {SyncFinanceStorage} from '../financeBinding';
import {IndexedFinanceDriver} from './indexedDb';
import {ReadOnlyWebController,WebController} from './controller';
import {isGuard,legacyInventory,sourceCopies,sourceData,sourceHash,verifyLegacy} from './legacy';
import {saveErrorMessage} from '../../utils/saveResult';
import {WebStorageError,digest,validateHead,type AsyncExclusive,type Migration,type WebFinanceController} from './protocol';

export const exclusiveWebOperation:AsyncExclusive=async work=>{
 const reason=browserStorageSupportError();if(reason)throw Error(reason);
 const cancellation=new AbortController();let acquired=false;
 // Native Web Locks cancellation removes queued requests. Once granted, no deadline can
 // release the lock or pretend a running transaction was cancelled or committed.
 const deadline=setTimeout(()=>cancellation.abort(),10000);
 try{return await navigator.locks.request(STORAGE_LOCK,{signal:cancellation.signal},async()=>{acquired=true;clearTimeout(deadline);return await work();});}
 catch(error){if(!acquired&&cancellation.signal.aborted)throw new WebStorageError('WEB_OPEN_BLOCKED');throw error;}
 finally{clearTimeout(deadline);}
};
export async function openWebFinance(defaults:FinanceData,storage:SyncFinanceStorage,progress:(state:'loading'|'migrating')=>void=()=>{}):Promise<WebFinanceController>{
 progress('loading');let driver:IndexedFinanceDriver|undefined;
 const support=browserStorageSupportError();
 const legacyData=(source:import('./protocol').LegacySource)=>{try{return sourceData(source,defaults);}catch{throw new WebStorageError('WEB_CORRUPT');}};
 try{
  if(support){
   try{driver=await IndexedFinanceDriver.open(false);const state=await driver.inspect();await validateHead(state.head);if(state.head.snapshot!==null){const {parseSnapshot}=await import('../../utils/backup');return new ReadOnlyWebController(parseSnapshot(state.head.snapshot),support,storage,driver,state.head);}}catch{/* No unsupported writes; preserve the readable legacy copy below. */}
   return new ReadOnlyWebController(legacyData(legacyInventory(storage)),support,storage,driver);
  }
  return await exclusiveWebOperation(async()=>{
   driver=await IndexedFinanceDriver.open();
   try{driver.requireStrict();}catch(error){const state=await driver.inspect();await validateHead(state.head);const {parseSnapshot}=await import('../../utils/backup');return new ReadOnlyWebController(state.head.snapshot===null?legacyData(legacyInventory(storage)):parseSnapshot(state.head.snapshot),(error as Error).message,storage,driver,state.head.snapshot!==null?state.head:undefined);}
   let state=await driver.inspect();await validateHead(state.head);
   if(!state.migration){
    const source=legacyInventory(storage);if(isGuard(source[DATA_KEY]??null))throw new WebStorageError('WEB_CORRUPT');
    const data=legacyData(source),hasSource=Object.keys(source).length>0;
    const snapshot=source[DATA_KEY]??(hasSource?serializeSnapshot(data):null),hash=snapshot===null?null:await digest(snapshot),id=crypto.randomUUID();
    const migration:Migration={schema:1,id,status:'prepared',source,initialHash:hash,sourceHash:await sourceHash(source),guard:JSON.stringify({finanzasWebStorage:'indexeddb-strict-v1',databaseId:id})};
    progress('migrating');await driver.prepare(migration,snapshot,hash,sourceCopies(source));state=await driver.inspect();await validateHead(state.head);
   }
   const migration=state.migration!;
   if(await sourceHash(migration.source)!==migration.sourceHash)throw new WebStorageError('WEB_CORRUPT');
   await verifyLegacy(storage,migration,true);
   if(migration.status==='prepared'){progress('migrating');await driver.activate(migration.id);}
   const confirmed=await driver.inspect();await validateHead(confirmed.head);
   if(confirmed.migration?.status!=='active'||confirmed.migration.id!==migration.id)throw new WebStorageError('WEB_CORRUPT');
   return new WebController(driver,storage,{...migration,status:'active'},confirmed.head,defaults,exclusiveWebOperation);
  });
 }catch(error){
  const reason=error instanceof WebStorageError?error.code:error instanceof Error&&['QuotaExceededError','SecurityError','NotAllowedError'].includes(error.name)?saveErrorMessage(error):'WEB_UNAVAILABLE';
  if(driver){
   // A corrupt new head is never replaced by, or silently hidden behind, an old profile.
   const state=await driver.inspect();await validateHead(state.head);
   const {parseSnapshot}=await import('../../utils/backup');
   if(state.head.snapshot!==null)return new ReadOnlyWebController(parseSnapshot(state.head.snapshot),reason,storage,driver,state.head);
   if(state.migration)return new ReadOnlyWebController(legacyData(state.migration.source),reason,storage,driver);
  }
  const source=legacyInventory(storage);if(isGuard(source[DATA_KEY]??null))throw error;
  return new ReadOnlyWebController(legacyData(source),support||'WEB_LEGACY_VIEW',storage,driver);
 }
}
