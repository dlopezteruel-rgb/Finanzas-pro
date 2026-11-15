import type React from 'react';

export type PreloadTarget='planning'|'catalog'|'assistant';
export type FeatureIntent=(target:PreloadTarget,action:'start'|'cancel'|'use')=>void;
export type PreloadConditions={visible:boolean;ready:boolean;busy:boolean;saveData?:boolean;effectiveType?:string;downlink?:number;rtt?:number;cores?:number;memory?:number;idleAvailable:boolean;inputPending:boolean};
/** Unknown connectivity/capabilities deliberately fall back to ordinary navigation. */
export function canPreload(c:PreloadConditions){
 return c.visible&&c.ready&&!c.busy&&!c.saveData&&c.effectiveType==='4g'&&typeof c.downlink==='number'&&c.downlink>=2&&typeof c.rtt==='number'&&c.rtt<=300&&(c.cores===undefined||c.cores>2)&&(c.memory===undefined||c.memory>2)&&c.idleAvailable&&!c.inputPending;
}
export function browserPreloadConditions(busy:boolean):PreloadConditions{
 if(typeof window==='undefined'||typeof navigator==='undefined')return {visible:false,ready:false,busy:true,idleAvailable:false,inputPending:false};
 try{
 const n=navigator as Navigator&{connection?:{saveData?:boolean;effectiveType?:string;downlink?:number;rtt?:number};deviceMemory?:number;scheduling?:{isInputPending?:()=>boolean}};
 let inputPending=true;try{inputPending=n.scheduling?.isInputPending?.()??false;}catch{/* An unavailable capability never authorizes background work. */}
 const active=document.activeElement;
 return {saveData:n.connection?.saveData,effectiveType:n.connection?.effectiveType,downlink:n.connection?.downlink,rtt:n.connection?.rtt,visible:document.visibilityState==='visible',ready:document.readyState==='complete',busy:busy||!!document.querySelector('[aria-modal="true"]:not(.more-dialog),[aria-busy="true"]')||!!active?.matches('input,textarea,[contenteditable="true"]')||!!document.querySelector<HTMLInputElement>('.home-quick input')?.value,cores:n.hardwareConcurrency,memory:n.deviceMemory,idleAvailable:typeof window.requestIdleCallback==='function',inputPending};
 }catch{return {visible:false,ready:false,busy:true,idleAvailable:false,inputPending:true};}
}
export type PreloadResource={preload:()=>Promise<void>;isLoaded:()=>boolean};
/** At most one unconsumed feature; import evaluation only, never render/provider/store work. */
export function createIntentPreloader(resources:Record<PreloadTarget,PreloadResource>,conditions:()=>PreloadConditions,schedule:{delay:(fn:()=>void)=>()=>void;idle:(fn:()=>void)=>()=>void}){
 let queued:(()=>void)|undefined,unused:PreloadTarget|undefined,inflight=false,disposed=false;
 const cancel=()=>{queued?.();queued=undefined;};
 const intent:FeatureIntent=(target,action)=>{
  cancel();if(action==='use'){if(unused===target)unused=undefined;return;}
  // The gesture itself can still be in the browser input queue. Only enqueue
  // intent here; actual import must pass the complete policy in the idle turn.
  if(action==='cancel'||disposed||inflight||unused||resources[target].isLoaded()||!canPreload({...conditions(),inputPending:false}))return;
  queued=schedule.delay(()=>{queued=schedule.idle(()=>{
   queued=undefined;if(disposed||inflight||unused||resources[target].isLoaded()||!canPreload(conditions()))return;
   inflight=true;unused=target;
   void resources[target].preload().catch(()=>{if(unused===target)unused=undefined;}).finally(()=>{inflight=false;});
  });});
 };
 return {intent,dispose:()=>{disposed=true;cancel();}};
}
/** Dwell works for mouse/pen, focus-visible keyboard and touch hold; short taps remain on demand. */
export function preloadIntentProps(intent:FeatureIntent|undefined,target:PreloadTarget|undefined):Pick<React.HTMLAttributes<HTMLElement>,'onPointerEnter'|'onPointerLeave'|'onPointerDown'|'onPointerUp'|'onPointerCancel'|'onFocus'|'onBlur'> {
 const send=(action:'start'|'cancel')=>{if(target)intent?.(target,action);};
 return {onPointerEnter:e=>{if(e.pointerType!=='touch')send('start');},onPointerLeave:()=>send('cancel'),onPointerDown:()=>send('start'),onPointerUp:()=>send('cancel'),onPointerCancel:()=>send('cancel'),onFocus:e=>{if(e.currentTarget.matches(':focus-visible'))send('start');},onBlur:()=>send('cancel')};
}
