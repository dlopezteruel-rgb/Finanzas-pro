import {build} from 'vite';
import {mkdtemp,rm,readFile,writeFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {gzipSync} from 'node:zlib';

// Independent in-memory build: never replace dist while browser suites use it.
const temporary=await mkdtemp(path.join(tmpdir(),'finanzas-bundle-audit-'));
try{
  const result=await build({logLevel:'silent',build:{outDir:temporary,write:false,emptyOutDir:false}});
  const outputs=(Array.isArray(result)?result:[result]).flatMap(r=>r.output??[]),chunks=outputs.filter(o=>o.type==='chunk');
  const initial=new Set(chunks.filter(c=>c.isEntry).map(c=>c.fileName));
  for(let added=true;added;){added=false;for(const chunk of chunks)if(initial.has(chunk.fileName))for(const file of chunk.imports)if(!initial.has(file)){initial.add(file);added=true;}}
  const dictionaries=['es','en','it','fr','pt'];
  const moduleName=id=>id.replaceAll('\\','/').replace(process.cwd().replaceAll('\\','/')+'/','');
  const report={schemaVersion:1,node:process.version,method:'Vite production build in memory; gzip level 6. Bundler module renderedLength is before final chunk minification and is not an exact share of minified/compressed bytes. Dictionary source sizes include all Spanish fragments.',
    chunks:chunks.map(c=>({file:c.fileName,entry:c.isEntry,initial:initial.has(c.fileName),bytes:Buffer.byteLength(c.code),gzipBytes:gzipSync(c.code).length,imports:c.imports,dynamicImports:c.dynamicImports,
      translationModules:Object.entries(c.modules).filter(([id])=>moduleName(id).startsWith('src/i18n/')).map(([id,m])=>({file:moduleName(id),renderedLength:m.renderedLength??null}))})),
    dictionaries:await Promise.all(dictionaries.map(async language=>{const file=`src/i18n/${language}.ts`,files=language==='es'?(await readdir('src/i18n')).filter(n=>/^es(?:\..+)?\.ts$/.test(n)).filter(n=>!n.endsWith('.test.ts')).map(n=>`src/i18n/${n}`).sort():[file],source=Buffer.concat(await Promise.all(files.map(f=>readFile(f)))),chunk=chunks.find(c=>Object.keys(c.modules).some(id=>moduleName(id)===file));return {language,files,sourceBytes:source.length,sourceGzipBytes:gzipSync(source).length,chunk:chunk?.fileName??null,initial:!!chunk&&initial.has(chunk.fileName)};})),
    proposalOnly:'Consider lazy-loading non-selected dictionaries behind the existing provider, with validated readiness, request-race/error handling and cross-tab/fallback tests. No loading strategy or runtime source changed by this audit.'};
  const text=JSON.stringify(report,null,2)+'\n';if(process.argv[2])await writeFile(process.argv[2],text);else process.stdout.write(text);
}finally{await rm(temporary,{recursive:true,force:true});}
