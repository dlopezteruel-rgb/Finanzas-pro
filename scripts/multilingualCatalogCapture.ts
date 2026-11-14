import express from 'express';
import path from 'node:path';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {chromium} from 'playwright-core';
import {DATA_KEY,makeBackup} from '../src/utils/backup';
import {LANGUAGE_KEY,translatorFor,type Language} from '../src/i18n';
import {multilingualCatalogFixture} from './multilingualCatalogFixture';

const baseline=process.argv[2];if(!baseline)throw Error('Pass the separately built 5C dist directory; never replace the current workspace.');
const directory=path.resolve('docs/phase-5d-screenshots');await mkdir(directory,{recursive:true});
async function serve(dist:string){const app=express();app.use(express.static(dist));app.get('*',(_q,r)=>r.sendFile(path.resolve(dist,'index.html')));const server=app.listen(0,'127.0.0.1');await new Promise<void>(r=>server.on('listening',r));return {server,origin:`http://127.0.0.1:${(server.address() as {port:number}).port}`};}
const before=await serve(baseline),after=await serve(path.resolve('dist')),browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH??'/usr/bin/chromium',args:['--no-sandbox']});
const sha=execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),files=execFileSync('git',['ls-files','src'],{encoding:'utf8'}).trim().split('\n').filter(file=>!file.includes('.test.'));
const hash=createHash('sha256');for(const file of files){hash.update(file);hash.update(await readFile(file));}
const captures:any[]=[];
try{
 for(const [language,width] of [['en',390],['fr',768],['pt',1280]] as const)for(const theme of ['light','dark'] as const)for(const state of ['before','after'] as const){
  const source=state==='before'?before:after,data={...multilingualCatalogFixture(state==='after'),theme},c=await browser.newContext({viewport:{width,height:1000},locale:'de-DE',timezoneId:'Europe/Madrid',serviceWorkers:'block'});
  try{
   await c.route('**/*',r=>new URL(r.request().url()).origin===source.origin?r.continue():r.abort());await c.addInitScript(({key,pref,value,language})=>{localStorage.setItem(key,value);localStorage.setItem(pref,language);},{key:DATA_KEY,pref:LANGUAGE_KEY,value:JSON.stringify(makeBackup(data)),language});const p=await c.newPage();await p.clock.setFixedTime(new Date('2026-11-13T12:00:00Z'));const t=translatorFor(language);await p.goto(source.origin+'/app');await p.getByRole('navigation',{name:t('nav.label')}).filter({visible:true}).getByRole('button',{name:t('nav.budgets'),exact:true}).click();await p.getByRole('tab',{name:t('budget_workspace.catalogo_y_detalle_de_partidas'),exact:true}).click();await p.locator('.catalog-view').waitFor();
   const file=`catalog-${language}-${width}-${theme}-${state}.png`;await p.screenshot({path:path.join(directory,file),animations:'disabled'});captures.push({file,state,language,width,theme,surface:'catalogue',sha256:createHash('sha256').update(await readFile(path.join(directory,file))).digest('hex')});
   if(state==='after'){
    await p.locator('.catalog-manager > summary').click();await p.getByRole('button',{name:t('catalog.names.review'),exact:true}).click();await p.getByRole('checkbox').first().scrollIntoViewIfNeeded();const file=`review-${language}-${width}-${theme}.png`;await p.screenshot({path:path.join(directory,file),animations:'disabled'});captures.push({file,state,language,width,theme,surface:'review',sha256:createHash('sha256').update(await readFile(path.join(directory,file))).digest('hex')});
   }
  }finally{await c.close();}
 }
 await writeFile('docs/phase-5d-capture-manifest.json',JSON.stringify({fixtureOnly:true,beforeCommit:'0a155a81ac31a96f28d515f64502507c91773f30',afterSourceCommit:sha,afterProductionSourceSha256:hash.digest('hex'),browser:browser.version(),note:'Before: original 5C build and legacy literal catalogue. After: 5D build with explicitly selected system names. Raw names and financial collections are identical; only catalogue-name metadata differs. Desktop emulation only; no physical-device claims.',captures},null,2)+'\n');
 console.log(`Captured ${captures.length} real application views with fictional data.`);
}finally{await browser.close();await Promise.all([before,after].map(({server})=>new Promise<void>(r=>server.close(()=>r()))));}
