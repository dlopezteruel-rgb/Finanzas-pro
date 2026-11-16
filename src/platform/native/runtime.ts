import {Capacitor,SystemBars,SystemBarsStyle,type PluginListenerHandle} from '@capacitor/core';
import {App} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
import {Filesystem,Directory,Encoding} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {Keyboard,KeyboardStyle} from '@capacitor/keyboard';
import {Preferences} from '@capacitor/preferences';
import {hydrateVisualPreferences,visualPreferenceWriter} from './preferences';
import {nativeFileExporter,EXPORT_DIRECTORY} from './fileExport';
import type {PlatformNotice} from '../services';
import {externalHttpsLink} from '../linkPolicy';

export const isNative=()=>Capacitor.isNativePlatform();
export async function hydrateNativeUI(){if(isNative())await hydrateVisualPreferences(Preferences,window.localStorage);}
export const writeNativeUI=visualPreferenceWriter(Preferences);
export const nativeExport=nativeFileExporter({
 list:async()=>{const result=await Filesystem.readdir({directory:Directory.Cache,path:EXPORT_DIRECTORY});return result.files;},
 write:async(path,text)=>(await Filesystem.writeFile({directory:Directory.Cache,path,data:text,encoding:Encoding.UTF8,recursive:true})).uri,
 read:async path=>{const {data}=await Filesystem.readFile({directory:Directory.Cache,path,encoding:Encoding.UTF8});if(typeof data!=='string')throw Error('EXPORT_READ_INVALID');return data;},
 remove:async path=>{await Filesystem.deleteFile({directory:Directory.Cache,path});},
 share:async(uri,title)=>{await Share.share({files:[uri],title,dialogTitle:title});},
},()=>Array.from(crypto.getRandomValues(new Uint32Array(4)),n=>n.toString(16)).join('-'));

export async function minimizePrototype(){if(Capacitor.getPlatform()==='android')await App.minimizeApp();}

/** Optional native APIs live here, never in the initial web entry. No finance writes. */
export async function installNativeRuntime(onBack:()=>void,notify:(notice:PlatformNotice)=>void){
 if(!isNative())return()=>{};
 const handles:PluginListenerHandle[]=[];let disposed=false;
 const add=async(promise:Promise<PluginListenerHandle>)=>{const handle=await promise;if(disposed)await handle.remove();else handles.push(handle);};
 const theme=()=>{
  const light=document.documentElement.getAttribute('data-theme')==='light';
  void SystemBars.setStyle({style:light?SystemBarsStyle.Light:SystemBarsStyle.Dark}).catch(()=>notify('native.deviceUnavailable'));
  if(Capacitor.getPlatform()==='ios')void Keyboard.setStyle({style:light?KeyboardStyle.Light:KeyboardStyle.Dark}).catch(()=>notify('native.deviceUnavailable'));
 };
 const observer=new MutationObserver(theme);
 const clicked=(event:MouseEvent)=>{
  const link=(event.target as Element|null)?.closest<HTMLAnchorElement>('a[href]');
  if(!link||link.download||link.getAttribute('href')?.startsWith('#'))return;
  event.preventDefault();
  if(new URL(link.href).origin===location.origin){onBack();return;}
  const safe=externalHttpsLink(link.href);
  if(!safe||!event.isTrusted){notify('native.linkBlocked');return;}
  void Browser.open({url:safe}).catch(()=>notify('native.deviceUnavailable'));
 };
 try{
  // Register Android's override before enabling App; never allow default exit
  // to bypass a financial form when a bridge/plugin is unavailable.
  if(Capacitor.getPlatform()==='android')await add(App.addListener('backButton',()=>{
   if(document.documentElement.dataset.nativeKeyboard==='open'){void Keyboard.hide().catch(()=>notify('native.backBlocked'));return;}
   onBack();
  }));
  await add(App.addListener('appStateChange',state=>{if(state.isActive)window.dispatchEvent(new Event('focus'));}));
  await add(App.addListener('appUrlOpen',()=>notify('native.importBlocked')));
  await add(Keyboard.addListener('keyboardDidShow',()=>{document.documentElement.dataset.nativeKeyboard='open';}));
  await add(Keyboard.addListener('keyboardDidHide',()=>{delete document.documentElement.dataset.nativeKeyboard;}));
  observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});theme();document.addEventListener('click',clicked,true);
 }catch(error){disposed=true;await Promise.all(handles.map(h=>h.remove()));throw error;}
 return()=>{disposed=true;observer.disconnect();document.removeEventListener('click',clicked,true);for(const h of handles)void h.remove().catch(()=>{});};
}
