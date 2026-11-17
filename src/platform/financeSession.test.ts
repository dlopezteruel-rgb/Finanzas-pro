import test from 'node:test';
import assert from 'node:assert/strict';
import {financeSession} from './financeSession';
import {prototypeFinanceBinding,type FinanceBinding} from './financeBinding';
import type {DurableFinanceController} from './vault/protocol';
const base=()=>prototypeFinanceBinding();
test('integrated session: web selects async open without reading or seeding storage',()=>{
 let opened=0,read=0;const open=async()=>{opened++;throw Error('Not during selection');};const finance:FinanceBinding={...base(),open,getStorage:()=>{read++;throw Error('No fallback');}};
 const choice=financeSession({prototype:false,finance});assert.equal(choice.kind,'web');assert.equal(choice.kind==='web'&&choice.open,open);assert.equal(opened,0);assert.equal(read,0);
});
test('integrated session: native uses the exact already-opened owner controller with no second store',()=>{
 const controller={} as DurableFinanceController;const finance=base();finance.getStorage=()=>{throw Error('No memory or WebView reads');};
 for(let render=0;render<5;render++){const choice=financeSession({prototype:true,finance,durable:controller});assert.equal(choice.kind,'native');assert.equal(choice.kind==='native'&&choice.controller,controller);}
});
test('integrated session: only explicit disposable prototype may use memory',()=>{
 assert.equal(financeSession({prototype:true,finance:base()}).kind,'prototype');assert.throws(()=>financeSession({prototype:false,finance:base()}),/WEB_UNAVAILABLE/);
});
test('integrated session: a native shell cannot silently select IndexedDB and a browser cannot select a vault',()=>{
 const finance={...base(),open:async()=>{throw Error('Must not execute');}};assert.throws(()=>financeSession({prototype:true,finance}),/VAULT_DISABLED/);assert.throws(()=>financeSession({prototype:true,finance,durable:{} as DurableFinanceController}),/VAULT_DISABLED/);assert.throws(()=>financeSession({prototype:false,finance,durable:{} as DurableFinanceController}),/WEB_UNAVAILABLE/);
});
