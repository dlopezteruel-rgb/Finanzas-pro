import {useEffect,useState} from 'react';
import {flushSync} from 'react-dom';

/** Browser-only presentation adapter; no persistence or financial work. */
export function useCompletePrint(){
 const [printing,setPrinting]=useState(false);
 useEffect(()=>{
  if(typeof window==='undefined')return;
  let position:{x:number;y:number}|undefined;
  const before=()=>{position??={x:window.scrollX,y:window.scrollY};flushSync(()=>setPrinting(true));};
  const after=()=>{flushSync(()=>setPrinting(false));if(position){window.scrollTo(position.x,position.y);position=undefined;}};
  window.addEventListener('beforeprint',before);window.addEventListener('afterprint',after);
  return ()=>{window.removeEventListener('beforeprint',before);window.removeEventListener('afterprint',after);};
 },[]);
 return printing;
}
