import React,{lazy,Suspense,useEffect,useMemo,useState,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {createPortal} from 'react-dom';
import {I18nProvider,useI18n} from '../../i18n';
import {SafeDialog} from '../../components/SafeDialog';
import {BUDGET_GROUPS} from '../../constants/categories';
import {storageOwnedText} from '../../i18n/storageMessages';
import {AsyncFinanceStore} from '../vault/asyncFinanceStore';
import {emptySandbox,nativeStoragePolicy} from '../vault/policy';
import {driverError,type DurableFinanceController} from '../vault/protocol';
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
 const [durable,setDurable]=useState<DurableFinanceController>(),[preparing,setPreparing]=useState(false),[vaultProblem,setVaultProblem]=useState(''),[,refreshVault]=useState(0);
 const [recoveryDialog,setRecoveryDialog]=useState(false);
 const mounted=useRef(true);useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;};},[]);
 useEffect(()=>()=>{void durable?.close().catch(()=>{});},[durable]);
 const opening=useRef(false),[exportConsent,setExportConsent]=useState(false),exportDecision=useRef<((value:boolean)=>void)|null>(null);
 useEffect(()=>durable?.subscribe(()=>{refreshVault(n=>n+1);setRecoveryDialog(['recoveryRequired','reloadRequired','conflict'].includes(durable.phase));}),[durable]);
 useEffect(()=>()=>{exportDecision.current?.(false);},[]);
 const finishExport=(confirmed:boolean)=>{const resolve=exportDecision.current;exportDecision.current=null;setExportConsent(false);resolve?.(confirmed);};
 const exportText=async(text:string,filename:string,mime:string,title?:string)=>{
  if(durable){if(exportDecision.current)throw Error('EXPORT_BUSY');const consent=await new Promise<boolean>(resolve=>{exportDecision.current=resolve;setExportConsent(true);});if(!consent)return;}
  await (isNative()?nativeExport:browserExportText)(text,filename,mime,title);
 };
 async function openVault(){
  if(!acknowledged||opening.current)return;opening.current=true;setPreparing(true);setVaultProblem('');
  try{
   const driver=import.meta.env.VITE_VAULT_TEST==='true'?await (await import('../vault/testBridge')).openBrowserTestVault():await (await import('../vault/nativeDriver')).openNativeSandbox(true);
   if(!mounted.current){await driver.close();return;}
   let controller:AsyncFinanceStore;try{controller=await AsyncFinanceStore.open(driver,emptySandbox(BUDGET_GROUPS));}catch(error){await driver.close();throw error;}
   try{await controller.initialize();}catch(error){await controller.close();throw error;}
   if(!mounted.current){await controller.close();return;}setDurable(controller);setStarted(true);
  }catch(error){if(mounted.current)setVaultProblem(driverError(error).code);}finally{opening.current=false;if(mounted.current)setPreparing(false);}
 }
 const [theme,setTheme]=useState(()=>readThemePreference()??'dark');
 const navigation=useMemo(backRegistry,[]);
 const services=useMemo<PlatformServices>(()=>({prototype:true,finance:prototypeFinanceBinding(),durable,canImport:nativeStoragePolicy.externalImport,pickBackup:durable?async()=>await (await import('../vault/nativeDriver')).selectNativeBackup():undefined,assistantEndpoint:null,exportText,registerBack:navigation.register,notify:setNotice}),[navigation,durable]);
 relay.notify=setNotice;
 relay.back=()=>{if(recoveryDialog){setRecoveryDialog(false);return;}if(exportDecision.current){finishExport(false);return;}if(navigation.request()==='root'){if(hostPlatform()==='android')void minimizePrototype().catch(()=>setNotice('native.deviceUnavailable'));else setNotice('native.rootBack');}};
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
  {!started?<main className="native-gate app-load-failure"><Brand/><LanguageSelector/><h1>{t('native.title')}</h1><p>{t('native.warning')}</p><label className="native-consent"><input type="checkbox" checked={acknowledged} onChange={e=>setAcknowledged(e.target.checked)}/><span>{t('native.acknowledge')}</span></label><button className="button-primary" disabled={!acknowledged||preparing} onClick={()=>setStarted(true)}>{t('native.enter')}</button><h2>{t('vault.title')}</h2><p>{t('vault.warning')}</p><button className="button-secondary" disabled={!acknowledged||preparing} onClick={()=>void openVault()}>{t('vault.open')}</button>{preparing&&<p role="status">{t('vault.preparing')}</p>}{vaultProblem&&<p role="alert">{storageOwnedText(vaultProblem,t)}</p>}</main>:<>
   <aside className="native-prototype-bar" aria-label={t('native.title')}><button type="button" className="button-secondary" onClick={()=>relay.back()}>{t('native.back')}</button><div><p>{durable?t('vault.notice'):t('native.sessionNotice')}</p>{durable&&<><p role="status" aria-live="polite">{t(`vault.${durable.phase}`)}</p>{durable.problem&&<p role="alert">{storageOwnedText(durable.problem,t)}</p>}{durable.phase==='recoveryRequired'&&<button onClick={()=>void durable.reconcile().catch(()=>{})}>{t('vault.reconcile')}</button>}{['reloadRequired','conflict'].includes(durable.phase)&&<button onClick={()=>location.reload()}>{t('vault.reload')}</button>}</>}</div></aside>
   <AppBoundary fallback={failed}><Suspense fallback={<main className="app-splash" role="status"><Brand/><p>{t('loading.title')}</p></main>}><Application/></Suspense></AppBoundary>
  </>}
  {recoveryDialog&&durable&&<SafeDialog title={t('vault.title')} onCancel={()=>setRecoveryDialog(false)}><p role="alert">{t(`vault.${durable.phase}`)}</p>{durable.problem&&<p>{storageOwnedText(durable.problem,t)}</p>}<div className="native-vault-actions">{durable.phase==='recoveryRequired'?<button onClick={()=>void durable.reconcile().catch(()=>{})}>{t('vault.reconcile')}</button>:<button onClick={()=>location.reload()}>{t('vault.reload')}</button>}<button onClick={()=>setRecoveryDialog(false)}>{t('vault.cancel')}</button></div></SafeDialog>}
  {exportConsent&&<SafeDialog title={t('vault.exportTitle')} onCancel={()=>finishExport(false)}><p>{t('vault.exportWarning')}</p><div className="native-vault-actions"><button onClick={()=>finishExport(false)}>{t('vault.cancel')}</button><button onClick={()=>finishExport(true)}>{t('vault.exportConfirm')}</button></div></SafeDialog>}
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
