import test from 'node:test';
import assert from 'node:assert/strict';
import {readdirSync,readFileSync} from 'node:fs';
import path from 'node:path';
const scripts=path.resolve(import.meta.dirname,'..');
function files(directory){return readdirSync(directory,{withFileTypes:true}).flatMap(f=>f.isDirectory()?files(path.join(directory,f.name)):[path.join(directory,f.name)]);}
test('browser regression conditions cannot mistake a Promise for a true persisted-state predicate, including multiline callbacks',()=>{
 for(const file of files(scripts).filter(f=>f.endsWith('.ts')&&!f.endsWith('/asyncStorageCondition.ts')))assert.doesNotMatch(readFileSync(file,'utf8'),/\.waitForFunction\s*\(\s*async\b/,`${path.relative(scripts,file)} must await the actual asynchronous condition.`);
});
