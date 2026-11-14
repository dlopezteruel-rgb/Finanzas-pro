import React,{createContext,useContext} from 'react';
import {useI18n} from './index';
import type {translate} from './messages';
import type {BudgetGroup,BudgetPartida,MovementType} from '../types/finance';
import type {FinanceData} from '../utils/backup';
import {isSystemFamily,isSystemItem,isSystemSubgroup,type CatalogNameTarget} from '../utils/catalogNames';
import {catalogNameKeys} from './catalogKeys';

// This context carries original data. It never constructs a translated financial model.
const CatalogContext=createContext<FinanceData|null>(null);
export const CatalogNamesProvider=CatalogContext.Provider;
export function catalogPresentation(data:FinanceData|null,t:typeof translate){
 type NameKey={ [K in keyof typeof catalogNameKeys]:(typeof catalogNameKeys)[K][keyof (typeof catalogNameKeys)[K]] }[keyof typeof catalogNameKeys];
 const key=(kind:keyof typeof catalogNameKeys,id:string)=> (catalogNameKeys[kind] as Record<string,NameKey>)[id];
 const family=(g:BudgetGroup)=>isSystemFamily(data,g)?t(key('family',g.code)):g.name;
 const item=(p:BudgetPartida)=>isSystemItem(data,p)?t(key('item',`${p.type}:${p.code}`)):p.name;
 const subgroup=(p:BudgetPartida)=>{
  const container=data?.budgetGroups.find(g=>g.code===p.groupCode&&g.type===p.type);
  return container?family(container):isSystemSubgroup(data,p)?t(key('subgroup',`${p.type}:${p.groupCode}`)):p.groupName;
 };
 const findItem=(type:MovementType,code:string)=>data?.budgetGroups.flatMap(g=>g.partidas).find(p=>p.type===type&&p.code===code);
 const itemRef=(type:MovementType,code:string,fallback?:string)=>{const p=findItem(type,code);return p?item(p):fallback??t('partida_selector.partida_historica_fuera_del_catalogo');};
 const familyRef=(code:string,fallback:string)=>{const g=data?.budgetGroups.find(g=>g.code===code);return g?family(g):fallback;};
 const raw=(target:CatalogNameTarget)=>target.kind==='family'?data?.budgetGroups.find(g=>g.code===target.code)?.name??'':target.kind==='item'?findItem(target.type,target.code)?.name??'':data?.budgetGroups.flatMap(g=>g.partidas).find(p=>p.type===target.type&&p.groupCode===target.code)?.groupName??'';
 const target=(target:CatalogNameTarget,preview=false)=>{
  const id=target.kind==='family'?target.code:`${target.type}:${target.code}`,k=key(target.kind,id);
  if(preview&&k)return t(k);
  if(target.kind==='family'){const g=data?.budgetGroups.find(g=>g.code===target.code);return g?family(g):raw(target);}
  const p=target.kind==='item'?findItem(target.type,target.code):data?.budgetGroups.flatMap(g=>g.partidas).find(p=>p.type===target.type&&p.groupCode===target.code);
  return p?(target.kind==='item'?item(p):subgroup(p)):raw(target);
 };
 return {family,item,subgroup,itemRef,familyRef,target,raw};
}
export function useCatalogNames(){const data=useContext(CatalogContext),{t}=useI18n();return catalogPresentation(data,t);}

/** Only application-owned catalogue diagnostics, never arbitrary user names or service responses. */
export function catalogNamesDiagnostic(message:string,t:typeof translate):string|undefined{
 if(!message.startsWith('Nombres del catálogo: '))return;
 if(message==='Nombres del catálogo: el catálogo ha cambiado. Vuelve a revisar los nombres antes de confirmar.')return t('catalog.names.staleReview');
 if(message==='Nombres del catálogo: selección inválida.')return t('catalog.names.invalidSelection');
 return t('catalog.names.invalidDeclaration');
}
