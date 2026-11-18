/** Browser-only contract probe. Controllers are controlled transports, not native certification. */
import React,{Profiler,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {PlatformProvider,type PlatformServices} from '../../src/platform/services';
import {prototypeFinanceBinding} from '../../src/platform/financeBinding';
import {useFinanceData} from '../../src/utils/useFinanceData';
const w=window as any,state=w.__hookState={renders:0,opens:0,closes:0,legacyReads:0,subscriptions:0,proposals:0,confirmed:undefined as any,results:[] as unknown[]};
let confirmed=w.__hookData,phase='ready',openResolve:(v:unknown)=>void,openReject:(v:unknown)=>void,commitResolve:(v:unknown)=>void,next:any;
const listeners=new Set<()=>void>(),mode=new URLSearchParams(location.search).get('mode')??'web';
const controller={get data(){return confirmed;},get phase(){return phase;},problem:'',subscribe(listener:()=>void){state.subscriptions++;listeners.add(listener);return()=>{state.subscriptions--;listeners.delete(listener);};},checkForConflict:async()=>false,recoveryCopies:async()=>[],exportJSON:async()=>JSON.stringify(confirmed),reconcile:async()=>{},close:()=>{state.closes++;},mutate:async(transform:(data:any)=>any)=>{state.proposals=(state.proposals??0)+1;next=transform(structuredClone(confirmed));phase='saving';listeners.forEach(fn=>fn());return new Promise(resolve=>{commitResolve=resolve;});},restore:async()=>confirmed};
const finance={...prototypeFinanceBinding(),getStorage:()=>{state.legacyReads++;throw Error('No fallback storage');},open:mode==='web'?async()=>{state.opens++;return new Promise((resolve,reject)=>{openResolve=resolve;openReject=reject;});}:undefined};
const services={prototype:mode==='native',finance,durable:mode==='native'?controller:undefined,canImport:false,assistantEndpoint:null,exportText:async()=>{},registerBack:()=>()=>{},notify:()=>{}} as unknown as PlatformServices;
function Probe(){const f=useFinanceData(w.__hookDefaults),[result,setResult]=useState('');return <><output id="phase">{f.loading?'loading':f.loadError?'error':'ready'}</output><output id="wallets">{f.loading||f.loadError?'hidden':String(f.data.wallets.length)}</output><output id="result">{result}</output><button id="save" onClick={()=>void f.mutate(data=>({...data,wallets:[...data.wallets,w.__hookWallet]})).then(value=>{state.results.push(value);setResult(value.ok?'saved':'error');})}>save</button></>;}
const root=createRoot(document.getElementById('root')!);root.render(<PlatformProvider value={services}><Profiler id="hook" onRender={()=>state.renders++}><Probe/></Profiler></PlatformProvider>);
w.__hookControls={open:()=>openResolve(controller),failOpen:()=>openReject(Error('WEB_UNAVAILABLE')),unmount:()=>root.unmount(),confirm:()=>{confirmed=next;phase='ready';listeners.forEach(fn=>fn());state.confirmed=confirmed;commitResolve(confirmed);}};
