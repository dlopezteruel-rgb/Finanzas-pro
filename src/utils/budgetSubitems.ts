import type { FinanceData } from './backup';
import type { BudgetPartida, BudgetSubitem, MonthlySubitemPlan, MovementType, SubitemAmount, SubitemSnapshot } from '../types/finance';
import { assertMonth, planCents, safeCents } from './planningMoney';
import { economicTransactions } from './transfers';

type Parent = { type: MovementType; code: string };
export const subitemParentKey = (p: Parent) => `${p.type}:${p.code}`;
export const sameSubitemParent = (a: Parent, b: Parent) => a.type === b.type && a.code === b.code;
export const subitemsFor = (data: FinanceData, p: Parent) => (data.budgetSubitems?.items ?? []).filter(i => !i.deleted && sameSubitemParent(i, p)).sort((a,b) => a.order-b.order || a.id.localeCompare(b.id));
export const monthlySubitems = (data: FinanceData, month: string, p: Parent) => data.budgetSubitems?.months.find(m => m.monthYear === month && sameSubitemParent(m,p));
export const subitemSum = (lines: {amountCents:number}[]) => lines.reduce((sum,l) => safeCents(sum+safeCents(l.amountCents)),0);
export const subitemContent = (data: FinanceData, month: string) => (data.budgetSubitems?.months ?? []).filter(m => m.monthYear===month).map(m => ({monthYear:m.monthYear,type:m.type,code:m.code,lines:m.lines.map(l=>({subitemId:l.subitemId,amountCents:l.amountCents})).sort((a,b)=>a.subitemId.localeCompare(b.subitemId))})).sort((a,b)=>subitemParentKey(a).localeCompare(subitemParentKey(b)));
/** Identity and cents define distribution; names, object key order and row order do not. */
export function normalizedSubitemBreakdowns(plans: (Parent & {lines:SubitemAmount[]})[]) {
  return JSON.stringify(plans.map(p=>({type:p.type,code:p.code,lines:p.lines.map(l=>({subitemId:l.subitemId,amountCents:l.amountCents})).sort((a,b)=>a.subitemId.localeCompare(b.subitemId))})).sort((a,b)=>subitemParentKey(a).localeCompare(subitemParentKey(b))));
}
export function subitemPhotos(data: FinanceData, month: string): SubitemSnapshot[] {
  return subitemContent(data,month).map(m=>({type:m.type,code:m.code,lines:m.lines.map(l=>({...l,name:data.budgetSubitems!.items.find(i=>i.id===l.subitemId)!.name}))}));
}
export function subitemUsed(data: FinanceData, id: string) {
  return data.transactions.some(t=>t.subitemId===id) || !!data.budgetSubitems?.months.some(m=>m.lines.some(l=>l.subitemId===id)) ||
    [...(data.planningMonths ?? []).flatMap(m=>m.approval?[m.approval]:[]),...(data.planningAutomation?.history ?? []).flatMap(h=>h.approvals)].some(a=>a.subitemBreakdowns?.some(b=>b.lines.some(l=>l.subitemId===id)));
}
function replaceItem(data: FinanceData, item: BudgetSubitem): FinanceData {
  const state = data.budgetSubitems ?? {items:[],months:[]};
  const old=state.items.find(i=>i.id===item.id);
  if (JSON.stringify(old)===JSON.stringify(item)) return data;
  return {...data,budgetSubitems:{...state,items:[...state.items.filter(i=>i.id!==item.id),item]}};
}
export function createSubitem(data: FinanceData, parent: Parent, name: string, id: string=crypto.randomUUID()): FinanceData {
  if (!data.budgetGroups.some(g=>g.partidas.some(p=>sameSubitemParent(p,parent)))) throw new Error('La partida padre no existe.');
  check(typeof id==='string'&&!!id.trim()&&id.length<=200,'ID inválido.');
  if (data.budgetSubitems?.items.some(i=>i.id===id)) throw new Error('El ID del subítem ya existe o está retirado.');
  const item={type:parent.type,code:parent.code,id,name:name.trim(),order:Math.max(-1,...subitemsFor(data,parent).map(i=>i.order))+1,archived:false};
  validateName(item.name);
  return replaceItem(data,item);
}
export type SubitemEdit = {kind:'create';parent:Parent;name:string;id:string} | {kind:'rename';id:string;name:string} | {kind:'archive';id:string;archived:boolean} | {kind:'delete';id:string} | {kind:'reorder';id:string;direction:-1|1};
export function editSubitem(data: FinanceData, edit: SubitemEdit): FinanceData {
  if(edit.kind==='create') return createSubitem(data,edit.parent,edit.name,edit.id);
  const item=data.budgetSubitems?.items.find(i=>i.id===edit.id&&!i.deleted);
  if(!item)throw new Error('El subítem ya no existe.');
  if(edit.kind==='rename') {validateName(edit.name.trim());return replaceItem(data,{...item,name:edit.name.trim()});}
  if(edit.kind==='archive')return replaceItem(data,{...item,archived:edit.archived});
  if(edit.kind==='delete') {
    if(subitemUsed(data,item.id))throw new Error('Este subítem tiene históricos. Archívalo para conservarlos.');
    return replaceItem(data,{...item,archived:true,deleted:true});
  }
  const siblings=subitemsFor(data,item),index=siblings.findIndex(i=>i.id===item.id),other=siblings[index+edit.direction];
  if(!other)return data;
  // Normalize the user-selected order; no financial collection is touched.
  [siblings[index],siblings[index+edit.direction]]=[other,item];
  const order=new Map(siblings.map((i,n)=>[i.id,n]));
  return {...data,budgetSubitems:{...data.budgetSubitems!,items:data.budgetSubitems!.items.map(i=>order.has(i.id)?{...i,order:order.get(i.id)!}:i)}};
}
function validateName(name: unknown): asserts name is string {
  if(typeof name!=='string'||!name.trim()||name.length>100)throw new Error('El nombre del subítem debe tener entre 1 y 100 caracteres.');
}
function check(ok: unknown, message: string): asserts ok {if(!ok)throw new Error(`Subítems: ${message}`);}
function shape(v:any, required:string[], optional:string[]=[]) {
  check(v && typeof v==='object'&&!Array.isArray(v),'objeto inválido.');
  check(required.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>[...required,...optional].includes(k)),'campos inválidos.');
}
function parent(p:any) {check(['GASTO','INGRESO'].includes(p.type)&&typeof p.code==='string'&&p.code.trim(),'partida o tipo inválido.');}
function unique(ids: string[]) {check(new Set(ids).size===ids.length,'IDs o partidas duplicados.');}
export function validateSubitemSnapshot(photos: unknown, lines: {type:MovementType;code:string;amountCents:number}[]) {
  check(Array.isArray(photos)&&photos.length<=2000,'fotografías inválidas.');
  unique(photos.map(subitemParentKey));
  for(const p of photos) {
    shape(p,['type','code','lines']);parent(p);check(Array.isArray(p.lines)&&p.lines.length>0&&p.lines.length<=1000,'desglose de fotografía inválido.');
    unique(p.lines.map((l:any)=>l.subitemId));
    for(const l of p.lines){shape(l,['subitemId','name','amountCents']);check(typeof l.subitemId==='string'&&l.subitemId.trim(),'ID de fotografía inválido.');validateName(l.name);safeCents(l.amountCents);}
    check(subitemSum(p.lines)===(lines.find(l=>sameSubitemParent(l,p))?.amountCents ?? 0),'la fotografía no coincide con su presupuesto base.');
  }
}
/** Strict schema validation, also used for imports. Does not mutate any record. */
export function validateSubitems(data: FinanceData) {
  const state=data.budgetSubitems;
  if(!state){check(!data.transactions.some(t=>t.subitemId!==undefined),'referencias sin registro de subítems.');return;}
  shape(state,['items','months']);check(Array.isArray(state.items)&&state.items.length<=10000&&Array.isArray(state.months)&&state.months.length<=20000,'colecciones inválidas.');
  unique(state.items.map(i=>i.id));unique(state.months.map(m=>`${m.monthYear}:${subitemParentKey(m)}`));
  const items=new Map(state.items.map(i=>[i.id,i]));
  for(const i of state.items) {
    shape(i,['id','type','code','name','order','archived'],['deleted']);parent(i);validateName(i.name);
    check(typeof i.id==='string'&&!!i.id.trim()&&i.id.length<=200,'ID inválido.');safeCents(i.order);
    check(typeof i.archived==='boolean'&&(i.deleted===undefined||i.deleted===true&&i.archived),'estado inválido.');
    check(data.budgetGroups.some(g=>g.partidas.some(p=>sameSubitemParent(p,i))),'partida padre inexistente.');
  }
  const ref=(id:unknown,p:Parent)=>{const i=items.get(id as string);check(typeof id==='string'&&i&&!i.deleted&&sameSubitemParent(i,p),'referencia inexistente, retirada o de otra partida/tipo.');return i;};
  for(const t of data.transactions)if(t.subitemId!==undefined){ref(t.subitemId,t);planCents(t.amount);check(!t.transfer&&!t.reimbursement&&!t.obligationSettlement,'las operaciones sin efecto presupuestario no admiten subítem.');}
  for(const m of state.months) {
    shape(m,['monthYear','type','code','lines']);parent(m);assertMonth(m.monthYear);
    check(Array.isArray(m.lines)&&m.lines.length>0&&m.lines.length<=1000,'desglose mensual vacío o inválido.');unique(m.lines.map(l=>l.subitemId));
    for(const l of m.lines){shape(l,['subitemId','amountCents']);ref(l.subitemId,m);safeCents(l.amountCents);}
    const sum=subitemSum(m.lines);
    check(planCents(sum/100)===sum,'importe no representable exactamente.');
    check(sum===planCents(data.budgetPlans.find(p=>p.monthYear===m.monthYear&&sameSubitemParent(p,m))?.plannedAmount ?? 0),'la suma de hijos no coincide con la base de la partida.');
    check(!data.planningAutomation?.carryovers.some(c=>(c.toMonth===m.monthYear||c.fromMonth===m.monthYear)&&sameSubitemParent(c,m)),'retira primero el arrastre global de origen o destino antes de distribuir la base.');
  }
  for(const a of [...(data.planningMonths ?? []).flatMap(m=>m.approval?[m.approval]:[]),...(data.planningAutomation?.history ?? []).flatMap(h=>h.approvals)]) {
    for(const p of a.subitemBreakdowns ?? [])for(const l of p.lines)ref(l.subitemId,p);
  }
}
/** Store boundary: identities and dependency protection cannot be bypassed by forms. */
export function assertSubitemTransition(previous: FinanceData, next: FinanceData) {
  const items=new Map((next.budgetSubitems?.items ?? []).map(i=>[i.id,i]));
  for(const old of previous.budgetSubitems?.items ?? []) {
    const item=items.get(old.id);
    check(item&&sameSubitemParent(item,old),'no se puede retirar una identidad ni cambiar su partida o tipo.');
    if(old.deleted)check(JSON.stringify(old)===JSON.stringify(item),'un ID retirado es permanente.');
    if(item.deleted&&!old.deleted)check(!subitemUsed(previous,old.id),'hay históricos dependientes; utiliza Archivar.');
  }
  const oldTx=new Map(previous.transactions.map(t=>[t.id,t]));
  for(const t of next.transactions)if(t.subitemId) {
    const i=items.get(t.subitemId),old=oldTx.get(t.id);
    if(i?.archived)check(old?.subitemId===i.id&&sameSubitemParent(old,t),'no se puede asignar un subítem archivado a otro movimiento.');
  }
  for(const m of next.budgetSubitems?.months ?? [])for(const l of m.lines) {
    if(items.get(l.subitemId)?.archived)check(!!monthlySubitems(previous,m.monthYear,m)?.lines.some(o=>o.subitemId===l.subitemId),'no se puede añadir una previsión nueva a un subítem archivado.');
  }
  validateSubitems(next);
}
export function replaceMonthlySubitems(data: FinanceData, month: string, drafts: MonthlySubitemPlan[]) {
  assertMonth(month);check(drafts.every(m=>m.monthYear===month),'mes de desglose incorrecto.');
  if(!data.budgetSubitems&&!drafts.length)return data;
  return {...data,budgetSubitems:{items:data.budgetSubitems?.items ?? [],months:[...(data.budgetSubitems?.months ?? []).filter(m=>m.monthYear!==month),...drafts]}};
}
export function subitemBudgetRows(data: FinanceData, month: string, partida: BudgetPartida) {
  const plan=monthlySubitems(data,month,partida),items=subitemsFor(data,partida);
  const txs=economicTransactions(data.transactions).filter(t=>t.processed&&t.date.startsWith(month)&&sameSubitemParent(t,partida));
  return [...items.map(i=>({id:i.id,name:i.name,archived:i.archived})),{id:undefined,name:'Sin subítem',archived:false}].map(i=>{
    const planned=i.id ? plan?.lines.find(l=>l.subitemId===i.id)?.amountCents ?? 0 : plan ? 0 : safeCents(Math.round((data.budgetPlans.find(p=>p.monthYear===month&&sameSubitemParent(p,partida))?.plannedAmount ?? 0)*100));
    const executed=safeCents(Math.round(txs.filter(t=>t.subitemId===i.id).reduce((n,t)=>n+t.amount,0)*100));
    return {...i,planned,executed,remainder:safeCents(planned-executed,false),deviation:safeCents(executed-planned,false)};
  });
}
