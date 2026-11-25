import React,{useEffect,useRef,useState} from 'react';
import {Brand} from '../components/Brand';
import {LanguageSelector} from '../components/LanguageSelector';
import {useI18n} from '../i18n';
import {useVisualTheme} from '../app/useVisualTheme';
import {paths} from '../app/paths';
import {identityFromWebSession,parseWebSession,type WebSession} from '../app/auth0Session';
import './access.css';
/** Independent host: never imports App, FinanceStore, PlatformServices or a financial adapter. */
export default function AccessPage(){
 const {t,language}=useI18n();const {theme}=useVisualTheme('light');const [session,setSession]=useState<WebSession|null>(null),[error,setError]=useState(false),[pending,setPending]=useState(false),[busy,setBusy]=useState(false);
 const generation=useRef(0),abort=useRef<AbortController|null>(null),alive=useRef(false);
 const refresh=()=>{
  const id=++generation.current;abort.current?.abort();const controller=new AbortController();abort.current=controller;setPending(true);
  void fetch(paths.home+'api/identity/session',{credentials:'same-origin',cache:'no-store',signal:controller.signal}).then(r=>{if(!r.ok)throw Error();return r.json();}).then(parseWebSession).then(value=>{
   if(id===generation.current&&alive.current){setSession(value);setError(false);}
  },()=>{if(id===generation.current&&alive.current){setSession(null);setError(true);}}).finally(()=>{if(id===generation.current&&alive.current)setPending(false);});
 };
 useEffect(()=>{alive.current=true;refresh();const resume=()=>{setBusy(false);refresh();};window.addEventListener('focus',resume);window.addEventListener('pageshow',resume);
  return()=>{alive.current=false;++generation.current;abort.current?.abort();window.removeEventListener('focus',resume);window.removeEventListener('pageshow',resume);};},[]);
 const expired=session?.status==='authenticated'&&identityFromWebSession(session).status==='expired';
 useEffect(()=>{if(session?.status!=='authenticated'||session.session.expiresAtMs<=Date.now())return;const timer=setTimeout(refresh,Math.max(1,session.session.expiresAtMs-Date.now()));return()=>clearTimeout(timer);},[session]);
 const authenticated=session?.status==='authenticated'&&!expired,available=session?.status==='signed-out'||session?.status==='authenticated';
 const methods=session?.methods??{email:false,google:false,apple:false};
 const form=(label:'auth.login'|'auth.signup'|'auth.recover'|'auth.google'|'auth.apple'|'auth.logout'|'auth.reauth',method:string,action:string)=>
  <form action={paths.home+'api/identity/'+(action==='logout'?'logout':'login')} method="post" onSubmit={e=>{if(busy){e.preventDefault();return;}setBusy(true);}}>
   <input type="hidden" name="method" value={method}/><input type="hidden" name="action" value={action}/><input type="hidden" name="language" value={language}/>
   <button className="button-secondary" disabled={busy||pending||!available} type="submit">{label==='auth.reauth'?t('auth.reauth',{method:method==='email'?t('auth.emailMethod'):method==='google'?'Google':'Apple'}):t(label)}</button>
  </form>;
 return <div className="access-shell" data-theme={theme}><header className="landing-header"><Brand/><LanguageSelector appearance="landing"/></header>
  <main id="access-content" className="access-panel"><h1>{t('auth.title')}</h1><p>{t('auth.description')}</p>
   <p className="access-notice">{t('auth.noFinancial')}</p><p>{t('auth.linking')}</p>
   {pending&&<p role="status">{t('auth.wait')}</p>}{busy&&<p role="status">{t('auth.redirect')}</p>}
   {(error||new URLSearchParams(location.search).has('authError'))&&<p role="alert">{t('auth.error')}</p>}
   {session&&!available&&!expired&&<p role="status">{t('auth.unconfigured')}</p>}
   {expired&&<p role="alert">{t('auth.expired')}</p>}
   {authenticated&&<section aria-label={t('auth.session')}><h2>{t('auth.session')}</h2><p role="status">{t(session.emailVerified?'auth.verified':'auth.verify')}</p>
    {methods.email&&form('auth.reauth','email','reauth')}{methods.google&&form('auth.reauth','google','reauth')}{methods.apple&&form('auth.reauth','apple','reauth')}{form('auth.logout','email','logout')}</section>}
   {!authenticated&&<div className="access-actions">{methods.email&&<>{form('auth.login','email','login')}{form('auth.signup','email','signup')}{form('auth.recover','email','recover')}<p>{t('auth.recoverHelp')}</p></>}
    {methods.google&&form('auth.google','google','login')}{methods.apple&&form('auth.apple','apple','login')}</div>}
   <button type="button" className="button-secondary" onClick={refresh} disabled={pending||busy}>{t('auth.retry')}</button>
   <p>{t('auth.legacy')}</p><a className="button-secondary" href={paths.home}>{t('loading.back')}</a>
  </main></div>;
}
