import type { FinanceData } from './backup';
import type { PlanningCarryover, PlanningOrigin, PlanningRule, PlanningTarget } from '../types/finance';
import { planningLines, planningKey } from './planning';
import { validatePlanningRule } from './planningAutomationValidation';
import { assertMonth, planCents, safeCents, formatPlanningCents } from './planningMoney';
import { emptyAutomation } from './planningBasis';
import { monthNumber, nextMonth, planningRange, temporalMonth } from './planningCalendar';
import { isLegacyShared } from './sharedExpenses';
import { legacyTransferReport } from './transfers';

export type AutomationRequest =
  | { kind:'copy';source:string;first:string;last:string;keys:string[];savings:boolean;overwrite:string[] }
  | { kind:'recurrences';first:string;last:string;overwrite:string[] }
  | { kind:'rule';rule:PlanningRule } | { kind:'deleteRule';id:string }
  | { kind:'carry';source:string;amounts:{code:string;amountCents:number}[] }
  | { kind:'removeCarry'|'reviewCarry';id:string };
export interface AutomationRow { id:string;month:string;target:PlanningTarget;code?:string;before:number|null;after:number|null;status:'apply'|'skip'|'blocked';reason:string;origin?:{kind:'copy'|'rule';sourceMonth?:string;ruleName?:string}; }
export interface AutomationPreview { request:AutomationRequest;scope:string;id:string;createdAt:string;asOf:string;rows:AutomationRow[]; }
export function automationScope(data:FinanceData) {
  return JSON.stringify({plans:data.budgetPlans,months:data.planningMonths,automation:data.planningAutomation,transactions:data.transactions,groups:data.budgetGroups});
}
const targetKey=(t:{target:PlanningTarget;code?:string})=>`${t.target}:${t.code ?? ''}`;
const oldAmount=(data:FinanceData,month:string,target:PlanningTarget,code?:string):number|null=>target==='SAVINGS' ? data.planningMonths?.find(m=>m.monthYear===month)?.savingsCents ?? null : (()=>{const p=data.budgetPlans.find(p=>p.monthYear===month&&p.type===target&&p.code===code);return p?planCents(p.plannedAmount):null})();
export const protectedMonth=(data:FinanceData,month:string)=>!!data.planningMonths?.find(m=>m.monthYear===month)?.approval || !!data.planningAutomation?.history.some(h=>h.monthYear===month);
export const hasMonthPlan=(data:FinanceData,month:string)=>data.budgetPlans.some(p=>p.monthYear===month)||!!data.planningMonths?.some(m=>m.monthYear===month);
export { carryObservation, carryIsStale } from './planningCarry';
import { carryObservation } from './planningCarry';
function carryBlock(data:FinanceData,source:string,code:string,asOf:string) {
  if(source>=asOf)return 'El origen debe ser un mes transcurrido y cerrado temporalmente.';
  if(data.planningAutomation?.carryovers.some(c=>c.fromMonth===nextMonth(source)&&c.code===code))return 'El destino ya origina otro arrastre: no se permiten cascadas.';
  if(data.planningAutomation?.carryovers.some(c=>c.toMonth===source&&c.code===code))return 'El origen ya recibió arrastre: no se permiten cascadas.';
  if(data.transactions.some(t=>t.date.slice(0,7)===source&&t.code===code&&isLegacyShared(t)))return 'Revisa y migra el gasto compartido histórico antes de calcular remanentes.';
  if(legacyTransferReport(data.transactions).unresolved.some(t=>t.date.slice(0,7)===source&&t.code===code))return 'Hay traspasos históricos ambiguos que requieren revisión.';
  return '';
}
export function previewAutomation(data:FinanceData,request:AutomationRequest,now=new Date(),identity?:{id:string;createdAt:string}):AutomationPreview {
  const asOf=temporalMonth(now),id=identity?.id ?? crypto.randomUUID(),createdAt=identity?.createdAt ?? now.toISOString();
  const rows:AutomationRow[]=[];
  const add=(month:string,target:PlanningTarget,code:string|undefined,after:number,rowId:string,reason:string,origin:AutomationRow['origin'],permit:boolean,wholeMonth=false)=>{
    safeCents(after);if(planCents(after/100)!==after)throw new Error('Importe fuera del rango exacto.');
    const before=oldAmount(data,month,target,code),touched=before!==null||!!data.planningAutomation?.origins.some(o=>o.monthYear===month&&o.target===target&&o.code===code);
    let status:AutomationRow['status']='apply',why=reason;
    if(protectedMonth(data,month)){status='blocked';why='Mes aprobado o previamente aprobado: edición masiva bloqueada.';}
    else if(month<asOf){status='blocked';why='Solo se generan copias/recurrencias en el mes actual o futuro.';}
    else if((wholeMonth?hasMonthPlan(data,month):touched)&&!permit){status='skip';why='Conflicto existente: omitido por defecto; requiere elección individual.';}
    else if(before===after){status='skip';why='Ya coincide; no se duplica ni se vuelve a guardar.';}
    rows.push({id:rowId,month,target,...(code?{code}:{}),before,after,status,reason:why,...(origin?{origin}:{})});
  };
  if(request.kind==='copy') {
    assertMonth(request.source);const destinations=planningRange(request.first,request.last);
    if(destinations.some(m=>m<=request.source))throw new Error('Los destinos deben ser posteriores al mes origen.');
    if(!hasMonthPlan(data,request.source))throw new Error('El origen no tiene planificación guardada.');
    if(!request.keys.length&&!request.savings)throw new Error('Selecciona partidas o el objetivo de ahorro.');
    if(new Set(request.keys).size!==request.keys.length)throw new Error('Partidas seleccionadas duplicadas.');
    const source=data.budgetPlans.filter(p=>p.monthYear===request.source&&request.keys.includes(planningKey(p)));
    if(source.length!==request.keys.length)throw new Error('Alguna partida seleccionada no existe en el origen guardado.');
    for(const month of destinations) {
      for(const line of source)add(month,line.type,line.code,planCents(line.plannedAmount),`${month}:${planningKey(line)}`,'Copia de base guardada; no incluye arrastres ni aprobaciones.',{kind:'copy',sourceMonth:request.source},request.overwrite.includes(month),true);
      if(request.savings)add(month,'SAVINGS',undefined,data.planningMonths?.find(m=>m.monthYear===request.source)?.savingsCents ?? 0,`${month}:SAVINGS`,'Copia del objetivo guardado.',{kind:'copy',sourceMonth:request.source},request.overwrite.includes(month),true);
    }
  } else if(request.kind==='recurrences') {
    const targets=new Map<string,{month:string;rule:PlanningRule;rowId:string}[]>();
    for(const month of planningRange(request.first,request.last))for(const rule of data.planningAutomation?.rules ?? []) {
      const interval=rule.frequency==='monthly'?1:rule.frequency==='quarterly'?3:12;
      if(!rule.active||month<rule.startMonth||(rule.endMonth&&month>rule.endMonth)||(monthNumber(month)-monthNumber(rule.startMonth))%interval)continue;
      const key=`${month}:${targetKey(rule)}`,list=targets.get(key) ?? [];list.push({month,rule,rowId:`${key}:${rule.id}`});targets.set(key,list);
    }
    for(const candidates of targets.values()) {
      const selected=candidates.filter(c=>request.overwrite.includes(c.rowId));
      for(const {month,rule,rowId} of candidates) {
        if(candidates.length>1&&(selected.length!==1||selected[0].rowId!==rowId)) {rows.push({id:rowId,month,target:rule.target,...(rule.code?{code:rule.code}:{}),before:oldAmount(data,month,rule.target,rule.code),after:rule.amountCents,status:'skip',origin:{kind:'rule',ruleName:rule.name},reason:'Reglas coincidentes: elige una sola propuesta para esta partida/mes.'});continue;}
        add(month,rule.target,rule.code,rule.amountCents,rowId,`Regla ${rule.name} (${rule.frequency==='monthly'?'mensual':rule.frequency==='quarterly'?'trimestral':'anual'}).`,{kind:'rule',ruleName:rule.name},request.overwrite.includes(rowId));
      }
    }
  } else if(request.kind==='rule') {
    validatePlanningRule(request.rule);
    const old=data.planningAutomation?.rules.find(r=>r.id===request.rule.id);
    rows.push({id:request.rule.id,month:request.rule.startMonth,target:request.rule.target,...(request.rule.code?{code:request.rule.code}:{}),before:old?.amountCents ?? null,after:request.rule.amountCents,status:JSON.stringify(old)===JSON.stringify(request.rule)?'skip':'apply',reason:'Guardar regla únicamente. No genera ni borra presupuestos o movimientos.'});
  } else if(request.kind==='deleteRule') {
    const rule=data.planningAutomation?.rules.find(r=>r.id===request.id);if(!rule)throw new Error('La regla ya no existe.');
    rows.push({id:rule.id,month:rule.startMonth,target:rule.target,...(rule.code?{code:rule.code}:{}),before:rule.amountCents,after:null,status:'apply',reason:'Eliminar regla; se conservan las previsiones generadas y su procedencia histórica.'});
  } else if(request.kind==='carry') {
    assertMonth(request.source);const month=nextMonth(request.source);if(!request.amounts.length)throw new Error('Selecciona al menos una partida y un importe.');
    if(new Set(request.amounts.map(a=>a.code)).size!==request.amounts.length)throw new Error('Selección de arrastre duplicada.');
    for(const amount of request.amounts) {
      safeCents(amount.amountCents);const observation=carryObservation(data,request.source,amount.code);
      const reason=carryBlock(data,request.source,amount.code,asOf)||(protectedMonth(data,month)?'Destino aprobado o previamente aprobado: bloqueado.':data.planningAutomation?.carryovers.some(c=>c.fromMonth===request.source&&c.code===amount.code)?'Arrastre ya existente; no se duplica.':amount.amountCents<=0||amount.amountCents>observation.remainder?'Importe fuera del remanente positivo disponible.':'');
      const base=oldAmount(data,month,'GASTO',amount.code) ?? 0;
      rows.push({id:`${month}:GASTO:${amount.code}`,month,target:'GASTO',code:amount.code,before:base,after:safeCents(base+amount.amountCents),status:reason?'blocked':'apply',reason:reason||`Origen base ${formatPlanningCents(observation.baseCents)}, propio ejecutado ${formatPlanningCents(observation.executedCents)}, remanente ${formatPlanningCents(observation.remainder)}. Ajuste separado: +${formatPlanningCents(amount.amountCents)}; no es dinero real.`});
    }
  } else {
    const c=data.planningAutomation?.carryovers.find(c=>c.id===request.id);if(!c)throw new Error('El arrastre ya no existe.');
    const observation=carryObservation(data,c.fromMonth,c.code),block=request.kind==='reviewCarry'?(carryBlock(data,c.fromMonth,c.code,asOf)|| (c.amountCents>observation.remainder?'El remanente actual es menor: elimina el ajuste y revisa otro importe.':'')):'';
    rows.push({id:c.id,month:c.toMonth,target:'GASTO',code:c.code,before:c.amountCents,after:request.kind==='removeCarry'?0:c.amountCents,status:block?'blocked':'apply',reason:block||(request.kind==='removeCarry'?'Eliminar solo este ajuste; conserva la fotografía y marca el contenido modificado.':'Revisar expresamente la observación actual sin recalcular el importe del ajuste.')});
  }
  return {request,scope:automationScope(data),id,createdAt,asOf,rows};
}
export function applyAutomationPreview(data:FinanceData,preview:AutomationPreview,now=new Date()):FinanceData {
  if(automationScope(data)!==preview.scope||temporalMonth(now)!==preview.asOf)throw new Error('La vista previa ha caducado o los datos han cambiado. Cancela y vuelve a revisar.');
  const fresh=previewAutomation(data,preview.request,now,preview);
  if(JSON.stringify(fresh.rows)!==JSON.stringify(preview.rows))throw new Error('La propuesta cambió; vuelve a previsualizar.');
  const applied=fresh.rows.filter(r=>r.status==='apply');if(!applied.length)return data;
  const a=data.planningAutomation ?? emptyAutomation(),request=preview.request;
  if(request.kind==='rule')return {...data,planningAutomation:{...a,rules:[...a.rules.filter(r=>r.id!==request.rule.id),request.rule]}};
  if(request.kind==='deleteRule')return {...data,planningAutomation:{...a,rules:a.rules.filter(r=>r.id!==request.id)}};
  if(request.kind==='removeCarry'||request.kind==='reviewCarry') {
    return {...data,planningAutomation:{...a,carryovers:a.carryovers.flatMap(c=>c.id!==request.id?[c]:request.kind==='removeCarry'?[]:[{...c,...(()=>{const o=carryObservation(data,c.fromMonth,c.code);return {sourceBaseCents:o.baseCents,sourceExecutedCents:o.executedCents,sourceSignature:o.sourceSignature}})()}])}};
  }
  let next:FinanceData={...data,budgetPlans:[...data.budgetPlans],planningMonths:[...(data.planningMonths ?? [])],planningAutomation:{...a,carryovers:[...a.carryovers],origins:[...a.origins]}};
  for(const row of applied) {
    const old=next.planningMonths!.find(m=>m.monthYear===row.month);
    if(!old)next.planningMonths!.push({monthYear:row.month,savingsCents:0,revision:1});
    if(request.kind==='carry') {
      const item=request.amounts.find(a=>a.code===row.code)!,o=carryObservation(data,request.source,row.code!);
      next.planningAutomation!.carryovers.push({id:`${preview.id}:${row.code}`,fromMonth:request.source,toMonth:row.month,type:'GASTO',code:row.code!,amountCents:item.amountCents,sourceBaseCents:o.baseCents,sourceExecutedCents:o.executedCents,sourceSignature:o.sourceSignature,createdAt:preview.createdAt});
    } else {
      if(row.target==='SAVINGS')next.planningMonths=next.planningMonths!.map(m=>m.monthYear===row.month?{...m,savingsCents:row.after!}:m);
      else next.budgetPlans=[...next.budgetPlans.filter(p=>!(p.monthYear===row.month&&p.type===row.target&&p.code===row.code)),{monthYear:row.month,type:row.target,code:row.code!,plannedAmount:row.after!/100}];
      const origin:PlanningOrigin={monthYear:row.month,target:row.target,...(row.code?{code:row.code}:{}),...row.origin!,appliedAt:preview.createdAt};
      next.planningAutomation!.origins=[...next.planningAutomation!.origins.filter(o=>!(o.monthYear===row.month&&targetKey(o)===targetKey(row))),origin];
    }
  }
  return next;
}
/** Enforce immutable history and verify newly introduced adjustments at the store boundary. */
export function reconcileAutomation(previous:FinanceData,candidate:FinanceData):FinanceData {
  const old=previous.planningAutomation ?? emptyAutomation(),next=candidate.planningAutomation ?? emptyAutomation();
  const months=new Set([...old.history.map(h=>h.monthYear),...(previous.planningMonths ?? []).map(m=>m.monthYear)]);
  for(const month of months) {
    const before=previous.planningMonths?.find(m=>m.monthYear===month)?.approval,after=candidate.planningMonths?.find(m=>m.monthYear===month)?.approval;
    const oldPhotos=old.history.find(h=>h.monthYear===month)?.approvals ?? [],newPhotos=next.history.find(h=>h.monthYear===month)?.approvals ?? [];
    const expected=before&&JSON.stringify(before)!==JSON.stringify(after)?[...oldPhotos,before]:oldPhotos;
    if(JSON.stringify(expected)!==JSON.stringify(newPhotos))throw new Error('El historial es inmutable y debe conservar exactamente las fotografías anteriores.');
  }
  for(const c of next.carryovers) {
    const prior=old.carryovers.find(o=>o.id===c.id);
    if(!prior || JSON.stringify(prior)!==JSON.stringify(c)) {
      if(prior&&['id','fromMonth','toMonth','type','code','amountCents','createdAt'].some(k=>(prior as any)[k]!== (c as any)[k]))throw new Error('El arrastre no puede reescribirse; revisa o elimina el ajuste individual.');
      if(!prior&&protectedMonth(previous,c.toMonth))throw new Error('No se puede aplicar arrastre por lote a un mes previamente aprobado.');
      const reason=carryBlock(previous,c.fromMonth,c.code,temporalMonth());if(reason)throw new Error(reason);
      const o=carryObservation(previous,c.fromMonth,c.code);
      if(o.baseCents!==c.sourceBaseCents||o.executedCents!==c.sourceExecutedCents||o.sourceSignature!==c.sourceSignature||c.amountCents>o.remainder)throw new Error('La observación de arrastre no coincide con el origen guardado.');
    }
  }
  if(!candidate.planningAutomation)return candidate;
  const origins=next.origins.map(origin=>{
    const prior=old.origins.find(o=>o.monthYear===origin.monthYear&&targetKey(o)===targetKey(origin));
    if(prior&&JSON.stringify(prior)===JSON.stringify(origin)&&oldAmount(previous,origin.monthYear,origin.target,origin.code)!==oldAmount(candidate,origin.monthYear,origin.target,origin.code)) {
      const {sourceMonth,ruleName,...rest}=origin;return {...rest,kind:'manual' as const};
    }
    return origin;
  });
  return {...candidate,planningAutomation:{...next,origins}};
}
