import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const suite=path.basename(process.argv.find(arg=>arg.endsWith('.browser.ts'))??'browser').replace(/[^a-zA-Z0-9.-]/g,'-');
const dir=path.resolve(process.env.CI_ARTIFACT_DIR??'ci-artifacts','browser','screenshots');
const launch=chromium.launch.bind(chromium);let counter=0;const captured=new WeakSet();
chromium.launch=async function(options){
  const browser=await launch(options),newContext=browser.newContext.bind(browser);
  const capture=async context=>{
    if(captured.has(context))return;captured.add(context);
    const sequence=counter++;if(sequence>=500)return;await mkdir(dir,{recursive:true});
    for(const [index,page] of context.pages().slice(-2).entries()){
      if(page.isClosed()||!/^https?:\/\/(?:127\.0\.0\.1|localhost)(?::|\/)/.test(page.url()))continue;
      const name=`${suite}-${sequence}-${index}`;
      try{await page.screenshot({path:path.join(dir,`${name}.jpg`),type:'jpeg',quality:65,timeout:3000});await writeFile(path.join(dir,`${name}.json`),JSON.stringify({suite,sequence,url:page.url(),fixtureOnly:true})+'\n');}
      catch(error){await writeFile(path.join(dir,`${name}.json`),JSON.stringify({suite,sequence,screenshotError:error.message.slice(0,500)})+'\n');}
    }
  };
  browser.newContext=async function(options){
    const context=await newContext(options),close=context.close.bind(context);let closed=false;
    context.close=async function(options){if(!closed){closed=true;await capture(context).catch(error=>process.stderr.write(`[diagnostics] ${error.message}\n`));}return close(options);};
    return context;
  };
  const close=browser.close.bind(browser);
  browser.close=async function(options){for(const context of browser.contexts())await capture(context).catch(error=>process.stderr.write(`[diagnostics] ${error.message}\n`));return close(options);};
  return browser;
};
