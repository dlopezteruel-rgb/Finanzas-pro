import React,{useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {GripVertical} from 'lucide-react';
import type {DragSource,DropTarget,ReorderCallback} from '../utils/catalogReorder';
import {canReorder} from '../utils/catalogReorder';
import {saveErrorMessage} from '../utils/saveResult';

interface Session{source:DragSource;scope:string;x:number;y:number;startX:number;startY:number;active:boolean;target:DropTarget|null;node:HTMLElement;keyboard:boolean}
/** Pointer capture supports mouse/pen/touch. Only release persists; cancellation never writes. */
export function useCatalogDrag(scope:string,onReorder:ReorderCallback,disabled=false){
  const owner=useId(),session=useRef<Session|null>(null),frame=useRef<number|undefined>(undefined),pending=useRef(false),mounted=useRef(true);
  const restoreFocus=useRef<HTMLElement|null>(null);
  useLayoutEffect(()=>{if(restoreFocus.current&&!pending.current){const node=restoreFocus.current;restoreFocus.current=null;if(node.isConnected)node.focus({preventScroll:true});}});
  const [view,setView]=useState<Session|null>(null),[saving,setSaving]=useState(false),[message,setMessage]=useState(''),[error,setError]=useState('');
  const refresh=()=>setView(session.current?{...session.current}:null);
  const stop=()=>{if(frame.current!==undefined)cancelAnimationFrame(frame.current);frame.current=undefined;session.current=null;setView(null);};
  useEffect(()=>{if(!view?.active)return;const cancel=(event:KeyboardEvent)=>{if(event.key==='Escape'){event.preventDefault();event.stopPropagation();stop();setMessage('Arrastre cancelado. Orden conservado.');}};document.addEventListener('keydown',cancel,true);if(!view.keyboard)document.body.classList.add('catalog-is-dragging');return()=>{document.removeEventListener('keydown',cancel,true);document.body.classList.remove('catalog-is-dragging');};},[view?.active,view?.keyboard]);
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;if(frame.current!==undefined)cancelAnimationFrame(frame.current);session.current=null;}},[]);
  const resolveTarget=(x:number,y:number)=>{
    let el=document.elementFromPoint(x,y) as HTMLElement|null;let first:DropTarget|null=null;while(el){if(el.dataset.catalogOwner===owner&&el.dataset.catalogDrop){const t=JSON.parse(el.dataset.catalogDrop) as DropTarget;first??=t;if(session.current&&canReorder(session.current.source,t))return t;}el=el.parentElement;}return first;
  };
  const scroll=()=>{
    const s=session.current;if(!s||!s.active||s.keyboard)return;
    const delta=s.y<72?-Math.ceil((72-s.y)/5):s.y>innerHeight-90?Math.ceil((s.y-innerHeight+90)/5):0;
    if(delta){let el:HTMLElement|null=document.elementFromPoint(s.x,s.y) as HTMLElement|null;while(el&&!(el.scrollHeight>el.clientHeight&&/auto|scroll/.test(getComputedStyle(el).overflowY)))el=el.parentElement;if(el)el.scrollBy(0,delta);else window.scrollBy(0,delta);s.target=resolveTarget(s.x,s.y);refresh();}
    frame.current=requestAnimationFrame(scroll);
  };
  const finish=async()=>{
    const s=session.current;if(!s||!s.active||!s.target||!canReorder(s.source,s.target)){if(s?.active)setMessage('Destino no válido. Orden conservado.');stop();return;}
    const request={source:s.source,target:s.target,scope:s.scope};const node=s.node;stop();pending.current=true;setSaving(true);setError('');
    try{const result=await onReorder(request);if(!mounted.current)return;if(result.ok)setMessage(`Orden guardado: ${request.source.label}.`);else setError(result.error);}catch(e){if(mounted.current)setError(saveErrorMessage(e));}finally{pending.current=false;if(mounted.current){restoreFocus.current=node;setSaving(false);}}
  };
  const handle=(source:DragSource)=><button type="button" className="catalog-drag-handle" aria-label={`Arrastrar ${source.label}`} aria-describedby={`${owner}-instructions`} disabled={disabled||saving}
    data-dragging={view?.active&&JSON.stringify(view.source)===JSON.stringify(source)||undefined}
    onClick={e=>e.stopPropagation()}
    onPointerDown={e=>{if(disabled||pending.current||e.button!==0)return;e.preventDefault();e.stopPropagation();e.currentTarget.focus({preventScroll:true});e.currentTarget.setPointerCapture(e.pointerId);session.current={source,scope,x:e.clientX,y:e.clientY,startX:e.clientX,startY:e.clientY,active:false,target:null,node:e.currentTarget,keyboard:false};setError('');}}
    onPointerMove={e=>{const s=session.current;if(!s||s.keyboard)return;s.x=e.clientX;s.y=e.clientY;if(!s.active&&Math.hypot(s.x-s.startX,s.y-s.startY)>=6){s.active=true;setMessage(`Moviendo ${source.label}. Suelta sobre el destino.`);frame.current=requestAnimationFrame(scroll);}if(s.active){s.target=resolveTarget(s.x,s.y);refresh();}}}
    onPointerUp={e=>{e.stopPropagation();if(session.current&&!session.current.keyboard){session.current.target=resolveTarget(e.clientX,e.clientY);void finish();}}}
    onPointerCancel={()=>{stop();setMessage('Arrastre cancelado. Orden conservado.');}}
    onLostPointerCapture={()=>{if(session.current&&!session.current.keyboard){stop();setMessage('Arrastre cancelado. Orden conservado.');}}}
    onKeyDown={e=>{
      if(![' ','Enter','Escape','ArrowUp','ArrowDown','Home','End'].includes(e.key))return;e.preventDefault();e.stopPropagation();
      if(e.key==='Escape'){stop();setMessage('Arrastre cancelado. Orden conservado.');return;}
      if(e.key===' '||e.key==='Enter'){setError('');if(session.current?.keyboard){void finish();return;}session.current={source,scope,x:0,y:0,startX:0,startY:0,active:true,target:null,node:e.currentTarget,keyboard:true};setMessage(`Moviendo ${source.label}. Usa flechas y confirma con Enter; Escape cancela.`);refresh();return;}
      const s=session.current;if(!s?.keyboard)return;
      const targets=Array.from(document.querySelectorAll<HTMLElement>('[data-catalog-drop]')).filter(el=>el.dataset.catalogOwner===owner&&el.getClientRects().length).map(el=>({el,target:JSON.parse(el.dataset.catalogDrop!) as DropTarget})).filter(({target})=>canReorder(s.source,target));
      const index=targets.findIndex(({target})=>JSON.stringify(target)===JSON.stringify(s.target)),next=e.key==='Home'?0:e.key==='End'?targets.length-1:e.key==='ArrowUp'?Math.max(0,index-1):Math.min(targets.length-1,index+1);
      if(targets[next]){s.target=targets[next].target;targets[next].el.scrollIntoView({block:'nearest'});setMessage(`Destino: ${s.target.label}. Enter confirma.`);refresh();}
    }}><GripVertical aria-hidden="true" size={18}/></button>;
  const target=(t:DropTarget)=>({'data-drop-position':t.kind==='partida'&&t.beforeCode===undefined||t.kind==='subitem'&&t.beforeId===undefined||t.kind==='family'&&t.code===undefined?'end':'before','data-catalog-owner':owner,'data-catalog-drop':JSON.stringify(t),'data-drop-highlight':view?.target&&JSON.stringify(view.target)===JSON.stringify(t)?canReorder(view.source,t)?'valid':'invalid':undefined});
  const feedback=<><p id={`${owner}-instructions`} className="sr-only">Arrastra con ratón o tacto. Con teclado, Espacio inicia, flechas eligen, Enter confirma y Escape cancela. También puedes usar las acciones de orden y traslado.</p><p role="status" aria-live="polite" className="catalog-drag-status">{saving?'Guardando orden…':message}</p>{error&&<p role="alert" className="catalog-drag-error">{error}</p>}{view?.active&&!view.keyboard&&createPortal(<div className="catalog-drag-preview" style={{left:Math.min(view.x+12,innerWidth-220),top:Math.max(8,view.y-48)}}>{view.source.label}<span>{view.target?(canReorder(view.source,view.target)?`Destino: ${view.target.label}`:'Destino no válido'):'Elige un destino'}</span></div>,document.body)}</>;
  return {handle,target,feedback,saving,sourceKind:view?.source.kind};
}
