import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readdir,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {chromium} from 'playwright-core';
async function fixture(t,tag,closeError=false){
 const dir=await mkdtemp(path.join(tmpdir(),'finanzas-ci-diag-')),original=chromium.launch,oldDir=process.env.CI_ARTIFACT_DIR;process.env.CI_ARTIFACT_DIR=dir;
 t.after(async()=>{chromium.launch=original;if(oldDir===undefined)delete process.env.CI_ARTIFACT_DIR;else process.env.CI_ARTIFACT_DIR=oldDir;await rm(dir,{recursive:true,force:true});});
 chromium.launch=async()=>({newContext:async()=>({pages:()=>[{isClosed:()=>false,url:()=> 'http://127.0.0.1:1234/fixture',screenshot:async options=>writeFile(options.path,'synthetic diagnostic test')}],close:async()=>{if(closeError)throw new Error('Real context-close failure');}}),contexts:()=>[],close:async()=>{}});
 await import(`./browser-diagnostics.mjs?fixture=${tag}`);return {dir,browser:await chromium.launch()};
}
test('diagnostics retain an earlier failed context after later siblings close',async t=>{const {dir,browser}=await fixture(t,'preserve');for(let i=0;i<9;i++){const c=await browser.newContext();await c.close();}const files=await readdir(path.join(dir,'browser/screenshots'));assert.equal(files.filter(f=>f.endsWith('.jpg')).length,9,'captured contexts must not overwrite each other');assert.ok(files.includes('browser-0-0.jpg'));assert.ok(files.includes('browser-8-0.jpg'));});
test('diagnostic capture must not suppress real close errors',async t=>{const {browser}=await fixture(t,'close-error',true),context=await browser.newContext();await assert.rejects(context.close(),/Real context-close failure/);});
