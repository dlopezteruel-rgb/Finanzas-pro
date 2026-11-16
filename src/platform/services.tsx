import React,{createContext,useContext,useEffect,useRef} from 'react';
import {paths} from '../app/paths';
import {webFinanceBinding,type FinanceBinding} from './financeBinding';

export type PlatformNotice='native.backBlocked'|'native.rootBack'|'native.preferencesFailed'|'native.importBlocked'|'native.exportFailed'|'native.deviceUnavailable'|'native.linkBlocked';
export type BackResult='handled'|'root';
export type PlatformServices={
 prototype:boolean;finance:FinanceBinding;canImport:boolean;assistantEndpoint:string|null;
 exportText:(text:string,filename:string,mime:string,title?:string)=>Promise<void>;
 registerBack:(handler:()=>BackResult)=>()=>void;
 notify:(message:PlatformNotice)=>void;
};
export async function browserExportText(text:string,filename:string,mime:string){
 const csv=mime==='text/csv',url=csv?encodeURI('data:text/csv;charset=utf-8,'+text):URL.createObjectURL(new Blob([text],{type:mime}));
 const link=document.createElement('a');link.href=url;link.download=filename;document.body.appendChild(link);
 try{link.click();}finally{link.remove();if(!csv)setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
const webServices:PlatformServices={prototype:false,finance:webFinanceBinding,canImport:true,assistantEndpoint:paths.assistant,exportText:browserExportText,registerBack:()=>()=>{},notify:()=>{}};
const Context=createContext<PlatformServices>(webServices);
export const PlatformProvider=Context.Provider;
export const usePlatformServices=()=>useContext(Context);
export function usePlatformBack(handler:()=>BackResult){
 const services=usePlatformServices(),latest=useRef(handler);latest.current=handler;
 useEffect(()=>services.registerBack(()=>latest.current()),[services]);
}
export function backRegistry(){
 let current:(()=>BackResult)|undefined;
 return {register:(handler:()=>BackResult)=>{current=handler;return()=>{if(current===handler)current=undefined;};},request:()=>current?.()??'root'};
}
