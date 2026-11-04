import React, { useEffect, useMemo, useState } from 'react';
import type { BudgetGroup, BudgetPartida, Contact, MovementType, SharedDistribution, SharedExpenseInfo, Transaction, Wallet } from '../types/finance';
import type { SaveResult } from '../utils/saveResult';
import { useAsyncForm } from '../utils/useAsyncForm';
import { ALL_PARTIDAS } from '../constants/categories';
import { cents } from '../utils/sharedExpenses';
import { amountCents, weightedCents } from '../utils/sharedDistribution';
import { parseTransferAmount } from '../utils/transfers';
import { normalizeSearch } from '../utils/partidaSearch';
import { formatCurrency } from '../utils/finance';
import { Overlay } from './Overlay';
import { PartidaSelector } from './PartidaSelector';
import { Check, X } from 'lucide-react';

interface TransactionModalProps {
  isOpen: boolean; onClose: () => void;
  onSave: (t: Omit<Transaction, 'id'>, id?: string) => Promise<SaveResult>;
  wallets: Wallet[]; contacts?: Contact[]; onQuickCreateContact?: (contact: Contact) => Promise<SaveResult>;
  defaultDate?: string; transactionToEdit?: Transaction | null;
  initialPartidaCode?: string; initialContactId?: string; initialMovementType?: MovementType;
  availablePartidas?: BudgetPartida[]; budgetGroups?: BudgetGroup[]; transactions?: Transaction[];
}
export const TransactionModal: React.FC<TransactionModalProps> = ({ isOpen, onClose, onSave, wallets, contacts = [], onQuickCreateContact,
  defaultDate, transactionToEdit, initialPartidaCode, initialContactId, initialMovementType = 'GASTO', availablePartidas = ALL_PARTIDAS, budgetGroups, transactions = [] }) => {
  const submission = useAsyncForm();
  const [type, setType] = useState<MovementType>('GASTO'), [code, setCode] = useState('V.001.002'), [amount, setAmount] = useState(0);
  const [description, setDescription] = useState(''), [wallet, setWallet] = useState(''), [date, setDate] = useState(''), [processed, setProcessed] = useState(true), [notes, setNotes] = useState('');
  const [isShared, setIsShared] = useState(false), [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [method, setMethod] = useState<SharedDistribution['method']>('equal');
  const [ownWeight, setOwnWeight] = useState('1'), [weights, setWeights] = useState<Record<string, string>>({});
  const [ownAmount, setOwnAmount] = useState('0'), [amounts, setAmounts] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState(false), [contactQuery, setContactQuery] = useState('');
  const [showQuickContactInput, setShowQuickContactInput] = useState(false), [newContactName, setNewContactName] = useState('');
  const groups = useMemo(() => budgetGroups ?? Array.from(availablePartidas.reduce((map, p) => {
    const key = `${p.type}:${p.groupCode}`, group = map.get(key) ?? { code: p.groupCode, name: p.groupName, type: p.type, partidas: [] };
    group.partidas.push(p); map.set(key, group); return map;
  }, new Map<string, BudgetGroup>()).values()), [budgetGroups, availablePartidas]);
  useEffect(() => {
    if (!isOpen) return;
    submission.clearError();
    const tx = transactionToEdit, split = tx?.splitInfo, distribution = split?.distribution;
    const nextType = tx?.type ?? initialMovementType;
    setType(nextType); setCode(tx?.code ?? initialPartidaCode ?? (availablePartidas.find(p => p.type === nextType && p.code === 'V.001.002') ?? availablePartidas.find(p => p.type === nextType))?.code ?? '');
    setAmount(tx?.amount ?? 0); setDescription(tx?.description ?? ''); setWallet(tx?.wallet ?? wallets[0]?.name ?? '');
    setDate(tx?.date ?? defaultDate ?? new Date().toISOString().slice(0, 10)); setProcessed(tx?.processed ?? true); setNotes(tx?.notes ?? '');
    setIsShared(split?.isShared ?? !!initialContactId); setSelectedContactIds(split?.participants.map(p => p.contactId) ?? (initialContactId ? [initialContactId] : []));
    // Older 2.7 allocations do not identify a method: preserve their actual amounts.
    setMethod(distribution?.method ?? (split?.isShared ? 'amounts' : 'equal'));
    setOwnWeight(distribution?.method === 'weighted' ? String(distribution.ownWeight) : '1');
    setWeights(distribution?.method === 'weighted' ? Object.fromEntries(distribution.contactWeights.map(w => [w.contactId, String(w.weight)])) : {});
    setOwnAmount(String(split?.myShare ?? 0)); setAmounts(Object.fromEntries(split?.participants.map(p => [p.contactId, String(p.amount)]) ?? []));
    setTouched(false); setContactQuery(''); setShowQuickContactInput(false); setNewContactName('');
  }, [isOpen, transactionToEdit?.id, initialPartidaCode, initialContactId, initialMovementType, defaultDate]);

  const selected = selectedContactIds.map(id => contacts.find(c => c.id === id));
  let shares: number[] = [], splitError = '';
  if (isShared) try {
    if (!selected.length) throw new Error('Selecciona al menos otro contacto para compartir el gasto.');
    if (selected.some(c => !c)) throw new Error('Uno de los contactos seleccionados ya no existe.');
    const total = cents(amount);
    shares = method === 'equal' ? weightedCents(total, Array(selected.length + 1).fill(1))
      : method === 'weighted' ? weightedCents(total, [ownWeight, ...selectedContactIds.map(id => weights[id] ?? '1')].map(s => s.trim() ? Number(s.replace(',', '.')) : NaN))
      : amountCents(total, [ownAmount, ...selectedContactIds.slice(0, -1).map(id => amounts[id] ?? '0')].map(s => cents(parseTransferAmount(s))));
  } catch (error) { splitError = error instanceof Error ? error.message : 'Reparto inválido.'; }
  const clear = () => submission.clearError();
  const rememberAmounts = () => {
    if (!shares.length) return;
    setOwnAmount(String(shares[0] / 100));
    setAmounts(previous => ({ ...previous, ...Object.fromEntries(selectedContactIds.map((id, i) => [id, String(shares[i + 1] / 100)])) }));
  };
  const selectContacts = (ids: string[]) => { if (method === 'amounts') rememberAmounts(); setSelectedContactIds([...new Set(ids)]); clear(); };
  const changeMethod = (next: SharedDistribution['method']) => { if (next === 'amounts') rememberAmounts(); setMethod(next); setTouched(true); clear(); };
  const createContact = () => {
    if (!newContactName.trim() || !onQuickCreateContact) return;
    const contact: Contact = { id: crypto.randomUUID(), name: newContactName.trim(), createdAt: new Date().toISOString().slice(0, 10), avatarColor: 'from-sky-500 to-indigo-600' };
    void submission.submit(() => onQuickCreateContact(contact), () => { selectContacts([...selectedContactIds, contact.id]); setNewContactName(''); setShowQuickContactInput(false); });
  };
  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    const fail = (error: string) => submission.submit(() => Promise.resolve({ ok: false, error }), () => {});
    const matched = availablePartidas.find(p => p.code === code && p.type === type);
    const unchangedCategory = transactionToEdit && transactionToEdit.code === code && transactionToEdit.type === type;
    if (!matched && !unchangedCategory) { void fail('Selecciona una partida válida del catálogo.'); return; }
    if (isShared && splitError) { void fail(splitError); return; }
    let splitInfo: SharedExpenseInfo | undefined;
    if (isShared) {
      const original = transactionToEdit?.splitInfo;
      const preserve = original?.accountingVersion === '2.7' && transactionToEdit!.amount === amount && !touched && JSON.stringify(selectedContactIds) === JSON.stringify(original.participants.map(p => p.contactId));
      const distribution: SharedDistribution = method === 'weighted'
        ? { method, ownWeight: Number(ownWeight.replace(',', '.')), contactWeights: selectedContactIds.map(id => ({ contactId: id, weight: Number((weights[id] ?? '1').replace(',', '.')) })) } : { method };
      splitInfo = preserve ? original : {
        isShared: true, accountingVersion: '2.7', walletId: wallets.find(w => w.name === wallet)?.id ?? '', distribution,
        settlements: original?.settlements ?? [], totalParticipants: 1 + selectedContactIds.length,
        myShare: shares[0] / 100, totalOwedToMe: shares.slice(1).reduce((a, b) => a + b, 0) / 100,
        participants: selected.map((c, i) => ({ contactId: c!.id, contactName: c!.name, amount: shares[i + 1] / 100, isPaid: false })),
      };
    }
    void submission.submit(() => onSave({ type, code, amount, categoryName: unchangedCategory ? transactionToEdit!.categoryName : matched!.groupName,
      subcategoryName: unchangedCategory ? transactionToEdit!.subcategoryName : matched!.name, description: description.trim() || matched?.name || transactionToEdit!.description,
      wallet, date, processed, notes, splitInfo }, transactionToEdit?.id), onClose);
  };
  if (!isOpen) return null;
  const close = () => submission.close(onClose);
  return <Overlay title="Movimiento" onClose={close}>
    <div role="dialog" aria-modal="true" aria-label="Movimiento" className="bg-[#141926] border border-white/10 rounded-2xl max-w-lg w-full p-5 shadow-2xl text-xs space-y-3 max-h-[92dvh] overflow-y-auto">
      <div className="flex items-center justify-between"><h3 className="text-sm font-bold">{transactionToEdit ? 'Editar Movimiento' : 'Nuevo Movimiento'}</h3><button aria-label="Cerrar modal" onClick={close} disabled={submission.saving}><X className="w-4 h-4" /></button></div>
      <form onSubmit={submit} aria-busy={submission.saving}><fieldset disabled={submission.saving} className="min-w-0 space-y-3">
        {(submission.error || splitError) && <p role="alert" className="text-amber-300">{submission.error || splitError}</p>}
        {submission.saving && <p role="status">Guardando…</p>}
        <div className="grid grid-cols-2 gap-2">{(['GASTO', 'INGRESO'] as const).map(t => <button type="button" key={t} aria-pressed={type === t} className={`rounded-xl p-2 font-bold ${type === t ? 'bg-sky-500/20 text-sky-300' : 'bg-white/5'}`} onClick={() => { if (type !== t) { setType(t); setCode(availablePartidas.find(p => p.type === t)?.code ?? ''); } clear(); }}>{t === 'GASTO' ? 'Gasto' : 'Ingreso'}</button>)}</div>
        <label className="block">Importe Total (€)<input aria-label="Importe Total (€)" type="number" step="0.01" min="0.01" required value={amount || ''} placeholder="0,00" onChange={e => { setAmount(parseFloat(e.target.value) || 0); clear(); }} className="block w-full bg-[#0c0f17] rounded-xl border border-white/10 p-3 text-base font-bold" /></label>
        <div><p className="mb-1 text-slate-400">Partida presupuestaria</p><PartidaSelector groups={groups} transactions={transactions} type={type} value={code} onChange={setCode} /></div>
        <label className="block">Concepto<input aria-label="Concepto" value={description} onChange={e => setDescription(e.target.value)} placeholder="ej. Cena restaurante, Compra Zara, Supermercado..." className="block w-full bg-[#0c0f17] rounded-xl border border-white/10 p-2.5" /></label>
        <label className="flex gap-2"><input type="checkbox" checked={isShared} onChange={e => { setIsShared(e.target.checked); clear(); }} />Gasto compartido</label>
        {isShared && <section className="space-y-3 rounded-xl border border-sky-500/20 p-3" aria-label="Reparto del gasto">
          <p className="text-slate-300">Participantes: <strong>{selectedContactIds.length + 1}</strong> (tú y los contactos seleccionados)</p>
          <label className="block">Modalidad de reparto<select aria-label="Modalidad de reparto" value={method} onChange={e => changeMethod(e.target.value as SharedDistribution['method'])} className="block w-full bg-[#0c0f17] rounded-xl p-2"><option value="equal">Reparto equitativo</option><option value="weighted">Reparto proporcional</option><option value="amounts">Reparto por importes</option></select></label>
          {transactionToEdit?.splitInfo && !transactionToEdit.splitInfo.distribution && <p className="text-slate-400">La copia anterior no guardaba modalidad: se conservan sus importes sin recalcularlos al editar el concepto.</p>}
          <input aria-label="Buscar contactos" type="search" placeholder="Buscar contactos…" value={contactQuery} onChange={e => setContactQuery(e.target.value)} className="w-full bg-[#0c0f17] rounded-lg p-2" />
          <div className="flex flex-wrap gap-2">{contacts.filter(c => normalizeSearch(c.name).includes(normalizeSearch(contactQuery))).map(c => <button type="button" key={c.id} aria-pressed={selectedContactIds.includes(c.id)} onClick={() => selectContacts(selectedContactIds.includes(c.id) ? selectedContactIds.filter(id => id !== c.id) : [...selectedContactIds, c.id])} className={`rounded-lg border px-2.5 py-1.5 ${selectedContactIds.includes(c.id) ? 'border-sky-500/40 bg-sky-500/20 text-sky-300' : 'border-white/10'}`}>{c.name}</button>)}</div>
          <button type="button" className="text-sky-300" onClick={() => setShowQuickContactInput(v => !v)}>{showQuickContactInput ? 'Cancelar nuevo contacto' : '+ Nuevo Contacto'}</button>
          {showQuickContactInput && <div className="flex gap-2"><input value={newContactName} onChange={e => setNewContactName(e.target.value)} placeholder="Nombre del nuevo contacto..." className="min-w-0 flex-1 bg-[#0c0f17] rounded-lg p-2" /><button type="button" disabled={!newContactName.trim()} onClick={createContact} className="text-sky-300">Añadir</button></div>}
          <div className="space-y-2" aria-label="Desglose del reparto">{[{ id: null, name: 'Tú' }, ...selected.map((c, i) => ({ id: selectedContactIds[i], name: c?.name ?? 'Contacto no disponible' }))].map((person, i) => <div key={person.id === null ? 'self' : `contact:${person.id}`}  className="flex flex-wrap justify-between items-center gap-2 rounded-lg bg-[#0c0f17] p-2">
            <span>{person.name}</span>
            {method === 'weighted' && <label>Peso de {person.name}<input aria-label={`Peso de ${person.name}`} type="number" min="0" max="1000000" step="0.000001" value={person.id === null ? ownWeight : weights[person.id] ?? '1'} onChange={e => { person.id === null ? setOwnWeight(e.target.value) : setWeights(w => ({ ...w, [person.id!]: e.target.value })); setTouched(true); clear(); }} className="ml-2 w-20 rounded p-1 bg-[#141926] border border-white/10" /></label>}
            {method === 'amounts' && i < selectedContactIds.length && <label>Importe de {person.name}<input aria-label={`Importe de ${person.name}`} inputMode="decimal" value={person.id === null ? ownAmount : amounts[person.id] ?? '0'} onChange={e => { person.id === null ? setOwnAmount(e.target.value) : setAmounts(a => ({ ...a, [person.id!]: e.target.value })); setTouched(true); clear(); }} className="ml-2 w-24 rounded p-1 bg-[#141926] border border-white/10" /></label>}
            <output aria-label={`Parte de ${person.name}`} className="font-mono font-bold">{shares.length ? formatCurrency(shares[i] / 100) : 'Sin asignar'}{method === 'amounts' && i > 0 && i === selectedContactIds.length ? ' · Resto automático' : ''}</output>
          </div>)}</div>
          {!!shares.length && <div className="space-y-1" aria-live="polite"><p>Tu gasto: <strong>{formatCurrency(shares[0] / 100)}</strong></p><p>Total que deben los demás: <strong>{formatCurrency(shares.slice(1).reduce((a, b) => a + b, 0) / 100)}</strong></p><p>Total repartido: <strong>{formatCurrency(shares.reduce((a, b) => a + b, 0) / 100)}</strong></p></div>}
        </section>}
        <div className="grid grid-cols-2 gap-3"><label>Cartera u Origen<select aria-label="Cartera u Origen" value={wallet} onChange={e => setWallet(e.target.value)} className="block w-full bg-[#0c0f17] rounded-xl p-2">{wallets.map(w => <option key={w.id} value={w.name}>{w.name}</option>)}</select></label><label>Estado Tramitación<select aria-label="Estado Tramitación" value={processed ? 'true' : 'false'} onChange={e => setProcessed(e.target.value === 'true')} className="block w-full bg-[#0c0f17] rounded-xl p-2"><option value="true">Tramitado (SÍ)</option><option value="false">Pendiente (NO)</option></select></label></div>
        <label className="block">Fecha<input aria-label="Fecha" type="date" required value={date} onChange={e => setDate(e.target.value)} className="block w-full bg-[#0c0f17] rounded-xl border border-white/10 p-2" /></label>
        <label className="block">Notas (opcional)<input value={notes} onChange={e => setNotes(e.target.value)} placeholder="Detalles adicionales..." className="block w-full bg-[#0c0f17] rounded-xl border border-white/10 p-2" /></label>
        <div className="flex justify-end gap-2"><button type="button" onClick={close} className="rounded-xl p-3 text-slate-300">Cancelar</button><button type="submit" disabled={isShared && !!splitError} className="rounded-xl bg-white text-slate-950 font-bold p-3 disabled:opacity-40"><Check className="w-3 h-3 inline" /> {transactionToEdit ? 'Guardar Cambios' : 'Guardar Movimiento'}</button></div>
      </fieldset></form>
    </div>
  </Overlay>;
};
