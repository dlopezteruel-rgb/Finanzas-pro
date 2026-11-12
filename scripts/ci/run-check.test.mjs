import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,writeFileSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const runner=fileURLToPath(new URL('./run-check.mjs',import.meta.url));
for(const [name,exit,skips,expected]of [['child failure',7,0,1],['skipped test',0,1,1],['complete success',0,0,0]])test(`runner exit status: ${name}`,t=>{
 const cwd=mkdtempSync(path.join(tmpdir(),'finanzas-ci-run-'));t.after(()=>rmSync(cwd,{recursive:true,force:true}));writeFileSync(path.join(cwd,'package.json'),JSON.stringify({scripts:{test:'node fixture.cjs'}}));
 const text=`# tests 1\n# pass ${skips?0:1}\n# fail 0\n# cancelled 0\n# skipped ${skips}\n# todo 0`;
 writeFileSync(path.join(cwd,'fixture.cjs'),`console.log(${JSON.stringify(text)});process.exit(${exit});`);
 const env={...process.env,CI_ARTIFACT_DIR:path.join(cwd,'artifacts')};delete env.GITHUB_STEP_SUMMARY;
 const result=spawnSync(process.execPath,[runner,'unit'],{cwd,env,encoding:'utf8'});assert.equal(result.status,expected,result.stdout+result.stderr);
 const summary=JSON.parse(readFileSync(path.join(cwd,'artifacts/unit/summary.json'),'utf8'));assert.equal(summary.passed,expected===0);assert.ok(readFileSync(path.join(cwd,'artifacts/unit/1.log'),'utf8').includes('# tests 1'));
});
