/** Server-test instrumentation: module identities only, never request bodies or secrets. */
import {registerHooks} from 'node:module';
import {appendFileSync,mkdirSync} from 'node:fs';
import path from 'node:path';
const output=process.env.SECURITY_MODULE_TRACE;
if(!output)throw Error('SECURITY_MODULE_TRACE must identify an isolated diagnostic file');
mkdirSync(path.dirname(output),{recursive:true});
const blocked=url=>/\/node_modules\/(?:vite|picomatch)\//.test(url);
registerHooks({
 resolve(specifier,context,next){const result=next(specifier,context);if(process.env.SECURITY_BLOCK_BUILD_IMPORTS==='1'&&blocked(result.url)){appendFileSync(output,JSON.stringify({event:'blocked',url:result.url})+'\n');throw Error('BUILD_DEPENDENCY_IN_PRODUCTION');}return result;},
 load(url,context,next){appendFileSync(output,JSON.stringify({event:'load',url})+'\n');return next(url,context);}
});
