import {build} from 'vite';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {languages,isLanguageAvailable} from '../../src/i18n';
/** Same app/provider/dictionaries. Readiness overrides exist ONLY in an isolated test bundle. */
export async function i18nTestBuild() {
  const availability=Object.fromEntries(Object.keys(languages).map(language=>[language,isLanguageAvailable(language)]));
  if(Object.values(availability).every(Boolean))return {dist:path.resolve('dist'),preview:false,availability,dispose:async()=>{}};
  const dir=await mkdtemp(path.join(os.tmpdir(),'finanzas-i18n-preview-'));
  const patched=new Set<string>();
  try {
    await build({base:'/',logLevel:'warn',define:{'process.env.GEMINI_API_KEY':'""','process.env.GOOGLE_API_KEY':'""'},plugins:[{
      name:'isolated-i18n-test-readiness',enforce:'pre',
      transform(source,id){
        const file=id.split('?')[0];
        if(file.endsWith('/src/i18n/messages.ts')){patched.add('registry');return source.replaceAll("status: 'planned'","status: 'ready'");}
        if(file.endsWith('/src/i18n/readiness.ts')){patched.add('readiness');return source.replaceAll('uiComplete: false','uiComplete: true').replaceAll('flowsVerified: false','flowsVerified: true');}
      },
    }],build:{outDir:dir,emptyOutDir:true,reportCompressedSize:false}});
    if(patched.size!==2)throw Error('The isolated preview did not load the expected production registry and readiness module.');
    console.log('[i18n test] isolated preview only; production availability:',JSON.stringify(availability));
    return {dist:dir,preview:true,availability,dispose:()=>rm(dir,{recursive:true,force:true})};
  }catch(error){await rm(dir,{recursive:true,force:true});throw error;}
}
