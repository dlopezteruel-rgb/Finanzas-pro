import React, { useState } from 'react';
import { SafeDialog } from './SafeDialog';
import { currentMonth, monthLabel, MONTH_NAMES, shiftMonth } from '../utils/financialCalendar';

export function PeriodSelector({ month, periods, onChange }: { month: string; periods: string[]; onChange: (month: string) => void }) {
  const [open,setOpen]=useState(false), [year,setYear]=useState(month.slice(0,4)), [number,setNumber]=useState(month.slice(5));
  const previous=shiftMonth(month,-1), next=shiftMonth(month,1);
  return <div className="period-selector">
    <button aria-label="Mes anterior" disabled={!previous} onClick={()=>previous&&onChange(previous)}>‹</button>
    <select aria-label="Seleccionar periodo contable" value={month} onChange={e=>onChange(e.target.value)}>
      {[...new Set([month,...periods])].sort().reverse().map(p=><option key={p} value={p}>{monthLabel(p)}</option>)}
    </select>
    <button aria-label="Mes siguiente" disabled={!next} onClick={()=>next&&onChange(next)}>›</button>
    <button aria-label="Elegir mes y año" onClick={()=>{setYear(month.slice(0,4));setNumber(month.slice(5));setOpen(true)}}>Fecha</button>
    <button aria-label="Ir al mes actual" onClick={()=>onChange(currentMonth())}>Hoy</button>
    {open&&<SafeDialog title="Elegir mes y año" onCancel={()=>setOpen(false)}><form className="finance-form" onSubmit={e=>{e.preventDefault();if(/^[0-9]{1,4}$/.test(year)&&Number(year)>=1){onChange(`${year.padStart(4,'0')}-${number}`);setOpen(false)}}}>
      <label>Mes<select aria-label="Mes" value={number} onChange={e=>setNumber(e.target.value)}>{MONTH_NAMES.map((m,i)=><option value={String(i+1).padStart(2,'0')} key={m}>{m}</option>)}</select></label>
      <label>Año<input aria-label="Año" type="number" min="1" max="9999" required value={year} onChange={e=>setYear(e.target.value)}/></label>
      <p>Rango 0001–9999. Puedes consultar periodos sin actividad.</p>
      <button type="button" onClick={()=>setOpen(false)}>Cancelar</button><button type="submit">Consultar periodo</button>
    </form></SafeDialog>}
  </div>;
}
