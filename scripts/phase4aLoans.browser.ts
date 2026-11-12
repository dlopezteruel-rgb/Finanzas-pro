import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import path from 'node:path';
import {chromium} from 'playwright-core';
import {DATA_KEY,makeBackup} from '../src/utils/backup';
import {STORAGE_LOCK} from '../src/utils/financeStore';
import {calculateWalletBalances} from '../src/utils/finance';
import {responsiveFixture} from './responsiveFixture';
import {navigateModule} from './browserNavigation';
test('Fase 4A: cuotas de préstamos sin duplicación y con reintento',{timeout:90000},async t=>{
 const app=express(),dist=path.resolve(process.env.PHASE4A_DIST??'dist');app.use(express.static(dist));app.get('*',(_q,r)=>r.sendFile(path.join(dist,'index.html')));
 const server=await new Promise<ReturnType<typeof app.listen>>(resolve=>{const s=app.listen(0,'127.0.0.1',()=>resolve(s));});t.after(()=>new Promise<void>(r=>server.close(()=>r())));
 const origin=`http://127.0.0.1:${(server.address() as {port:number}).port}`,browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});t.after(()=>browser.close());
 for(const width of [390,1280])await t.test(`${width}px: Web Lock, doble clic, espera real, cuota y reintento`,async()=>{
  const c=await browser.newContext({viewport:{width,height:1000},locale:'es-ES',timezoneId:'Europe/Madrid',serviceWorkers:'block'}),errors:string[]=[];try{
   await c.route('**/*',r=>new URL(r.request().url()).origin===origin?r.continue():r.abort());const fixture=responsiveFixture();fixture.loans[0].name='Casa familiar';fixture.loans[1].name='Casa';await c.addInitScript(({key,value})=>{(window as any).__name=(f:unknown)=>f;localStorage.setItem(key,value);},{key:DATA_KEY,value:JSON.stringify(makeBackup(fixture))});
   const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));p.setDefaultTimeout(7000);await p.clock.setFixedTime(new Date('2026-11-12T23:30:00Z'));await p.goto(origin+'/app');await navigateModule(p,'Deudas');const pay=p.getByRole('button',{name:/^Pagar Cuota/}).first(),raw=()=>p.evaluate(k=>localStorage.getItem(k),DATA_KEY),before=await raw();
   await p.evaluate(lock=>new Promise<void>(ready=>{void navigator.locks.request(lock,()=>new Promise<void>(release=>{(window as any).releaseLoanLock=release;ready();}));}),STORAGE_LOCK);
   await pay.click();await p.clock.setFixedTime(new Date('2026-11-12T23:30:00.005Z'));if(!await pay.isDisabled())await pay.click();else await pay.dispatchEvent('click');assert.equal(await raw(),before);
   await p.evaluate(()=>(window as any).releaseLoanLock());await p.waitForFunction(({key,n})=>JSON.parse(localStorage.getItem(key)!).transactions.length>=n,{key:DATA_KEY,n:fixture.transactions.length+1});await p.waitForTimeout(80);
   let data=JSON.parse((await raw())!);assert.equal(data.transactions.length,fixture.transactions.length+1,'una sola cuota por envío pendiente');assert.equal(data.transactions[0].loanId,fixture.loans[0].id);assert.equal(data.transactions[0].amount,fixture.loans[0].monthlyPayment);assert.equal(data.transactions[0].date,'2026-11-13');await p.getByText('35.800,00 €',{exact:true}).waitFor();
   const balance=(d:any)=>calculateWalletBalances(d.wallets,d.transactions)[fixture.loans[0].wallet];assert.equal(Math.round((balance(fixture)-balance(data))*100),fixture.loans[0].monthlyPayment*100);
   await p.evaluate(key=>{const original=Storage.prototype.setItem;(window as any).restoreLoanStorage=()=>Storage.prototype.setItem=original;Storage.prototype.setItem=function(k,v){if(k===key)throw new DOMException('Cuota ficticia','QuotaExceededError');original.call(this,k,v);};},DATA_KEY);
   const afterFirst=await raw();await p.clock.setFixedTime(new Date('2026-11-12T23:30:00.010Z'));await pay.click();const action=p.getByRole('group',{name:`Pago de cuota de ${fixture.loans[0].name}`,exact:true});await action.getByRole('alert').waitFor();assert.equal(await raw(),afterFirst);assert.equal(await pay.isEnabled(),true);
   await p.evaluate(()=>(window as any).restoreLoanStorage());await p.clock.setFixedTime(new Date('2026-11-12T23:30:00.015Z'));await pay.click();await p.waitForFunction(({key,n})=>JSON.parse(localStorage.getItem(key)!).transactions.length===n,{key:DATA_KEY,n:fixture.transactions.length+2});data=JSON.parse((await raw())!);assert.equal(data.transactions.filter((x:any)=>x.loanId===fixture.loans[0].id).length,2);assert.equal(await action.getByRole('alert').count(),0);assert.deepEqual(errors,[]);
  }finally{await c.close();}
 });
});
