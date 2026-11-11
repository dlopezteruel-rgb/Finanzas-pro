import React from 'react';
import type { BudgetSubitem, MovementType } from '../types/finance';

/** No implicit first selection; archived attribution remains available on its own record. */
export function SubitemSelector({items=[],type,code,value='',onChange}: {
  items?: BudgetSubitem[];type:MovementType;code:string;value?:string;onChange:(id:string)=>void;
}) {
  const options=items.filter(i=>!i.deleted&&i.type===type&&i.code===code&&(!i.archived||i.id===value)).sort((a,b)=>a.order-b.order||a.id.localeCompare(b.id));
  if(!options.length&&!value)return null;
  return <label className="block">Subítem (opcional)<select className="block w-full rounded-xl border p-2" aria-label="Subítem (opcional)" value={value} onChange={e=>onChange(e.target.value)}>
    <option value="">Sin subítem</option>
    {options.map(i=><option key={i.id} value={i.id}>{i.name}{i.archived?' (archivado)':''}</option>)}
  </select></label>;
}
