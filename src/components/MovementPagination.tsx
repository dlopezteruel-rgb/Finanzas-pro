import React from 'react';
import {ChevronLeft,ChevronRight} from 'lucide-react';
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
export function MovementPagination({count,page,all,onPage,onAll,announce=true,compact=false}:{count:number;page:number;all:boolean;onPage:(page:number)=>void;onAll:(all:boolean)=>void;announce?:boolean;compact?:boolean}){
 const {t,formatNumber:n}=useI18n(),view=movementPage(count,page,all);
 const select=React.useRef<HTMLSelectElement>(null);
 const move=(next:number)=>{
  // A focused button becoming disabled makes Chromium move focus to body.
  // Keep the user in this pager before the boundary button is disabled.
  if(next===0||next===view.pages-1)select.current?.focus({preventScroll:true});
  onPage(next);
 };
 return <div className={`movement-pagination${compact?' movement-pagination-compact':''}`}>
  <p className={compact?'sr-only':undefined} role={announce?'status':undefined} aria-live={announce?'polite':undefined} aria-atomic={announce?true:undefined}>{t('ledger.page.range',{start:n(count?view.start+1:0),end:n(view.end),total:n(count)})}</p>
  <div className="movement-page-controls" role="group" aria-label={t('ledger.page.navigation')}>
   {!all&&<>
    <button type="button" className="button-secondary" aria-label={t('ledger.page.previous')} title={t('ledger.page.previous')} disabled={view.page===0} onClick={()=>move(view.page-1)}>{compact?<ChevronLeft size={18} aria-hidden="true"/>:t('ledger.page.previous')}</button>
    <label><span className={compact?'sr-only':undefined}>{t('ledger.page.label')}</span><select ref={select} value={view.page} onChange={e=>onPage(Number(e.target.value))}>
     {Array.from({length:view.pages},(_,index)=><option key={index} value={index}>{t('ledger.page.number',{page:n(index+1),pages:n(view.pages)})}</option>)}
    </select></label>
    <button type="button" className="button-secondary" aria-label={t('ledger.page.next')} title={t('ledger.page.next')} disabled={view.page===view.pages-1} onClick={()=>move(view.page+1)}>{compact?<ChevronRight size={18} aria-hidden="true"/>:t('ledger.page.next')}</button>
   </>}
   <button type="button" className="button-secondary" aria-label={t(all?'ledger.page.paginate':'ledger.page.showAll')} title={t(all?'ledger.page.paginate':'ledger.page.showAll')} onClick={()=>onAll(!all)}>{t(compact?(all?'ledger.page.pagedShort':'ledger.page.allShort'):(all?'ledger.page.paginate':'ledger.page.showAll'))}</button>
  </div>
  {!compact&&<p className="movement-page-help">{t(all?'ledger.page.fullHelp':'ledger.page.help')}</p>}
 </div>;
}
