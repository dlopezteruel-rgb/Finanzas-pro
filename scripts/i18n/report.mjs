import {inventory,sourceFiles} from './inventory.mjs';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const rows=inventory(),counts=values=>values.reduce((r,x)=>(r[x.classification]=(r[x.classification]??0)+1,r),{});
const files=[...new Set(rows.map(row=>row.file))].sort().map(file=>{
 const values=rows.filter(row=>row.file===file),source=readFileSync(file,'utf8');let policy='Review each candidate; not presumed translated';
 if(['src/constants/categories.ts','src/utils/seedData.ts'].includes(file))policy='Protected personal/demo values and historical catalogue identities';
 else if(file==='server.ts'||file.startsWith('src/services/'))policy='API and prompts protected; localize owned presentation at the UI boundary only';
 else if(file.startsWith('src/types/'))policy='Internal schema types/enums; visible labels require separate keys';
 else if(file==='src/utils/financialAssistant.ts')policy='Original calculations, recognition, context and service payload protected; optional owned UI text formatting uses the existing provider. Two-argument output covered by original snapshots';
 else if(file.startsWith('src/utils/'))policy='Domain implementation protected; review owned UI output for boundary adapters';
 return {file,policy,sourceSha256:createHash('sha256').update(source).digest('hex'),counts:counts(values),visibleCandidateLines:[...new Set(values.filter(row=>['visible-text','visible-attribute','ui-message-candidate'].includes(row.classification)).map(row=>row.line))].sort((a,b)=>a-b),presentationCalls:[...source.matchAll(/\b(?:formatCurrency|formatPlanningCents|monthLabel|toLocaleDateString|toLocaleTimeString|toLocaleString)\s*\(/g)].map(m=>({line:source.slice(0,m.index).split('\n').length,name:m[0].replace(/\s*\($/,'')}))};
});
// Domain literals stay in their original code; these explicit UI maps identify reviewed boundaries.
const presentationBoundaries=['src/i18n/planningMessages.ts','src/i18n/bankingMessages.ts','src/i18n/sharedMessages.ts','src/i18n/storageMessages.ts','src/i18n/chartMessages.ts','src/i18n/naturalMessages.ts','src/i18n/domainMessages.ts'].map(file=>{
 const source=readFileSync(file,'utf8'),match=/const keys\s*=\s*(\{[\s\S]*?\}) as const;/.exec(source);
 if(!match)throw Error(`Missing owned-message map: ${file}`);
 return {file,knownStaticMessages:Object.keys(JSON.parse(match[1])).length,policy:'Owned diagnostics/dependency labels only; unknown messages retained literally; never user fields or stored history'};
});
const visibleLiterals=rows.filter(row=>['visible-text','visible-attribute'].includes(row.classification)).map(row=>{
 const text=row.text.trim();let decision='PENDING';
 if(text==='FinanZas'&&row.file==='src/components/Brand.tsx')decision='Invariant product brand';
 else if(/^[\p{P}\p{S}\s]+$/u.test(text))decision='Invariant punctuation, mathematical/currency sign, direction arrow or required-field marker';
 else if(['A','B'].includes(text)&&row.file==='src/components/PlanningAutomationPanel.tsx')decision='Invariant scenario identifiers A/B';
 else if(text==='GASTO'&&['src/components/CatalogManager.tsx','src/components/PartidaSelector.tsx'].includes(row.file))decision='Overinclusive AST candidate: internal conditional operand; the displayed branch uses translated keys';
 else if(['2-digit','numeric'].includes(text)&&['src/components/RecurringMovementsView.tsx','src/components/TransactionsView.tsx'].includes(row.file))decision='Overinclusive AST candidate: Intl date option inside localized title expression, never displayed literally';
 return {file:row.file,line:row.line,text,decision};
});
const report={base:'95d08a2dd7c2d9752b8865fc8aa4a32263b5eb96',schemaVersion:3,status:'reviewed-static-inventory-runtime-validation-recorded-separately',currentCounts:counts(rows),visibleLiterals,files,presentationBoundaries,nonTypeScriptSurfaces:[{file:'index.html',policy:'Spanish bootstrap/default; document.title and description/OG metadata localized by existing provider at runtime; exact default tested'},{file:'src/**/*.css',policy:'Style tokens and layout are invariant; no owned generated textual content found in current styles'},{file:'public/brand and preview screenshots',policy:'Brand marks invariant. Four native landing previews use fictional fixtures; reproducible captures and hashes in phase-5b-preview-manifest.json. Not readiness certification.'}]};
writeFileSync(process.argv[2]??'docs/phase-5b-inventory.json',JSON.stringify(report,null,2)+'\n');console.log(report.currentCounts);
