import React from 'react';
import type {FinanceData} from '../utils/backup';
import type {BudgetPartida} from '../types/finance';
import {subitemsFor,subitemBudgetRows} from '../utils/budgetSubitems';
import {formatPlanningCents as money,parsePlanningMoney} from '../utils/planningMoney';

export function PlanningSubitems({data,partida,month,value,onChange}:{data:FinanceData;partida:BudgetPartida;month:string;value?:Record<string,string>;onChange:(value:Record<string,string>)=>void}) {
  const items=subitemsFor(data,partida),rows=subitemBudgetRows(data,month,partida);
  if(!items.length&&!value)return null;
  const missing=items.filter(i=>!i.archived&&!Object.hasOwn(value ?? {},i.id));
  const carry=data.planningAutomation?.carryovers.some(c=>(c.toMonth===month||c.fromMonth===month)&&c.type===partida.type&&c.code===partida.code);
  return <details className="planning-subitems" aria-label={`Subítems de ${partida.name}`}>
    <summary>Subítems · {value?'Desglose mensual activo':'Pendiente de desglose'}</summary>
    {!value?<><p>Se conserva el presupuesto global de este mes sin repartir. Introduce explícitamente todos los importes al activar el desglose; indica 0 donde corresponda.</p>
      <button type="button" disabled={!missing.length||!!carry} onClick={()=>onChange(Object.fromEntries(missing.map(i=>[i.id,''])))}>Distribuir {partida.name} este mes</button>
      {carry&&<p role="status">Retira primero el arrastre global de origen o destino; no se distribuye automáticamente.</p>}</>:
      <><p>La base de la partida es la suma de este desglose, en céntimos. No se añaden importes al total por separado.</p>
      {Object.entries(value).map(([id,input])=>{const item=items.find(i=>i.id===id),row=rows.find(r=>r.id===id);let planned:number|undefined,error='';try{planned=parsePlanningMoney(input);}catch(e){error=(e as Error).message;}
        return <div className="subitem-summary-row" key={id}>
          <label>{item?.name ?? id}{item?.archived?' · Archivado':''}<input aria-label={`Previsto subítem ${item?.name ?? id}`} inputMode="decimal" value={input} aria-invalid={!!error} onChange={e=>onChange({...value,[id]:e.target.value})}/></label>
          {error&&<p role="alert">{error}</p>}
          <span>Ejecutado: {money(row?.executed ?? 0)}</span><span>Resto: {planned===undefined?'—':money(planned-(row?.executed ?? 0))}</span><span>Desviación: {planned===undefined?'—':money((row?.executed ?? 0)-planned)}</span>
        </div>;
      })}
      {!!missing.length&&<button type="button" onClick={()=>onChange({...value,...Object.fromEntries(missing.map(i=>[i.id,'']))})}>Añadir subítems disponibles a este mes</button>}
      </>}
    <p>Sin subítem · Ejecutado: {money(rows.find(r=>r.id===undefined)?.executed ?? 0)}. Incluido en el total de la partida.</p>
  </details>;
}
