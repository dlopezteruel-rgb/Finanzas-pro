import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import {generateKeyPair,exportJWK,SignJWT,decodeProtectedHeader} from 'jose';
import {createHash} from 'node:crypto';
import {readAuthConfig} from '../../server/identity/config';
import {createIdentityRouter} from '../../server/identity/router';
import {parseWebSession,identityFromWebSession} from '../app/auth0Session';
import {realFinancialAccess} from './coordinator';
const env={AUTH0_ENABLED:'true',AUTH0_DEVELOPMENT_APPROVED:'true',AUTH0_BASE_URL:'http://127.0.0.1:3000',AUTH0_ISSUER_BASE_URL:'https://fixture.auth.invalid/',AUTH0_CLIENT_ID:'FICTIONAL_CLIENT_ID',AUTH0_CLIENT_SECRET:'FICTIONAL_SECRET_NOT_DEPLOYABLE',AUTH0_SESSION_SECRET:'a'.repeat(64),AUTH0_EMAIL_CONNECTION:'EmailFixture',AUTH0_GOOGLE_CONNECTION:'google-oauth2',AUTH0_APPLE_CONNECTION:'apple',NODE_ENV:'development'};
for(const [name,overrides] of Object.entries({disabled:{AUTH0_ENABLED:''},debug:{DEBUG:'express-openid-connect:*'},approval:{AUTH0_DEVELOPMENT_APPROVED:''},production:{NODE_ENV:'production'},missingSecret:{AUTH0_CLIENT_SECRET:''},shortCookieKey:{AUTH0_SESSION_SECRET:'short'},httpIssuer:{AUTH0_ISSUER_BASE_URL:'http://evil.invalid'},urlCredentials:{AUTH0_BASE_URL:'https://a:b@host.invalid'},externalHttp:{AUTH0_BASE_URL:'http://host.invalid'},baseQuery:{AUTH0_BASE_URL:'https://host.invalid/?x'},allMethodsMissing:{AUTH0_EMAIL_CONNECTION:'',AUTH0_GOOGLE_CONNECTION:'',AUTH0_APPLE_CONNECTION:''},unsafeConnection:{AUTH0_EMAIL_CONNECTION:'../injection'}}))test('Auth0 configuration fails closed: '+name,()=>assert.equal(readAuthConfig({...env,...overrides}).ready,false));
test('Auth0 approved development config supports base path without exposing secrets',()=>{const c=readAuthConfig({...env,APP_BASE_PATH:'/finanzas'});assert.equal(c.ready,true);assert.equal(c.access,'/finanzas/access');assert.equal(c.prefix,'/finanzas/api/identity');});
async function fixture(overrides:Record<string,string>={}){
 const {privateKey,publicKey}=await generateKeyPair('RS256');const jwk={...await exportJWK(publicKey),kid:'fixture-key',alg:'RS256',use:'sig'};
 const app=express(),server=app.listen(0,'127.0.0.1');await once(server,'listening');const origin='http://127.0.0.1:'+(server.address()as any).port;
 const issuer=env.AUTH0_ISSUER_BASE_URL;let active:any=null,mode='valid',subject='auth0|fictional-A',calls:string[]=[];
 const transport=async(input:any,init?:RequestInit)=>{
  const url=String(input);calls.push(url);
  if(url===issuer+'.well-known/openid-configuration')return Response.json({issuer,authorization_endpoint:issuer+'authorize',token_endpoint:issuer+'oauth/token',jwks_uri:issuer+'jwks',end_session_endpoint:issuer+'oidc/logout',id_token_signing_alg_values_supported:['RS256'],response_types_supported:['code'],subject_types_supported:['public'],token_endpoint_auth_methods_supported:['client_secret_basic'],code_challenge_methods_supported:['S256']});
  if(url===issuer+'jwks')return Response.json({keys:[jwk]});
  if(url===issuer+'oauth/token'){
   if(mode==='revoked')return Response.json({error:'invalid_grant',error_description:'SECRET_PROVIDER_DESCRIPTION'}, {status:400});
   const body=new URLSearchParams(init?.body as string);assert.equal(body.get('code'),'fixture-code');assert.equal(body.get('grant_type'),'authorization_code');assert.equal(body.get('redirect_uri'),origin+'/api/identity/callback');
   assert.equal(createHash('sha256').update(body.get('code_verifier')!).digest('base64url'),active.get('code_challenge'));
   const now=Math.floor(Date.now()/1000);const id=await new SignJWT({nonce:mode==='nonce'?'wrong':active.get('nonce'),email:'same@fictional.invalid',email_verified:true,auth_time:now,...(mode==='ceiling'?{session_expiry:now+60}:{})}).setProtectedHeader({alg:'RS256',kid:'fixture-key'}).setIssuer(mode==='issuer'?'https://wrong.invalid/':issuer).setAudience(mode==='audience'?'WRONG':env.AUTH0_CLIENT_ID).setSubject(subject).setIssuedAt(now).setExpirationTime(mode==='expired'?now-60:now+600).sign(privateKey);
   return Response.json({token_type:'Bearer',access_token:'FAKE_ACCESS_NEVER_PROJECT',id_token:id,expires_in:600});
  }
  throw Error('Unexpected network request');
 };
 app.use(createIdentityRouter(readAuthConfig({...env,AUTH0_BASE_URL:origin,...overrides}),transport));app.get('/access',(_req,res)=>res.send('fixture access host'));
 const jar=new Map<string,string>();const request=async(route:string,init:RequestInit={})=>{
  const response=await fetch(origin+route,{...init,redirect:'manual',headers:{Cookie:[...jar].map(([k,v])=>k+'='+v).join('; '),...init.headers}});
  for(const cookie of response.headers.getSetCookie()){const [k,...v]=cookie.split(';')[0].split('=');jar.set(k,v.join('='));}
  return response;
 };
 const post=(route:string,body='method=email&action=login',originHeader=origin)=>request(route,{method:'POST',headers:{Origin:originHeader,'Content-Type':'application/x-www-form-urlencoded'},body});
 const start=async(action='login',method='email')=>{const r=await post('/api/identity/login',`method=${method}&action=${action}&language=pt&returnTo=https://evil.invalid`);assert.equal(r.status,302);const u=new URL(r.headers.get('location')!);active=u.searchParams;assert.equal(u.origin,new URL(issuer).origin);assert.equal(active.get('redirect_uri'),origin+'/api/identity/callback');assert.equal(active.get('response_type'),'code');assert.equal(active.get('code_challenge_method'),'S256');assert.ok(active.get('nonce'));assert.ok(active.get('state'));assert.equal(active.get('ui_locales'),'pt-PT');assert.equal(active.get('prompt'),'login');return r;};
 const callback=()=>request('/api/identity/callback?code=fixture-code&state='+encodeURIComponent(active.get('state')));
 return {request,post,start,callback,jar,setMode:(v:string)=>mode=v,setSubject:(v:string)=>subject=v,calls,close:()=>new Promise<void>((resolve,reject)=>server.close(e=>e?reject(e):resolve()))};
}
test('Auth0 official SDK: code PKCE, encrypted HttpOnly cookie, reload and redacted projection',async()=>{const f=await fixture();try{
 assert.equal((await(await f.request('/api/identity/session')).json()).status,'signed-out');await f.start();const callback=await f.callback();assert.equal(callback.status,302);assert.equal(callback.headers.get('location'),'/access');assert.match(callback.headers.getSetCookie().join(';'),/HttpOnly/i);assert.match(callback.headers.getSetCookie().join(';'),/SameSite=Lax/i);
 const raw=await(await f.request('/api/identity/session')).text();assert.doesNotMatch(raw,/FAKE_ACCESS|id_token|refresh_token|clientSecret|same@fictional/);const value=parseWebSession(JSON.parse(raw));assert.equal(value.status,'authenticated');assert.equal((value as any).session.identity.applicationSubject,null);assert.equal(value.financialAccess,false);
 const again=await(await f.request('/api/identity/session')).json();assert.equal(again.session.sessionReference,(value as any).session.sessionReference);const state=identityFromWebSession(value);assert.equal(state.status,'authenticated');assert.equal(realFinancialAccess(state,{kind:'unassigned-local',engine:'indexeddb-strict',profileReference:'not-opened'}).allowed,false);
 assert.equal(identityFromWebSession(value,Date.now()+3600000).status,'expired');
 }finally{await f.close();}});
for(const mode of ['nonce','issuer','audience','expired','revoked'])test('Auth0 official SDK rejects '+mode+' and sanitizes errors',async()=>{const f=await fixture();try{f.setMode(mode);await f.start();const r=await f.callback();assert.equal(r.status,303);assert.equal(r.headers.get('location'),'/access?authError=provider');assert.equal((await(await f.request('/api/identity/session')).json()).status,'signed-out');}finally{await f.close();}});
test('Auth0 rejects CSRF, client-selected redirect/provider and invalid callback state',async()=>{const f=await fixture();try{
 assert.equal((await f.post('/api/identity/login','method=email','https://evil.invalid')).status,403);assert.equal((await f.post('/api/identity/login','method=evil')).status,400);assert.equal((await f.request('/api/identity/login')).status,404);
 await f.start();const r=await f.request('/api/identity/callback?code=fixture-code&state=invalid');assert.equal(r.status,303);assert.equal((await(await f.request('/api/identity/session')).json()).status,'signed-out');
 }finally{await f.close();}});
test('Auth0 same email across subjects never links identities; reauth rejects a different subject',async()=>{const f=await fixture();try{
 await f.start();await f.callback();const a=await(await f.request('/api/identity/session')).json();await f.start('reauth');f.setSubject('google-oauth2|fictional-B');assert.equal((await f.callback()).status,303);
 assert.equal((await(await f.request('/api/identity/session')).json()).status,'signed-out');await f.start('login','google');await f.callback();const b=await(await f.request('/api/identity/session')).json();assert.notEqual(a.session.identity.providerSubject,b.session.identity.providerSubject);assert.equal(b.session.identity.applicationSubject,null);assert.equal(b.financialAccess,false);
 }finally{await f.close();}});
test('Auth0 logout requires same origin and clears encrypted session; rejected grant clears prior state',async()=>{const f=await fixture();try{
 await f.start();await f.callback();assert.equal((await f.post('/api/identity/logout','','https://evil.invalid')).status,403);
 assert.equal((await f.post('/api/identity/login','method='+('x'.repeat(4096)),'https://evil.invalid')).status,403);assert.equal((await(await f.request('/api/identity/session')).json()).status,'authenticated');
 const beforeStale=await(await f.request('/api/identity/session')).json();const stale=await f.request('/api/identity/callback?code=unsolicited&state=invalid');assert.equal(stale.status,302);assert.equal(new URL(stale.headers.get('location')!).origin,new URL(stale.url).origin);assert.equal(new URL(stale.headers.get('location')!).pathname,'/');assert.deepEqual(await(await f.request('/api/identity/session')).json(),beforeStale);
 const r=await f.post('/api/identity/logout');assert.equal(r.status,302);assert.equal((await(await f.request('/api/identity/session')).json()).status,'signed-out');
 await f.start();await f.callback();await f.start('reauth');f.setMode('revoked');await f.callback();assert.equal((await(await f.request('/api/identity/session')).json()).status,'signed-out');
 }finally{await f.close();}});
test('Auth0 projection rejects forged owner, financial permission and invalid structure',()=>{
 for(const v of [{},{financialAccess:true},{status:'authenticated',financialAccess:false,methods:{email:true,google:false,apple:false},session:{identity:{applicationSubject:'forged'}}}])assert.throws(()=>parseWebSession(v));
});
test('Auth0 incomplete configuration serves no login, logout or callback and reveals no configuration',async()=>{
 const app=express();app.use(createIdentityRouter(readAuthConfig({})));const s=app.listen(0,'127.0.0.1');await once(s,'listening');try{const origin='http://127.0.0.1:'+(s.address()as any).port;
  const r=await fetch(origin+'/api/identity/session');const value=await r.json();assert.equal(value.status,'unconfigured');assert.deepEqual(value.methods,{email:false,google:false,apple:false});assert.doesNotMatch(JSON.stringify(value),/secret|clientID|issuer/i);
  for(const route of ['login','logout','callback','link'])assert.equal((await fetch(origin+'/api/identity/'+route)).status,503);
 }finally{await new Promise<void>(r=>s.close(()=>r()));}
});
test('Auth0 signup and recovery delegate to email Universal Login, never a password API',async()=>{const f=await fixture();try{
 const signup=await f.start('signup');assert.equal(new URL(signup.headers.get('location')!).searchParams.get('screen_hint'),'signup');const recovery=await f.start('recover');assert.equal(new URL(recovery.headers.get('location')!).searchParams.get('connection'),'EmailFixture');assert.equal(f.calls.some(u=>u.includes('dbconnections')||u.includes('api/v2')),false);
 }finally{await f.close();}});
test('Auth0 application session survives a new server instance with the same protected cookie key',async()=>{const a=await fixture();await a.start();await a.callback();const before=await(await a.request('/api/identity/session')).json();const jar=new Map(a.jar);await a.close();const b=await fixture();try{
 for(const[k,v]of jar)b.jar.set(k,v);const after=await(await b.request('/api/identity/session')).json();assert.equal(after.session.sessionReference,before.session.sessionReference);assert.deepEqual(after.session.identity,before.session.identity);assert.equal(after.financialAccess,false);
 }finally{await b.close();}});
test('Auth0 adds only the audited identity mount to the original financial server',async()=>{
 const {readFileSync}=await import('node:fs');let source=readFileSync('server.ts','utf8');for(const line of ["import {readAuthConfig} from './server/identity/config';\n","import {createIdentityRouter} from './server/identity/router';\n","app.use(createIdentityRouter(readAuthConfig(process.env)));\n"]){assert.equal(source.includes(line),true);source=source.replace(line,'');}
 assert.equal(createHash('sha256').update(source).digest('hex'),'ed3b4ae2cceafd2cd51370a4ce4279dd6bc621b63cca19804eb7ae6a883406e6');
});
test('Auth0 dependency addition preserves every existing locked version and integrity',async()=>{
 const {readFileSync}=await import('node:fs');const {execFileSync}=await import('node:child_process');const before=JSON.parse(execFileSync('git',['show','40c16e6602bef8338d43fd833fe578fced9d670f:package-lock.json'],{encoding:'utf8'})).packages;
 const after=JSON.parse(readFileSync('package-lock.json','utf8')).packages;for(const[p,v]of Object.entries(before)as [string,any][]){if(!p)continue;assert.equal(after[p]?.version,v.version,p);assert.equal(after[p]?.integrity,v.integrity,p);}
 assert.equal(after['node_modules/express-openid-connect'].version,'3.4.0');
});
test('Auth0 cookie is an authenticated JWE; tampering or another application is rejected',async()=>{
 const a=await fixture();try{await a.start();await a.callback();const cookie=a.jar.get('finanzasAuth')!;assert.equal(decodeProtectedHeader(cookie).enc,'A256GCM');
  const b=await fixture({AUTH0_CLIENT_ID:'DIFFERENT_FIXTURE_CLIENT'});try{for(const[k,v]of a.jar)b.jar.set(k,v);assert.equal((await(await b.request('/api/identity/session')).json()).status,'signed-out');}finally{await b.close();}
  const i=Math.floor(cookie.length/2);a.jar.set('finanzasAuth',cookie.slice(0,i)+(cookie[i]==='a'?'b':'a')+cookie.slice(i+1));assert.equal((await(await a.request('/api/identity/session')).json()).status,'signed-out');
 }finally{await a.close();}
});

test('Auth0 provider session_expiry ceiling is preserved and bounds the public session',async()=>{const f=await fixture();try{f.setMode('ceiling');await f.start();await f.callback();const value=await(await f.request('/api/identity/session')).json();assert.equal(value.status,'authenticated');assert.ok(value.session.expiresAtMs<=Date.now()+35000,'Provider ceiling, including SDK30s leeway, must precede the ID token expiration');assert.equal(value.financialAccess,false);}finally{await f.close();}});
