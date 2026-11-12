import React,{useState} from 'react';
import type {FinanceData} from '../utils/backup';
import type {BudgetGroup,BudgetPartida,MovementType} from '../types/finance';
import {catalogDependencies,catalogArchiveImpact,type CatalogArchiveTarget,type CatalogEdit} from '../utils/budgetCatalog';
import {useAsyncForm} from '../utils/useAsyncForm';
import type {SaveResult} from '../utils/saveResult';
import {SafeDialog} from './SafeDialog';

type Editor={kind:'family';item?:BudgetGroup}|{kind:'partida';item?:BudgetPartida}|{kind:'deleteFamily';item:BudgetGroup}|{kind:'deletePartida';item:BudgetPartida};
export function CatalogManager({data,onEdit}:{data:FinanceData;onEdit:(edit:CatalogEdit)=>Promise<SaveResult>}){
  const form=useAsyncForm();
  const [editor,setEditor]=useState<Editor|null>(null),[name,setName]=useState(''),[description,setDescription]=useState(''),[keywords,setKeywords]=useState(''),[type,setType]=useState<MovementType>('GASTO'),[groupCode,setGroupCode]=useState(''),[notice,setNotice]=useState('');
  const [archive,setArchive]=useState<{edit:CatalogEdit;impact:ReturnType<typeof catalogArchiveImpact>}|null>(null);
  const requestArchive=(target:CatalogArchiveTarget,archived:boolean)=>{form.clearError();const impact=catalogArchiveImpact(data,target),edit={...target,archived,scope:impact.scope} as CatalogEdit;if(archived&&impact.dependencies.length)setArchive({edit,impact});else submit(edit);};
  const groups=data.budgetGroups.filter(g=>!g.deleted);
  const submit=(edit:CatalogEdit,close=false)=>{void form.submit(()=>onEdit(edit),()=>{setNotice('Catálogo guardado.');if(close)setEditor(null);});};
  const open=(e:Editor)=>{form.clearError();setName(e.item?.name??'');setDescription(e.kind==='partida'?e.item?.description??'':'');setKeywords(e.kind==='partida'?e.item?.keywords.join(', ')??'':'');setType(e.item?.type??'GASTO');setGroupCode(e.kind==='partida'&&e.item?data.budgetGroups.find(g=>g.partidas.some(p=>p.type===e.item!.type&&p.code===(e.item as BudgetPartida).code))?.code??'':groups.find(g=>!g.archived)?.code??'');setEditor(e);};
  const close=()=>{if(!form.saving)setEditor(null);};
  const title=editor?.kind==='deleteFamily'?'Eliminar familia':editor?.kind==='deletePartida'?'Eliminar partida':editor?.kind==='family'?(editor.item?'Renombrar familia':'Crear familia'):(editor?.item?'Editar partida':'Crear partida');
  const removal=editor?.kind==='deleteFamily'||editor?.kind==='deletePartida';
  const blockers=editor?.kind==='deleteFamily'?(editor.item.partidas.some(p=>!p.deleted)?['La familia contiene partidas. Archívalas o retíralas antes.']:[]):editor?.kind==='deletePartida'?catalogDependencies(data,editor.item):[];
  return <details className="catalog-manager planning-card" aria-label="Gestión del catálogo">
    <summary>Gestionar familias y partidas</summary>
    <p>Los cambios de nombres y organización conservan los movimientos y presupuestos históricos. Archivar impide nuevas clasificaciones.</p>
    {notice&&<p role="status">{notice}</p>}{form.error&&!editor&&!archive&&<p role="alert">{form.error}</p>}
    <fieldset disabled={form.saving}>
      <div className="catalog-actions"><button type="button" onClick={()=>open({kind:'family'})}>Crear familia</button><button type="button" onClick={()=>open({kind:'partida'})} disabled={!groups.some(g=>!g.archived)}>Crear partida</button></div>
      {(['GASTO','INGRESO'] as const).map(type=><section key={type} aria-label={`Gestionar ${type==='GASTO'?'Gastos':'Ingresos'}`}><h3>{type==='GASTO'?'Gastos':'Ingresos'}</h3>{groups.filter(g=>g.type===type).map((g,index,typed)=><article key={g.code} className="catalog-manage-family" aria-label={`Gestionar familia ${g.name}`}>
        <h4>{g.name}{g.archived?' · Archivada':''}</h4>
        <div className="catalog-actions">
          <button type="button" onClick={()=>open({kind:'family',item:g})}>Renombrar familia {g.name}</button>
          <button type="button" onClick={()=>requestArchive({kind:'archiveFamily',code:g.code},!g.archived)}>{g.archived?'Reactivar':'Archivar'} familia {g.name}</button>
          <button type="button" onClick={()=>submit({kind:'reorderFamily',code:g.code,direction:-1})} disabled={index===0}>Subir familia {g.name}</button>
          <button type="button" onClick={()=>submit({kind:'reorderFamily',code:g.code,direction:1})} disabled={index===typed.length-1}>Bajar familia {g.name}</button>
          <button type="button" onClick={()=>open({kind:'deleteFamily',item:g})}>Eliminar familia {g.name}</button>
        </div>
        {g.partidas.filter(p=>!p.deleted).map(p=><div key={`${p.type}:${p.code}`} className="catalog-manage-partida">
          <strong>{p.name}{p.archived?' · Archivada':''}</strong>
          <div className="catalog-actions"><button type="button" onClick={()=>open({kind:'partida',item:p})}>Editar partida {p.name}</button>
            <button type="button" onClick={()=>requestArchive({kind:'archivePartida',parent:{type:p.type,code:p.code}},!p.archived)}>{p.archived?'Reactivar':'Archivar'} partida {p.name}</button>
            <button type="button" onClick={()=>open({kind:'deletePartida',item:p})}>Eliminar partida {p.name}</button>
          </div>
        </div>)}
      </article>)}</section>)}
    </fieldset>
    {archive&&<SafeDialog title="Confirmar archivo con reglas activas" onCancel={()=>{if(!form.saving)setArchive(null);}}>
      <p>Vas a archivar «{archive.impact.name}». Estas reglas activas dependen de sus partidas:</p>
      <ul>{archive.impact.dependencies.map(r=><li key={`${r.kind}:${r.id}`}>{r.kind}: <strong>{r.name}</strong> · {r.partida}</li>)}</ul>
      <p>Las reglas se conservarán activas, sin borrarlas, desactivarlas ni reasignarlas. Sus movimientos y previsiones nuevos quedarán bloqueados mientras la partida o su familia estén archivadas. Los importes y desgloses históricos serán de solo lectura. Reactivar permite volver a utilizarlas; no ejecuta operaciones automáticamente.</p>
      {form.error&&<p role="alert">{form.error}</p>}
      <div className="catalog-actions"><button type="button" disabled={form.saving} onClick={()=>setArchive(null)}>Cancelar</button><button type="button" disabled={form.saving} onClick={()=>{void form.submit(()=>onEdit(archive.edit),()=>{setNotice('Catálogo guardado.');setArchive(null);});}}>{form.saving?'Guardando…':'Confirmar archivo'}</button></div>
    </SafeDialog>}
    {editor&&<SafeDialog title={title} onCancel={close}><form className="catalog-editor" aria-busy={form.saving} onSubmit={e=>{
      e.preventDefault();
      if(editor.kind==='deleteFamily')submit({kind:'deleteFamily',code:editor.item.code},true);
      else if(editor.kind==='deletePartida')submit({kind:'deletePartida',parent:editor.item},true);
      else if(editor.kind==='family')submit(editor.item?{kind:'renameFamily',code:editor.item.code,name}:{kind:'createFamily',id:crypto.randomUUID(),type,name},true);
      else {const fields={name,description,keywords:keywords.split(',').map(k=>k.trim()).filter(Boolean)};submit(editor.item?{kind:'updatePartida',parent:editor.item,...fields}:{kind:'createPartida',id:crypto.randomUUID(),groupCode,...fields},true);}
    }}><fieldset disabled={form.saving}>
      {form.error&&<p role="alert">{form.error}</p>}
      {removal?<><p>Eliminar «{editor.item?.name}» requiere que no existan dependencias. La identidad retirada se conservará y no se reutilizará.</p>{blockers.length>0&&<div role="alert">No se puede eliminar: {blockers.join(', ')}. Utiliza Archivar.</div>}</>:<>
        <label>Nombre<input aria-label="Nombre del catálogo" required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>
        {editor.kind==='family'&&!editor.item&&<label>Tipo principal<select aria-label="Tipo principal" value={type} onChange={e=>setType(e.target.value as MovementType)}><option value="GASTO">Gastos</option><option value="INGRESO">Ingresos</option></select></label>}
        {editor.kind==='partida'&&<>{!editor.item&&<label>Familia de la partida<select aria-label="Familia de la partida" required value={groupCode} onChange={e=>setGroupCode(e.target.value)}>{groups.filter(g=>!g.archived).map(g=><option key={g.code} value={g.code}>{g.type==='GASTO'?'Gastos':'Ingresos'} · {g.name}</option>)}</select></label>}
          <label>Descripción<textarea aria-label="Descripción de partida" maxLength={2000} value={description} onChange={e=>setDescription(e.target.value)}/></label>
          <label>Palabras clave (separadas por comas)<input aria-label="Palabras clave de partida" value={keywords} onChange={e=>setKeywords(e.target.value)}/></label></>}
      </>}
      <div className="catalog-actions"><button type="button" onClick={close}>Cancelar</button><button type="submit" disabled={blockers.length>0}>{form.saving?'Guardando…':removal?'Confirmar eliminación':'Guardar catálogo'}</button></div>
    </fieldset></form></SafeDialog>}
  </details>;
}
