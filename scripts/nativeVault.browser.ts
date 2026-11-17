import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import path from 'node:path';
import {mkdtemp,readFile,mkdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {build} from 'vite';
import {chromium,type Page} from 'playwright-core';
import {SQLiteTestDriver} from './native/sqliteTestDriver';
import {DATA_KEY,parseBackup,makeBackup} from '../src/utils/backup';
import {loadDictionary,translatorFor,languages,type Language} from '../src/i18n/messages';
import {navigateModule} from './browserNavigation';
import {AsyncFinanceStore} from '../src/platform/vault/asyncFinanceStore';
import {emptySandbox} from '../src/platform/vault/policy';
import {BUDGET_GROUPS} from '../src/constants/categories';
import {intelligentFixture} from './intelligentFixture';

// Browser UI + real desktop SQLite; neither a native SQLCipher bridge nor a mobile-runtime test.
test('5H: durable asynchronous UI adapter; Chromium plus real desktop SQLite, not Android/iOS',{timeout:180000},async t=>{
 const output=path.resolve(process.env.CI_ARTIFACT_DIR??'ci-artifacts'),directory=path.join(output,'vault-test-preview'),reports=path.join(output,'browser');await mkdir(reports,{recursive:true});
 await build({configFile:'vite.vault-test.config.ts',build:{outDir:directory,emptyOutDir:true}});
 const hookDirectory=path.join(output,'hook-probe');await build({configFile:false,define:{'process.env.NODE_ENV':JSON.stringify('development')},logLevel:'error',build:{outDir:hookDirectory,emptyOutDir:true,lib:{entry:path.resolve('scripts/native/hookProbe.tsx'),formats:['es'],fileName:()=> 'probe.js'}}});
 const marker=JSON.parse(await readFile(path.join(directory,'finanzas-native-build.json'),'utf8'));assert.equal(marker.kind,'native-prototype-test');assert.equal(marker.realData,false);
 const temp=await mkdtemp(path.join(tmpdir(),'finanzas-fictitious-ui-vault-'));t.after(()=>rm(temp,{recursive:true,force:true}));
 let driver:SQLiteTestDriver,delayCommit:(()=>Promise<void>)|null=null,loseResponse=false;let readFailureCode='';let serial=0;const observations:any[]=[];
 const app=express();app.use('/__hook-assets',express.static(hookDirectory));app.get('/__hook',(_q,r)=>r.type('html').send('<!doctype html><html lang="en"><title>Controlled hook contract probe</title><body><div id="root"></div><script type="module" src="/__hook-assets/probe.js"></script></body></html>'));app.use(express.json({limit:'22mb'}));app.get('/__axe.js',(_q,r)=>r.sendFile(path.resolve('node_modules/axe-core/axe.min.js')));
 app.post('/__vault_test/:action',async(req,res)=>{
  try{
   const {action}=req.params;let result:unknown;
   if(action==='read'){if(readFailureCode)throw Object.assign(Error(),{code:readFailureCode});result=await driver.read();}
   else if(action==='commit'){if(delayCommit)await delayCommit();result=await driver.commit(req.body.payload);if(loseResponse){loseResponse=false;throw Object.assign(Error(),{code:'VAULT_UNCERTAIN'});}}
   else if(action==='resolve')result=await driver.resolve(req.body.operationId,req.body.fingerprint);
   else if(action==='recoveries')result=await driver.recoveries();
   else return res.status(404).json({code:'VAULT_DISABLED'});
   res.json(result);
  }catch(error){res.status(409).json({code:(error as {code?:string}).code??'VAULT_UNCERTAIN'});}
 });
 app.use(express.static(directory));app.get('*',(_q,r)=>r.sendFile(path.join(directory,'index.html')));
 const server=await new Promise<ReturnType<typeof app.listen>>(r=>{const s=app.listen(0,'127.0.0.1',()=>r(s));});t.after(()=>new Promise<void>(r=>server.close(()=>r())));
 const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`;
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
 async function setup(language:Language='es',width=390,theme='dark'){
  await loadDictionary(language);driver=new SQLiteTestDriver(path.join(temp,`fictitious-${++serial}.db`));delayCommit=null;loseResponse=false;readFailureCode='';
  const c=await browser.newContext({viewport:{width,height:900},isMobile:width===390,hasTouch:width===390,timezoneId:'Europe/Madrid',locale:languages[language].locale,acceptDownloads:true,serviceWorkers:'block'});
  const errors:string[]=[],remote:string[]=[],api:string[]=[];
  await c.route('**/*',route=>{const url=new URL(route.request().url());if(url.origin!==origin){remote.push(url.origin);return route.abort();}if(url.pathname.startsWith('/api/'))api.push(url.pathname);return route.continue();});
  await c.addInitScript(({language,theme,key})=>{
   (window as any).__name=(fn:unknown)=>fn;(window as any).__webDbAttempts=0;const open=indexedDB.open.bind(indexedDB);indexedDB.open=function(...args:Parameters<IDBFactory['open']>){if(args[0]==='finanzas-pro-web-v1'){(window as any).__webDbAttempts++;throw Error('Native must not open web finance');}return open(...args);};const get=Storage.prototype.getItem,set=Storage.prototype.setItem;
   set.call(localStorage,key,'FICTITIOUS_WEBVIEW_PROFILE_MUST_NOT_BE_READ');set.call(localStorage,'finanzas.ui.language',language);set.call(localStorage,'finanzas.ui.theme',theme);
   (window as any).__financialTouches=[];
   Storage.prototype.getItem=function(k){if(k.startsWith('finanzas_pro_'))(window as any).__financialTouches.push('read:'+k);return get.call(this,k);};
   Storage.prototype.setItem=function(k,v){if(k.startsWith('finanzas_pro_'))(window as any).__financialTouches.push('write:'+k);return set.call(this,k,v);};
  },{language,theme,key:DATA_KEY});
  const p=await c.newPage();p.setDefaultTimeout(8000);p.on('pageerror',e=>errors.push(e.message));await p.goto(origin);const tr=translatorFor(language);
  await p.getByRole('heading',{name:tr('native.title'),exact:true}).waitFor();
  return {c,p,tr,close:async()=>{assert.deepEqual(await p.evaluate(()=>(window as any).__financialTouches),[]);assert.deepEqual(errors,[]);assert.deepEqual(remote,[]);assert.deepEqual(api,[]);await c.close();await driver.close();}};
 }
 async function enter(p:Page,tr:ReturnType<typeof translatorFor>){await p.getByRole('checkbox',{name:tr('native.acknowledge'),exact:true}).check();await p.getByRole('button',{name:tr('vault.open'),exact:true}).click();await p.locator('.home-quick').waitFor();await p.getByText(tr('vault.ready'),{exact:true}).waitFor();}
 async function wallet(p:Page,name='Cuenta ficticia persistente'){
  await navigateModule(p,'Cuentas');await p.getByRole('button',{name:'Nueva Cuenta',exact:true}).click();const form=p.getByRole('dialog',{name:'Cartera',exact:true,includeHidden:true});await form.getByLabel('Nombre de la cuenta',{exact:true}).fill(name);return form;
 }
 async function exportDialog(p:Page,tr:ReturnType<typeof translatorFor>){await p.locator('header').getByRole('button',{name:tr('options.title'),exact:true}).click();await p.getByRole('button',{name:tr('options.export'),exact:true}).click();const dialog=p.getByRole('dialog',{name:tr('vault.exportTitle'),exact:true});await dialog.waitFor();return dialog;}
 await t.test('explicit consent, empty profile, durable confirmation, repeated save and reopen',async()=>{
  const s=await setup();try{const {p,tr}=s;assert.equal(await p.getByRole('button',{name:tr('vault.open'),exact:true}).isDisabled(),true);assert.equal(await driver.read(),null);await enter(p,tr);assert.equal(JSON.parse((await driver.read())!.snapshot).wallets.length,0);
   const form=await wallet(p);let release!:()=>void,reached!:()=>void;const ready=new Promise<void>(r=>reached=r),gate=new Promise<void>(r=>release=r);delayCommit=async()=>{reached();await gate;};
   const before=(await driver.read())!.snapshot;await form.locator('button[type=submit]').click();await ready;await p.getByText(tr('vault.saving'),{exact:true}).waitFor();assert.equal((await driver.read())!.snapshot,before);assert.equal(await form.isVisible(),true);assert.equal(await form.locator('button[type=submit]').isDisabled(),true);release();delayCommit=null;await form.waitFor({state:'hidden'});
   assert.equal(JSON.parse((await driver.read())!.snapshot).wallets.length,1);await p.reload();await enter(p,tr);assert.equal(JSON.parse((await driver.read())!.snapshot).wallets.length,1);await navigateModule(p,'Cuentas');await p.getByText('CUENTA FICTICIA PERSISTENTE',{exact:true}).waitFor();
  }finally{await s.close();}
 });
 await t.test('failed commit preserves the financial document, draft, focus and retry',async()=>{
  const s=await setup();try{const {p,tr}=s;await enter(p,tr);const form=await wallet(p,'Borrador ficticio'),before=(await driver.read())!.snapshot;driver.fault='beforeCommit';await form.locator('button[type=submit]').click();await form.getByText(tr('vault.VAULT_NOT_COMMITTED'),{exact:true}).waitFor();assert.equal((await driver.read())!.snapshot,before);assert.equal(await form.getByLabel('Nombre de la cuenta',{exact:true}).inputValue(),'Borrador ficticio');await form.getByLabel('Nombre de la cuenta',{exact:true}).focus();await p.keyboard.press('Tab');assert.equal(await form.evaluate(el=>el.contains(document.activeElement)),true);await form.locator('button[type=submit]').click();await form.waitFor({state:'hidden'});assert.equal(JSON.parse((await driver.read())!.snapshot).wallets.length,1);
  }finally{await s.close();}
 });
 await t.test('lost commit response blocks writes; late reconciliation requires reload and prevents duplicate',async()=>{
  const s=await setup();try{const {p,tr}=s;await enter(p,tr);const form=await wallet(p,'Confirmada ficticia');loseResponse=true;driver.failResolution=true;await form.locator('button[type=submit]').click();await p.getByText(tr('vault.recoveryRequired'),{exact:true}).first().waitFor();await p.addScriptTag({url:origin+'/__axe.js'});const uncertain=await p.evaluate(async()=>await (window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));assert.deepEqual(uncertain.violations,[]);observations.push({surface:'uncertain-commit-recovery',language:'es',width:390,theme:'dark',scope:'Chromium adapter + desktop SQLite only',violations:uncertain.violations,incomplete:uncertain.incomplete});await p.screenshot({path:path.join(reports,'vault-uncertain-commit.png')});assert.equal(await form.isVisible(),true);assert.equal(JSON.parse((await driver.read())!.snapshot).wallets.length,1);await p.getByRole('dialog',{name:tr('vault.title'),exact:true}).getByRole('button',{name:tr('vault.cancel'),exact:true}).click();await form.locator('button[type=submit]').click();assert.equal(JSON.parse((await driver.read())!.snapshot).wallets.length,1);driver.failResolution=false;await p.getByRole('dialog',{name:tr('vault.title'),exact:true}).getByRole('button',{name:tr('vault.reconcile'),exact:true}).click();await p.getByRole('dialog',{name:tr('vault.title'),exact:true}).getByRole('button',{name:tr('vault.reload'),exact:true}).waitFor();assert.equal(await form.isVisible(),true);assert.equal(JSON.parse((await driver.read())!.snapshot).wallets.length,1);
  }finally{await s.close();}
 });
 await t.test('plaintext export requires confirmation, cancels with Escape and exports complete JSON3.5',async()=>{
  const s=await setup('es',1280);try{const {p,tr}=s;await enter(p,tr);const form=await wallet(p);await form.locator('button[type=submit]').click();await form.waitFor({state:'hidden'});const before=(await driver.read())!.snapshot;let downloads=0;p.on('download',()=>downloads++);
   let consent=await exportDialog(p,tr);await p.keyboard.press('Tab');assert.equal(await consent.evaluate(el=>el.contains(document.activeElement)),true);await p.keyboard.press('Escape');await consent.waitFor({state:'hidden'});assert.equal(downloads,0);assert.equal((await driver.read())!.snapshot,before);
   consent=await exportDialog(p,tr);const pending=p.waitForEvent('download');await consent.getByRole('button',{name:tr('vault.exportConfirm'),exact:true}).click();const download=await pending,backup=parseBackup(await readFile((await download.path())!,'utf8'));assert.equal(backup.version,'3.5');assert.equal(backup.wallets.length,1);assert.equal((await driver.read())!.snapshot,before);
  }finally{await s.close();}
 });
 await t.test('integrated hook opens once, hydrates once, retains pending commits and closes by platform owner',async()=>{
  async function probe(mode='web'){const c=await browser.newContext();await c.addInitScript(data=>{(window as any).__name=(fn:unknown)=>fn;(window as any).__hookData=data;(window as any).__hookDefaults={...data,wallets:[]};(window as any).__hookWallet={id:'hook-new',name:'FICTITIOUS',type:'BANK',initialBalance:1,color:'#fff'};},intelligentFixture());const p=await c.newPage();const errors:string[]=[];p.on('pageerror',e=>errors.push(e.message));await p.goto(origin+'/__hook?mode='+mode);await p.locator('#phase').waitFor({state:'attached'});assert.deepEqual(errors,[]);if(mode==='web')await p.waitForFunction(()=>(window as any).__hookState.opens===1);return {c,p};}
  {const {c,p}=await probe();try{assert.equal(await p.locator('#phase').innerText(),'loading');assert.equal(await p.locator('#wallets').innerText(),'hidden');await p.evaluate(()=>(window as any).__hookControls.open());await p.locator('#phase').filter({hasText:'ready'}).waitFor();await p.evaluate(()=>new Promise<void>(r=>requestAnimationFrame(()=>requestAnimationFrame(()=>r()))));const state=await p.evaluate(()=>(window as any).__hookState);assert.equal(state.opens,1);assert.equal(state.legacyReads,0);assert.equal(state.renders,2,'Hydration must not cause an extra subscription-only render');await p.locator('#save').click();assert.equal(await p.locator('#result').innerText(),'');const before=await p.locator('#wallets').innerText();await p.evaluate(()=>(window as any).__hookControls.confirm());await p.locator('#result').filter({hasText:'saved'}).waitFor();assert.equal(Number(await p.locator('#wallets').innerText()),Number(before)+1);await p.evaluate(()=>(window as any).__hookControls.unmount());assert.equal(await p.evaluate(()=>(window as any).__hookState.closes),1);}finally{await c.close();}}
  for(const late of ['open','failOpen']){const {c,p}=await probe();try{await p.evaluate(()=>(window as any).__hookControls.unmount());await p.evaluate(action=>(window as any).__hookControls[action](),late);assert.equal(await p.evaluate(()=>(window as any).__hookState.closes),late==='open'?1:0);assert.equal(await p.locator('#phase').count(),0);}finally{await c.close();}}
  {const {c,p}=await probe('native');try{await p.locator('#phase').filter({hasText:'ready'}).waitFor();await p.locator('#save').click();await p.evaluate(()=>(window as any).__hookControls.unmount());const count=await p.evaluate(()=>(window as any).__hookState.renders);await p.evaluate(()=>(window as any).__hookControls.confirm());assert.equal(await p.evaluate(()=>(window as any).__hookState.closes),0,'Native controller belongs to bootstrap, not a disposed child hook');assert.equal(await p.evaluate(()=>(window as any).__hookState.renders),count);assert.equal(await p.evaluate(()=>(window as any).__hookState.confirmed.wallets.length),2);assert.equal(await p.evaluate(()=>(window as any).__hookState.proposals),1);}finally{await c.close();}}
 });
 await t.test('integrated native controller survives language/theme changes without a second initialization or web database',async()=>{
  const s=await setup('es',1280);try{const {p,tr}=s;await enter(p,tr);const form=await wallet(p,'Identidad ficticia única');await form.locator('button[type=submit]').click();await form.waitFor({state:'hidden'});const before=(await driver.read())!.snapshot;
   const draft=p.locator('.home-quick input');await navigateModule(p,'Inicio');await draft.fill('Borrador sin guardar');const element=await draft.elementHandle();await p.locator('header').getByRole('button',{name:tr('options.title'),exact:true}).click();
   for(const language of ['en','it','fr','pt','es'] as Language[]){await p.locator('#ui-language').selectOption(language);await p.waitForFunction(locale=>document.documentElement.lang===locale,languages[language].locale);assert.equal((await driver.read())!.snapshot,before);assert.equal(await element!.evaluate(el=>el.isConnected&&(el as HTMLInputElement).value==='Borrador sin guardar'),true);}
   await p.keyboard.press('Escape');await p.locator('header').getByRole('button',{name:tr('theme.switch',{mode:tr('theme.light')}),exact:true}).click();await p.waitForFunction(()=>document.documentElement.dataset.theme==='light');assert.equal((await driver.read())!.snapshot,before);assert.equal(await p.evaluate(()=>(window as any).__webDbAttempts),0);assert.equal(await p.getByText(tr('webStore.saving'),{exact:true}).count(),0);
  }finally{await s.close();}
 });
 await t.test('integrated native recovery copies use the vault, verified plaintext consent and no web forensic path',async()=>{
  const s=await setup('es',1280);try{const {p,tr}=s,controller=await AsyncFinanceStore.open(driver,emptySandbox(BUDGET_GROUPS));await controller.initialize();await controller.restore(makeBackup(intelligentFixture()));const before=(await driver.read())!.snapshot;await enter(p,tr);
   await p.locator('header').getByRole('button',{name:tr('options.title'),exact:true}).click();await p.getByRole('button',{name:tr('options.recovery'),exact:true}).click();const copies=p.getByRole('dialog',{name:tr('app.copias_de_recuperacion'),exact:true});await copies.waitFor();const copy=copies.getByRole('button',{name:/^Descargar /});await copy.waitFor();assert.equal(await copy.count(),1);await copy.click();const consent=p.getByRole('dialog',{name:tr('vault.exportTitle'),exact:true});await consent.waitFor();const pending=p.waitForEvent('download');await consent.getByRole('button',{name:tr('vault.exportConfirm'),exact:true}).click();const file=await pending,backup=parseBackup(await readFile((await file.path())!,'utf8'));assert.equal(backup.version,'3.5');assert.equal(backup.wallets.length,0);assert.equal(backup.transactions.length,0);assert.equal((await driver.read())!.snapshot,before);assert.equal(await p.evaluate(()=>(window as any).__webDbAttempts),0);
  }finally{await s.close();}
 });
 await t.test('integrated key failure blocks native startup without default data, migration or IndexedDB fallback',async()=>{
  const s=await setup();try{const {p,tr}=s;readFailureCode='VAULT_KEY_MISSING';await p.getByRole('checkbox',{name:tr('native.acknowledge'),exact:true}).check();await p.getByRole('button',{name:tr('vault.open'),exact:true}).click();await p.getByRole('alert').filter({hasText:tr('vault.VAULT_KEY_MISSING')}).waitFor();assert.equal(await p.locator('.finance-app').count(),0);assert.equal(await driver.read(),null);assert.equal(await p.evaluate(()=>(window as any).__webDbAttempts),0);readFailureCode='';await enter(p,tr);assert.equal(JSON.parse((await driver.read())!.snapshot).wallets.length,0);
  }finally{await s.close();}
 });
 for(const language of Object.keys(languages) as Language[])for(const width of [390,768,1280])for(const theme of ['dark','light'])await t.test(`${language}/${width}/${theme}: accessible sandbox, keyboard, language, no financial WebView storage`,async()=>{
  const s=await setup(language,width,theme);try{const {p,tr}=s;await p.addScriptTag({url:origin+'/__axe.js'});
   async function axe(surface:string){const result=await p.evaluate(async()=>await (window as any).axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));observations.push({surface,language,width,theme,scope:'Chromium adapter + desktop SQLite only',violations:result.violations,incomplete:result.incomplete});assert.deepEqual(result.violations,[]);}
   await axe('explicit-sandbox-gate');await enter(p,tr);assert.equal(await p.evaluate(()=>document.documentElement.lang),languages[language].locale);const before=(await driver.read())!.snapshot;
   const back=p.locator('.native-prototype-bar > button');assert.equal(await back.evaluate(el=>document.activeElement===el),true);await p.keyboard.press('Tab');await p.keyboard.press('Shift+Tab');assert.equal(await back.evaluate(el=>document.activeElement===el),true);await axe('durable-test-profile');
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await p.evaluate(()=>document.documentElement.style.fontSize='125%');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true);await p.evaluate(()=>document.documentElement.style.fontSize='');
   const consent=await exportDialog(p,tr);await axe('plaintext-export-consent');await p.keyboard.press('Escape');await consent.waitFor({state:'hidden'});assert.equal((await driver.read())!.snapshot,before);
   await p.locator('header').getByRole('button',{name:tr('options.title'),exact:true}).click();await p.getByRole('button',{name:tr('options.import'),exact:true}).click();await p.getByText(tr('native.importBlocked'),{exact:true}).waitFor();assert.equal((await driver.read())!.snapshot,before);
   if(width===390)await p.screenshot({path:path.join(reports,`vault-test-${language}-${theme}.png`)});
  }finally{await s.close();}
 });
 await writeFile(path.join(reports,'native-vault-adapter-axe.json'),JSON.stringify({scope:'Browser adapter and real desktop SQLite; NOT native cryptographic or platform validation.',observations},null,2)+'\n');
});
