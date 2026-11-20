import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import path from 'node:path';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {createIdentityRouter} from '../server/identity/router';
import {readAuthConfig} from '../server/identity/config';
const observations:any[]=[],results:string[]=[];
test('7A.2: Auth0 access host, fictitious session responses and no financial profile access',{timeout:180000},async t=>{
 const app=express();app.use(createIdentityRouter(readAuthConfig({})));app.use(express.static(path.resolve('dist')));app.get('*',(_req,res)=>res.sendFile(path.resolve('dist/index.html')));
 const server=await new Promise<ReturnType<typeof app.listen>>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));}),origin='http://127.0.0.1:'+(server.address()as any).port;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});
 t.after(()=>browser.close());t.after(()=>new Promise<void>(r=>server.close(()=>r())));
 const axe=await readFile('node_modules/axe-core/axe.min.js','utf8');
 t.after(async()=>{const dir=path.resolve(process.env.CI_ARTIFACT_DIR??'ci-artifacts','browser');await mkdir(dir,{recursive:true});await writeFile(path.join(dir,'auth0-access.json'),JSON.stringify({source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),remoteAuth0Validated:false,fixtureOnly:true,workingTreeDirty:execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim()!=='',results,observations},null,2)+'\n');});
 async function context(language='es',width=390,theme:'dark'|'light'='dark'){
  const c=await browser.newContext({viewport:{width,height:900},colorScheme:theme,serviceWorkers:'block'});
  await c.addInitScript(({language,theme})=>{
   (window as any).__name=(f:unknown)=>f;localStorage.setItem('finanzas.ui.language',language);localStorage.setItem('finanzas.ui.theme',theme);localStorage.setItem('finanzas_pro_data_v1','FICTIONAL_UNASSIGNED_PROFILE');localStorage.setItem('finanzas_pro_recovery_canary','FICTIONAL_OLD_COPY');
   const get=Storage.prototype.getItem,set=Storage.prototype.setItem;(window as any).__blockedAccesses=[];
   Storage.prototype.getItem=function(key){if(key.startsWith('finanzas_pro_')){(window as any).__blockedAccesses.push(key);throw Error('REAL_PROFILE_BLOCKED');}return get.call(this,key);};
   Storage.prototype.setItem=function(key,value){if(key.startsWith('finanzas_pro_')){(window as any).__blockedAccesses.push(key);throw Error('REAL_PROFILE_BLOCKED');}return set.call(this,key,value);};
   indexedDB.open=(()=>{(window as any).__blockedAccesses.push('IDB');throw Error('REAL_PROFILE_BLOCKED');})as any;
   (window as any).Capacitor={isNativePlatform:()=>false,Plugins:new Proxy({},{get(){(window as any).__blockedAccesses.push('NATIVE_VAULT');throw Error('REAL_PROFILE_BLOCKED');}})};
  },{language,theme});return c;
 }
 async function inspect(p:any,surface:string){await p.addScriptTag({content:axe});const result=await p.evaluate(async()=>{const r=await(window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return{violations:r.violations,incomplete:r.incomplete};});observations.push({surface,language:'es',width:390,theme:'dark',...result});assert.deepEqual(result.violations.map((v:any)=>v.id),[]);}
 for(const language of ['es','en','it','fr','pt'])for(const width of [390,768,1280])for(const theme of ['dark','light']as const)await t.test(`${language}/${width}/${theme}: unavailable methods hidden, keyboard and strict axe`,async()=>{
  const c=await context(language,width,theme),p=await c.newPage();try{
   await p.goto(origin+'/access');await p.locator('main h1').waitFor();await p.waitForFunction(()=>document.documentElement.lang.startsWith(localStorage.getItem('finanzas.ui.language')!));
   await p.waitForFunction(()=>!document.querySelector('[role=status]')?.textContent?.includes('…'));
   assert.equal(await p.locator('.access-shell').getAttribute('data-theme'),theme);assert.equal(await p.locator('.access-panel').evaluate(el=>getComputedStyle(el).backgroundColor),theme==='dark'?'rgb(27, 43, 67)':'rgb(255, 255, 255)');assert.equal(await p.locator('form').count(),0);assert.equal(await p.locator('input[type=password]').count(),0);assert.equal(await p.locator('main').count(),1);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
   await p.locator('#landing-language').focus();await p.keyboard.press('Tab');assert.equal(await p.evaluate(()=>document.activeElement?.tagName),'BUTTON');await p.keyboard.press('Shift+Tab');assert.equal(await p.evaluate(()=>document.activeElement?.id),'landing-language');await p.keyboard.press('Escape');
   assert.deepEqual(await p.evaluate(()=>(window as any).__blockedAccesses),[]);
   await p.addScriptTag({content:axe});const result=await p.evaluate(async()=>{const r=await(window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}});return{violations:r.violations,incomplete:r.incomplete};});
   observations.push({surface:'auth0-access-unconfigured',language,width,theme,...result});assert.deepEqual(result.violations.map((v:any)=>v.id),[]);
   if(process.env.AUTH0_CAPTURE_DIR&&((language==='es'&&width===390&&theme==='dark')||(language==='fr'&&width===1280&&theme==='light'))){await mkdir(process.env.AUTH0_CAPTURE_DIR,{recursive:true});await p.screenshot({path:path.join(process.env.AUTH0_CAPTURE_DIR,`access-${language}-${width}-${theme}.jpg`),type:'jpeg',quality:80,fullPage:true,animations:'disabled'});}
   results.push(`${language}/${width}/${theme}`);
  }finally{await c.close();}
 });
 const methods={email:true,google:true,apple:true},authenticated=()=>({status:'authenticated',financialAccess:false,methods,emailVerified:false,session:{identity:{applicationSubject:null,issuer:'https://fixture.auth.invalid/',providerSubject:'auth0|fictional-A',method:'unknown'},sessionReference:'FICTIONAL_REFERENCE',issuedAtMs:Date.now()-1000,authenticatedAtMs:Date.now()-1000,expiresAtMs:Date.now()+30000}});
 await t.test('configured methods use only same-origin POST to Universal Login; no credentials collected',async()=>{const c=await context(),p=await c.newPage();try{
  await p.route('**/api/identity/session',r=>r.fulfill({json:{status:'signed-out',financialAccess:false,methods}}));await p.goto(origin+'/access');await p.locator('form').first().waitFor();assert.equal(await p.locator('form').count(),5);
  for(const f of await p.locator('form').all()){assert.equal(await f.getAttribute('method'),'post');assert.equal(await f.getAttribute('action'),'/api/identity/login');}
  assert.equal(await p.locator('input[type=password],input[type=email]').count(),0);assert.deepEqual(await p.evaluate(()=>(window as any).__blockedAccesses),[]);await inspect(p,'auth0-access-configured');results.push('configured-post');
 }finally{await c.close();}});
 await t.test('verified response remains unassigned and cannot open data; reload/logout',async()=>{const c=await context(),p=await c.newPage();try{
  await p.route('**/api/identity/session',r=>r.fulfill({json:authenticated()}));await p.goto(origin+'/access');await p.locator('form[action$=logout]').waitFor();assert.equal(await p.getByRole('button',{name:'Cerrar sesión',exact:true}).count(),1);assert.equal(await p.locator('form[action$=login]').count(),3);
  await inspect(p,'auth0-access-authenticated');await p.reload();await p.locator('form[action$=logout]').waitFor();assert.deepEqual(await p.evaluate(()=>(window as any).__blockedAccesses),[]);
  await p.route('**/api/identity/logout',r=>r.fulfill({status:303,headers:{location:'/access'}}));await p.unroute('**/api/identity/session');await p.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await p.waitForURL(origin+'/access');await p.waitForFunction(()=>document.querySelectorAll('form').length===0);results.push('reload-logout');
 }finally{await c.close();}});
 await t.test('expired projection allows a new explicit login, never automatic renewal loops',async()=>{const c=await context(),p=await c.newPage();try{
  let calls=0;await p.route('**/api/identity/session',r=>{calls++;const v=authenticated();v.session.issuedAtMs=Date.now()-60000;v.session.authenticatedAtMs=v.session.issuedAtMs;v.session.expiresAtMs=Date.now()-1000;return r.fulfill({json:v});});await p.goto(origin+'/access');await p.getByRole('alert').waitFor();assert.equal(await p.getByRole('button',{name:'Iniciar sesión',exact:true}).isEnabled(),true);await p.getByRole('button',{name:'Comprobar de nuevo',exact:true}).focus();await p.keyboard.press('Tab');assert.ok(calls<5);await inspect(p,'auth0-access-expired');results.push('expired');
 }finally{await c.close();}});
 await t.test('provider error and malformed identity never show authenticated controls',async()=>{const c=await context(),p=await c.newPage();try{
  await p.route('**/api/identity/session',r=>r.fulfill({json:{...authenticated(),financialAccess:true}}));await p.goto(origin+'/access?authError=provider&error_description=SECRET_FIXTURE');await p.getByRole('alert').waitFor();assert.equal(await p.locator('form').count(),0);assert.equal((await p.locator('body').innerText()).includes('SECRET_FIXTURE'),false);await inspect(p,'auth0-access-error');results.push('provider-error');
 }finally{await c.close();}});
 await t.test('native WebView cannot enter the web BFF host',async()=>{const c=await context(),p=await c.newPage();try{
  await c.addInitScript(()=>{(window as any).Capacitor={isNativePlatform:()=>true,getPlatform:()=> 'android'};});let requests=0;p.on('request',r=>{if(r.url().includes('/api/identity/'))requests++;});await p.goto(origin+'/access');await p.getByRole('alert').waitFor();assert.equal(await p.locator('form').count(),0);assert.equal(requests,0);results.push('native-blocked');
 }finally{await c.close();}});
 await t.test('late response from previous identity cannot replace the current session',async()=>{const c=await context(),p=await c.newPage();try{
  let first:any,resolveFirst:()=>void=()=>{},calls=0;const hold=new Promise<void>(r=>resolveFirst=r);
  await p.route('**/api/identity/session',async r=>{calls++;if(calls===1){first=r;await hold;try{await r.fulfill({json:authenticated()});}catch{}return;}const v=authenticated();v.emailVerified=true;v.session.identity.providerSubject='google-oauth2|fictional-B';await r.fulfill({json:v});});
  await p.goto(origin+'/access');await p.locator('main h1').waitFor();await p.evaluate(()=>window.dispatchEvent(new Event('focus')));await p.getByText('Correo verificado. El acceso financiero sigue bloqueado.',{exact:true}).waitFor();resolveFirst();await p.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));assert.equal(await p.getByText('Correo verificado. El acceso financiero sigue bloqueado.',{exact:true}).count(),1);assert.deepEqual(await p.evaluate(()=>(window as any).__blockedAccesses),[]);results.push('late-identity-response');
 }finally{await c.close();}});
 await t.test('shared browser logout refreshes the second tab on focus without opening a profile',async()=>{const c=await context();let signed=true;try{
  await c.route('**/api/identity/session',r=>r.fulfill({json:signed?authenticated():{status:'signed-out',financialAccess:false,methods}}));await c.route('**/api/identity/logout',r=>{signed=false;return r.fulfill({status:303,headers:{location:'/access'}});});const a=await c.newPage(),b=await c.newPage();await a.goto(origin+'/access');await b.goto(origin+'/access');await a.locator('form[action$=logout]').waitFor();await b.locator('form[action$=logout]').waitFor();await a.getByRole('button',{name:'Cerrar sesión',exact:true}).click();await b.evaluate(()=>window.dispatchEvent(new Event('focus')));await b.waitForFunction(()=>document.querySelectorAll('form[action$=logout]').length===0);assert.deepEqual(await b.evaluate(()=>(window as any).__blockedAccesses),[]);results.push('shared-browser-logout');
 }finally{await c.close();}});
 await t.test('web chunks never include the server SDK, demo or secret environment names',async()=>{const report=JSON.parse(await readFile('dist/bundle-analysis.json','utf8').catch(()=>'{"chunks":[]}')); // Check actual output text as well as module provenance when available.
  const {readdir}=await import('node:fs/promises');for(const file of(await readdir('dist/assets')).filter(f=>f.endsWith('.js'))){const text=await readFile(path.join('dist/assets',file),'utf8');for(const forbidden of ['express-openid-connect','AUTH0_CLIENT_SECRET','AUTH0_SESSION_SECRET','FAKE_ACCESS_NEVER_PROJECT','openIsolatedDemo'])assert.equal(text.includes(forbidden),false,forbidden);}
  results.push('bundle-secrets');
 });
});
