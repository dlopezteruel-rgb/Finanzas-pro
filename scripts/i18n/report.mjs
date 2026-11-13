import {inventory,sourceFiles} from './inventory.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const rows=inventory(),counts=values=>values.reduce((r,x)=>(r[x.classification]=(r[x.classification]??0)+1,r),{});
const files=[...new Set(rows.map(row=>row.file))].sort().map(file=>{
 const values=rows.filter(row=>row.file===file),source=readFileSync(file,'utf8');let policy='Review each candidate; not presumed translated';
 if(['src/constants/categories.ts','src/utils/seedData.ts'].includes(file))policy='Protected personal/demo values and historical catalogue identities';
 else if(file==='server.ts'||file.startsWith('src/services/'))policy='API and prompts protected; localize owned presentation at the UI boundary only';
 else if(file.startsWith('src/types/'))policy='Internal schema types/enums; visible labels require separate keys';
 else if(file.startsWith('src/utils/'))policy='Domain implementation protected; review owned UI output for boundary adapters';
 return {file,policy,sourceSha256:createHash('sha256').update(source).digest('hex'),counts:counts(values),visibleCandidateLines:[...new Set(values.filter(row=>['visible-text','visible-attribute','ui-message-candidate'].includes(row.classification)).map(row=>row.line))].sort((a,b)=>a-b),presentationCalls:[...source.matchAll(/\b(?:formatCurrency|formatPlanningCents|monthLabel|toLocaleDateString|toLocaleTimeString|toLocaleString)\s*\(/g)].map(m=>({line:source.slice(0,m.index).split('\n').length,name:m[0].replace(/\s*\($/,'')}))};
});
const report={base:'95d08a2dd7c2d9752b8865fc8aa4a32263b5eb96',schemaVersion:2,status:'in-progress-not-a-completeness-certificate',currentCounts:counts(rows),files,nonTypeScriptSurfaces:[{file:'index.html',policy:'Spanish bootstrap/default; document.title and description/OG metadata localized by existing provider at runtime; exact default tested'},{file:'src/**/*.css',policy:'Style tokens and layout are invariant; no owned generated textual content found in current styles'},{file:'public/brand and preview screenshots',policy:'Brand marks invariant; foreign-language landing preview images still require review/capture before readiness'}]};
writeFileSync(process.argv[2]??'docs/phase-5b-inventory.json',JSON.stringify(report,null,2)+'\n');console.log(report.currentCounts);
