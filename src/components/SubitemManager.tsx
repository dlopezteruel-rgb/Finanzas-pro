import {useCatalogDrag} from './useCatalogDrag';
import {catalogReorderScope,type ReorderCallback} from '../utils/catalogReorder';
import React, {useLayoutEffect,useState} from 'react';
import type {FinanceData} from '../utils/backup';
import type {BudgetPartida} from '../types/finance';
import {subitemsFor, subitemUsed, type SubitemEdit} from '../utils/budgetSubitems';
import {useAsyncForm} from '../utils/useAsyncForm';
import type {SaveResult} from '../utils/saveResult';

export function SubitemManager({data,partida,onEdit,onBusy,onReorder}:{data:FinanceData;partida:BudgetPartida;onEdit:(edit:SubitemEdit)=>Promise<SaveResult>;onBusy:(busy:boolean)=>void;onReorder:ReorderCallback}) {
  const [name,setName]=useState(''),[renaming,setRenaming]=useState<{id:string;name:string}|null>(null),[deleting,setDeleting]=useState<string|null>(null);
  const form=useAsyncForm(),items=subitemsFor(data,partida);
  const drag=useCatalogDrag(catalogReorderScope(data),onReorder,form.saving);
  useLayoutEffect(()=>{onBusy(form.saving||drag.saving);},[form.saving,drag.saving,onBusy]);
  const submit=(edit:SubitemEdit,done=()=>{})=>{void form.submit(()=>onEdit(edit),done);};
  return <details className="subitem-manager" aria-label="Gestión de subítems">
    <summary>Gestionar subítems ({items.length})</summary>
    <p>Opcionales. Añadirlos no reparte previsiones anteriores. Los importes se distribuyen en cada mes de Planificación.</p>
    {form.error&&<p role="alert">{form.error}</p>}
    <fieldset disabled={form.saving||drag.saving} className="space-y-2 min-w-0">
      <label>Nombre del nuevo subítem<input aria-label="Nombre del nuevo subítem" maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>
      <button type="button" disabled={!name.trim()} onClick={()=>submit({kind:'create',parent:{type:partida.type,code:partida.code},name,id:crypto.randomUUID()},()=>setName(''))}>Crear subítem</button>
      {items.map((i,n)=><div className="subitem-manage-row" key={i.id} {...drag.target({kind:'subitem',type:i.type,code:i.code,beforeId:i.id,label:i.name})}>
        {drag.handle({kind:'subitem',type:i.type,code:i.code,id:i.id,label:`subítem ${i.name}`})}
        <strong>{i.name}{i.archived?' · Archivado':''}</strong>
        {renaming?.id===i.id?<div><input aria-label={`Nuevo nombre de ${i.name}`} value={renaming.name} maxLength={100} onChange={e=>setRenaming({...renaming,name:e.target.value})}/><button type="button" onClick={()=>submit({kind:'rename',id:i.id,name:renaming.name},()=>setRenaming(null))}>Guardar nombre</button><button type="button" onClick={()=>setRenaming(null)}>Cancelar nombre</button></div>:
          <button type="button" aria-label={`Renombrar ${i.name}`} onClick={()=>setRenaming({id:i.id,name:i.name})}>Renombrar</button>}
        <button type="button" aria-label={`Subir ${i.name}`} disabled={n===0} onClick={()=>submit({kind:'reorder',id:i.id,direction:-1})}>Subir</button>
        <button type="button" aria-label={`Bajar ${i.name}`} disabled={n===items.length-1} onClick={()=>submit({kind:'reorder',id:i.id,direction:1})}>Bajar</button>
        <button type="button" onClick={()=>submit({kind:'archive',id:i.id,archived:!i.archived})}>{i.archived?'Reactivar':'Archivar'} {i.name}</button>
        {subitemUsed(data,i.id)?<span>Con históricos: se conserva mediante archivo.</span>:<button type="button" onClick={()=>setDeleting(i.id)}>Eliminar {i.name}</button>}
        {deleting===i.id&&<div role="group" aria-label={`Confirmar eliminación de ${i.name}`}><p>Se retirará el subítem sin históricos. Su ID no se reutilizará.</p><button type="button" onClick={()=>submit({kind:'delete',id:i.id},()=>setDeleting(null))}>Confirmar eliminación de {i.name}</button><button type="button" onClick={()=>setDeleting(null)}>Cancelar eliminación</button></div>}
      </div>)}
    </fieldset>
    <div className="catalog-drop-end" {...drag.target({kind:'subitem',type:partida.type,code:partida.code,label:'Final de los subítems'})}>Final de los subítems</div>
    {drag.feedback}
  </details>;
}
