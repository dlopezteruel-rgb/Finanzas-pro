import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFileSync} from 'node:child_process';
import {createServer} from 'node:net';
import {mkdir,readFile,writeFile,unlink} from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
const root=process.cwd(),output=path.resolve(process.env.CI_ARTIFACT_DIR??'ci-artifacts','security-server'),results=[];
await mkdir(output,{recursive:true});
const env={...process.env,GEMINI_API_KEY:'',GOOGLE_API_KEY:''};delete env.GITHUB_TOKEN;delete env.GH_TOKEN;
async function freePort(){return new Promise(r=>{const s=createServer();s.listen(0,'127.0.0.1',()=>{const port=s.address().port;s.close(()=>r(port));});});}
function deadline(promise,ms,label){let id;return Promise.race([promise,new Promise((_,reject)=>{id=setTimeout(()=>reject(Error(label)),ms);})]).finally(()=>clearTimeout(id));}
async function launch(mode,base,disabled){
 const port=await freePort(),id=mode+'-'+randomUUID(),trace=path.join(output,id+'.jsonl'),started=performance.now();
 const child=spawn(process.execPath,['--import','tsx','--import','./scripts/security/module-trace.mjs','server.ts'],{env:{...env,NODE_ENV:mode,PORT:String(port),APP_BASE_PATH:base,DISABLE_HMR:disabled?'true':'false',SECURITY_MODULE_TRACE:trace,SECURITY_BLOCK_BUILD_IMPORTS:mode==='production'?'1':'0'},detached:true,stdio:['ignore','pipe','pipe','ipc']});let log='';child.stdout.on('data',x=>log+=x);child.stderr.on('data',x=>log+=x);const closed=new Promise(r=>child.once('close',r));
 const stop=async()=>{if(child.exitCode===null&&child.signalCode===null)try{process.kill(-child.pid,'SIGTERM');}catch{}await deadline(closed,5000,'Owned server did not stop');await writeFile(path.join(output,id+'.log'),log);};
 const origin='http://127.0.0.1:'+port;
 try{const until=performance.now()+15000;for(;;){if(child.exitCode!==null||child.signalCode!==null)throw Error('Server exited before ready: '+log);try{if((await fetch(origin+base)).ok)break;}catch{}if(performance.now()>until)throw Error('Server startup timed out: '+log);await new Promise(r=>setTimeout(r,25));}}catch(error){await stop();throw error;}
 return {child,origin,base,id,trace,readyMs:performance.now()-started,stop,cache:()=>deadline(new Promise(r=>{child.once('message',m=>r(m.modules));child.send('security:module-cache');}),5000,'Module IPC timeout')};
}
async function routes(s,production){
 for(const route of [s.base,s.base+'app',s.base+'app/?pattern=%2B(GHSA_PROBE_PATTERN)']){const response=await fetch(s.origin+route);assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/html/);assert.match(await response.text(),/id="root"/);}
 if(s.base!=='/'){const response=await fetch(s.origin+s.base.slice(0,-1),{redirect:'manual'});assert.equal(response.status,308);assert.equal(response.headers.get('location'),s.base);}
 if(production){const html=await(await fetch(s.origin+s.base)).text(),match=html.match(/<script[^>]+src="([^"]+)"/);assert.ok(match);const response=await fetch(new URL(match[1],s.origin));assert.equal(response.status,200);assert.match(response.headers.get('content-type'),/javascript/);assert.doesNotMatch(html,/@vite\/client/);}
 else {const response=await fetch(s.origin+s.base+'@vite/client');assert.equal(response.status,200);assert.match(await response.text(),/WebSocket/);}
 const post=(route,body)=>fetch(s.origin+s.base+'api/'+route,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 let response=await post('assistant-chat',{message:'GHSA_PROBE_PATTERN +(safe)',fallbackReply:'FICTITIOUS FALLBACK'});assert.equal(response.status,200);assert.deepEqual(await response.json(),{success:true,reply:'FICTITIOUS FALLBACK'});
 response=await post('assistant-chat',{message:27});assert.equal(response.status,400);assert.deepEqual(await response.json(),{error:'Message is required'});
 response=await post('parse-movement',{text:'FICTITIOUS'});assert.equal(response.status,200);assert.deepEqual(await response.json(),{success:false,fallback:true});
 response=await post('parse-movement',{text:'FICTITIOUS',referenceDate:'invalid',budgetGroups:[]});assert.equal(response.status,400);assert.deepEqual(await response.json(),{error:'Invalid reference date'});
 response=await post('assistant-chat',{message:'x'.repeat(8192)+'+(GHSA_PROBE_PATTERN)',fallbackReply:'FICTITIOUS LONG FALLBACK'});assert.equal(response.status,200);assert.equal((await response.json()).reply,'FICTITIOUS LONG FALLBACK');
}
for(const base of ['/','/security-finanzas/'])test('security: production serves HTML/assets/API and cannot import Vite/picomatch: '+base,{timeout:25000},async()=>{
 if(base!=='/')execFileSync(process.execPath,['node_modules/vite/bin/vite.js','build'],{env:{...env,APP_BASE_PATH:base},stdio:'pipe',timeout:60000});
 const s=await launch('production',base,true);try{await routes(s,true);const cache=await s.cache(),trace=(await readFile(s.trace,'utf8')).trim().split('\n').map(JSON.parse);assert.equal(trace.some(e=>/\/node_modules\/(?:vite|picomatch)\//.test(e.url)),false);assert.equal(cache.some(url=>/\/node_modules\/(?:vite|picomatch)\//.test(url)),false);results.push({mode:'production',base,passed:true,readyMs:s.readyMs,buildDependenciesLoaded:false});}finally{await s.stop();}
});
for(const base of ['/','/security-finanzas/'])test('security: development middleware and DISABLE_HMR retain routes/config: '+base,{timeout:30000},async()=>{
 const s=await launch('development',base,true);try{await routes(s,false);const cache=await s.cache();assert.ok(cache.some(url=>url.includes('/node_modules/picomatch/')));const config=execFileSync(process.execPath,['--import','tsx','--input-type=module','-e','const c=await (await import("vite")).resolveConfig({server:{middlewareMode:true},appType:"spa"},"serve"); console.log("SECURITY_CONFIG:"+JSON.stringify({base:c.base,hmr:c.server.hmr,watch:c.server.watch}));'],{env:{...env,APP_BASE_PATH:base,DISABLE_HMR:'true'},encoding:'utf8',timeout:15000});const actual=JSON.parse(config.split('\n').find(l=>l.startsWith('SECURITY_CONFIG:')).slice('SECURITY_CONFIG:'.length));assert.deepEqual(actual,{base,hmr:false,watch:null});results.push({mode:'development',base,passed:true,readyMs:s.readyMs,hmrDisabled:true});}finally{await s.stop();}
});
for(const base of ['/','/security-finanzas/'])test('security: enabled HMR updates a private fictional module: '+base,{timeout:30000},async()=>{
 const file=path.join(root,'src','__security_hmr_'+randomUUID().replaceAll('-','')+'.ts'),modulePath=base+'src/'+path.basename(file);let s,ws,created=false;
 try{await writeFile(file,'export const value="FICTITIOUS_FIRST";if(import.meta.hot)import.meta.hot.accept();\n',{flag:'wx'});created=true;s=await launch('development',base,false);const client=await(await fetch(s.origin+base+'@vite/client')).text(),port=JSON.parse(client.match(/const hmrPort = ([^;]+);/)[1]),token=JSON.parse(client.match(/const wsToken = ([^;]+);/)[1]);ws=new WebSocket('ws://127.0.0.1:'+port+base+'?token='+encodeURIComponent(token),'vite-hmr');const messages=[];let updated;const update=new Promise(r=>updated=r);ws.addEventListener('message',e=>{const m=JSON.parse(String(e.data));messages.push(m.type);if(m.type==='update'&&m.updates.some(u=>u.path.includes(path.basename(file))))updated();});await deadline(new Promise((r,j)=>{ws.addEventListener('open',r,{once:true});ws.addEventListener('error',()=>j(Error('HMR socket failed')),{once:true});}),5000,'HMR handshake timeout');const response=await fetch(s.origin+modulePath);assert.equal(response.status,200);assert.match(await response.text(),/FICTITIOUS_FIRST/);await writeFile(file,'export const value="FICTITIOUS_SECOND";if(import.meta.hot)import.meta.hot.accept();\n');await deadline(update,8000,'HMR update not delivered');assert.match(await(await fetch(s.origin+modulePath)).text(),/FICTITIOUS_SECOND/);assert.ok(messages.includes('update'));results.push({mode:'development',base,passed:true,hmrUpdated:true});}finally{ws?.close();if(s)await s.stop();if(created)await unlink(file);}
});
test.after(async()=>{execFileSync(process.execPath,['node_modules/vite/bin/vite.js','build'],{env:{...env,APP_BASE_PATH:'/'},stdio:'pipe',timeout:60000});await writeFile(path.join(output,'summary.json'),JSON.stringify({source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),results,scope:'Real Express/Vite HTTP and HMR on owned processes; fictional API data and no financial persistence operations. No ReDoS payloads. Tokens are never logged.'},null,2)+'\n');});
