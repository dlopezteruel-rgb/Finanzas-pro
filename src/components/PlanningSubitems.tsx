import {useCatalogNames} from '../i18n/catalogNames';
import {storageOwnedText} from '../i18n/storageMessages';

import { useI18n, I18nText } from "../i18n";
import React from 'react';
import type {FinanceData} from '../utils/backup';
import type {BudgetPartida} from '../types/finance';
import {subitemsFor,subitemBudgetRows} from '../utils/budgetSubitems';
import { parsePlanningMoney } from '../utils/planningMoney';

export function PlanningSubitems({data,partida,month,value,onChange}:{data:FinanceData;partida:BudgetPartida;month:string;value?:Record<string,string>;onChange:(value:Record<string,string>)=>void}) {
  const { t: uiText , formatCents: money } = useI18n();
  const catalogNames=useCatalogNames();
  const items=subitemsFor(data,partida),rows=subitemBudgetRows(data,month,partida);
  if(!items.length&&!value)return null;
  const missing=items.filter(i=>!i.archived&&!Object.hasOwn(value ?? {},i.id));
  const carry=data.planningAutomation?.carryovers.some(c=>(c.toMonth===month||c.fromMonth===month)&&c.type===partida.type&&c.code===partida.code);
  return <details className="planning-subitems" aria-label={uiText("planning_subitems.subitems_de", { name: catalogNames.item(partida) })}>
    <summary><I18nText id="planning_subitems.subitems" values={{ content: (value?uiText("planning_subitems.desglose_mensual_activo"):uiText("planning_subitems.pendiente_de_desglose")) }} /></summary>
    {!value?<><p>{uiText("planning_subitems.se_conserva_el_presupuesto_global_de_este_mes_sin")}</p>
      <button type="button" disabled={!missing.length||!!carry} onClick={()=>onChange(Object.fromEntries(missing.map(i=>[i.id,''])))}><I18nText id="planning_subitems.distribuir_este_mes" values={{ name: (catalogNames.item(partida)) }} /></button>
      {carry&&<p role="status">{uiText("planning_subitems.retira_primero_el_arrastre_global_de_origen_o_destino")}</p>}</>:
      <><p>{uiText("planning_subitems.la_base_de_la_partida_es_la_suma_de")}</p>
      {Object.entries(value).map(([id,input])=>{const item=items.find(i=>i.id===id),row=rows.find(r=>r.id===id);let planned:number|undefined,error='';try{planned=parsePlanningMoney(input);}catch(e){error=(e as Error).message;}
        return <div className="subitem-summary-row" key={id}>
          <label>{item?.name ?? id}{item?.archived?uiText("partida_detail.archivado"):''}<input aria-label={uiText("planning_subitems.previsto_subitem", { content: item?.name ?? id })} inputMode="decimal" value={input} aria-invalid={!!error} onChange={e=>onChange({...value,[id]:e.target.value})}/></label>
          {error&&<p role="alert">{storageOwnedText(error,uiText)}</p>}
          <span><I18nText id="planning_subitems.ejecutado" values={{ money: (money(row?.executed ?? 0)) }} /></span><span><I18nText id="planning_subitems.resto" values={{ content: (planned===undefined?'—':money(planned-(row?.executed ?? 0))) }} /></span><span><I18nText id="planning_subitems.desviacion" values={{ content: (planned===undefined?'—':money((row?.executed ?? 0)-planned)) }} /></span>
        </div>;
      })}
      {!!missing.length&&<button type="button" onClick={()=>onChange({...value,...Object.fromEntries(missing.map(i=>[i.id,'']))})}>{uiText("planning_subitems.anadir_subitems_disponibles_a_este_mes")}</button>}
      </>}
    <p><I18nText id="planning_subitems.sin_subitem_ejecutado_incluido_en_el_total_de_la" values={{ money: (money(rows.find(r=>r.id===undefined)?.executed ?? 0)) }} /></p>
  </details>;
}
