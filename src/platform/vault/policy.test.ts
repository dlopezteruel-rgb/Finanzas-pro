import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {nativeStoragePolicy,emptySandbox} from './policy';
import {selectBackup} from './documents';
import {multilingualCatalogFixture} from '../../../scripts/multilingualCatalogFixture';
import {makeBackup,parseBackup} from '../../utils/backup';
import {storageOwnedText} from '../../i18n/storageMessages';
import {loadDictionary,translatorFor,type Language} from '../../i18n/messages';
import {vaultCodes} from './protocol';

test('5H: no installed plugin or platform detection enables real data, import or portable encryption',()=>{
 assert.deepEqual(nativeStoragePolicy,{androidRealData:false,iosRealData:false,externalImport:false,portableEncryptedBackup:false});assert.ok(Object.isFrozen(nativeStoragePolicy));
 const android=readFileSync('native/secure-vault/android/src/main/java/invalid/finanzas/prototype/vault/FinanceVaultPlugin.java','utf8');
 assert.match(android,/!BuildConfig.DEBUG/);assert.match(android,/acknowledgedFictitious/);assert.match(android,/productEnabled", false/);
 const ios=readFileSync('native/secure-vault/ios/Sources/FinanceVaultPlugin/FinanceVaultPlugin.swift','utf8');assert.match(ios,/#if !DEBUG/);assert.match(ios,/productEnabled": false/);
});
test('5H: explicit empty sandbox clones catalogue but never seeds 5G demo finances',()=>{
 const base=multilingualCatalogFixture(),empty=emptySandbox(base.budgetGroups);
 for(const name of ['transactions','wallets','loans','budgetPlans','contacts'] as const)assert.deepEqual(empty[name],[]);
 assert.equal(parseBackup(JSON.stringify(makeBackup(empty))).version,'3.5');assert.deepEqual(empty.budgetGroups,base.budgetGroups);empty.budgetGroups[0].name='Changed fictitious label';assert.notDeepEqual(empty.budgetGroups,base.budgetGroups);
});
test('5H: native document capability is checked before opening a system picker',async()=>{
 let calls=0;await assert.rejects(selectBackup(async()=>{calls++;return {cancelled:true};},nativeStoragePolicy.externalImport));assert.equal(calls,0);
});
test('5H: cancelling document selection creates no restoration or write',async()=>{
 assert.equal(await selectBackup(async()=>({cancelled:true}),true),null);
});
test('5H: document selection validates a complete JSON independently of restoration',async()=>{
 const before=multilingualCatalogFixture(),content=JSON.stringify(makeBackup(before)),unchanged=structuredClone(before);const preview=await selectBackup(async()=>({cancelled:false,name:'fictitious.json',content}),true);
 assert.equal(preview!.backup.version,'3.5');assert.deepEqual(preview!.backup.wallets,before.wallets);assert.deepEqual(before,unchanged);
});
for(const content of ['', '{','{"version":"99"}','x'.repeat(10485761)])test(`5H: invalid document ${content.length} bytes is rejected before preview`,async()=>{
 await assert.rejects(selectBackup(async()=>({cancelled:false,name:'invalid.json',content}),true));
});
test('5H: every native failure has a complete owned message in all five languages',async()=>{
 for(const language of ['es','en','it','fr','pt'] as Language[]){await loadDictionary(language);const t=translatorFor(language);for(const code of vaultCodes){const text=storageOwnedText(code,t);assert.notEqual(text,code);assert.ok(text.length>20);}}
});
