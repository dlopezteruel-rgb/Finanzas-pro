import {build} from 'vite';
import {mkdtemp,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {gzipSync} from 'node:zlib';
const temporary=await mkdtemp(path.join(tmpdir(),'finanzas-5e-bundles-'));
try{
 const result=await build({logLevel:'silent',build:{outDir:temporary,write:false,emptyOutDir:false}}),outputs=(Array.isArray(result)?result:[result]).flatMap(r=>r.output??[]),chunks=outputs.filter(o=>o.type==='chunk');
 const initial=new Set(chunks.filter(c=>c.isEntry).map(c=>c.fileName));
 for(let previous=-1;previous!==initial.size;){previous=initial.size;for(const c of chunks)if(initial.has(c.fileName))for(const name of c.imports)initial.add(name);}
 const relative=id=>id.replaceAll('\\','/').replace(process.cwd().replaceAll('\\','/')+'/','');
 const report={schemaVersion:1,node:process.version,method:'Production Vite8/Rolldown outputs; actual minified/gzip bytes by chunk. Module renderedLength is pre-final-minification and cannot assign an exact compressed share. Initial means the static entry graph, not dynamic imports.',chunks:chunks.map(c=>({file:c.fileName,entry:c.isEntry,initial:initial.has(c.fileName),bytes:Buffer.byteLength(c.code),gzipBytes:gzipSync(c.code).length,imports:c.imports,dynamicImports:c.dynamicImports,modules:Object.entries(c.modules).map(([id,m])=>({file:relative(id),renderedLength:m.renderedLength??0})).sort((a,b)=>b.renderedLength-a.renderedLength)})),assets:outputs.filter(o=>o.type==='asset').map(a=>({file:a.fileName,bytes:Buffer.byteLength(a.source)}))};
 report.initial={bytes:report.chunks.filter(c=>c.initial).reduce((n,c)=>n+c.bytes,0),gzipBytes:report.chunks.filter(c=>c.initial).reduce((n,c)=>n+c.gzipBytes,0)};
 report.dictionaries=Object.fromEntries(['es','en','it','fr','pt'].map(l=>[l,report.chunks.filter(c=>c.modules.some(m=>m.file===`src/i18n/${l}.ts`)).map(c=>({file:c.file,initial:c.initial,bytes:c.bytes,gzipBytes:c.gzipBytes}))]));
 if(process.env.PERF_REQUIRE_LAZY==='1'){
  for(const l of ['en','it','fr','pt'])if(!report.dictionaries[l].length||report.dictionaries[l].some(c=>c.initial))throw Error(`Foreign dictionary ${l} must exist only in a dynamic chunk`);
  if(report.initial.gzipBytes>256834)throw Error('Initial gzip exceeds 80% of measured 5D baseline321042: review deterministic regression.');
 }
 const text=JSON.stringify(report,null,2)+'\n';if(process.argv[2])await writeFile(process.argv[2],text);else process.stdout.write(text);
}finally{await rm(temporary,{recursive:true,force:true});}
