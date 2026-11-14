import assert from 'node:assert/strict';
import type {Page} from 'playwright-core';
import {dictionaries,es,type Language} from '../../src/i18n/messages';

const normalize=(value:string)=>value.replace(/\s+/gu,' ').trim();
export function protectedStrings(value:unknown,found=new Set<string>()):Set<string>{
 if(typeof value==='string')found.add(normalize(value));
 else if(Array.isArray(value))value.forEach(child=>protectedStrings(child,found));
 else if(value&&typeof value==='object')Object.values(value).forEach(child=>protectedStrings(child,found));
 return found;
}
/** Test-only lexical detector. It never rewrites DOM, user data, prompts or dictionaries. */
export function spanishResidualPatterns(language:Language,personal:readonly string[]=[]){
 if(language==='es')return {static:[],parameterized:[]} as {static:[string,string[]][];parameterized:{source:string;key:string}[]};
 const native=new Set(Object.values(dictionaries[language]!).map(normalize)),protectedText=new Set(personal.map(normalize)),staticMessages=new Map<string,string[]>(),parameterized:{source:string;key:string}[]=[];
 for(const [key,template] of Object.entries(es)){
  const text=normalize(template);
  if(native.has(text)||protectedText.has(text))continue;
  if(!/\{[^{}]+\}/u.test(text)){if(/\p{L}/u.test(text))staticMessages.set(text,[...(staticMessages.get(text)??[]),key]);continue;}
  // Short or all-slot templates cannot distinguish personal names from owned prose.
  if((text.replace(/\{[^{}]+\}/gu,'').match(/\p{L}/gu)??[]).length<12)continue;
  const source='^'+text.split(/(\{[^{}]+\})/u).map(part=>/^\{[^{}]+\}$/u.test(part)?'.+?':part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('')+'$';
  parameterized.push({source,key});
 }
 return {static:[...staticMessages],parameterized};
}
export async function assertNoSpanishOwnedText(page:Page,language:Language,personalData:unknown){
 if(language==='es')return;
 const personal=[...protectedStrings(personalData)],patterns=spanishResidualPatterns(language,personal);
 const residuals=await page.evaluate(({patterns,personal})=>{
  const normalize=(text:string)=>text.replace(/\s+/gu,' ').trim(),protectedText=new Set(personal),staticMessages=new Map(patterns.static),dynamic=patterns.parameterized.map(pattern=>({...pattern,regex:new RegExp(pattern.source,'u')})),found:{text:string;keys:string[];surface:string}[]=[];
  function inspect(text:string,surface:string){text=normalize(text);if(!text||protectedText.has(text))return;const keys=staticMessages.get(text)??dynamic.filter(pattern=>pattern.regex.test(text)).map(pattern=>pattern.key);if(keys.length)found.push({text,keys,surface});}
  function visible(element:Element){const target=element.tagName==='OPTION'?element.closest('select')!:element,style=getComputedStyle(target);return !!target.getClientRects().length&&style.visibility!=='hidden'&&style.display!=='none'&&!target.closest('[hidden],[aria-hidden="true"],script,style,template');}
  const walker=document.createTreeWalker(document.body,NodeFilter.SHOW_TEXT);let node:Node|null;
  while((node=walker.nextNode()))if(node.parentElement&&visible(node.parentElement))inspect(node.textContent??'',node.parentElement.tagName);
  for(const element of document.querySelectorAll('[aria-label],[title],[placeholder],[alt],[aria-valuetext],[aria-description],[data-tooltip]'))if(visible(element))for(const attribute of ['aria-label','title','placeholder','alt','aria-valuetext','aria-description','data-tooltip']){const value=element.getAttribute(attribute);if(value)inspect(value,`${element.tagName}[${attribute}]`);}
  return found;
 },{patterns,personal});
 assert.deepEqual(residuals,[],`Owned Spanish text remaining in ${language}; personal fields and deliberately native homographs are excluded explicitly`);
}
