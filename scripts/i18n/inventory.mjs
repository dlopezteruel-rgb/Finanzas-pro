import {parseSync} from 'rolldown/utils';
import {readFileSync,readdirSync,writeFileSync,existsSync} from 'node:fs';
import path from 'node:path';
export function sourceFiles(dir='src') { return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?sourceFiles(path.join(dir,e.name)):/\.tsx?$/.test(e.name)&&!/\.test\.tsx?$/.test(e.name)&&!e.name.endsWith('.d.ts')?[path.join(dir,e.name)]:[]); }
export function inventoryFile(file, source = readFileSync(file,'utf8')) {
 const ast=parseSync(file,source,{lang:file.endsWith('tsx')?'tsx':'ts'});
 if(ast.errors.length)throw Error(`${file}: ${JSON.stringify(ast.errors)}`);
 const rows=[];
 const translationCall=node=>node.type==='CallExpression'&&(['t','uiText','tn','uiCount'].includes(node.callee?.name)||(node.callee?.type==='MemberExpression'&&node.callee.property?.name==='text'&&['ui','view','v'].includes(node.callee.object?.name)));
 function visit(node,parents=[]) {
  if(!node||typeof node!=='object')return;
  if(node.type==='JSXText'||node.type==='Literal'&&typeof node.value==='string'||node.type==='TemplateLiteral') {
   const parent=parents.at(-1),attribute=[...parents].reverse().find(p=>p.type==='JSXAttribute'),prop=[...parents].reverse().find(p=>p.type==='Property');
   const uiMessage=parents.some(p=>p.type==='NewExpression'&&/^(?:Error|TypeError|RangeError)$/.test(p.callee?.name??'')||p.type==='CallExpression'&&/^(?:set.*(?:Error|Notice|Warning|Notification)|alert|confirm)$/.test(p.callee?.name??''));
   const text=node.type==='JSXText'?node.value:node.type==='TemplateLiteral'?node.quasis.map((q,i)=>q.value.cooked+(i<node.expressions.length?`{value${i+1}}`:'')).join(''):node.value;
   if(/[\p{L}]/u.test(text))rows.push({file,line:source.slice(0,node.start).split('\n').length,start:node.start,end:node.end,kind:node.type,text,role:parent?.type==='Property'?(parent.key===node?'key':'value'):undefined,attribute:attribute?.name?.name,property:prop?.key?.name??prop?.key?.value,parent:parent?.type,ancestors:parents.slice(-5).map(p=>p.type),expression:node.type==='TemplateLiteral'?node.expressions.map(e=>source.slice(e.start,e.end)):undefined,classification:(parents.some(p=>translationCall(p)&&p.arguments[0]&&node.start>=p.arguments[0].start&&node.end<=p.arguments[0].end)||attribute?.name?.name==='id'&&parents.some(p=>p.type==='JSXOpeningElement'&&p.name?.name==='I18nText'))?'translation-key':node.type==='JSXText'?'visible-text':uiMessage?'ui-message-candidate':attribute?(['aria-label','title','placeholder','alt','aria-valuetext','aria-description','data-label','data-tooltip'].includes(attribute.name.name)?'visible-attribute':'attribute-internal'):parents.some(p=>p.type==='ImportDeclaration'||['TSLiteralType','TSUnionType','TSTypeReference'].includes(p.type))?'type-or-import':'review'});
  }
  for(const [key,value] of Object.entries(node)){if(['type','start','end','raw','loc','comments'].includes(key))continue;if(Array.isArray(value))for(const child of value)visit(child,[...parents,node]);else if(value&&typeof value==='object')visit(value,[...parents,node]);}
 }
 visit(ast.program);return rows;
}
export const inventory=()=>[...sourceFiles(),...['server.ts','config/appPaths.ts'].filter(existsSync)].filter(f=>!f.startsWith('src/i18n/')).flatMap(file=>inventoryFile(file));
if(process.argv[1]?.endsWith('inventory.mjs')){const rows=inventory();writeFileSync(process.argv[2]??'/tmp/finanzas-i18n-inventory.json',JSON.stringify(rows,null,2)+'\n');console.log(JSON.stringify(rows.reduce((r,x)=>(r[x.classification]=(r[x.classification]??0)+1,r),{})));}
