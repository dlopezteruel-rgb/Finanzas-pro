import React,{useState} from 'react';
import {useI18n} from '../i18n';
import {catalogPresentation} from '../i18n/catalogNames';
import {storageOwnedText} from '../i18n/storageMessages';
import {catalogNameCandidates,catalogNamesScope,selectedCatalogNames,nameTargetKey,type CatalogNameTarget} from '../utils/catalogNames';
import type {CatalogEdit} from '../utils/budgetCatalog';
import type {FinanceData} from '../utils/backup';
import type {SaveResult} from '../utils/saveResult';
import {useAsyncForm} from '../utils/useAsyncForm';
import {SafeDialog} from './SafeDialog';

export function CatalogNameReview({data,onEdit,onClose}:{data:FinanceData;onEdit:(edit:CatalogEdit)=>Promise<SaveResult>;onClose:()=>void}){
 const {t}=useI18n(),names=catalogPresentation(data,t),form=useAsyncForm();
 // Freeze the reviewed candidates and scope. A simultaneous edit must be reviewed again.
 const [review]=useState(()=>({candidates:catalogNameCandidates(data),scope:catalogNamesScope(data)}));
 const [selected,setSelected]=useState(()=>new Set(selectedCatalogNames(data).map(nameTargetKey)));
 const sections=[['family','catalog.names.families'],['item','catalog.names.items'],['subgroup','catalog.names.subgroups']] as const;
 const toggle=(target:CatalogNameTarget)=>setSelected(old=>{const next=new Set(old),key=nameTargetKey(target);if(next.has(key))next.delete(key);else next.add(key);return next;});
 return <SafeDialog title={t('catalog.names.reviewTitle')} onCancel={()=>{if(!form.saving)onClose();}}>
  <form className="catalog-editor" aria-busy={form.saving} onSubmit={e=>{e.preventDefault();void form.submit(()=>onEdit({kind:'reviewNames',scope:review.scope,selected:review.candidates.filter(target=>selected.has(nameTargetKey(target)))}),onClose);}}>
   <p>{t('catalog.names.reviewHelp')}</p><p>{t('catalog.names.reviewRecovery')}</p><p>{t('catalog.names.reviewReversible')}</p>
   {form.error&&<p role="alert">{storageOwnedText(form.error,t)}</p>}
   {!review.candidates.length&&<p>{t('catalog.names.noCandidates')}</p>}
   <fieldset disabled={form.saving} className="space-y-4">
    {sections.map(([kind,key])=><fieldset key={kind} className="space-y-2"><legend className="font-bold">{t(key)}</legend>{review.candidates.filter(target=>target.kind===kind).map(target=><label key={nameTargetKey(target)} className="flex items-start gap-3 rounded-lg border border-white/10 p-2 break-words">
     <input type="checkbox" className="mt-1 shrink-0" checked={selected.has(nameTargetKey(target))} onChange={()=>toggle(target)}/><span className="min-w-0">{names.target(target,true)}<small className="block text-slate-300">{t('catalog.names.storedName',{name:names.raw(target)})}</small></span>
    </label>)}</fieldset>)}
    <div className="catalog-actions"><button type="button" onClick={onClose}>{t('common.cancel')}</button><button type="submit">{form.saving?t('common.saving'):t('catalog.names.saveReview')}</button></div>
   </fieldset>
  </form>
 </SafeDialog>;
}
