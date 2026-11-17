import {useEffect,useState} from 'react';
import {recoveryCopies,makeBackup,type FinanceData,StorageConflictError} from './backup';
import {FinanceStore,type RestorationInput,type FinanceMutation} from './financeStore';
import {type SaveResult,saveErrorMessage} from './saveResult';
import {usePlatformServices} from '../platform/services';
import type {WebFinanceController,WebPhase} from '../platform/web/protocol';
export {loadFinanceData} from './financeStore';

type Store=FinanceStore|WebFinanceController;
export function useFinanceData(defaults:FinanceData){
 const {finance:binding}=usePlatformServices();
 const [initial]=useState(()=>{
  if(binding.open)return {store:null as Store|null,data:defaults,error:''};
  try{const store=new FinanceStore(binding.getStorage(),defaults,binding.exclusive);return {store:store as Store|null,data:store.data,error:''};}
  catch(error){return {store:null as Store|null,data:defaults,error:`No se han podido cargar los datos: ${error instanceof Error?error.message:'almacenamiento no disponible'}. Los datos guardados no se han sobrescrito.`};}
 });
 const [store,setStore]=useState<Store|null>(initial.store),[data,setData]=useState(initial.data),[loadError,setLoadError]=useState(initial.error);
 const [loading,setLoading]=useState(!!binding.open),[loadingPhase,setLoadingPhase]=useState<'loading'|'migrating'>('loading');
 const [saveError,setSaveError]=useState(''),[conflict,setConflict]=useState(false),[capabilityError,setCapabilityError]=useState(()=>binding.open?'':binding.supportError());
 const [persistencePhase,setPersistencePhase]=useState<WebPhase>('ready'),[persistenceRevision,setPersistenceRevision]=useState(0);
 const controller=store&&'subscribe' in store?store:undefined;
 function reportError(error:unknown){if(error instanceof StorageConflictError)setConflict(true);setSaveError(saveErrorMessage(error));}
 useEffect(()=>{
  if(!binding.open)return;
  let active=true,opened:WebFinanceController|undefined;
  binding.open(defaults,phase=>{if(active)setLoadingPhase(phase);}).then(value=>{
   opened=value;if(!active){value.close();return;}
   setStore(value);setData(value.data);setPersistencePhase(value.phase);setCapabilityError(value.phase==='readonly'?value.problem:'');
  }).catch(error=>{if(active)setLoadError(saveErrorMessage(error));}).finally(()=>{if(active)setLoading(false);});
  return()=>{active=false;opened?.close();};
 },[binding]);
 useEffect(()=>{
  if(!controller)return;
  return controller.subscribe(()=>{setPersistencePhase(controller.phase);setPersistenceRevision(n=>n+1);setCapabilityError(controller.phase==='readonly'?controller.problem:'');});
 },[controller]);
 useEffect(()=>{
  if(!store)return;let active=true;
  const check=async()=>{try{if(await store.checkForConflict()&&active){setConflict(true);setSaveError(new StorageConflictError().message);}}catch(error){if(active)reportError(error);}};
  const stop=binding.subscribe(()=>void check());void check();return()=>{active=false;stop();};
 },[store,binding]);
 useEffect(()=>{
  if(binding.open||binding.supportError())return;let active=true;
  binding.exclusive(()=>undefined).catch(error=>{if(active)setCapabilityError(saveErrorMessage(error));});return()=>{active=false;};
 },[binding]);
 function update<K extends keyof FinanceData>(field:K,value:FinanceData[K]|((previous:FinanceData[K])=>FinanceData[K])):Promise<SaveResult>{return mutate(current=>({...current,[field]:typeof value==='function'?value(current[field]):value}));}
 function mutate(transform:FinanceMutation):Promise<SaveResult>{
  if(!store)return Promise.resolve({ok:false,error:loadError||'WEB_UNAVAILABLE'});
  return store.mutate(transform).then(()=>{setData(store.data);setSaveError('');return {ok:true} as const;}).catch(error=>{reportError(error);return {ok:false,error:saveErrorMessage(error)};});
 }
 async function restore(next:RestorationInput){if(!store)throw Error(loadError||'WEB_UNAVAILABLE');try{setData(await store.restore(next));setSaveError('');}catch(error){reportError(error);throw error;}}
 async function exportForensic(){
  if(binding.open)return (await import('../platform/web/forensic')).exportWebForensic(binding.getStorage);
  const raw:Record<string,string|null>={},storage=binding.getStorage();for(let i=0;i<storage.length;i++){const key=storage.key(i);if(key?.startsWith('finanzas_pro_'))raw[key]=storage.getItem(key);}
  if(!Object.keys(raw).length)throw Error('WEB_FORENSIC_EMPTY');return JSON.stringify(raw,null,2);
 }
 return {data,update,mutate,restore,conflict,capabilityError,loadError,saveError,loading,loadingPhase,persistencePhase,persistenceRevision,
  financeStorage:binding.getStorage,
  readRecoveryCopies:()=>controller?controller.recoveryCopies():Promise.resolve(recoveryCopies(binding.getStorage())),
  exportJSON:()=>controller?controller.exportJSON():Promise.resolve(JSON.stringify(makeBackup(data),null,2)),
  exportForensic,reconcile:async()=>{if(!controller)throw Error('WEB_UNAVAILABLE');try{await controller.reconcile();}catch(error){reportError(error);}},
 };
}
