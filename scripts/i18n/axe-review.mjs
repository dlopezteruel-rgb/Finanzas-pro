import {readdir,readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

/** Group repeated observations, preserving their provenance. Incomplete never means pass or violation. */
export function groupIncompleteReports(reports){
  if(!Array.isArray(reports)||!reports.length)throw new Error('At least one real axe report is required.');
  const groups=new Map(),totals={surfaces:0,violations:0,incompleteGroups:0,incompleteNodes:0},rules={},mechanisms={};
  for(const {name,data} of reports){
    if(!name||!Array.isArray(data?.observations)||!data.observations.length)throw new Error(`Missing axe observations: ${name}`);
    totals.surfaces+=data.observations.length;
    for(const [index,observation] of data.observations.entries()){
      if(!Array.isArray(observation.violations)||!Array.isArray(observation.incomplete))throw new Error(`Malformed axe observation: ${name}/${index}`);
      totals.violations+=observation.violations.length;
      for(const [groupIndex,result] of observation.incomplete.entries()){
        const details=Array.isArray(result.nodes)?result.nodes:result.review;
        const count=Array.isArray(result.nodes)?result.nodes.length:result.nodes;
        if(!result.id||!Number.isInteger(count)||count<1||details&&(!Array.isArray(details)||details.length!==count))throw new Error(`Malformed incomplete group: ${name}/${index}/${groupIndex}`);
        totals.incompleteGroups++;totals.incompleteNodes+=count;rules[result.id]=(rules[result.id]??0)+1;
        const key=JSON.stringify([name,observation.surface,result.id]);
        if(!groups.has(key))groups.set(key,{report:name,surface:observation.surface,rule:result.id,observationGroups:0,nodeOccurrences:0,languages:new Set(),widths:new Set(),themes:new Set(),references:[],mechanisms:{},examples:[],status:'manual-review-required',isAutomaticViolation:false});
        const group=groups.get(key);group.observationGroups++;group.nodeOccurrences+=count;
        group.languages.add(observation.language??'es');group.widths.add(observation.width);group.themes.add(observation.theme);
        group.references.push({observation:index,group:groupIndex});
        if(!details){group.mechanisms['details-not-retained']=(group.mechanisms['details-not-retained']??0)+count;mechanisms['details-not-retained']=(mechanisms['details-not-retained']??0)+count;continue;}
        for(const node of details){
          const checks=node.checks??[...(node.any??[]),...(node.all??[]),...(node.none??[])];
          const causes=[...new Set(checks.map(check=>`${check.id}:${check.data?.messageKey??'unclassified'}`))];
          if(!causes.length)causes.push('unclassified');
          for(const cause of causes){group.mechanisms[cause]=(group.mechanisms[cause]??0)+1;mechanisms[cause]=(mechanisms[cause]??0)+1;}
          if(!group.examples.some(e=>JSON.stringify(e.causes)===JSON.stringify(causes)))group.examples.push({causes,target:node.target,html:node.html,checks});
        }
      }
    }
  }
  return {schemaVersion:1,method:'Equivalence is report + surface + rule; every original observation remains referenced. Mechanism counts are node/check occurrences, not distinct defects. Missing details cannot establish a cause or resolution.',totals,rules,mechanisms,
    groups:[...groups.values()].map(g=>({...g,languages:[...g.languages].sort(),widths:[...g.widths].sort((a,b)=>a-b),themes:[...g.themes].sort()}))};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const [directory,output]=process.argv.slice(2);if(!directory||!output)throw new Error('Usage: node scripts/i18n/axe-review.mjs <browser-report-directory> <output.json>');
  const names=(await readdir(directory)).filter(name=>/^(axe|translated-.+|landing-language)\.json$/.test(name)).sort();
  const reports=await Promise.all(names.map(async name=>({name,data:JSON.parse(await readFile(path.join(directory,name),'utf8'))})));
  const report=groupIncompleteReports(reports);await writeFile(output,JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({reports:names.length,...report.totals,rules:report.rules,mechanisms:report.mechanisms}));
}
