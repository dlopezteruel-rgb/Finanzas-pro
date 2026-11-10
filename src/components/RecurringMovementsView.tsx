import React,{useMemo,useState} from 'react';
import type { FinanceData } from '../utils/backup';
import type { RecurringMovementRule, Transaction } from '../types/finance';
import { intelligent } from '../utils/intelligentValidation';
import { applyOccurrenceBatch, nextRuleDate, occurrencePreviews, occurrenceScope, removeMovementRule, saveMovementRule, type OccurrenceBatch } from '../utils/recurringMovements';
import type { FinanceMutation } from '../utils/financeStore';
import type { SaveResult } from '../utils/saveResult';
import { formatPlanningCents as money, parsePlanningMoney, planningMoneyInput } from '../utils/planningMoney';
import { madridDate } from '../utils/financialCalendar';
import { FinanceReview } from './FinanceReview';
import { SafeDialog } from './SafeDialog';

export function RecurringMovementsView({data,month,mutate,onEdit}:{data:FinanceData;month:string;mutate:(fn:FinanceMutation)=>Promise<SaveResult>;onEdit:(t:Transaction)=>void}) {
  const [first,setFirst]=useState(month),[last,setLast]=useState(month);
  const [draft,setDraft]=useState<RecurringMovementRule|null>(null),[amount,setAmount]=useState(''),[error,setError]=useState('');
  const [review,setReview]=useState<{text:string;apply:(d:FinanceData)=>FinanceData}|null>(null);
  const [selected,setSelected]=useState<string[]>([]),[batch,setBatch]=useState<OccurrenceBatch|null>(null),[ack,setAck]=useState(false);
  const state=intelligent(data),partidas=useMemo(()=>{
    const all=[...data.budgetGroups.flatMap(g=>g.partidas),...data.transactions.map(t=>({type:t.type,code:t.code,name:t.subcategoryName,groupName:t.categoryName}))];
    return [...new Map(all.map(p=>[`${p.type}:${p.code}`,p])).values()];
  },[data]);
  let rows:ReturnType<typeof occurrencePreviews>=[],rangeError='';try{rows=occurrencePreviews(data,first,last)}catch(e){rangeError=(e as Error).message}
  const create=()=>{const p=partidas[0],w=data.wallets[0];if(!p||!w){setError('Crea primero una cartera y una partida.');return;}setAmount('');setError('');setDraft({id:crypto.randomUUID(),concept:'',type:p.type,amountCents:0,code:p.code,categoryName:p.groupName,subcategoryName:p.name,walletId:w.id,frequency:'monthly',startDate:madridDate(),day:1,active:true});};
  const reviewRule=(e:React.FormEvent)=>{e.preventDefault();try{const rule={...draft!,amountCents:parsePlanningMoney(amount)};saveMovementRule(data,rule);setError('');setReview({text:`${rule.concept} · ${money(rule.amountCents)} · ${rule.frequency} · día ${rule.day} · ${data.wallets.find(w=>w.id===rule.walletId)?.name}. No crea movimientos ni presupuestos.`,apply:d=>saveMovementRule(d,rule)});}catch(e){setError((e as Error).message)}};
  return <section className="finance-module" aria-label="Movimientos periódicos">
    <div className="finance-heading"><div><h1>Movimientos periódicos</h1><p>Nóminas, alquileres, seguros y suscripciones. Cada ocurrencia requiere confirmación y entra pendiente de tramitar.</p></div><button onClick={create}>Nueva regla periódica</button></div>
    {error&&!draft&&<p role="alert">{error}</p>}
    <div className="finance-grid">{state.recurringRules.filter(r=>!r.deleted).map(r=><article className="planning-card" key={r.id}>
      <h2>{r.concept}</h2><p>{r.type} · {money(r.amountCents)} · {r.frequency} · día {r.day}</p><p>{data.wallets.find(w=>w.id===r.walletId)?.name} · {r.subcategoryName}</p><p>{r.active?'Activa':'Pausada'} · Próxima: {nextRuleDate(r,madridDate())??'Sin próxima fecha'}</p>
      <div className="finance-actions"><button onClick={()=>{setError('');setDraft(r);setAmount(planningMoneyInput(r.amountCents))}}>Editar {r.concept}</button><button onClick={()=>setReview({text:`${r.active?'Pausar':'Reactivar'} ${r.concept}. Se conservan las ocurrencias y los movimientos.`,apply:d=>saveMovementRule(d,{...r,active:!r.active})})}>{r.active?'Pausar':'Reactivar'} {r.concept}</button><button onClick={()=>setReview({text:`Eliminar regla ${r.concept}. Su identidad se conserva para no duplicar movimientos históricos.`,apply:d=>removeMovementRule(d,r.id)})}>Eliminar {r.concept}</button></div>
    </article>)}</div>
    {!state.recurringRules.some(r=>!r.deleted)&&<p>No hay reglas periódicas. La planificación presupuestaria se gestiona por separado.</p>}
    <div className="planning-card"><h2>Próximos movimientos · vista previa</h2><p>Consulta hasta 12 meses; confirma como máximo 500 ocurrencias por lote. No se rellenan fechas históricas al abrir la aplicación.</p>
      <div className="finance-actions"><label>Desde<input aria-label="Ocurrencias desde" type="month" min="0001-01" max="9999-12" value={first} onChange={e=>{setFirst(e.target.value);setSelected([])}}/></label><label>Hasta<input aria-label="Ocurrencias hasta" type="month" min="0001-01" max="9999-12" value={last} onChange={e=>{setLast(e.target.value);setSelected([])}}/></label><button onClick={()=>setSelected(rows.filter(r=>r.status==='proposed').slice(0,500).map(r=>r.id))}>Seleccionar propuestas</button></div>
      {rangeError&&<p role="alert">{rangeError}</p>}
      <div className="finance-table"><table><caption>Ocurrencias del periodo</caption><thead><tr><th>Selección</th><th>Fecha / concepto</th><th>Importe / cuenta</th><th>Estado</th><th>Revisión</th></tr></thead><tbody>{rows.map(r=><tr key={r.id}><td>{r.status==='proposed'&&<input type="checkbox" aria-label={`Seleccionar ${r.rule.concept} ${r.dueDate}`} checked={selected.includes(r.id)} onChange={e=>setSelected(prev=>e.target.checked?[...prev,r.id]:prev.filter(id=>id!==r.id))}/>}</td><td>{r.dueDate}<br/>{r.rule.concept}</td><td>{money(r.rule.amountCents)}<br/>{data.wallets.find(w=>w.id===r.rule.walletId)?.name}</td><td>{r.status==='skipped'?'Omitido':r.status==='proposed'?'Próximo (propuesta)':data.transactions.find(t=>t.id===r.transactionId)?.processed?'Tramitado':'Pendiente'}</td><td>{r.collisions.length>0&&<p>Coincidencia manual: {r.collisions.join(', ')}. No se fusionará.</p>}{r.transactionId&&<button onClick={()=>onEdit(data.transactions.find(t=>t.id===r.transactionId)!)}>Revisar movimiento</button>}</td></tr>)}</tbody></table></div>
      {!rows.length&&!rangeError&&<p>Sin ocurrencias en este periodo.</p>}
      <div className="finance-actions">{(['register','skip'] as const).map(action=><button key={action} disabled={!selected.length||!!rangeError} onClick={()=>{setAck(false);setBatch({first,last,ids:selected,scope:occurrenceScope(data),action,acknowledgeCollisions:false})}}>{action==='register'?'Revisar registro pendiente':'Revisar omisión'}</button>)}</div>
    </div>
    {draft&&<SafeDialog title="Regla de movimiento periódico" onCancel={()=>{if(!review)setDraft(null)}}><form className="finance-form" onSubmit={reviewRule}>
      <label>Concepto<input required maxLength={500} value={draft.concept} onChange={e=>setDraft({...draft,concept:e.target.value})}/></label>
      <label>Importe (€)<input aria-label="Importe periódico (€)" inputMode="decimal" required value={amount} onChange={e=>setAmount(e.target.value)}/></label>
      <label>Partida<select aria-label="Partida periódica" value={`${draft.type}:${draft.code}`} onChange={e=>{const p=partidas.find(p=>`${p.type}:${p.code}`===e.target.value)!;setDraft({...draft,type:p.type,code:p.code,categoryName:p.groupName,subcategoryName:p.name})}}>{partidas.map(p=><option value={`${p.type}:${p.code}`} key={`${p.type}:${p.code}`}>{p.type} · {p.name} ({p.code})</option>)}</select></label>
      <label>Cartera<select value={draft.walletId} onChange={e=>setDraft({...draft,walletId:e.target.value})}>{data.wallets.map(w=><option value={w.id} key={w.id}>{w.name}</option>)}</select></label>
      <label>Frecuencia<select value={draft.frequency} onChange={e=>setDraft({...draft,frequency:e.target.value as RecurringMovementRule['frequency']})}><option value="monthly">Mensual</option><option value="quarterly">Trimestral</option><option value="yearly">Anual</option></select></label>
      <label>Día del mes<input type="number" min="1" max="31" required value={draft.day} onChange={e=>setDraft({...draft,day:Number(e.target.value)})}/></label>
      <p>Si no existe el día elegido, se usa el último día válido del mes.</p>
      <label>Inicio<input type="date" min="0001-01-01" max="9999-12-31" required value={draft.startDate} onChange={e=>setDraft({...draft,startDate:e.target.value})}/></label>
      <label>Fin opcional<input type="date" min={draft.startDate} max="9999-12-31" value={draft.endDate??''} onChange={e=>setDraft({...draft,endDate:e.target.value||undefined})}/></label>
      {error&&<p role="alert">{error}</p>}<div className="finance-actions"><button type="button" onClick={()=>setDraft(null)}>Cancelar</button><button type="submit">Revisar regla</button></div>
    </form></SafeDialog>}
    {review&&<FinanceReview title="Confirmar regla periódica" onCancel={()=>setReview(null)} onConfirm={()=>mutate(review.apply)} onSuccess={()=>{setReview(null);setDraft(null)}}><p>{review.text}</p></FinanceReview>}
    {batch&&<FinanceReview title="Confirmar ocurrencias" onCancel={()=>setBatch(null)} onConfirm={()=>mutate(d=>applyOccurrenceBatch(d,{...batch,acknowledgeCollisions:ack}))} onSuccess={()=>{setBatch(null);setSelected([])}} disabled={batch.action==='register'&&rows.some(r=>batch.ids.includes(r.id)&&r.collisions.length>0)&&!ack}>
      <p>{batch.action==='register'?'Crear movimientos pendientes; no modifica el saldo bancario.':'Omitir ocurrencias; conserva su identidad para no volver a proponerlas.'}</p>
      {rows.filter(r=>batch.ids.includes(r.id)).map(r=><p key={r.id}>{r.dueDate} · {r.rule.concept} · {money(r.rule.amountCents)} · {data.wallets.find(w=>w.id===r.rule.walletId)?.name}</p>)}
      {rows.some(r=>batch.ids.includes(r.id)&&r.collisions.length>0)&&<label><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>He revisado las coincidencias manuales y autorizo crear movimientos adicionales. También puedo cancelar y omitir estas ocurrencias.</label>}
    </FinanceReview>}
  </section>;
}
