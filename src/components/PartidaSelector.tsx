import React, { useEffect, useId, useMemo, useRef, useState } from 'react';
import type { BudgetGroup, MovementType, Transaction } from '../types/finance';
import { partidaCatalog, recentPartidas, searchPartidas } from '../utils/partidaSearch';

export function PartidaSelector({ groups, transactions, type, value, onChange }: {
  groups: BudgetGroup[]; transactions: Transaction[]; type: MovementType; value: string; onChange: (code: string) => void;
}) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState(''), [family, setFamily] = useState(''), [group, setGroup] = useState(''), [active, setActive] = useState(0);
  const trigger = useRef<HTMLButtonElement>(null), input = useRef<HTMLInputElement>(null), list = useRef<HTMLUListElement>(null), id = useId();
  const catalog = useMemo(() => partidaCatalog(groups), [groups]);
  const results = searchPartidas(catalog, type, query, family, group);
  const recents = recentPartidas(catalog, transactions, type).filter(item => results.includes(item));
  const current = groups.flatMap(g=>g.partidas).find(p=>p.type===type&&p.code===value);
  const availableGroups = [...new Map(catalog.filter(c => c.partida.type === type && (!family || c.familyCode === family)).map(c => [`${c.partida.groupCode}:${c.partida.groupName}`, c.partida])).entries()];
  useEffect(() => { setQuery(''); setFamily(''); setGroup(''); setActive(0); }, [type]);
  useEffect(() => { if (open) input.current?.focus(); }, [open]);
  useEffect(() => { list.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' }); }, [active]);
  const choose = (code: string) => { onChange(code); setOpen(false); trigger.current?.focus(); };
  const close = () => { setOpen(false); trigger.current?.focus(); };
  return <div className="space-y-2">
    <button ref={trigger} type="button" aria-label="Seleccionar partida presupuestaria" aria-expanded={open} aria-controls={`${id}-options`} aria-haspopup="listbox"
      onClick={() => setOpen(v => !v)} className="w-full text-left bg-[#0c0f17] border border-white/10 rounded-xl px-3 py-2.5">
      {current?.name ?? 'Partida actual fuera del catálogo'}
    </button>
    {open && <div className="space-y-2 border border-sky-500/30 rounded-xl p-3 bg-[#0c0f17]" onKeyDown={e => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); }
    }}>
      <input ref={input} role="combobox" aria-label="Buscar partida" aria-expanded="true" aria-autocomplete="list" aria-controls={`${id}-options`}
        aria-activedescendant={results.length ? `${id}-${Math.min(active, results.length - 1)}` : undefined}
        placeholder="Nombre, categoría o grupo…" value={query}
        onChange={e => { setQuery(e.target.value); setActive(0); }}
        onKeyDown={e => {
          if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) {
            e.preventDefault();
            setActive(i => !results.length ? 0 : e.key === 'Home' ? 0 : e.key === 'End' ? results.length - 1 : (i + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length);
          }
          if (e.key === 'Enter') { e.preventDefault(); const selected = results[Math.min(active, results.length - 1)]; if (selected) choose(selected.partida.code); }
        }} className="w-full rounded-lg border border-white/10 p-2 bg-[#141926]" />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <select aria-label="Familia presupuestaria" value={family} onChange={e => { setFamily(e.target.value); setGroup(''); setActive(0); }} className="w-full rounded-lg p-2 bg-[#141926]">
          <option value="">Todas las familias</option>{groups.filter(g => g.type === type&&!g.archived&&!g.deleted).map(g => <option key={g.code} value={g.code}>{g.name}</option>)}
        </select>
        <select aria-label="Grupo presupuestario" value={group} onChange={e => { setGroup(e.target.value); setActive(0); }} className="w-full rounded-lg p-2 bg-[#141926]">
          <option value="">Todos los grupos</option>{availableGroups.map(([key, p]) => <option key={key} value={key}>{p.groupName}</option>)}
        </select>
      </div>
      {!!recents.length && <div aria-label="Partidas recientes" className="space-y-1"><p className="text-slate-400">Usadas recientemente</p>
        {recents.map(({ partida: p }) => <button type="button" key={`${p.type}:${p.code}`} onClick={() => choose(p.code)} className="block text-left text-sky-300">{p.name}</button>)}
      </div>}
      <ul ref={list} id={`${id}-options`} role="listbox" aria-label={`Partidas de ${type === 'GASTO' ? 'gasto' : 'ingreso'}`} className="max-h-52 overflow-y-auto space-y-1">
        {results.map(({ partida: p, familyName }, i) => <li key={`${p.type}:${p.code}`}>
          <button type="button" role="option" aria-selected={value === p.code} tabIndex={-1} id={`${id}-${i}`} data-index={i}
            onMouseDown={e => e.preventDefault()} onMouseEnter={() => setActive(i)} onClick={() => choose(p.code)}
            className={`w-full rounded-lg text-left p-2 ${active === i ? 'bg-sky-500/20 ring-1 ring-sky-500/40' : 'hover:bg-white/5'}`}>
            {p.name}<span className="block text-[10px] text-slate-400">{familyName} → {p.groupName}</span>
          </button>
        </li>)}
      </ul>
      {!results.length && <p role="status">No hay partidas con esos filtros.</p>}
    </div>}
  </div>;
}
