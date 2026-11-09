import { carryObservation } from './planningCarry';
import type { FinanceData } from './backup';
import type { PlanningApproval, PlanningRule } from '../types/finance';
import { hasAutomation, effectiveBudgetPlans } from './planningBasis';
import { assertMonth, safeCents, planCents } from './planningMoney';
import { nextMonth, temporalMonth } from './planningCalendar';

function check(condition:unknown,message:string):asserts condition {if(!condition)throw new Error(`Automatización: ${message}`);}
function object(x:any,required:string[],optional:string[]=[]) {check(x&&typeof x==='object'&&!Array.isArray(x),'objeto inválido');for(const k of required)check(Object.hasOwn(x,k),`falta ${k}`);for(const k of Object.keys(x))check([...required,...optional].includes(k),`campo no reconocido ${k}`);}
function text(x:unknown) {check(typeof x==='string'&&x.trim().length>0&&x.length<=300,'texto inválido');}
function iso(x:unknown) {check(typeof x==='string'&&/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(x)&&Number.isFinite(Date.parse(x))&&new Date(x).toISOString()===x,'fecha ISO inválida');}
function list(x:any,limit:number) {check(Array.isArray(x)&&x.length<=limit,'colección inválida o límite de registros superado');}
function unique(keys:string[]) {check(new Set(keys).size===keys.length,'identificadores duplicados');}
function target(x:any) {check(['INGRESO','GASTO','SAVINGS'].includes(x.target),'destino inválido');if(x.target==='SAVINGS')check(!Object.hasOwn(x,'code'),'el ahorro no tiene código de partida');else text(x.code);}
export function validatePlanningRule(value:unknown):asserts value is PlanningRule {
  const r=value as PlanningRule;
    object(r,['id','name','target','amountCents','frequency','startMonth','active'],['code','endMonth']);text(r.id);text(r.name);target(r);safeCents(r.amountCents);check(planCents(r.amountCents/100)===r.amountCents,'importe de regla no representable');
    check(['monthly','quarterly','yearly'].includes(r.frequency),'frecuencia inválida');assertMonth(r.startMonth);if(r.endMonth!==undefined){assertMonth(r.endMonth);check(r.endMonth>=r.startMonth,'fin de regla anterior al inicio');}check(typeof r.active==='boolean','estado de regla inválido');
}
export function validateAutomation(data:FinanceData,approval:(value:unknown,path:string,advanced:boolean)=>asserts value is PlanningApproval) {
  check(hasAutomation(data),'3.0 exige campos nuevos de planificación');
  const a=data.planningAutomation;
  if(!a)return; // A current photo with base/carry breakdown alone is also 3.0.
  object(a,['rules','carryovers','origins','history']);
  list(a.rules,200);list(a.carryovers,1200);list(a.origins,20000);list(a.history,1200);
  unique(a.rules.map(r=>r.id));unique(a.carryovers.map(c=>c.id));unique(a.origins.map(o=>`${o.monthYear}:${o.target}:${o.code ?? ''}`));unique(a.history.map(h=>h.monthYear));
  for(const r of a.rules)validatePlanningRule(r);
  for(const o of a.origins) {
    object(o,['monthYear','target','kind','appliedAt'],['code','sourceMonth','ruleName']);assertMonth(o.monthYear);target(o);iso(o.appliedAt);check(['copy','rule','manual'].includes(o.kind),'procedencia inválida');
    check(data.planningMonths?.some(m=>m.monthYear===o.monthYear),'procedencia sin mes de planificación');
    if(o.kind==='copy'){assertMonth(o.sourceMonth!);check(o.sourceMonth!<o.monthYear&&!Object.hasOwn(o,'ruleName'),'origen de copia inválido');}
    else check(!Object.hasOwn(o,'sourceMonth'),'fuente inesperada');
    if(o.kind==='rule')text(o.ruleName);else check(!Object.hasOwn(o,'ruleName'),'nombre de regla inesperado');
  }
  unique(a.carryovers.map(c=>`${c.fromMonth}:${c.type}:${c.code}`));
  for(const c of a.carryovers) {
    object(c,['id','fromMonth','toMonth','type','code','amountCents','sourceBaseCents','sourceExecutedCents','sourceSignature','createdAt']);text(c.id);text(c.code);assertMonth(c.fromMonth);check(nextMonth(c.fromMonth)===c.toMonth,'el destino debe ser el mes consecutivo');iso(c.createdAt);
    check(c.fromMonth<temporalMonth(new Date(c.createdAt)),'el origen no estaba cerrado temporalmente');check(c.type==='GASTO','solo gastos admiten arrastre');safeCents(c.amountCents);safeCents(c.sourceBaseCents);safeCents(c.sourceExecutedCents);
    check(c.amountCents>0&&c.amountCents<=Math.max(0,c.sourceBaseCents-c.sourceExecutedCents),'arrastre excede el remanente observado');check(typeof c.sourceSignature==='string'&&/^[0-9a-f]{16}$/.test(c.sourceSignature),'firma de origen inválida');
    check(data.planningMonths?.some(m=>m.monthYear===c.toMonth),'arrastre sin mes destino');
    check(!a.carryovers.some(other=>other.toMonth===c.fromMonth&&other.code===c.code),'no se admiten cascadas de arrastre');
    const observed=carryObservation(data,c.fromMonth,c.code);
    if(observed.sourceSignature===c.sourceSignature)check(observed.baseCents===c.sourceBaseCents&&observed.executedCents===c.sourceExecutedCents,'observación inconsistente con el origen actual');
  }
  effectiveBudgetPlans(data); // Validate exact base + adjustments before exposing the backup.
  let retained=0;
  for(const h of a.history) {
    object(h,['monthYear','approvals']);assertMonth(h.monthYear);list(h.approvals,100);check(h.approvals.length>0,'historial vacío');retained+=h.approvals.length;
    const current=data.planningMonths?.find(m=>m.monthYear===h.monthYear)?.approval;check(current,'historial sin última fotografía');
    let number=0,at='',revision=0;
    for(const photo of h.approvals){approval(photo,`history.${h.monthYear}`,true);check(photo.number>number&&photo.number<current.number&&photo.approvedAt>=at&&photo.approvedAt<=current.approvedAt&&photo.revision>=revision&&photo.revision<=current.revision,'historial fuera de orden o incoherente');number=photo.number;at=photo.approvedAt;revision=photo.revision;}
  }
  check(retained<=2000,'límite de fotografías históricas superado');
}
