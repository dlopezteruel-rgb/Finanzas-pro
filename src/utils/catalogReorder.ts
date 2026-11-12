import type {FinanceData} from './backup';
import type {MovementType} from '../types/finance';
import type {SaveResult} from './saveResult';
import {catalogEntry,catalogKey} from './budgetCatalog';
import {changePartidaGroup} from './budgetChanges';
import {sameSubitemParent,subitemsFor} from './budgetSubitems';

export type DragSource={kind:'family';type:MovementType;code:string;label:string}|{kind:'partida';type:MovementType;code:string;label:string}|{kind:'subitem';type:MovementType;code:string;id:string;label:string};
export type DropTarget={kind:'family';type:MovementType;code?:string;label:string}|{kind:'partida';type:MovementType;groupCode:string;beforeCode?:string;label:string;disabled?:boolean}|{kind:'subitem';type:MovementType;code:string;beforeId?:string;label:string};
export interface ReorderRequest{source:DragSource;target:DropTarget;scope:string}
export type ReorderCallback=(request:ReorderRequest)=>Promise<SaveResult>;
export const catalogReorderScope=(d:FinanceData)=>JSON.stringify({groups:d.budgetGroups,subitems:d.budgetSubitems?.items});
export function canReorder(source:DragSource,target:DropTarget){return !('disabled' in target&&target.disabled)&&source.kind===target.kind&&source.type===target.type&&(source.kind!=='subitem'||target.kind==='subitem'&&source.code===target.code);}
function check(ok:unknown,message:string):asserts ok{if(!ok)throw new Error(message);}
export function applyCatalogReorder(data:FinanceData,request:ReorderRequest):FinanceData{
  check(request.scope===catalogReorderScope(data),'El catálogo ha cambiado durante el arrastre. Revisa el orden y vuelve a intentarlo.');
  const {source:s,target:t}=request;check(canReorder(s,t),'Destino no válido: conserva el tipo y la partida de cada subítem.');
  if(s.kind==='family'&&t.kind==='family'){
    const from=data.budgetGroups.find(g=>g.code===s.code&&!g.deleted),target=data.budgetGroups.find(g=>g.code===t.code&&!g.deleted);check(from&&from.type===s.type&&(t.code===undefined||target&&target.type===s.type),'Las familias deben existir y tener el mismo tipo.');if(from===target)return data;
    const groups=data.budgetGroups.filter(g=>g!==from),index=target?groups.indexOf(target):groups.reduce((last,g,n)=>g.type===s.type&&!g.deleted?n+1:last,0);groups.splice(index,0,from);return JSON.stringify(groups.filter(g=>g.type===s.type&&!g.deleted).map(g=>g.code))===JSON.stringify(data.budgetGroups.filter(g=>g.type===s.type&&!g.deleted).map(g=>g.code))?data:{...data,budgetGroups:groups};
  }
  if(s.kind==='partida'&&t.kind==='partida'){
    const {item,group}=catalogEntry(data,s),target=data.budgetGroups.find(g=>g.code===t.groupCode&&!g.archived&&!g.deleted);check(item&&!item.deleted&&group&&target&&target.type===s.type,'Elige una familia activa del mismo tipo.');
    if(group===target&&t.beforeCode===s.code)return data;
    let next=group===target?data:changePartidaGroup(data,item,target.code);
    const current=next.budgetGroups.find(g=>g.code===target.code)!,moved=current.partidas.find(p=>catalogKey(p)===catalogKey(s))!;
    const rest=current.partidas.filter(p=>p!==moved),index=t.beforeCode===undefined?rest.length:rest.findIndex(p=>p.code===t.beforeCode&&!p.deleted);
    check(index>=0,'La posición de destino ya no existe.');rest.splice(index,0,moved);
    if(group===target&&JSON.stringify(rest.filter(p=>!p.deleted).map(catalogKey))===JSON.stringify(current.partidas.filter(p=>!p.deleted).map(catalogKey)))return data;
    next={...next,budgetGroups:next.budgetGroups.map(g=>g===current?{...g,partidas:rest}:g)};
    return JSON.stringify(next.budgetGroups)===JSON.stringify(data.budgetGroups)?data:next;
  }
  check(s.kind==='subitem'&&t.kind==='subitem','Destino incompatible.');
  const item=data.budgetSubitems?.items.find(i=>i.id===s.id&&!i.deleted);check(item&&sameSubitemParent(item,s),'El subítem ya no existe.');if(t.beforeId===s.id)return data;
  const siblings=subitemsFor(data,item).filter(i=>i.id!==s.id),index=t.beforeId===undefined?siblings.length:siblings.findIndex(i=>i.id===t.beforeId);check(index>=0,'Los subítems solo se ordenan dentro de su partida.');siblings.splice(index,0,item);
  const orders=new Map(siblings.map((i,n)=>[i.id,n]));const items=data.budgetSubitems!.items.map(i=>orders.has(i.id)?{...i,order:orders.get(i.id)!}:i);
  return JSON.stringify(items)===JSON.stringify(data.budgetSubitems!.items)?data:{...data,budgetSubitems:{...data.budgetSubitems!,items}};
}
