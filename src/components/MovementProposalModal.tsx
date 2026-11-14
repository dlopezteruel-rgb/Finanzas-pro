import {useCatalogNames} from '../i18n/catalogNames';
import {storageOwnedText} from '../i18n/storageMessages';
import { useI18n } from "../i18n";
import {SubitemSelector} from './SubitemSelector';
import React, { useState } from 'react';
import { BudgetPartida, BudgetSubitem, Transaction, Wallet } from '../types/finance';
import { isISODate } from '../utils/backup';
import { SafeDialog } from './SafeDialog';

export function MovementProposalModal({ proposal, wallets, partidas, subitems, onConfirm, onCancel, busy = false, saveError = '' }: {
  subitems?:BudgetSubitem[]; proposal: Omit<Transaction, 'id'>; wallets: Wallet[]; partidas: BudgetPartida[];
  onConfirm: (transaction: Omit<Transaction, 'id'>) => void; onCancel: () => void; busy?: boolean; saveError?: string;
}) {
  const { t: uiText } = useI18n();
  const catalogNames=useCatalogNames();
  const [draft, setDraft] = useState(proposal);
  const [error, setError] = useState('');
  const inputClass = 'block w-full mt-1 bg-[#0c0f17] border border-white/10 rounded-xl px-3 py-2 text-white';
  const options = partidas.filter(p => p.type === draft.type&&!p.archived&&!p.deleted);
  return <SafeDialog title={uiText("movement_proposal.revisar_propuesta_de_movimiento")} onCancel={() => { if (!busy) onCancel(); }}>
    <p className="text-sm text-slate-300">{uiText("movement_proposal.todavia_no_se_ha_registrado_revisa_todos_los_campos")}</p>
    <form className="space-y-3 text-sm" onSubmit={event => {
      event.preventDefault();
      const partida = options.find(p => p.code === draft.code);
      if (!Number.isFinite(draft.amount) || draft.amount <= 0 || !isISODate(draft.date) || !draft.description.trim() || !wallets.some(w => w.name === draft.wallet) || !partida) {
        setError('Revisa el importe, la fecha, la cartera, la categoría y el concepto.'); return;
      }
      onConfirm({ ...draft, amount: Math.round(draft.amount * 100) / 100, description: draft.description.trim(), categoryName: partida.groupName, subcategoryName: partida.name });
    }}>
      <label className="block">{uiText("movement_proposal.tipo")}<select aria-label={uiText("movement_proposal.tipo")} className={inputClass} value={draft.type} onChange={e => {
        const type = e.target.value as Transaction['type'];
        setDraft({ ...draft, type, subitemId:undefined, code: '' });
      }}><option value="GASTO">{uiText("movement_proposal.gasto")}</option><option value="INGRESO">{uiText("movement_proposal.ingreso")}</option></select></label>
      <label className="block">{uiText("movement_proposal.importe")}<input className={inputClass} type="number" min="0.01" step="0.01" required value={draft.amount || ''} onChange={e => setDraft({ ...draft, amount: Number(e.target.value) })} /></label>
      <label className="block">{uiText("transfer.fecha")}<input className={inputClass} type="date" required value={draft.date} onChange={e => setDraft({ ...draft, date: e.target.value })} /></label>
      <label className="block">{uiText("wallet.cartera")}<select aria-label={uiText("wallet.cartera")} className={inputClass} required value={draft.wallet} onChange={e => setDraft({ ...draft, wallet: e.target.value })}>
        <option value="" disabled>{uiText("transfer.selecciona_una_cartera")}</option>{wallets.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}
      </select></label>
      <label className="block">{uiText("movement_proposal.categoria")}<select aria-label={uiText("movement_proposal.categoria")} className={inputClass} required value={draft.code} onChange={e => setDraft({ ...draft, code: e.target.value, subitemId:draft.code===e.target.value?draft.subitemId:undefined })}>
        <option value="" disabled>{uiText("loan.selecciona_una_partida")}</option>{options.map(p => <option key={p.code} value={p.code}>{catalogNames.item(p)}</option>)}
      </select></label>
      <SubitemSelector items={subitems} type={draft.type} code={draft.code} value={draft.subitemId} onChange={id=>setDraft({...draft,subitemId:id||undefined})}/>
      <label className="block">{uiText("transaction.concepto")}<input className={inputClass} required value={draft.description} onChange={e => setDraft({ ...draft, description: e.target.value })} /></label>
      <label className="block">{uiText("movement_proposal.estado")}<select aria-label={uiText("movement_proposal.estado")} className={inputClass} value={String(draft.processed)} onChange={e => setDraft({ ...draft, processed: e.target.value === 'true' })}>
        <option value="true">{uiText("movement_proposal.tramitado")}</option><option value="false">{uiText("movement_proposal.pendiente")}</option>
      </select></label>
      {(error || saveError) && <p role="alert" className="text-amber-300">{error?uiText('assistant.proposalValidation'):storageOwnedText(saveError,uiText)}</p>}
      <div className="flex justify-end gap-2">
        <button type="button" disabled={busy} onClick={onCancel} className="rounded-xl bg-white/10 px-4 py-2">{uiText("transfer.cancelar")}</button>
        <button type="submit" disabled={busy || !wallets.length || !options.some(p=>p.code===draft.code)} className="rounded-xl bg-sky-500 text-slate-950 font-bold px-4 py-2 disabled:opacity-40">{busy ? uiText("transfer.guardando") : uiText("movement_proposal.confirmar_y_registrar")}</button>
      </div>
    </form>
  </SafeDialog>;
}
