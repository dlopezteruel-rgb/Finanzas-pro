import {useEffect,useRef} from 'react';
import {browserPreloadConditions,createIntentPreloader,type PreloadResource,type PreloadTarget} from './intentPreload';
import {waitForPreloadIdle} from './preloadIdle';

export function useIntentPreload(resources:Record<PreloadTarget,PreloadResource>,busy:()=>boolean){
 const latest=useRef(busy);latest.current=busy;
 const coordinator=useRef<ReturnType<typeof createIntentPreloader>|null>(null);
 useEffect(()=>{
  const instance=createIntentPreloader(resources,()=>browserPreloadConditions(latest.current()),{
   delay:fn=>{const id=window.setTimeout(fn,200);return()=>window.clearTimeout(id);},
   idle:fn=>waitForPreloadIdle(fn,{now:()=>performance.now(),request:callback=>window.requestIdleCallback(callback),cancel:id=>window.cancelIdleCallback?.(id)})
  });coordinator.current=instance;return()=>{instance.dispose();if(coordinator.current===instance)coordinator.current=null;};
 },[resources]);
 return (target:PreloadTarget,action:'start'|'cancel'|'use')=>coordinator.current?.intent(target,action);
}
