/** Mandatory WEB-001 gate. The process-kill oracle is independent of the fixture adapter. */
import './webStorage.browser';
import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdir,readFile,rm} from 'node:fs/promises';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {validateDurabilityReport} from './ci/durability-report.mjs';

test('P0 WEB-001: twenty independent real Chromium SIGKILLs after UI confirmation, plus controls',{timeout:300000},async()=>{
 const report=path.resolve(process.env.CI_ARTIFACT_DIR??'ci-artifacts','browser','web-durability.json');
 await mkdir(path.dirname(report),{recursive:true});await rm(report,{force:true});
 const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
 const code=await new Promise<number|null>((resolve,reject)=>{
  const child=spawn(process.execPath,['--import','tsx','scripts/native/webCrashRecovery.ts',path.resolve('dist'),report],{env:{...process.env,DURABILITY_BACKEND:'indexeddb',DURABILITY_REPETITIONS:'20',DURABILITY_SOURCE_SHA:sha},stdio:['ignore','pipe','pipe']});
  child.stdout.on('data',d=>process.stdout.write(d));child.stderr.on('data',d=>process.stderr.write(d));child.on('error',reject);child.on('close',resolve);
 });
 assert.equal(code,0,'The real browser crash process must exit successfully.');
 validateDurabilityReport(JSON.parse(await readFile(report,'utf8')),sha);
});
