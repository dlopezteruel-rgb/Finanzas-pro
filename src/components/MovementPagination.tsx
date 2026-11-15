import React from 'react';
import {useI18n} from '../i18n';

export const MOVEMENT_PAGE_SIZE=50;
export const MOVEMENT_PAGING_THRESHOLD=200;
/** Presentation indices only. Filtering, ordering and financial totals stay with the caller. */
export function movementPage(count:number,requested:number,all=false){
 const pages=Math.max(1,Math.ceil(count/MOVEMENT_PAGE_SIZE));
 const page=Math.max(0,Math.min(pages-1,Number.isFinite(requested)?Math.trunc(requested):0));
 const start=all?0:page*MOVEMENT_PAGE_SIZE,end=all?count:Math.min(count,start+MOVEMENT_PAGE_SIZE);
 return {page,pages,start,end};
}
export function MovementPagination({count,page,all,onPage,onAll,announce=true}:{count:number;page:number;all:boolean;onPage:(page:number)=>void;onAll:(all:boolean)=>void;announce?:boolean}){
 const {t,formatNumber:n}=useI18n(),view=movementPage(count,page,all);
 return <div className="movement-pagination">
  <p role={announce?'status':undefined} aria-live={announce?'polite':undefined} aria-atomic={announce?true:undefined}>{t('ledger.page.range',{start:n(count?view.start+1:0),end:n(view.end),total:n(count)})}</p>
  <div className="movement-page-controls" role="group" aria-label={t('ledger.page.navigation')}>
   {!all&&<>
    <button type="button" className="button-secondary" disabled={view.page===0} onClick={()=>onPage(view.page-1)}>{t('ledger.page.previous')}</button>
    <label>{t('ledger.page.label')}<select value={view.page} onChange={e=>onPage(Number(e.target.value))}>
     {Array.from({length:view.pages},(_,index)=><option key={index} value={index}>{t('ledger.page.number',{page:n(index+1),pages:n(view.pages)})}</option>)}
    </select></label>
    <button type="button" className="button-secondary" disabled={view.page===view.pages-1} onClick={()=>onPage(view.page+1)}>{t('ledger.page.next')}</button>
   </>}
   <button type="button" className="button-secondary" onClick={()=>onAll(!all)}>{t(all?'ledger.page.paginate':'ledger.page.showAll')}</button>
  </div>
  <p className="movement-page-help">{t(all?'ledger.page.fullHelp':'ledger.page.help')}</p>
 </div>;
}
