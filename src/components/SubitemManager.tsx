import {storageOwnedText} from '../i18n/storageMessages';
import { useI18n, I18nText } from "../i18n";
import {activeCatalogEntry} from '../utils/budgetCatalog';
import {useCatalogDrag} from './useCatalogDrag';
import {catalogReorderScope,type ReorderCallback} from '../utils/catalogReorder';
import React, {useLayoutEffect,useState} from 'react';
import type {FinanceData} from '../utils/backup';
import type {BudgetPartida} from '../types/finance';
import {subitemsFor, subitemUsed, type SubitemEdit} from '../utils/budgetSubitems';
import {useAsyncForm} from '../utils/useAsyncForm';
import type {SaveResult} from '../utils/saveResult';

export function SubitemManager({data,partida,onEdit,onBusy,onReorder}:{data:FinanceData;partida:BudgetPartida;onEdit:(edit:SubitemEdit)=>Promise<SaveResult>;onBusy:(busy:boolean)=>void;onReorder:ReorderCallback}) {
  const { t: uiText } = useI18n();
  const [name,setName]=useState(''),[renaming,setRenaming]=useState<{id:string;name:string}|null>(null),[deleting,setDeleting]=useState<string|null>(null);
  const form=useAsyncForm(),items=subitemsFor(data,partida);
  const drag=useCatalogDrag(catalogReorderScope(data),onReorder,form.saving);
  useLayoutEffect(()=>{onBusy(form.saving||drag.saving);},[form.saving,drag.saving,onBusy]);
  const submit=(edit:SubitemEdit,done=()=>{})=>{void form.submit(()=>onEdit(edit),done);};
  return <details className="subitem-manager" aria-label={uiText("subitem_manager.gestion_de_subitems")}>
    <summary><I18nText id="subitem_manager.gestionar_subitems" values={{ length: (items.length) }} /></summary>
    <p>{uiText("subitem_manager.opcionales_anadirlos_no_reparte_previsiones_anteriores_los_importes_se")}</p>
    {form.error&&<p role="alert">{storageOwnedText(form.error,uiText)}</p>}
    <fieldset disabled={form.saving||drag.saving} className="space-y-2 min-w-0">
      <label>{uiText("subitem_manager.nombre_del_nuevo_subitem")}<input aria-label={uiText("subitem_manager.nombre_del_nuevo_subitem")} maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>
      <button type="button" disabled={!name.trim()||!activeCatalogEntry(data,partida)} onClick={()=>submit({kind:'create',parent:{type:partida.type,code:partida.code},name,id:crypto.randomUUID()},()=>setName(''))}>{uiText("subitem_manager.crear_subitem")}</button>
      {items.map((i,n)=><div className="subitem-manage-row" key={i.id} {...drag.target({kind:'subitem',type:i.type,code:i.code,beforeId:i.id,label:i.name})}>
        {drag.handle({kind:'subitem',type:i.type,code:i.code,id:i.id,label:i.name})}
        <strong>{i.name}{i.archived?uiText("partida_detail.archivado"):''}</strong>
        {renaming?.id===i.id?<div><input aria-label={uiText("subitem_manager.nuevo_nombre_de", { name: i.name })} value={renaming.name} maxLength={100} onChange={e=>setRenaming({...renaming,name:e.target.value})}/><button type="button" onClick={()=>submit({kind:'rename',id:i.id,name:renaming.name},()=>setRenaming(null))}>{uiText("subitem_manager.guardar_nombre")}</button><button type="button" onClick={()=>setRenaming(null)}>{uiText("subitem_manager.cancelar_nombre")}</button></div>:
          <button type="button" aria-label={uiText("subitem_manager.renombrar_6de164", { name: i.name })} onClick={()=>setRenaming({id:i.id,name:i.name})}>{uiText("subitem_manager.renombrar")}</button>}
        <button type="button" aria-label={uiText("subitem_manager.subir_1fde7d", { name: i.name })} disabled={n===0} onClick={()=>submit({kind:'reorder',id:i.id,direction:-1})}>{uiText("subitem_manager.subir")}</button>
        <button type="button" aria-label={uiText("subitem_manager.bajar_ddb6a3", { name: i.name })} disabled={n===items.length-1} onClick={()=>submit({kind:'reorder',id:i.id,direction:1})}>{uiText("subitem_manager.bajar")}</button>
        <button type="button" onClick={()=>submit({kind:'archive',id:i.id,archived:!i.archived})}><I18nText id={i.archived?"subitem_manager.reactivateNamed":"subitem_manager.archiveNamed"} values={{name:i.name}} /></button>
        {subitemUsed(data,i.id)?<span>{uiText("subitem_manager.con_historicos_se_conserva_mediante_archivo")}</span>:<button type="button" onClick={()=>setDeleting(i.id)}><I18nText id="subitem_manager.eliminar" values={{ name: (i.name) }} /></button>}
        {deleting===i.id&&<div role="group" aria-label={uiText("subitem_manager.confirmar_eliminacion_de", { name: i.name })}><p>{uiText("subitem_manager.se_retirara_el_subitem_sin_historicos_su_id_no")}</p><button type="button" onClick={()=>submit({kind:'delete',id:i.id},()=>setDeleting(null))}><I18nText id="subitem_manager.confirmar_eliminacion_de" values={{ name: (i.name) }} /></button><button type="button" onClick={()=>setDeleting(null)}>{uiText("subitem_manager.cancelar_eliminacion")}</button></div>}
      </div>)}
    </fieldset>
    <div className="catalog-drop-end" {...drag.target({kind:'subitem',type:partida.type,code:partida.code,label:''})}>{uiText("subitem_manager.final_de_los_subitems")}</div>
    {drag.feedback}
  </details>;
}
