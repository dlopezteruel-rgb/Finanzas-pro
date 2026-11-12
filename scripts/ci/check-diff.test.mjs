import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {checkDiff} from './check-diff.mjs';
function fixture(t){const cwd=mkdtempSync(path.join(tmpdir(),'finanzas-ci-diff-'));t.after(()=>rmSync(cwd,{recursive:true,force:true}));const git=(...args)=>execFileSync('git',args,{cwd,encoding:'utf8',stdio:['ignore','pipe','pipe']}).trim();git('init','-b','main');git('config','user.name','CI fixture');git('config','user.email','ci@example.invalid');writeFileSync(path.join(cwd,'a.txt'),'base\n');git('add','.');git('commit','-m','base');const base=git('rev-parse','HEAD');const commit=text=>{writeFileSync(path.join(cwd,'a.txt'),text);git('add','.');git('commit','-m','change');return git('rev-parse','HEAD');};return {cwd,git,base,commit};}
const pr=(base,head)=>({pull_request:{base:{sha:base},head:{sha:head}}});
test('PR diff checks the actual changed commit',t=>{const f=fixture(t),head=f.commit('clean\n'),r=checkDiff({cwd:f.cwd,eventName:'pull_request',event:pr(f.base,head)});assert.equal(r.changedFiles,1);assert.equal(r.mergeBase,f.base);assert.equal(r.head,head);});
test('whitespace in a PR fails even after base branch advances',t=>{const f=fixture(t);f.git('switch','-c','feature');const head=f.commit('bad trailing  \n');f.git('switch','main');writeFileSync(path.join(f.cwd,'b.txt'),'base advanced\n');f.git('add','.');f.git('commit','-m','advance');const base=f.git('rev-parse','HEAD');f.git('switch','feature');assert.throws(()=>checkDiff({cwd:f.cwd,eventName:'pull_request',event:pr(base,head)}));});
test('wrong checkout and same-SHA diff are rejected',t=>{const f=fixture(t),head=f.commit('clean\n');assert.throws(()=>checkDiff({cwd:f.cwd,eventName:'pull_request',event:pr(f.base,f.base)}),/Checkout/);assert.throws(()=>checkDiff({cwd:f.cwd,eventName:'pull_request',event:pr(head,head)}),/distinct/);});
test('an empty PR diff is never a false green',t=>{const f=fixture(t);f.git('commit','--allow-empty','-m','empty');assert.throws(()=>checkDiff({cwd:f.cwd,eventName:'pull_request',event:pr(f.base,f.git('rev-parse','HEAD'))}),/empty/);});
test('push uses before/after and dispatch uses the parent',t=>{const f=fixture(t),head=f.commit('clean\n');for(const [eventName,event]of [['push',{before:f.base,after:head}],['workflow_dispatch',{}]])assert.equal(checkDiff({cwd:f.cwd,eventName,event}).base,f.base);});
test('zero or shell-like base SHA cannot be passed to git',t=>{const f=fixture(t),head=f.commit('clean\n');for(const base of ['0'.repeat(40),'$(echo unsafe)'])assert.throws(()=>checkDiff({cwd:f.cwd,eventName:'pull_request',event:pr(base,head)}),/distinct/);});
