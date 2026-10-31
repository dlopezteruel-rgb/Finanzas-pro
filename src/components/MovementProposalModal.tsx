import React, { useState } from 'react';
import { BudgetPartida, Transaction, Wallet } from '../types/finance';
import { isISODate } from '../utils/backup';
import { SafeDialog } from './SafeDialog';

export function MovementProposalModal({ proposal, wallets, partidas, onConfirm, onCancel }: {
  proposal: Omit<Transaction, 'id'>; wallets: Wallet[]; partidas: BudgetPartida[];
  onConfirm: (transaction: Omit<Transaction, 'id'>) => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState(proposal);
  const [error, setError] = useState('');
  const inputClass = 'block w-full mt-1 bg-[#0c0f17] border border-white/10 rounded-xl px-3 py-2 text-white';
  const options = partidas.filter(p => p.type === draft.type);
  return <SafeDialog title="Revisar propuesta de movimiento" onCancel={onCancel}>
    <p className="text-sm text-slate-300">Todavía no se ha registrado. Revisa todos los campos antes de confirmar.</p>
    <form className="space-y-3 text-sm" onSubmit={event => {
      event.preventDefault();
      const partida = options.find(p => p.code === draft.code);
      if (!Number.isFinite(draft.amount) || draft.amount <= 0 || !isISODate(draft.date) || !draft.description.trim() || !wallets.some(w => w.name === draft.wallet) || !partida) {
        setError('Revisa el importe, la fecha, la cartera, la categoría y el concepto.'); return;
      }
      onConfirm({ ...draft, amount: Math.round(draft.amount * 100) / 100, description: draft.description.trim(), categoryName: partida.groupName, subcategoryName: partida.name });
    }}>
      <label className="block">Tipo<select aria-label="Tipo" className={inputClass} value={draft.type} onChange={e => {
        const type = e.target.value as Transaction['type'];
        setDraft({ ...draft, type, code: partidas.find(p => p.type === type)?.code ?? '' });
      }}><option value="GASTO">Gasto</option><option value="INGRESO">Ingreso</option></select></label>
      <label className="block">Importe (€)<input className={inputClass} type="number" min="0.01" step="0.01" required value={draft.amount || ''} onChange={e => setDraft({ ...draft, amount: Number(e.target.value) })} /></label>
      <label className="block">Fecha<input className={inputClass} type="date" required value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} /></label>
      <label className="block">Cartera<select aria-label="Cartera" className={inputClass} required value={draft.wallet} onChange={e => setDraft({ ...draft, wallet: e.target.value })}>
        <option value="" disabled>Selecciona una cartera</option>{wallets.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
      </select></label>
      <label className="block">Categoría<select aria-label="Categoría" className={inputClass} required value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value })}>
        {options.map(p => <option key={p.code} value={p.code}>{p.code} · {p.name}</option>)}
      </select></label>
      <label className="block">Concepto<input className={inputClass} required value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>
      <label className="block">Estado<select aria-label="Estado" className={inputClass} value={String(draft.processed)} onChange={e => setDraft({ ...draft, processed: e.target.value === 'true' })}>
        <option value="true">Tramitado</option><option value="false">Pendiente</option>
      </select></label>
      {error && <p role="alert" className="text-amber-300">{error}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="rounded-xl bg-white/10 px-4 py-2">Cancelar</button>
        <button type="submit" disabled={!wallets.length || !options.length} className="rounded-xl bg-sky-500 text-slate-950 font-bold px-4 py-2 disabled:opacity-40">Confirmar y registrar</button>
      </div>
    </form>
  </SafeDialog>;
}
