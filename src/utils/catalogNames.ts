import {BUDGET_GROUPS} from '../constants/categories';
import type {BudgetGroup,BudgetPartida,CatalogNames,CatalogNameRef,MovementType} from '../types/finance';
import type {FinanceData} from './backup';

export const nameRefKey=(ref:CatalogNameRef)=>`${ref.type}:${ref.code}`;
export const defaultFamilies=new Map(BUDGET_GROUPS.map(g=>[g.code,g]));
export const defaultItems=new Map(BUDGET_GROUPS.flatMap(g=>g.partidas.map(p=>[nameRefKey(p),p] as const)));
export const defaultSubgroups=new Map<string,{type:MovementType;code:string;name:string}>(BUDGET_GROUPS.flatMap(g=>g.partidas.map(p=>[`${p.type}:${p.groupCode}`,{type:p.type,code:p.groupCode,name:p.groupName}] as const)));
export type CatalogNameTarget={kind:'family';code:string}|({kind:'item'|'subgroup'}&CatalogNameRef);
export const nameTargetKey=(target:CatalogNameTarget)=>target.kind==='family'?`family:${target.code}`:`${target.kind}:${nameRefKey(target)}`;
const empty=():CatalogNames=>({version:1,families:[],items:[],subgroups:[]});
function fail(ok:unknown,message:string):asserts ok{if(!ok)throw new Error(`Nombres del catálogo: ${message}`);}
const currentItem=(data:FinanceData,ref:CatalogNameRef)=>data.budgetGroups.flatMap(g=>g.partidas).find(p=>nameRefKey(p)===nameRefKey(ref));
const uniqueFamily=(data:FinanceData,code:string)=>data.budgetGroups.filter(g=>g.code===code).length===1;
const uniqueItem=(data:FinanceData,ref:CatalogNameRef)=>data.budgetGroups.flatMap(g=>g.partidas).filter(p=>nameRefKey(p)===nameRefKey(ref)).length===1;

/** Call only for defaults actually constructed by this application, never to infer imported provenance. */
export function systemCatalogNames():CatalogNames{return {version:1,families:BUDGET_GROUPS.map(g=>g.code),items:BUDGET_GROUPS.flatMap(g=>g.partidas.map(p=>({type:p.type,code:p.code}))),subgroups:[...defaultSubgroups.values()].map(({type,code})=>({type,code}))};}

export function isSystemFamily(data:FinanceData|null,group:BudgetGroup){const original=defaultFamilies.get(group.code);return !!data?.catalogNames?.families.includes(group.code)&&uniqueFamily(data,group.code)&&original?.type===group.type&&original.name===group.name;}
export function isSystemItem(data:FinanceData|null,item:BudgetPartida){return !!data?.catalogNames?.items.some(p=>nameRefKey(p)===nameRefKey(item))&&uniqueItem(data,item)&&defaultItems.get(nameRefKey(item))?.name===item.name;}
export function isSystemSubgroup(data:FinanceData|null,item:BudgetPartida){const key=`${item.type}:${item.groupCode}`;return !!data?.catalogNames?.subgroups.some(p=>nameRefKey(p)===key)&&defaultSubgroups.get(key)?.name===item.groupName;}

/** Validation is locale-independent; a stale/forged declaration never overrides a personal name. */
export function validateCatalogNames(data:FinanceData){
  const value=data.catalogNames;if(value===undefined)return;
  fail(value&&typeof value==='object'&&!Array.isArray(value),'declaración inválida.');
  fail(Object.keys(value).length===4&&['version','families','items','subgroups'].every(k=>Object.hasOwn(value,k))&&value.version===1,'versión o campos inválidos.');
  fail(Array.isArray(value.families)&&value.families.length<=defaultFamilies.size,'familias inválidas.');
  fail(new Set(value.families).size===value.families.length,'identidades duplicadas.');
  for(const code of value.families){fail(typeof code==='string','identidad inválida.');const original=defaultFamilies.get(code),current=data.budgetGroups.find(g=>g.code===code);fail(original&&current&&uniqueFamily(data,code)&&original.type===current.type&&original.name===current.name,'el nombre guardado no coincide con una familia inicial declarada.');}
  for(const kind of ['items','subgroups'] as const){
    const refs=value[kind],registry=kind==='items'?defaultItems:defaultSubgroups;fail(Array.isArray(refs)&&refs.length<=registry.size,'referencias inválidas.');
    const keys:string[]=[];
    for(const ref of refs){fail(ref&&typeof ref==='object'&&!Array.isArray(ref)&&Object.keys(ref).length===2&&['type','code'].every(k=>Object.hasOwn(ref,k))&&['GASTO','INGRESO'].includes(ref.type)&&typeof ref.code==='string','referencia inválida.');const key=nameRefKey(ref),original=registry.get(key);fail(original,'identidad inicial desconocida.');keys.push(key);
      if(kind==='items')fail(uniqueItem(data,ref)&&currentItem(data,ref)?.name===original.name,'el nombre guardado no coincide con una partida inicial declarada.');
      else for(const item of data.budgetGroups.flatMap(g=>g.partidas).filter(p=>p.type===ref.type&&p.groupCode===ref.code))fail(item.groupName===original.name,'el nombre guardado no coincide con un subgrupo inicial declarado.');
    }
    fail(new Set(keys).size===keys.length,'identidades duplicadas.');
  }
}

/** Existing/ambiguous data are candidates for explicit review, never automatically adopted. */
export function catalogNameCandidates(data:FinanceData):CatalogNameTarget[]{
  const targets:CatalogNameTarget[]=[];
  for(const group of data.budgetGroups.filter(g=>!g.deleted)){
    const original=defaultFamilies.get(group.code);if(uniqueFamily(data,group.code)&&original?.type===group.type&&original.name===group.name)targets.push({kind:'family',code:group.code});
    for(const item of group.partidas.filter(p=>!p.deleted))if(uniqueItem(data,item)&&defaultItems.get(nameRefKey(item))?.name===item.name)targets.push({kind:'item',type:item.type,code:item.code});
  }
  for(const original of defaultSubgroups.values()){
    const items=data.budgetGroups.filter(g=>!g.deleted).flatMap(g=>g.partidas).filter(p=>!p.deleted&&p.type===original.type&&p.groupCode===original.code);
    if(items.length&&items.every(p=>p.groupName===original.name))targets.push({kind:'subgroup',type:original.type,code:original.code});
  }
  return targets;
}
export function selectedCatalogNames(data:FinanceData):CatalogNameTarget[]{return data.catalogNames?[...data.catalogNames.families.map(code=>({kind:'family' as const,code})),...data.catalogNames.items.map(p=>({kind:'item' as const,...p})),...data.catalogNames.subgroups.map(p=>({kind:'subgroup' as const,...p}))]:[];}
export const catalogNamesScope=(data:FinanceData)=>JSON.stringify({groups:data.budgetGroups,names:data.catalogNames??null});

/** Executed by the existing catalogue mutation under FinanceStore's current revision/Web Lock. */
export function reviewCatalogNames(data:FinanceData,selected:CatalogNameTarget[],scope:string):FinanceData{
  fail(scope===catalogNamesScope(data),'el catálogo ha cambiado. Vuelve a revisar los nombres antes de confirmar.');
  fail(Array.isArray(selected)&&selected.length<=defaultFamilies.size+defaultItems.size+defaultSubgroups.size,'selección inválida.');
  fail(selected.every(t=>t&&typeof t==='object'&&typeof t.code==='string'&&(t.kind==='family'?Object.keys(t).length===2:(t.kind==='item'||t.kind==='subgroup')&&['GASTO','INGRESO'].includes(t.type)&&Object.keys(t).length===3)),'selección inválida.');
  const candidates=catalogNameCandidates(data),available=new Set(candidates.map(nameTargetKey)),keys=selected.map(nameTargetKey);
  fail(keys.every(key=>available.has(key))&&new Set(keys).size===keys.length,'selección inválida.');
  const retained=selectedCatalogNames(data).filter(target=>!available.has(nameTargetKey(target))),all=[...retained,...selected],next=empty();
  for(const target of all){if(target.kind==='family')next.families.push(target.code);else next[target.kind==='item'?'items':'subgroups'].push({type:target.type,code:target.code});}
  next.families.sort();next.items.sort((a,b)=>nameRefKey(a).localeCompare(nameRefKey(b)));next.subgroups.sort((a,b)=>nameRefKey(a).localeCompare(nameRefKey(b)));
  const result={...data,catalogNames:next};validateCatalogNames(result);return result;
}

/** Explicit rename intent withdraws only that name's presentation choice, even for identical spelling. */
export function personalizeCatalogName(data:FinanceData,target:CatalogNameTarget):FinanceData{
  if(!data.catalogNames)return data;const names={...data.catalogNames};
  if(target.kind==='family')names.families=names.families.filter(code=>code!==target.code);
  else names[target.kind==='item'?'items':'subgroups']=names[target.kind==='item'?'items':'subgroups'].filter(ref=>nameRefKey(ref)!==nameRefKey(target));
  return {...data,catalogNames:names};
}
