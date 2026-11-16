import {readFile,access} from 'node:fs/promises';
import assert from 'node:assert/strict';

const marker=JSON.parse(await readFile('dist/finanzas-native-build.json','utf8'));
assert.deepEqual(marker,{kind:'native-prototype',appId:'invalid.finanzas.prototype',financialPersistence:'session-only',realData:false,remoteBackend:false});
const html=await readFile('dist/index.html','utf8');
assert.match(html,/name="finanzas-platform" content="native-prototype"/);
assert.match(html,/viewport-fit=cover/);assert.match(html,/Content-Security-Policy/);
assert.doesNotMatch(html,/<script[^>]+src="https?:/);
await access('dist/brand/finanzas-mark.svg');
console.log('Local native prototype build verified; real financial persistence and remote API disabled.');
