import {useEffect,useRef,useState} from 'react';
import {recoveryCopies,makeBackup,type FinanceData,StorageConflictError} from './backup';
import {FinanceStore,type RestorationInput,type FinanceMutation} from './financeStore';
import {type SaveResult,saveErrorMessage} from './saveResult';
import {usePlatformServices} from '../platform/services';
import {financeSession} from '../platform/financeSession';
import type {WebFinanceController,WebPhase} from '../platform/web/protocol';
import type {DurableFinanceController,VaultPhase} from '../platform/vault/protocol';
export {loadFinanceData} from './financeStore';

type Store=FinanceStore|WebFinanceController|DurableFinanceController;
export function useFinanceData(defaults:FinanceData){
 const services=usePlatformServices(),binding=services.finance;
 const [initial]=useState(()=>{
  try{
   const selection=financeSession(services);
   if(selection.kind==='web')return {kind:selection.kind,store:null as Store|null,data:defaults,error:'',opening:true};
   const store=selection.kind==='native'?selection.controller:new FinanceStore(binding.getStorage(),defaults,binding.exclusive);
   return {kind:selection.kind,store:store as Store|null,data:store.data,error:'',opening:false};
  }catch(error){return {kind:services.prototype?'native' as const:'web' as const,store:null as Store|null,data:defaults,error:saveErrorMessage(error),opening:false};}
 });
 const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 const [store,setStore]=useState<Store|null>(initial.store),[data,setData]=useState(initial.data),[loadError,setLoadError]=useState(initial.error);
 const [loading,setLoading]=useState(initial.opening),[loadingPhase,setLoadingPhase]=useState<'loading'|'migrating'>('loading');
 const [saveError,setSaveError]=useState(''),[conflict,setConflict]=useState(false),[capabilityError,setCapabilityError]=useState(()=>initial.kind==='prototype'?binding.supportError():'');
 const [persistencePhase,setPersistencePhase]=useState<WebPhase|VaultPhase>(()=>initial.store&&'phase' in initial.store?initial.store.phase:'ready'),[persistenceRevision,setPersistenceRevision]=useState(0);
 const controller=store&&'subscribe' in store?store:undefined;
 function reportError(error:unknown){if(!mounted.current)return;if(error instanceof StorageConflictError)setConflict(true);setSaveError(saveErrorMessage(error));}
 useEffect(()=>{
  if(!initial.opening)return;
  let active=true,opened:WebFinanceController|undefined;
  binding.open!(defaults,phase=>{if(active)setLoadingPhase(phase);}).then(value=>{
   opened=value;if(!active){value.close();return;}
   setStore(value);setData(value.data);setPersistencePhase(value.phase);setCapabilityError(value.phase==='readonly'?value.problem:'');
  }).catch(error=>{if(active){const detail=saveErrorMessage(error);setLoadError(/^No se han podido cargar los datos: /.test(detail)?detail:`No se han podido cargar los datos: ${detail}. Los datos guardados no se han sobrescrito.`);}}).finally(()=>{if(active)setLoading(false);});
  // Only the web session is owned here. Native bootstrap owns/serially closes its controller.
  return()=>{active=false;opened?.close();};
 },[binding]);
 useEffect(()=>{
  if(!controller)return;
  const sync=()=>{setPersistencePhase(controller.phase);setPersistenceRevision(n=>n+1);setCapabilityError(controller.phase==='readonly'?controller.problem??'':'');};
  // Initial phase is captured at controller hand-off; subscribing must not repeat hydration.
  return controller.subscribe(sync);
 },[controller]);
 useEffect(()=>{
  if(!store)return;let active=true;
  const check=async()=>{try{if(await store.checkForConflict()&&active){setConflict(true);setSaveError(new StorageConflictError().message);}}catch(error){if(active)reportError(error);}};
  const stop=binding.subscribe(()=>void check());void check();return()=>{active=false;stop();};
 },[store,binding]);
 useEffect(()=>{
  if(initial.kind!=='prototype'||binding.supportError())return;let active=true;
  binding.exclusive(()=>undefined).catch(error=>{if(active)setCapabilityError(saveErrorMessage(error));});return()=>{active=false;};
 },[binding]);
 function update<K extends keyof FinanceData>(field:K,value:FinanceData[K]|((previous:FinanceData[K])=>FinanceData[K])):Promise<SaveResult>{return mutate(current=>({...current,[field]:typeof value==='function'?value(current[field]):value}));}
 function mutate(transform:FinanceMutation):Promise<SaveResult>{
  if(!store)return Promise.resolve({ok:false,error:loadError||'WEB_UNAVAILABLE'});
  return store.mutate(transform).then(()=>{if(mounted.current){setData(store.data);setSaveError('');}return {ok:true} as const;}).catch(error=>{reportError(error);return {ok:false,error:saveErrorMessage(error)};});
 }
 async function restore(next:RestorationInput){if(!store)throw Error(loadError||'WEB_UNAVAILABLE');try{const confirmed=await store.restore(next);if(mounted.current){setData(confirmed);setSaveError('');}}catch(error){reportError(error);throw error;}}
 const exportForensic=initial.kind==='web'?async()=>
  (await import('../platform/web/forensic')).exportWebForensic(binding.getStorage):undefined;
 return {data,update,mutate,restore,conflict,capabilityError,loadError,saveError,loading,loadingPhase,persistenceKind:initial.kind,persistencePhase,persistenceRevision,
  financeStorage:binding.getStorage,
  readRecoveryCopies:()=>controller?controller.recoveryCopies():Promise.resolve(recoveryCopies(binding.getStorage())),
  exportJSON:()=>controller?controller.exportJSON():Promise.resolve(JSON.stringify(makeBackup(data),null,2)),
  exportForensic,reconcile:async()=>{if(!controller)throw Error(initial.kind==='web'?'WEB_UNAVAILABLE':'VAULT_DISABLED');try{await controller.reconcile();}catch(error){reportError(error);}},
 };
}
