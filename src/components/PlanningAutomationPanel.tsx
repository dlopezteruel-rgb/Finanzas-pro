import React,{useEffect,useLayoutEffect,useState} from 'react';
import type { FinanceData } from '../utils/backup';
import type { PlanningRule, PlanningApproval } from '../types/finance';
import type { SaveResult } from '../utils/saveResult';
import { applyAutomationPreview, previewAutomation, carryObservation, carryIsStale, protectedMonth, hasMonthPlan, type AutomationPreview, type AutomationRequest } from '../utils/planningAutomation';
import { annualPlanning, planningKey, formatPlanningCents as money, parsePlanningMoney, planningMoneyInput } from '../utils/planning';
import { nextMonth, monthNumber } from '../utils/planningCalendar';
import { SafeDialog } from './SafeDialog';
import { useAsyncForm } from '../utils/useAsyncForm';

const previousMonth=(month:string)=>{const n=monthNumber(month)-1;return `${String(Math.floor(n/12)).padStart(4,'0')}-${String(n%12+1).padStart(2,'0')}`};
const labels={copy:'Copiar planificación',rules:'Reglas recurrentes',recurrences:'Aplicar recurrencias',carry:'Arrastrar remanentes',history:'Historial de aprobaciones'};
type Mode=keyof typeof labels;
const destinationAfter=(month:string)=>{try{return nextMonth(month)}catch{return month}};
export function PlanningAutomationPanel({data,month,blocked,onBusy,onApply,requestCarryReview}:{data:FinanceData;month:string;blocked:boolean;onBusy:(busy:boolean)=>void;onApply:(preview:AutomationPreview)=>Promise<SaveResult>;requestCarryReview?:{id:string}|null}) {
  const [mode,setMode]=useState<Mode|null>(null),[preview,setPreview]=useState<AutomationPreview|null>(null),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const submission=useAsyncForm();useLayoutEffect(()=>onBusy(submission.saving),[submission.saving,onBusy]);
  const [source,setSource]=useState(month),[first,setFirst]=useState(()=>destinationAfter(month)),[last,setLast]=useState(()=>destinationAfter(month)),[copySavings,setCopySavings]=useState(true);
  const [keys,setKeys]=useState(()=>data.budgetPlans.filter(p=>p.monthYear===month).map(planningKey));
  const [carrySource,setCarrySource]=useState(()=>previousMonth(month)),[amounts,setAmounts]=useState<Record<string,string>>({});
  const [ruleId,setRuleId]=useState(''),[ruleName,setRuleName]=useState(''),[ruleTarget,setRuleTarget]=useState('SAVINGS'),[ruleAmount,setRuleAmount]=useState('0'),[frequency,setFrequency]=useState<PlanningRule['frequency']>('monthly'),[ruleStart,setRuleStart]=useState(month),[ruleEnd,setRuleEnd]=useState(''),[active,setActive]=useState(true);
  const [historyMonth,setHistoryMonth]=useState(month),[compareA,setCompareA]=useState(''),[compareB,setCompareB]=useState('');
  const a=data.planningAutomation;
  const catalog=new Map(data.budgetGroups.flatMap(g=>g.partidas).map(p=>[planningKey(p),p.name]));
  const partName=(type:string,code?:string)=>type==='SAVINGS'?'Ahorro objetivo':`${type} · ${catalog.get(`${type}:${code}`) ?? 'Partida histórica'}`;
  const prepare=(request:AutomationRequest)=>{try{setError('');submission.clearError();setPreview(previewAutomation(data,request))}catch(e){setError((e as Error).message)}};
  // A row opens the same reviewed operation; browsing never applies it.
  useEffect(()=>{if(requestCarryReview&&!blocked)prepare({kind:'reviewCarry',id:requestCarryReview.id})},[requestCarryReview]);
  const close=()=>{if(!submission.saving){setMode(null);setError('');setPreview(null)}};
  const editRule=(rule:PlanningRule)=>{setRuleId(rule.id);setRuleName(rule.name);setRuleTarget(rule.target==='SAVINGS'?'SAVINGS':`${rule.target}:${rule.code}`);setRuleAmount(planningMoneyInput(rule.amountCents));setFrequency(rule.frequency);setRuleStart(rule.startMonth);setRuleEnd(rule.endMonth ?? '');setActive(rule.active)};
  const newRule=()=>{setRuleId('');setRuleName('');setRuleTarget('SAVINGS');setRuleAmount('0');setFrequency('monthly');setRuleStart(month);setRuleEnd('');setActive(true)};
  const start=(next:Mode)=>{if(blocked)return;setMode(next);setError('');setNotice('');if(next==='copy'){setFirst(destinationAfter(month));setLast(destinationAfter(month));setSource(month);setKeys(data.budgetPlans.filter(p=>p.monthYear===month).map(planningKey));setCopySavings(true)}if(next==='recurrences'){setFirst(month);setLast(month)}if(next==='rules')newRule()};
  const selectedHistory=[...(a?.history.find(h=>h.monthYear===historyMonth)?.approvals ?? []),...(data.planningMonths?.find(m=>m.monthYear===historyMonth)?.approval?[data.planningMonths.find(m=>m.monthYear===historyMonth)!.approval!]:[])];
  const photoA=selectedHistory.find(p=>String(p.number)===compareA) ?? selectedHistory[0],photoB=selectedHistory.find(p=>String(p.number)===compareB) ?? selectedHistory.at(-1);
  const compareLines=(one:PlanningApproval,two:PlanningApproval)=>[...new Map([...one.lines,...two.lines].map(l=>[planningKey(l),l])).values()];
  let after:FinanceData|undefined;
  if(preview)try{after=applyAutomationPreview(data,preview)}catch{}
  const totals=(d:FinanceData,m:string)=>annualPlanning(d,m.slice(0,4)).find(r=>r.monthYear===m)!;
  const targetOptions=new Map([...data.budgetGroups.flatMap(g=>g.partidas).map(p=>[planningKey(p),partName(p.type,p.code)] as const),...data.budgetPlans.map(p=>[planningKey(p),partName(p.type,p.code)] as const),...(a?.rules.filter(r=>r.code).map(r=>[`${r.target}:${r.code}`,partName(r.target,r.code)] as const) ?? [])]);
  return <section className="planning-card space-y-3" aria-label="Automatización de planificación">
    <h2 className="text-lg font-bold">Planificación multiperiodo</h2>
    <p>Copia, reglas y arrastres requieren revisión y confirmación. Nunca generan movimientos ni modifican saldos bancarios.</p>
    {blocked&&<p role="status">Guarda o descarta los cambios locales antes de usar estas operaciones.</p>}
    {notice&&<p role="status">{notice}</p>}
    <div className="flex flex-wrap gap-2">{(Object.keys(labels) as Mode[]).map(key=><button key={key} type="button" disabled={blocked||submission.saving} onClick={()=>start(key)}>{labels[key]}</button>)}</div>
    {!!a?.carryovers.length&&<div className="space-y-2"><h3 className="font-bold">Ajustes de arrastre guardados</h3>{a.carryovers.filter(c=>c.toMonth===month||c.fromMonth===month).map(c=><div key={c.id} className="planning-family">
      <p>{c.fromMonth} → {c.toMonth} · {partName(c.type,c.code)} · {money(c.amountCents)}</p>
      {carryIsStale(data,c)&&<p role="status" className="planning-warning">Arrastre potencialmente desactualizado: cambió el presupuesto, el libro o el cierre temporal del origen. No se recalculó automáticamente.</p>}
      <button disabled={blocked||submission.saving} onClick={()=>prepare({kind:'reviewCarry',id:c.id})}>Revisar este arrastre</button><button disabled={blocked||submission.saving} onClick={()=>prepare({kind:'removeCarry',id:c.id})}>Eliminar este arrastre</button>
    </div>)}</div>}
    {mode&&<SafeDialog title={labels[mode]} onCancel={close}><div className="planning space-y-3">
      {error&&<p role="alert">{error}</p>}
      {(mode==='copy'||mode==='recurrences')&&<><label className="block">Primer mes destino <input type="month" aria-label="Primer mes destino" value={first} onChange={e=>setFirst(e.target.value)}/></label><label className="block">Último mes destino <input type="month" aria-label="Último mes destino" value={last} onChange={e=>setLast(e.target.value)}/></label><p>Máximo 12 meses. Mes actual o futuro; los meses con aprobación previa están bloqueados.</p></>}
      {mode==='copy'&&<>
        <label className="block">Mes origen guardado <input type="month" aria-label="Mes origen guardado" value={source} onChange={e=>{setSource(e.target.value);setKeys(data.budgetPlans.filter(p=>p.monthYear===e.target.value).map(planningKey))}}/></label>
        <fieldset><legend>Partidas base seleccionadas (incluye históricas)</legend>{data.budgetPlans.filter(p=>p.monthYear===source).map(p=><label className="block" key={planningKey(p)}><input type="checkbox" checked={keys.includes(planningKey(p))} onChange={e=>setKeys(previous=>e.target.checked?[...previous,planningKey(p)]:previous.filter(k=>k!==planningKey(p)))}/> {partName(p.type,p.code)} · {money(Math.round(p.plannedAmount*100))}</label>)}</fieldset>
        <label className="block"><input type="checkbox" checked={copySavings} onChange={e=>setCopySavings(e.target.checked)}/> Copiar ahorro objetivo guardado</label>
        <p>Solo base y objetivo seleccionados. No copia arrastres, fotografías, revisiones ni historial. Los borradores destino se omiten por defecto; puedes autorizar individualmente la mezcla de las partidas seleccionadas.</p>
        <button onClick={()=>prepare({kind:'copy',source,first,last,keys,savings:copySavings,overwrite:[]})}>Previsualizar copia</button>
      </>}
      {mode==='recurrences'&&<><p>Aplica manualmente las reglas activas; cada conflicto se omite por defecto. Las reglas pausadas no generan propuestas.</p><button onClick={()=>prepare({kind:'recurrences',first,last,overwrite:[]})}>Previsualizar recurrencias</button></>}
      {mode==='rules'&&<>
        <p>Guardar, editar, pausar o eliminar una regla no altera los presupuestos ya creados. Las futuras previsiones se aplican manualmente.</p>
        <div>{a?.rules.map(r=><div className="planning-family" key={r.id}><p>{r.name} · {partName(r.target,r.code)} · {money(r.amountCents)} · {r.frequency==='monthly'?'Mensual':r.frequency==='quarterly'?'Trimestral':'Anual'} · {r.active?'Activa':'Pausada'}</p><button onClick={()=>editRule(r)}>Editar regla {r.name}</button><button onClick={()=>prepare({kind:'rule',rule:{...r,active:!r.active}})}>{r.active?'Pausar':'Activar'} regla {r.name}</button><button onClick={()=>prepare({kind:'deleteRule',id:r.id})}>Eliminar regla {r.name}</button></div>)}</div>
        <button onClick={newRule}>Nueva regla</button>
        <label className="block">Nombre de regla <input aria-label="Nombre de regla" value={ruleName} maxLength={300} onChange={e=>setRuleName(e.target.value)}/></label>
        <label className="block">Destino de regla <select aria-label="Destino de regla" value={ruleTarget} onChange={e=>setRuleTarget(e.target.value)}><option value="SAVINGS">Ahorro objetivo</option>{[...targetOptions].map(([key,name])=><option key={key} value={key}>{name}</option>)}</select></label>
        <label className="block">Importe de regla (€) <input aria-label="Importe de regla (€)" inputMode="decimal" value={ruleAmount} onChange={e=>setRuleAmount(e.target.value)}/></label>
        <label className="block">Frecuencia <select aria-label="Frecuencia" value={frequency} onChange={e=>setFrequency(e.target.value as typeof frequency)}><option value="monthly">Mensual</option><option value="quarterly">Trimestral</option><option value="yearly">Anual</option></select></label>
        <label className="block">Inicio de regla <input aria-label="Inicio de regla" type="month" value={ruleStart} onChange={e=>setRuleStart(e.target.value)}/></label>
        <label className="block">Fin de regla (opcional) <input aria-label="Fin de regla (opcional)" type="month" value={ruleEnd} onChange={e=>setRuleEnd(e.target.value)}/></label>
        <label><input type="checkbox" checked={active} onChange={e=>setActive(e.target.checked)}/> Regla activa</label>
        <button onClick={()=>{try{const [target,...code]=ruleTarget.split(':');prepare({kind:'rule',rule:{id:ruleId||crypto.randomUUID(),name:ruleName,target:target as PlanningRule['target'],...(target==='SAVINGS'?{}:{code:code.join(':')}),amountCents:parsePlanningMoney(ruleAmount),frequency,startMonth:ruleStart,...(ruleEnd?{endMonth:ruleEnd}:{}),active}})}catch(e){setError((e as Error).message)}}}>Previsualizar regla</button>
      </>}
      {mode==='carry'&&<>
        <label className="block">Mes de origen del remanente <input aria-label="Mes de origen del remanente" type="month" value={carrySource} onChange={e=>{setCarrySource(e.target.value);setAmounts({})}}/></label>
        <p>Solo gastos de un mes transcurrido; destino consecutivo. Se permite un ajuste por origen/partida, sin cascadas. No es efectivo, ingreso, saldo ni ahorro realizado. La ausencia de movimientos no acredita dinero disponible.</p>
        {data.budgetPlans.filter(p=>p.monthYear===carrySource&&p.type==='GASTO').map(p=>{
          let o:ReturnType<typeof carryObservation>;try{o=carryObservation(data,carrySource,p.code)}catch{return <p key={p.code} role="alert">Revisa los importes históricos de {partName(p.type,p.code)} antes de arrastrar.</p>}
          return <div key={p.code} className="planning-family"><p>{partName(p.type,p.code)} · Base {money(o.baseCents)}, propio procesado {money(o.executedCents)}, remanente {money(o.remainder)}</p>
            <label><input type="checkbox" aria-label={`Seleccionar remanente ${p.code}`} checked={Object.hasOwn(amounts,p.code)} onChange={e=>setAmounts(previous=>{const next={...previous};if(e.target.checked)next[p.code]=planningMoneyInput(o.remainder);else delete next[p.code];return next})}/> Seleccionar partida</label>
            {Object.hasOwn(amounts,p.code)&&<label>Arrastre (€) <input aria-label={`Arrastre ${p.code} (€)`} inputMode="decimal" value={amounts[p.code]} onChange={e=>setAmounts(previous=>({...previous,[p.code]:e.target.value}))}/></label>}
          </div>;
        })}
        <button onClick={()=>{try{prepare({kind:'carry',source:carrySource,amounts:Object.entries(amounts).map(([code,value])=>({code,amountCents:parsePlanningMoney(value)}))})}catch(e){setError((e as Error).message)}}}>Previsualizar arrastre</button>
      </>}
      {mode==='history'&&<>
        <label>Mes del historial <input aria-label="Mes del historial" type="month" value={historyMonth} onChange={e=>{setHistoryMonth(e.target.value);setCompareA('');setCompareB('')}}/></label>
        <p>Solo fotografías reales conservadas. De un JSON 2.9 previo se conoce únicamente su última aprobación; no se inventan las anteriores.</p>
        {!selectedHistory.length?<p>Sin fotografías de aprobación.</p>:<>
          <ol>{selectedHistory.map(p=><li key={p.number}>Aprobación n.º {p.number} · revisión {p.revision} · {p.approvedAt}</li>)}</ol>
          <label>Versión A <select aria-label="Versión A" value={photoA?.number ?? ''} onChange={e=>setCompareA(e.target.value)}>{selectedHistory.map(p=><option key={p.number} value={p.number}>{p.number}</option>)}</select></label>
          <label>Versión B <select aria-label="Versión B" value={photoB?.number ?? ''} onChange={e=>setCompareB(e.target.value)}>{selectedHistory.map(p=><option key={p.number} value={p.number}>{p.number}</option>)}</select></label>
          {photoA&&photoB&&<div className="chart-table automation-table" tabIndex={0} role="region" aria-label="Comparación de aprobaciones desplazable"><table><caption>Diferencias entre fotografías reales</caption><thead><tr><th>Partida</th><th>A</th><th>B</th><th>Diferencia B − A</th></tr></thead><tbody>
            {compareLines(photoA,photoB).map(l=>{const va=photoA.lines.find(p=>planningKey(p)===planningKey(l))?.amountCents ?? 0,vb=photoB.lines.find(p=>planningKey(p)===planningKey(l))?.amountCents ?? 0;return <tr key={planningKey(l)}><th>{partName(l.type,l.code)}</th><td>{money(va)}</td><td>{money(vb)}</td><td>{money(vb-va)}</td></tr>})}
            <tr><th>Ahorro objetivo</th><td>{money(photoA.totals.savings)}</td><td>{money(photoB.totals.savings)}</td><td>{money(photoB.totals.savings-photoA.totals.savings)}</td></tr>
            <tr><th>Arrastre aprobado</th><td>{money(photoA.carryLines?.reduce((n,l)=>n+l.amountCents,0) ?? 0)}</td><td>{money(photoB.carryLines?.reduce((n,l)=>n+l.amountCents,0) ?? 0)}</td><td>{money((photoB.carryLines?.reduce((n,l)=>n+l.amountCents,0) ?? 0)-(photoA.carryLines?.reduce((n,l)=>n+l.amountCents,0) ?? 0))}</td></tr>
          </tbody></table></div>}
          {[photoA,photoB].filter((p):p is NonNullable<typeof p>=>!!p).map((photo,index)=><details key={index}><summary>Subítems de la fotografía {index===0?'A':'B'} · n.º {photo.number}</summary>{photo.subitemBreakdowns===undefined?<p>Sin desglose histórico. No se reconstruye con el catálogo actual.</p>:photo.subitemBreakdowns.map(b=><div key={planningKey(b)}><strong>{partName(b.type,b.code)}</strong>{b.lines.map(l=><p key={l.subitemId}>{l.name}: {money(l.amountCents)}</p>)}</div>)}</details>)}
        </>}
      </>}
      <button disabled={submission.saving} onClick={close}>Cerrar operación</button>
    </div></SafeDialog>}
    {preview&&<SafeDialog title="Confirmar operación de planificación" onCancel={()=>{if(!submission.saving)setPreview(null)}}><div className="planning space-y-3">
      <p>Acción {{copy:'Copiar planificación',recurrences:'Aplicar recurrencias',rule:'Guardar regla',deleteRule:'Eliminar regla',carry:'Arrastrar remanentes',removeCarry:'Eliminar arrastre',reviewCarry:'Revisar arrastre'}[preview.request.kind]} · {preview.request.kind==='copy'?`Origen guardado ${preview.request.source}`:preview.request.kind==='carry'?`Origen ${preview.request.source}`:'Solo los cambios aplicables'}. Revisa antes/después y omisiones. No se generarán movimientos bancarios.</p>
      {preview.request.kind==='copy'&&[...new Set(preview.rows.map(r=>r.month))].map(m=>hasMonthPlan(data,m)&&!protectedMonth(data,m)?<label className="block" key={m}><input type="checkbox" checked={preview.request.kind==='copy'&&preview.request.overwrite.includes(m)} onChange={e=>{const request=preview.request;if(request.kind==='copy')prepare({...request,overwrite:e.target.checked?[...request.overwrite,m]:request.overwrite.filter(k=>k!==m)})}}/> Autorizar mezcla de partidas seleccionadas en borrador {m}</label>:null)}
      {preview.request.kind==='recurrences'&&preview.rows.filter(r=>!protectedMonth(data,r.month)&&(r.status==='skip'||preview.request.kind==='recurrences'&&preview.request.overwrite.includes(r.id))).map(r=><label className="block" key={r.id}><input type="checkbox" checked={preview.request.kind==='recurrences'&&preview.request.overwrite.includes(r.id)} onChange={e=>{const request=preview.request;if(request.kind==='recurrences')prepare({...request,overwrite:e.target.checked?[...request.overwrite,r.id]:request.overwrite.filter(k=>k!==r.id)})}}/> Autorizar esta propuesta {r.month} · {partName(r.target,r.code)} · {r.origin?.ruleName ?? 'Regla'} · {r.after===null?'—':money(r.after)}</label>)}
      <p>La tabla se puede desplazar horizontalmente; con teclado, enfócala y usa las flechas.</p>
      <div className="chart-table automation-table" tabIndex={0} role="region" aria-label="Diferencias de planificación desplazables"><table><caption>Vista previa de diferencias</caption><thead><tr><th>Mes / partida</th><th>Antes</th><th>Después</th><th>Diferencia</th><th>Resultado y motivo</th></tr></thead><tbody>{preview.rows.map(r=><tr key={r.id}><th>{r.month} · {partName(r.target,r.code)}</th><td>{r.before===null?'Sin dato':money(r.before)}</td><td>{r.after===null?'Eliminar':money(r.after)}</td><td>{r.after===null?'—':money(r.after-(r.before ?? 0))}</td><td>{r.status==='apply'?'Aplicar':r.status==='blocked'?'Bloqueado':'Omitido'} · {r.reason}</td></tr>)}</tbody></table></div>
      {preview.rows.filter(r=>r.subitems).map(r=><details key={r.id}><summary>Desglose de la copia · {r.month} · {partName(r.target,r.code)}</summary>{r.subitems!.map(l=><p key={l.subitemId}>{l.name} · Antes: {l.before===null?'Sin distribución':money(l.before)} → Después: {l.after===null?'Sin distribución':money(l.after)}</p>)}</details>)}
      {after&&<div>{[...new Set(preview.rows.map(r=>r.month))].map(m=>{try{const before=totals(data,m),result=totals(after!,m);return <p key={m}>Resumen {m}: {before.status} → {result.status}. Ingresos {money(before.totals.income)} → {money(result.totals.income)}; base gastos {money(before.baseExpenses)} → {money(result.baseExpenses)}; arrastre {money(before.carryoverCents)} → {money(result.carryoverCents)}; efectivo gastos {money(before.totals.expenses)} → {money(result.totals.expenses)}; ahorro {money(before.totals.savings)} → {money(result.totals.savings)}; margen {money(before.totals.margin)} → {money(result.totals.margin)}.</p>}catch{return <p key={m} role="alert">No se pudo calcular el resumen de {m}; revisa los importes.</p>}})}</div>}
      {submission.error&&<p role="alert">{submission.error}</p>}
      {!preview.rows.some(r=>r.status==='apply')&&<p role="status">No hay cambios aplicables. No se escribirá nada.</p>}
      <div className="flex flex-wrap gap-2"><button disabled={submission.saving} onClick={()=>setPreview(null)}>Cancelar</button><button disabled={submission.saving||!preview.rows.some(r=>r.status==='apply')} onClick={()=>void submission.submit(()=>onApply(preview),()=>{setPreview(null);setMode(null);setNotice('Operación de planificación guardada.')} )}>{submission.saving?'Guardando…':'Confirmar cambios de planificación'}</button></div>
    </div></SafeDialog>}
  </section>;
}
