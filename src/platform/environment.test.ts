import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import config from '../../capacitor.config';
import {detectPlatform} from './environment';

test('5G: platform detection is explicit, not user-agent based',()=>{
 assert.equal(detectPlatform(false),'web');assert.equal(detectPlatform(true),'test');
 for(const value of ['android','ios'])assert.equal(detectPlatform(true,{isNativePlatform:()=>true,getPlatform:()=>value}),value);
 assert.equal(detectPlatform(false,{isNativePlatform:()=>true,getPlatform:()=> 'other'}),'blocked');
 assert.equal(detectPlatform(false,{isNativePlatform:()=>{throw Error('synthetic restricted bridge');}}),'blocked');
});
test('5G: local prototype config cannot imply production API or identity',()=>{
 assert.equal(config.appId,'invalid.finanzas.prototype');assert.equal(config.webDir,'dist');assert.equal(config.server?.url,undefined);
 assert.equal(config.server?.cleartext,false);assert.deepEqual(config.server?.allowNavigation,[]);assert.equal(config.android?.allowMixedContent,false);
 assert.equal(config.plugins?.CapacitorHttp?.enabled,false);
});
test('5G: Android prototype permissions and exports are bounded',()=>{
 const manifest=readFileSync('android/app/src/main/AndroidManifest.xml','utf8');
 assert.match(manifest,/android:allowBackup="false"/);assert.match(manifest,/android:usesCleartextTraffic="false"/);
 assert.deepEqual([...manifest.matchAll(/<uses-permission android:name="([^"]+)"/g)].map(m=>m[1]),['android.permission.INTERNET']);
 const paths=readFileSync('android/app/src/main/res/xml/file_paths.xml','utf8');assert.match(paths,/finanzas-prototype-exports\//);assert.doesNotMatch(paths,/external-path/);
 assert.match(readFileSync('android/app/build.gradle','utf8'),/signingConfig = null/);
});
test('5G: iOS project uses scene lifecycle and pinned SPM sources, not a claimed build',()=>{
 assert.match(readFileSync('ios/App/App/SceneDelegate.swift','utf8'),/SceneDelegateProxy/);
 assert.match(readFileSync('ios/App/CapApp-SPM/Package.swift','utf8'),/exact: "8.6.2"/);
 const privacy=readFileSync('ios/App/App/PrivacyInfo.xcprivacy','utf8');assert.match(privacy,/C617.1/);assert.match(privacy,/CA92.1/);
 assert.match(readFileSync('ios/App/App.xcodeproj/project.pbxproj','utf8'),/PrivacyInfo.xcprivacy in Resources/);
});

test('5G: financial core, schemas, server, web paths and CI retain their audited bytes',()=>{
 const manifest=JSON.parse(readFileSync('docs/phase-5g-protected-files.json','utf8'));
 assert.equal(Object.keys(manifest.files).length,44);
 for(const [file,expected] of Object.entries(manifest.files))assert.equal(createHash('sha256').update(readFileSync(file)).digest('hex'),expected,file);
});
