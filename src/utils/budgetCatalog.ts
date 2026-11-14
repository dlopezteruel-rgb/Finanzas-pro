import type {BudgetGroup, BudgetPartida, MovementType} from '../types/finance';
import type {FinanceData} from './backup';
import {changePartidaGroup, duplicatePartida, reorderPartida} from './budgetChanges';
import {personalizeCatalogName,reviewCatalogNames,validateCatalogNames,type CatalogNameTarget} from './catalogNames';

export type CatalogParent={type:MovementType;code:string};
export const catalogKey=(p:CatalogParent)=>`${p.type}:${p.code}`;
export const hasCustomCatalog=(d:FinanceData)=>d.budgetGroups.some(g=>g.archived!==undefined||g.deleted!==undefined||g.partidas.some(p=>p.archived!==undefined||p.deleted!==undefined));
export const availableCatalogGroups=(groups:BudgetGroup[])=>groups.filter(g=>!g.archived&&!g.deleted).map(g=>({...g,partidas:g.partidas.filter(p=>!p.archived&&!p.deleted)}));
export const classificationCatalog=(groups:BudgetGroup[])=>availableCatalogGroups(groups).flatMap(g=>g.partidas.map(p=>({...p,groupName:p.groupCode===g.code?g.name:p.groupName})));
export const catalogEntry=(data:FinanceData,p:CatalogParent)=>{const group=data.budgetGroups.find(g=>g.partidas.some(i=>catalogKey(i)===catalogKey(p)));return {group,item:group?.partidas.find(i=>catalogKey(i)===catalogKey(p))};};
export const activeCatalogEntry=(data:FinanceData,p:CatalogParent)=>{const {group,item}=catalogEntry(data,p);return !!group&&!group.archived&&!group.deleted&&!!item&&!item.archived&&!item.deleted;};
function check(ok:unknown,message:string):asserts ok {if(!ok)throw new Error(`Catálogo: ${message}`);}
function name(value:string){check(typeof value==='string'&&!!value.trim()&&value.trim().length<=100,'el nombre debe tener entre 1 y 100 caracteres.');return value.trim();}
function uuidCode(prefix:string,id:string){check(typeof id==='string'&&!!id.trim()&&id.length<=200,'identificador inválido.');return `${prefix}-${id}`;}
export function catalogDependencies(data:FinanceData,parent:CatalogParent):string[]{
  const matches=(p:CatalogParent)=>catalogKey(p)===catalogKey(parent);
  const approvals=[...(data.planningMonths??[]).flatMap(m=>m.approval?[m.approval]:[]),...(data.planningAutomation?.history??[]).flatMap(h=>h.approvals)];
  return [
    data.transactions.some(matches)&&'Movimientos (también pendientes)', data.budgetPlans.some(matches)&&'Previsiones mensuales',
    data.loans.some(l=>l.code===parent.code)&&'Préstamos', data.budgetSubitems?.items.some(matches)&&'Identidades de subítems',
    data.budgetSubitems?.months.some(matches)&&'Desgloses mensuales',
    approvals.some(a=>[...a.lines,...(a.baseLines??[]),...(a.carryLines??[]),...(a.subitemBreakdowns??[])].some(matches))&&'Aprobaciones e histórico',
    data.planningAutomation?.rules.some(r=>r.target===parent.type&&r.code===parent.code)&&'Reglas de planificación',
    data.planningAutomation?.origins.some(o=>o.target===parent.type&&o.code===parent.code)&&'Procedencia de planificación',
    data.planningAutomation?.carryovers.some(matches)&&'Arrastres',
    data.intelligentFinance?.recurringRules.some(matches)&&'Movimientos periódicos (también retirados)',
  ].filter((s):s is string=>typeof s==='string');
}
export type CatalogArchiveTarget={kind:'archiveFamily';code:string}|{kind:'archivePartida';parent:CatalogParent};
/** Snapshot of the reviewed target and affected rules; never persisted in financial data. */
export function catalogArchiveImpact(data:FinanceData,target:CatalogArchiveTarget){
  const group=target.kind==='archiveFamily'?data.budgetGroups.find(g=>g.code===target.code):catalogEntry(data,target.parent).group;
  const items=target.kind==='archiveFamily'?group?.partidas??[]:[catalogEntry(data,target.parent).item].filter((p):p is BudgetPartida=>!!p);
  const keys=new Set(items.map(catalogKey));
  const recurring=(data.intelligentFinance?.recurringRules??[]).filter(r=>keys.has(catalogKey(r))).sort((a,b)=>a.id.localeCompare(b.id));
  const planning=(data.planningAutomation?.rules??[]).filter(r=>r.target!=='SAVINGS'&&keys.has(`${r.target}:${r.code}`)).sort((a,b)=>a.id.localeCompare(b.id));
  const dependencies=[...recurring.filter(r=>r.active&&!r.deleted).map(r=>({kind:'Movimiento periódico',id:r.id,name:r.concept,partida:items.find(p=>catalogKey(p)===catalogKey(r))!.name})),
    ...planning.filter(r=>r.active).map(r=>({kind:'Automatización de planificación',id:r.id,name:r.name,partida:items.find(p=>p.type===r.target&&p.code===r.code)!.name}))];
  const identity=target.kind==='archiveFamily'?{kind:target.kind,code:target.code}:{kind:target.kind,parent:{type:target.parent.type,code:target.parent.code}};
  return {name:target.kind==='archiveFamily'?group?.name:items[0]?.name,dependencies,rulesScope:JSON.stringify({recurring,planning}),
    scope:JSON.stringify({target:identity,group:group?{code:group.code,type:group.type,name:group.name,archived:group.archived,deleted:group.deleted}:null,items,recurring,planning})};
}
export type CatalogEdit=
 | {kind:'reviewNames';selected:CatalogNameTarget[];scope:string}
 | {kind:'createFamily';type:MovementType;name:string;id:string}
 | {kind:'renameFamily';code:string;name:string}
 | {kind:'archiveFamily';code:string;archived:boolean;scope?:string}
 | {kind:'deleteFamily';code:string}
 | {kind:'reorderFamily';code:string;direction:-1|1}
 | {kind:'createPartida';groupCode:string;name:string;description:string;keywords:string[];id:string}
 | {kind:'updatePartida';parent:CatalogParent;name:string;description:string;keywords:string[];personalizeName?:boolean}
 | {kind:'archivePartida';parent:CatalogParent;archived:boolean;scope?:string}
 | {kind:'deletePartida';parent:CatalogParent}
 | {kind:'duplicatePartida';parent:CatalogParent}
 | {kind:'movePartida';parent:CatalogParent;groupCode:string}
 | {kind:'reorderPartida';parent:CatalogParent;direction:-1|1};
function metadata(edit:{name:string;description:string;keywords:string[]}){
  check(typeof edit.description==='string'&&edit.description.length<=2000,'descripción demasiado larga.');
  check(Array.isArray(edit.keywords)&&edit.keywords.length<=100&&edit.keywords.every(k=>typeof k==='string'&&!!k.trim()&&k.length<=100),'palabras clave inválidas.');
  return {name:name(edit.name),description:edit.description.trim(),keywords:[...new Set(edit.keywords.map(k=>k.trim()))]};
}
export function editCatalog(data:FinanceData,edit:CatalogEdit):FinanceData{
  if(edit.kind==='reviewNames')return reviewCatalogNames(data,edit.selected,edit.scope);
  if(edit.kind==='createFamily'){
    check(edit.type==='GASTO'||edit.type==='INGRESO','tipo inválido.');const code=uuidCode('family',edit.id);
    check(!data.budgetGroups.some(g=>g.code===code),'esta identidad ya existe o está retirada.');
    return {...data,budgetGroups:[...data.budgetGroups,{code,type:edit.type,name:name(edit.name),archived:false,partidas:[]}]};
  }
  if(edit.kind==='createPartida'){
    const g=data.budgetGroups.find(g=>g.code===edit.groupCode);check(g&&!g.archived&&!g.deleted,'elige una familia activa.');
    const code=uuidCode('partida',edit.id);
    const occupied=data.budgetGroups.some(g=>g.partidas.some(p=>p.code===code))||(['GASTO','INGRESO'] as const).some(type=>catalogDependencies(data,{type,code}).length);
    check(!occupied,'esta identidad ya existe, tiene históricos o está retirada.');
    const p:BudgetPartida={...metadata(edit),code,type:g.type,groupCode:g.code,groupName:g.name,archived:false};
    return {...data,budgetGroups:data.budgetGroups.map(group=>group===g?{...g,partidas:[...g.partidas,p]}:group)};
  }
  if(edit.kind==='renameFamily'||edit.kind==='archiveFamily'||edit.kind==='deleteFamily'||edit.kind==='reorderFamily'){
    const g=data.budgetGroups.find(g=>g.code===edit.code);check(g&&!g.deleted,'la familia ya no existe.');
    if(edit.kind==='reorderFamily'){
      const siblings=data.budgetGroups.filter(i=>i.type===g.type&&!i.deleted),index=siblings.indexOf(g),other=siblings[index+edit.direction];if(!other)return data;
      const groups=[...data.budgetGroups],a=groups.indexOf(g),b=groups.indexOf(other);[groups[a],groups[b]]=[groups[b],groups[a]];return {...data,budgetGroups:groups};
    }
    if(edit.kind==='deleteFamily')check(g.partidas.every(p=>p.deleted&&!catalogDependencies(data,p).length),'la familia contiene partidas o históricos. Archívala para conservarlos.');
    const next=edit.kind==='renameFamily'?{...g,name:name(edit.name),archived:g.archived??false}:edit.kind==='archiveFamily'?{...g,archived:edit.archived}:{...g,archived:true,deleted:true as const};
    const result={...data,budgetGroups:data.budgetGroups.map(group=>group===g?next:group)};
    return edit.kind==='renameFamily'?personalizeCatalogName(result,{kind:'family',code:g.code}):result;
  }
  const {group:g,item:p}=catalogEntry(data,edit.parent);check(g&&!g.deleted&&p&&!p.deleted,'la partida ya no existe.');
  if(edit.kind==='duplicatePartida')return duplicatePartida(data,p);
  if(edit.kind==='movePartida')return changePartidaGroup(data,p,edit.groupCode);
  if(edit.kind==='reorderPartida')return reorderPartida(data,g.code,g.partidas.indexOf(p),edit.direction<0?'UP':'DOWN');
  if(edit.kind==='deletePartida'){const dependencies=catalogDependencies(data,p);check(!dependencies.length,`tiene dependencias: ${dependencies.join(', ')}. Utiliza Archivar.`);}
  const next=edit.kind==='updatePartida'?{...p,...metadata(edit),archived:p.archived??false}:edit.kind==='archivePartida'?{...p,archived:edit.archived}:{...p,archived:true,deleted:true as const};
  const result={...data,budgetGroups:data.budgetGroups.map(group=>group===g?{...g,partidas:g.partidas.map(item=>item===p?next:item)}:group)};
  return edit.kind==='updatePartida'&&(edit.personalizeName||edit.name!==p.name)?personalizeCatalogName(result,{kind:'item',type:p.type,code:p.code}):result;
}

/** Read validation preserves the legacy subgroup/container distinction. */
export function validateCatalog(data:FinanceData){
  for(const g of data.budgetGroups){
    for(const item of [g,...g.partidas]){
      check(item.archived===undefined||typeof item.archived==='boolean','estado de archivo inválido.');
      check(item.deleted===undefined||item.deleted===true&&item.archived===true,'una identidad retirada debe estar archivada.');
    }
    if(g.deleted)check(g.partidas.every(p=>p.deleted),'familia retirada con partidas activas.');
    for(const p of g.partidas)if(p.deleted)check(!catalogDependencies(data,p).length,'partida retirada con dependencias.');
  }
}
/** Applied inside the lock, including changes attempted outside the catalog forms. */
export function assertCatalogTransition(previous:FinanceData,next:FinanceData,review?:CatalogEdit){
  validateCatalogNames(next);
  const checkArchive=(target:CatalogArchiveTarget)=>{
    const impact=catalogArchiveImpact(previous,target);
    const matches=review?.kind===target.kind&&(target.kind==='archiveFamily'?review.kind==='archiveFamily'&&review.code===target.code:review.kind==='archivePartida'&&catalogKey(review.parent)===catalogKey(target.parent));
    const scope=matches&&review&&'scope' in review?review.scope:undefined;
    check(!impact.dependencies.length||scope!==undefined,'hay reglas activas afectadas. Revisa sus consecuencias y confirma el archivo.');
    if(scope!==undefined)check(scope===impact.scope,'el alcance del archivo ha cambiado. Cancela y vuelve a revisar las reglas antes de confirmar.');
    // Archiving is organizational only: it never changes the affected rules.
    check(catalogArchiveImpact(next,target).rulesScope===impact.rulesScope,'archivar no puede borrar, desactivar ni reasignar reglas.');
  };
  const archived=(data:FinanceData,p:CatalogParent)=>{const {group,item}=catalogEntry(data,p);return !!(group?.archived||item?.archived);};
  const protectedParent=(p:CatalogParent)=>archived(previous,p)||archived(next,p);
  const planKey=(p:CatalogParent&{monthYear:string})=>`${p.monthYear}:${catalogKey(p)}`;
  const beforePlans=new Map(previous.budgetPlans.map(p=>[planKey(p),p]));
  const afterPlans=new Map(next.budgetPlans.map(p=>[planKey(p),p]));
  for(const p of [...previous.budgetPlans,...next.budgetPlans])if(protectedParent(p))check(beforePlans.get(planKey(p))?.plannedAmount===afterPlans.get(planKey(p))?.plannedAmount,'la previsión de una partida o familia archivada es de solo lectura. Reactiva primero sin modificar importes.');
  const normalizeLines=(p:{lines:{subitemId:string;amountCents:number}[]}|undefined)=>p?JSON.stringify(p.lines.map(l=>({subitemId:l.subitemId,amountCents:l.amountCents})).sort((a,b)=>a.subitemId.localeCompare(b.subitemId))):undefined;
  const beforeMonths=new Map((previous.budgetSubitems?.months??[]).map(p=>[planKey(p),p]));
  const afterMonths=new Map((next.budgetSubitems?.months??[]).map(p=>[planKey(p),p]));
  for(const p of [...(previous.budgetSubitems?.months??[]),...(next.budgetSubitems?.months??[])])if(protectedParent(p))check(normalizeLines(beforeMonths.get(planKey(p)))===normalizeLines(afterMonths.get(planKey(p))),'el desglose mensual de un padre archivado es de solo lectura. Reactiva primero sin modificar importes.');
  for(const g of previous.budgetGroups){
    const after=next.budgetGroups.find(i=>i.code===g.code);check(after&&after.type===g.type,'no se puede retirar ni cambiar el tipo de una identidad de familia.');
    if(!g.archived&&after.archived)checkArchive({kind:'archiveFamily',code:g.code});
    if(g.deleted)check(JSON.stringify(g)===JSON.stringify(after),'las identidades retiradas son permanentes.');
    for(const p of g.partidas){
      const found=catalogEntry(next,p);check(found.item,'no se puede retirar ni cambiar el tipo de una identidad de partida.');
      if(!p.archived&&found.item.archived)checkArchive({kind:'archivePartida',parent:{type:p.type,code:p.code}});
      if(p.deleted)check(JSON.stringify(p)===JSON.stringify(found.item)&&found.group?.code===g.code,'las identidades retiradas son permanentes.');
      if(found.item.deleted&&!p.deleted)check(!catalogDependencies(previous,p).length,'hay históricos dependientes. Utiliza Archivar.');
      if(found.group?.code!==g.code)check(found.group?.type===g.type&&!found.group.archived&&!found.group.deleted,'el destino debe ser una familia activa del mismo tipo.');
    }
  }
  const oldKeys=new Set(previous.budgetGroups.flatMap(g=>g.partidas.map(catalogKey)));
  const oldCodes=new Set(previous.budgetGroups.flatMap(g=>g.partidas.map(p=>p.code)));
  for(const p of next.budgetGroups.flatMap(g=>g.partidas))if(!oldKeys.has(catalogKey(p))){
    check(!oldCodes.has(p.code)&&!(['GASTO','INGRESO'] as const).some(type=>catalogDependencies(previous,{type,code:p.code}).length),'no se puede reutilizar un código retirado o con históricos.');
  }
  const requireActive=(p:CatalogParent)=>check(activeCatalogEntry(next,p),'elige una partida activa para esta nueva asignación.');
  for(const item of next.budgetSubitems?.items??[])if(!previous.budgetSubitems?.items.some(i=>i.id===item.id))requireActive(item);
  for(const rule of next.intelligentFinance?.recurringRules??[]){const old=previous.intelligentFinance?.recurringRules.find(r=>r.id===rule.id);if(!old||catalogKey(old)!==catalogKey(rule))requireActive(rule);}
  for(const rule of next.planningAutomation?.rules??[])if(rule.target!=='SAVINGS'){
    const old=previous.planningAutomation?.rules.find(r=>r.id===rule.id);if(!old||old.target!==rule.target||old.code!==rule.code){const entry={type:rule.target,code:rule.code!};if(catalogEntry(next,entry).item)requireActive(entry);}
  }
  for(const loan of next.loans){const old=previous.loans.find(l=>l.id===loan.id);if(!old||old.code!==loan.code){const p={type:'GASTO' as const,code:loan.code};if(hasCustomCatalog(next)||catalogEntry(next,p).item)requireActive(p);}}
  const oldTx=new Map(previous.transactions.map(t=>[t.id,t]));
  for(const t of next.transactions){const old=oldTx.get(t.id);if(old&&catalogKey(old)===catalogKey(t)||t.transfer||t.reimbursement||t.obligationSettlement)continue;
    const {item,group}=catalogEntry(next,t);if(item||hasCustomCatalog(next))check(item&&!item.archived&&!item.deleted&&group&&!group.archived&&!group.deleted,'Selecciona una partida activa del catálogo; no se puede clasificar un movimiento nuevo en una partida ausente o archivada.');
  }
  const oldPlans=new Set(previous.budgetPlans.map(p=>`${p.monthYear}:${catalogKey(p)}`));
  for(const p of next.budgetPlans)if(!oldPlans.has(`${p.monthYear}:${catalogKey(p)}`)){const {item,group}=catalogEntry(next,p);if(item)check(!item.archived&&!item.deleted&&!group?.archived&&!group?.deleted,'no se puede crear una previsión nueva en una partida archivada.');}
  validateCatalog(next);
}
