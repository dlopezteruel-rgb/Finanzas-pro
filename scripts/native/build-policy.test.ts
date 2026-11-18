import test from 'node:test';
import assert from 'node:assert/strict';
import {build} from 'vite';

test('5H: environment flags cannot package the browser test bridge; explicit diagnostic builds remain marked',{timeout:30000},async()=>{
 const previous=process.env.VITE_VAULT_TEST;process.env.VITE_VAULT_TEST='true';
 try{
  const native=await build({configFile:'vite.native.config.ts',logLevel:'silent',build:{write:false,emptyOutDir:false}});
  const nativeOutputs=(Array.isArray(native)?native:[native]).flatMap(r=>'output' in r?r.output:[]);
  const chunks=nativeOutputs.filter(x=>x.type==='chunk');
  assert.ok(chunks.length>0);assert.ok(chunks.every(x=>!x.code.includes('__vault_test')&&!Object.keys(x.modules).some(m=>m.endsWith('/vault/testBridge.ts'))));
  const marker=nativeOutputs.find(x=>x.type==='asset'&&x.fileName==='finanzas-native-build.json');assert.ok(marker&&marker.type==='asset');
  const data=JSON.parse(String(marker.source));assert.equal(data.kind,'native-prototype');assert.equal(data.financialPersistence,'debug-sandbox-opt-in');assert.equal(data.realData,false);
  const preview=await build({configFile:'vite.vault-test.config.ts',logLevel:'silent',build:{write:false,emptyOutDir:false}});
  const testOutputs=(Array.isArray(preview)?preview:[preview]).flatMap(r=>'output' in r?r.output:[]);
  assert.ok(testOutputs.some(x=>x.type==='chunk'&&x.code.includes('__vault_test')));
  const testMarker=testOutputs.find(x=>x.type==='asset'&&x.fileName==='finanzas-native-build.json');assert.ok(testMarker&&testMarker.type==='asset');assert.equal(JSON.parse(String(testMarker.source)).kind,'native-prototype-test');
 }finally{if(previous===undefined)delete process.env.VITE_VAULT_TEST;else process.env.VITE_VAULT_TEST=previous;}
});
