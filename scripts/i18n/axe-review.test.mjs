import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {groupIncompleteReports} from './axe-review.mjs';

const observation=(extra={})=>({language:'es',width:390,theme:'light',surface:'landing',violations:[],incomplete:[{id:'color-contrast',nodes:2}],...extra});
const report=observations=>[{name:'axe.json',data:{observations}}];

test('axe review: groups equivalent observations without discarding locales, sizes, themes or references',()=>{
  const result=groupIncompleteReports(report([observation(),observation({language:'fr',width:1280,theme:'dark'}),observation({surface:'dialog'})]));
  assert.equal(result.groups.length,2);assert.equal(result.totals.incompleteGroups,3);assert.equal(result.totals.incompleteNodes,6);
  assert.deepEqual(result.groups[0].languages,['es','fr']);assert.deepEqual(result.groups[0].widths,[390,1280]);assert.deepEqual(result.groups[0].themes,['dark','light']);assert.deepEqual(result.groups[0].references,[{observation:0,group:0},{observation:1,group:0}]);
});
test('axe review: incomplete is neither an automatic violation nor a manual pass',()=>{
  const result=groupIncompleteReports(report([observation({violations:[{id:'actual-violation'}]})]));
  assert.equal(result.totals.violations,1);assert.equal(result.groups[0].isAutomaticViolation,false);assert.equal(result.groups[0].status,'manual-review-required');
});
test('axe review: missing historical node details remain explicitly unattributed',()=>{
  const result=groupIncompleteReports(report([observation()]));assert.deepEqual(result.mechanisms,{'details-not-retained':2});assert.deepEqual(result.groups[0].examples,[]);
});
test('axe review: retains node/check evidence and separates two causes of the same rule',()=>{
  const node=cause=>({target:['.example'],html:'<span>Example</span>',any:[{id:'color-contrast',data:{messageKey:cause},message:cause}],all:[],none:[]});
  const result=groupIncompleteReports(report([observation({incomplete:[{id:'color-contrast',nodes:2,review:[node('nonBmp'),node('imgNode')]}]})]));
  assert.deepEqual(result.mechanisms,{'color-contrast:nonBmp':1,'color-contrast:imgNode':1});assert.equal(result.groups[0].examples.length,2);assert.deepEqual(result.groups[0].examples[1].target,['.example']);
});
test('axe review: missing, malformed or inconsistent evidence cannot become a zero-result approval',()=>{
  for(const reports of [[],[{name:'empty',data:{}}],report([observation({incomplete:[{id:'x',nodes:0}]})]),report([observation({incomplete:[{id:'x',nodes:2,review:[]}]})]),report([observation({violations:undefined})])])assert.throws(()=>groupIncompleteReports(reports));
});
test('axe review: all 136 general and 1527 matrix observations from verified 5B remain indexed',()=>{
  const evidence=JSON.parse(readFileSync('docs/phase-5c-axe-5b-reference.json','utf8'));
  assert.equal(evidence.totals.incompleteGroups,1663);assert.equal(evidence.groups.length,83);
  assert.equal(evidence.groups.filter(g=>g.report==='axe.json').reduce((n,g)=>n+g.references.length,0),136);
  assert.equal(evidence.groups.filter(g=>g.report!=='axe.json').reduce((n,g)=>n+g.references.length,0),1527);
  assert.deepEqual(evidence.rules,{'aria-prohibited-attr':670,'aria-valid-attr-value':68,'color-contrast':925});
  assert.equal(evidence.source.sha,'d12fadb7084cda7579bd74e4684acbdba68f8351');
});
