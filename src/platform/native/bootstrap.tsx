import React,{lazy,Suspense,useEffect,useMemo,useState} from 'react';
import {createRoot} from 'react-dom/client';
import {createPortal} from 'react-dom';
import {I18nProvider,useI18n} from '../../i18n';
import {Brand} from '../../components/Brand';
import {LanguageSelector} from '../../components/LanguageSelector';
import {readThemePreference} from '../../app/themePreference';
import {hostPlatform} from '../environment';
import {prototypeFinanceBinding} from '../financeBinding';
import {PlatformProvider,backRegistry,browserExportText,type PlatformNotice,type PlatformServices} from '../services';
import {hydrateNativeUI,installNativeRuntime,isNative,minimizePrototype,nativeExport,writeNativeUI} from './runtime';
import './native.css';

const Application=lazy(()=>import('../../App'));
class AppBoundary extends React.Component<{children:React.ReactNode;fallback:React.ReactNode},{failed:boolean}>{
 state={failed:false};static getDerivedStateFromError(){return {failed:true};}
 render(){return this.state.failed?<>{this.props.fallback}</>:<>{this.props.children}</>;}
}
type Relay={back:()=>void;notify:(notice:PlatformNotice)=>void};
function NativePrototype({relay,preferenceFailure}:{relay:Relay;preferenceFailure:boolean}){
 const {t,language}=useI18n(),[started,setStarted]=useState(false),[acknowledged,setAcknowledged]=useState(false);
 const [notice,setNotice]=useState<PlatformNotice|undefined>(preferenceFailure?'native.preferencesFailed':undefined);
 const [theme,setTheme]=useState(()=>readThemePreference()??'dark');
 const navigation=useMemo(backRegistry,[]);
 const services=useMemo<PlatformServices>(()=>({prototype:true,finance:prototypeFinanceBinding(),canImport:false,assistantEndpoint:null,exportText:isNative()?nativeExport:browserExportText,registerBack:navigation.register,notify:setNotice}),[navigation]);
 relay.notify=setNotice;
 relay.back=()=>{if(navigation.request()==='root'){if(hostPlatform()==='android')void minimizePrototype().catch(()=>setNotice('native.deviceUnavailable'));else setNotice('native.rootBack');}};
 useEffect(()=>{const observer=new MutationObserver(()=>{const current=document.documentElement.getAttribute('data-theme');if(current==='light'||current==='dark')setTheme(current);});observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});return()=>observer.disconnect();},[]);
 useEffect(()=>{if(isNative())void writeNativeUI(language,theme).catch(()=>setNotice('native.preferencesFailed'));},[language,theme]);
 useEffect(()=>{
  if(hostPlatform()!=='test')return;
  // Explicit production-build browser preview only; this is not an Android test.
  const back=()=>relay.back(),resume=()=>window.dispatchEvent(new Event('focus'));
  document.addEventListener('finanzas-prototype-back',back);document.addEventListener('finanzas-prototype-resume',resume);
  return()=>{document.removeEventListener('finanzas-prototype-back',back);document.removeEventListener('finanzas-prototype-resume',resume);};
 },[relay]);
 useEffect(()=>{if(started)document.querySelector<HTMLButtonElement>('.native-prototype-bar button')?.focus();},[started]);
 const failed=<main className="app-load-failure"><Brand/><h1>{t('native.title')}</h1><p role="alert">{t('native.packagingError')}</p><button className="button-primary" onClick={()=>location.reload()}>{t('loading.retry')}</button></main>;
 return <PlatformProvider value={services}>
  {!started?<main className="native-gate app-load-failure"><Brand/><LanguageSelector/><h1>{t('native.title')}</h1><p>{t('native.warning')}</p><label className="native-consent"><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)}/><span>{t('native.acknowledge')}</span></label><button className="button-primary" disabled={!acknowledged} onClick={()=>setStarted(true)}>{t('native.enter')}</button></main>:<>
   <aside className="native-prototype-bar" aria-label={t('native.title')}><button type="button" className="button-secondary" onClick={()=>relay.back()}>{t('native.back')}</button><p>{t('native.sessionNotice')}</p></aside>
   <AppBoundary fallback={failed}><Suspense fallback={<main className="app-splash" role="status"><Brand/><p>{t('loading.title')}</p></main>}><Application/></Suspense></AppBoundary>
  </>}
  {notice&&createPortal(<p className="native-notice" role="status" aria-live="polite">{t(notice)}</p>,document.body)}
 </PlatformProvider>;
}
export async function mountNative(node:HTMLElement){
 if(hostPlatform()==='blocked')throw Error('NATIVE_HOST_UNSUPPORTED');
 let preferenceFailure=false;try{await hydrateNativeUI();}catch{preferenceFailure=true;}
 document.documentElement.dataset.nativeShell='prototype';document.documentElement.setAttribute('data-theme',readThemePreference()??'dark');
 const relay:Relay={back:()=>{},notify:()=>{}};
 const stop=await installNativeRuntime(()=>relay.back(),notice=>relay.notify(notice));
 createRoot(node).render(<I18nProvider><NativePrototype relay={relay} preferenceFailure={preferenceFailure}/></I18nProvider>);
 window.addEventListener('pagehide',event=>{if(!event.persisted)stop();});
}
