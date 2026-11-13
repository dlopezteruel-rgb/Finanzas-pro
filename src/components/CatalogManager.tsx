import { useI18n, I18nText } from "../i18n";
import {catalogDependencyText} from '../i18n/presenters';
import React,{useState} from 'react';
import type {FinanceData} from '../utils/backup';
import type {BudgetGroup,BudgetPartida,MovementType} from '../types/finance';
import {catalogDependencies,catalogArchiveImpact,type CatalogArchiveTarget,type CatalogEdit} from '../utils/budgetCatalog';
import {useAsyncForm} from '../utils/useAsyncForm';
import type {SaveResult} from '../utils/saveResult';
import {SafeDialog} from './SafeDialog';

type Editor={kind:'family';item?:BudgetGroup}|{kind:'partida';item?:BudgetPartida}|{kind:'deleteFamily';item:BudgetGroup}|{kind:'deletePartida';item:BudgetPartida};
export function CatalogManager({data,onEdit}:{data:FinanceData;onEdit:(edit:CatalogEdit)=>Promise<SaveResult>}){
  const { t: uiText } = useI18n();
  const form=useAsyncForm();
  const [editor,setEditor]=useState<Editor|null>(null),[name,setName]=useState(''),[description,setDescription]=useState(''),[keywords,setKeywords]=useState(''),[type,setType]=useState<MovementType>('GASTO'),[groupCode,setGroupCode]=useState(''),[notice,setNotice]=useState(false);
  const [archive,setArchive]=useState<{edit:CatalogEdit;impact:ReturnType<typeof catalogArchiveImpact>}|null>(null);
  const requestArchive=(target:CatalogArchiveTarget,archived:boolean)=>{form.clearError();const impact=catalogArchiveImpact(data,target),edit={...target,archived,scope:impact.scope} as CatalogEdit;if(archived&&impact.dependencies.length)setArchive({edit,impact});else submit(edit);};
  const groups=data.budgetGroups.filter(g=>!g.deleted);
  const submit=(edit:CatalogEdit,close=false)=>{void form.submit(()=>onEdit(edit),()=>{setNotice(true);if(close)setEditor(null);});};
  const open=(e:Editor)=>{form.clearError();setName(e.item?.name??'');setDescription(e.kind==='partida'?e.item?.description??'':'');setKeywords(e.kind==='partida'?e.item?.keywords.join(', ')??'':'');setType(e.item?.type??'GASTO');setGroupCode(e.kind==='partida'&&e.item?data.budgetGroups.find(g=>g.partidas.some(p=>p.type===e.item!.type&&p.code===(e.item as BudgetPartida).code))?.code??'':groups.find(g=>!g.archived)?.code??'');setEditor(e);};
  const close=()=>{if(!form.saving)setEditor(null);};
  const title=editor?.kind==='deleteFamily'?uiText("catalog_manager.deleteFamilyTitle"):editor?.kind==='deletePartida'?uiText("catalog_manager.deleteItemTitle"):editor?.kind==='family'?(editor.item?uiText("catalog_manager.renameFamilyTitle"):uiText("catalog_manager.crear_familia")):(editor?.item?uiText("catalog_manager.editItemTitle"):uiText("catalog_manager.crear_partida"));
  const removal=editor?.kind==='deleteFamily'||editor?.kind==='deletePartida';
  const blockers=editor?.kind==='deleteFamily'?(editor.item.partidas.some(p=>!p.deleted)?[uiText("catalog_manager.familyNotEmpty")]:[]):editor?.kind==='deletePartida'?catalogDependencies(data,editor.item).map(value=>catalogDependencyText(value,uiText)):[];
  return <details className="catalog-manager planning-card" aria-label={uiText("catalog_manager.gestion_del_catalogo")}>
    <summary>{uiText("catalog_manager.gestionar_familias_y_partidas")}</summary>
    <p>{uiText("catalog_manager.los_cambios_de_nombres_y_organizacion_conservan_los_movimientos")}</p>
    {notice&&<p role="status">{uiText("catalog_manager.saved")}</p>}{form.error&&!editor&&!archive&&<p role="alert">{form.error}</p>}
    <fieldset disabled={form.saving}>
      <div className="catalog-actions"><button type="button" onClick={()=>open({kind:'family'})}>{uiText("catalog_manager.crear_familia")}</button><button type="button" onClick={()=>open({kind:'partida'})} disabled={!groups.some(g=>!g.archived)}>{uiText("catalog_manager.crear_partida")}</button></div>
      {(['GASTO','INGRESO'] as const).map(type=><section key={type} aria-label={uiText("catalog_manager.gestionar", { content: type==='GASTO'?uiText("catalog_manager.gastos"):uiText("catalog_manager.ingresos") })}><h3>{type==='GASTO'?uiText("catalog_manager.gastos"):uiText("catalog_manager.ingresos")}</h3>{groups.filter(g=>g.type===type).map((g,index,typed)=><article key={g.code} className="catalog-manage-family" aria-label={uiText("catalog_manager.gestionar_familia", { name: g.name })}>
        <h4>{g.name}{g.archived?uiText("catalog_manager.archivada"):''}</h4>
        <div className="catalog-actions">
          <button type="button" onClick={()=>open({kind:'family',item:g})}><I18nText id="catalog_manager.renombrar_familia" values={{ name: (g.name) }} /></button>
          <button type="button" onClick={()=>requestArchive({kind:'archiveFamily',code:g.code},!g.archived)}><I18nText id={g.archived?"catalog_manager.reactivateFamily":"catalog_manager.archiveFamily"} values={{name:g.name}} /></button>
          <button type="button" onClick={()=>submit({kind:'reorderFamily',code:g.code,direction:-1})} disabled={index===0}><I18nText id="catalog_manager.subir_familia" values={{ name: (g.name) }} /></button>
          <button type="button" onClick={()=>submit({kind:'reorderFamily',code:g.code,direction:1})} disabled={index===typed.length-1}><I18nText id="catalog_manager.bajar_familia" values={{ name: (g.name) }} /></button>
          <button type="button" onClick={()=>open({kind:'deleteFamily',item:g})}><I18nText id="catalog_manager.eliminar_familia" values={{ name: (g.name) }} /></button>
        </div>
        {g.partidas.filter(p=>!p.deleted).map(p=><div key={`${p.type}:${p.code}`} className="catalog-manage-partida">
          <strong>{p.name}{p.archived?uiText("planning.archivada"):''}</strong>
          <div className="catalog-actions"><button type="button" onClick={()=>open({kind:'partida',item:p})}><I18nText id="catalog_manager.editar_partida" values={{ name: (p.name) }} /></button>
            <button type="button" onClick={()=>requestArchive({kind:'archivePartida',parent:{type:p.type,code:p.code}},!p.archived)}><I18nText id={p.archived?"catalog_manager.reactivateItem":"catalog_manager.archiveItem"} values={{name:p.name}} /></button>
            <button type="button" onClick={()=>open({kind:'deletePartida',item:p})}><I18nText id="catalog_manager.eliminar_partida" values={{ name: (p.name) }} /></button>
          </div>
        </div>)}
      </article>)}</section>)}
    </fieldset>
    {archive&&<SafeDialog title={uiText("catalog_manager.confirmar_archivo_con_reglas_activas")} onCancel={()=>{if(!form.saving)setArchive(null);}}>
      <p><I18nText id="catalog_manager.vas_a_archivar_estas_reglas_activas_dependen_de_sus" values={{ name: (archive.impact.name) }} /></p>
      <ul>{archive.impact.dependencies.map(r=><li key={`${r.kind}:${r.id}`}>{uiText(r.kind==='Movimiento periódico'?"catalog_manager.recurringDependency":"catalog_manager.planningDependency")}: <strong>{r.name}</strong> · {r.partida}</li>)}</ul>
      <p>{uiText("catalog_manager.las_reglas_se_conservaran_activas_sin_borrarlas_desactivarlas_ni")}</p>
      {form.error&&<p role="alert">{form.error}</p>}
      <div className="catalog-actions"><button type="button" disabled={form.saving} onClick={()=>setArchive(null)}>{uiText("catalog_manager.cancelar")}</button><button type="button" disabled={form.saving} onClick={()=>{void form.submit(()=>onEdit(archive.edit),()=>{setNotice(true);setArchive(null);});}}>{form.saving?uiText("catalog_manager.guardando"):uiText("catalog_manager.confirmar_archivo")}</button></div>
    </SafeDialog>}
    {editor&&<SafeDialog title={title} onCancel={close}><form className="catalog-editor" aria-busy={form.saving} onSubmit={e=>{
      e.preventDefault();
      if(editor.kind==='deleteFamily')submit({kind:'deleteFamily',code:editor.item.code},true);
      else if(editor.kind==='deletePartida')submit({kind:'deletePartida',parent:editor.item},true);
      else if(editor.kind==='family')submit(editor.item?{kind:'renameFamily',code:editor.item.code,name}:{kind:'createFamily',id:crypto.randomUUID(),type,name},true);
      else {const fields={name,description,keywords:keywords.split(',').map(k=>k.trim()).filter(Boolean)};submit(editor.item?{kind:'updatePartida',parent:editor.item,...fields}:{kind:'createPartida',id:crypto.randomUUID(),groupCode,...fields},true);}
    }}><fieldset disabled={form.saving}>
      {form.error&&<p role="alert">{form.error}</p>}
      {removal?<><p><I18nText id="catalog_manager.eliminar_requiere_que_no_existan_dependencias_la_identidad_retirada" values={{ content: (editor.item?.name) }} /></p>{blockers.length>0&&<div role="alert">{uiText("catalog_manager.blockedRemoval",{dependencies:blockers.join(', ')})}</div>}</>:<>
        <label>{uiText("catalog_manager.nombre")}<input aria-label={uiText("catalog_manager.nombre_del_catalogo")} required maxLength={100} value={name} onChange={e=>setName(e.target.value)}/></label>
        {editor.kind==='family'&&!editor.item&&<label>{uiText("catalog_manager.tipo_principal")}<select aria-label={uiText("catalog_manager.tipo_principal")} value={type} onChange={e=>setType(e.target.value as MovementType)}><option value="GASTO">{uiText("catalog_manager.gastos")}</option><option value="INGRESO">{uiText("catalog_manager.ingresos")}</option></select></label>}
        {editor.kind==='partida'&&<>{!editor.item&&<label>{uiText("catalog_manager.familia_de_la_partida")}<select aria-label={uiText("catalog_manager.familia_de_la_partida")} required value={groupCode} onChange={e=>setGroupCode(e.target.value)}>{groups.filter(g=>!g.archived).map(g=><option key={g.code} value={g.code}>{g.type==='GASTO'?uiText("catalog_manager.gastos"):uiText("catalog_manager.ingresos")} · {g.name}</option>)}</select></label>}
          <label>{uiText("catalog_manager.descripcion")}<textarea aria-label={uiText("catalog_manager.descripcion_de_partida")} maxLength={2000} value={description} onChange={e=>setDescription(e.target.value)}/></label>
          <label>{uiText("catalog_manager.palabras_clave_separadas_por_comas")}<input aria-label={uiText("catalog_manager.palabras_clave_de_partida")} value={keywords} onChange={e=>setKeywords(e.target.value)}/></label></>}
      </>}
      <div className="catalog-actions"><button type="button" onClick={close}>{uiText("catalog_manager.cancelar")}</button><button type="submit" disabled={blockers.length>0}>{form.saving?uiText("catalog_manager.guardando"):removal?uiText("catalog_manager.confirmar_eliminacion"):uiText("catalog_manager.guardar_catalogo")}</button></div>
    </fieldset></form></SafeDialog>}
  </details>;
}
