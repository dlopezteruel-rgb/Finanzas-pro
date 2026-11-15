import React, {lazy, Suspense, useState} from 'react';
import {useI18n, type MessageKey, type MessageSlots} from '../i18n';

type FeatureNameKey = {[K in MessageKey]: MessageSlots<K> extends never ? K : never}[MessageKey];

function FeatureState({name,failed,retry,loadingKey}:{name:FeatureNameKey;failed?:boolean;retry?:()=>void;loadingKey?:FeatureNameKey}){
 const {t}=useI18n();
 return <section className="planning-card deferred-feature" aria-busy={failed?undefined:true}>
  <p role={failed?'alert':'status'}>{!failed&&loadingKey?t(loadingKey):t(failed?'feature.error':'feature.loading',{name:t(name)})}</p>
  {failed&&<button type="button" className="button-secondary" onClick={retry}>{t('loading.retry')}</button>}
 </section>;
}
class FeatureBoundary extends React.Component<{children:React.ReactNode;fallback:React.ReactNode},{failed:boolean}>{
 state={failed:false};
 static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?this.props.fallback:this.props.children;}
}
/** One loader per feature; successful modules and in-flight requests are shared, never stores/providers. */
export function deferredFeature<C extends React.ComponentType<any>>(loader:()=>Promise<{default:C}>,name:FeatureNameKey,loadingKey?:FeatureNameKey):React.ComponentType<React.ComponentProps<C>>&{preload:()=>Promise<void>;isLoaded:()=>boolean}{
 let request:ReturnType<typeof loader>|undefined;
 let resolved:C|undefined;
 const load=()=>request??=(loader().then(module=>{resolved=module.default;return module;}).catch(error=>{request=undefined;throw error;}));
 // Keep React's fulfilled lazy payload across visits/month keys, not only its import Promise.
 let Cached=lazy(load);
 function DeferredFeature(props:React.ComponentProps<C>){
  const [attempt,setAttempt]=useState(0),[Component,setComponent]=useState(()=>resolved??Cached);
  const Loaded=Component as React.ComponentType<React.ComponentProps<C>>;
  const retry=()=>{
   const target=document.activeElement?.closest<HTMLElement>('[role="tabpanel"]')??document.getElementById('app-content');
   target?.focus({preventScroll:true});
   Cached=lazy(load);setComponent(()=>Cached);setAttempt(n=>n+1);
  };
  return <FeatureBoundary key={attempt} fallback={<FeatureState name={name} failed retry={retry}/>}><Suspense fallback={<FeatureState name={name} loadingKey={loadingKey}/>}><Loaded {...props}/></Suspense></FeatureBoundary>;
 }
 return Object.assign(DeferredFeature,{preload:()=>load().then(()=>undefined),isLoaded:()=>resolved!==undefined});
}
