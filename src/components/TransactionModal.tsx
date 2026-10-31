import { SaveResult } from '../utils/saveResult';
import { useAsyncForm } from '../utils/useAsyncForm';
import React, { useState, useEffect } from 'react';
import {
  Transaction,
  MovementType,
  Wallet,
  BudgetPartida,
  Contact,
  SplitParticipant,
  SharedExpenseInfo,
} from '../types/finance';
import { ALL_PARTIDAS } from '../constants/categories';
import { X, Check, Users, UserPlus } from 'lucide-react';
import { formatCurrency } from '../utils/finance';

interface TransactionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (t: Omit<Transaction, 'id'>, id?: string) => Promise<SaveResult>;
  wallets: Wallet[];
  contacts?: Contact[];
  onQuickCreateContact?: (contact: Contact) => Promise<SaveResult>;
  defaultDate?: string;
  transactionToEdit?: Transaction | null;
  initialPartidaCode?: string;
  initialContactId?: string;
  availablePartidas?: BudgetPartida[];
}

export const TransactionModal: React.FC<TransactionModalProps> = ({
  isOpen,
  onClose,
  onSave,
  wallets,
  contacts = [],
  onQuickCreateContact,
  defaultDate,
  transactionToEdit,
  initialPartidaCode,
  initialContactId,
  availablePartidas = ALL_PARTIDAS,
}) => {
  const submission = useAsyncForm();
  const [type, setType] = useState<MovementType>('GASTO');
  const [code, setCode] = useState<string>('V.001.002');
  const [amount, setAmount] = useState<number>(0);
  const [description, setDescription] = useState<string>('');
  const [wallet, setWallet] = useState<string>(wallets[0]?.name || 'OPENBANK');
  const [date, setDate] = useState<string>(defaultDate || new Date().toISOString().split('T')[0]);
  const [processed, setProcessed] = useState<boolean>(true);
  const [notes, setNotes] = useState<string>('');

  // Split / Shared Expense States
  const [isShared, setIsShared] = useState<boolean>(false);
  const [totalParticipants, setTotalParticipants] = useState<number>(2);
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([]);
  const [showQuickContactInput, setShowQuickContactInput] = useState<boolean>(false);
  const [newContactName, setNewContactName] = useState<string>('');

  useEffect(() => {
    submission.clearError();
    if (transactionToEdit) {
      setType(transactionToEdit.type);
      setCode(transactionToEdit.code);
      setAmount(transactionToEdit.amount);
      setDescription(transactionToEdit.description);
      setWallet(transactionToEdit.wallet);
      setDate(transactionToEdit.date);
      setProcessed(transactionToEdit.processed);
      setNotes(transactionToEdit.notes || '');

      if (transactionToEdit.splitInfo && transactionToEdit.splitInfo.isShared) {
        setIsShared(true);
        setTotalParticipants(transactionToEdit.splitInfo.totalParticipants || 2);
        setSelectedContactIds(
          transactionToEdit.splitInfo.participants.map(p => p.contactId)
        );
      } else {
        setIsShared(false);
        setTotalParticipants(2);
        setSelectedContactIds([]);
      }
    } else {
      const defaultType = 'GASTO';
      setType(defaultType);
      const targetCode = initialPartidaCode || 'V.001.002';
      setCode(targetCode);
      setAmount(0);
      setDescription('');
      setWallet(wallets[0]?.name || 'OPENBANK');
      setDate(defaultDate || new Date().toISOString().split('T')[0]);
      setProcessed(true);
      setNotes('');

      // If opened with a preselected contact for split
      if (initialContactId) {
        setIsShared(true);
        setTotalParticipants(2);
        setSelectedContactIds([initialContactId]);
      } else {
        setIsShared(false);
        setTotalParticipants(2);
        setSelectedContactIds([]);
      }
    }
    setShowQuickContactInput(false);
    setNewContactName('');
  }, [transactionToEdit?.id, initialPartidaCode, initialContactId, defaultDate, isOpen]);

  if (!isOpen) return null;

  const filteredPartidas = availablePartidas.filter(p => p.type === type);

  const handleTypeChange = (newType: MovementType) => {
    setType(newType);
    const first = availablePartidas.find(p => p.type === newType);
    if (first) setCode(first.code);
  };

  // Split calculation
  const safeParticipantsCount = Math.max(2, totalParticipants);
  const perPersonShare = amount > 0 ? Math.round((amount / safeParticipantsCount) * 100) / 100 : 0;
  const myShare = perPersonShare;
  const totalOwedToMe = amount > 0 ? Math.round((amount - myShare) * 100) / 100 : 0;

  const handleToggleContactSelection = (contactId: string) => {
    setSelectedContactIds(prev =>
      prev.includes(contactId) ? prev.filter(id => id !== contactId) : [...prev, contactId]
    );
  };

  const handleCreateQuickContact = () => {
    if (!newContactName.trim()) return;
    const newContact: Contact = {
      id: `contact-${Date.now()}`,
      name: newContactName.trim(),
      createdAt: new Date().toISOString().split('T')[0],
      avatarColor: 'from-sky-500 to-indigo-600',
    };
    if (!onQuickCreateContact) return;
    void submission.submit(() => onQuickCreateContact(newContact), () => {
      setSelectedContactIds(prev => [...prev, newContact.id]);
      setNewContactName('');
      setShowQuickContactInput(false);
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (amount <= 0) return;

    const matched = availablePartidas.find(p => p.code === code && p.type === type) ||
      availablePartidas.find(p => p.code === code) || {
        groupName: 'General',
        name: 'Movimiento',
      };

    let splitInfo: SharedExpenseInfo | undefined = undefined;

    if (isShared) {
      // Build participants list
      const debtorCount = safeParticipantsCount - 1;
      const debtorsShare = perPersonShare;
      const participants: SplitParticipant[] = [];

      // 1. Add selected contacts
      selectedContactIds.slice(0, debtorCount).forEach(cid => {
        const foundContact = contacts.find(c => c.id === cid);
        const prevParticipant = transactionToEdit?.splitInfo?.participants.find(p => p.contactId === cid);

        participants.push({
          contactId: cid,
          contactName: foundContact ? foundContact.name : 'Contacto',
          amount: debtorsShare,
          isPaid: prevParticipant?.isPaid || false,
          paidDate: prevParticipant?.paidDate,
          reimbursementTxId: prevParticipant?.reimbursementTxId,
        });
      });

      // 2. Fill remaining anonymous participants if total participants exceeds selected contacts
      const remainingDebtors = debtorCount - participants.length;
      for (let i = 1; i <= remainingDebtors; i++) {
        const dummyId = `amigo-${i}`;
        const prevParticipant = transactionToEdit?.splitInfo?.participants.find(p => p.contactId === dummyId);
        participants.push({
          contactId: dummyId,
          contactName: `Persona ${i + participants.length}`,
          amount: debtorsShare,
          isPaid: prevParticipant?.isPaid || false,
          paidDate: prevParticipant?.paidDate,
          reimbursementTxId: prevParticipant?.reimbursementTxId,
        });
      }

      splitInfo = {
        isShared: true,
        totalParticipants: safeParticipantsCount,
        myShare,
        totalOwedToMe,
        participants,
      };
    }

    void submission.submit(() => onSave(
      {
        type,
        code,
        amount,
        categoryName: matched.groupName,
        subcategoryName: matched.name,
        description: description.trim() || matched.name,
        wallet,
        date,
        processed,
        notes,
        splitInfo,
      },
      transactionToEdit?.id
    ), onClose);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fadeIn">
      <div role="dialog" aria-modal="true" aria-label="Movimiento" className="bg-[#141926] border border-white/10 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-5 shadow-2xl text-xs space-y-3.5 max-h-[92vh] overflow-y-auto">
        {/* Handle bar on mobile */}
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto sm:hidden -mt-1 mb-2" />

        <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
          <h3 className="text-sm font-bold text-white">
            {transactionToEdit ? 'Editar Movimiento' : 'Nuevo Movimiento'}
          </h3>
          <button
            onClick={() => submission.close(onClose)} disabled={submission.saving}
            className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 cursor-pointer"
            aria-label="Cerrar modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} aria-busy={submission.saving}>
          <fieldset disabled={submission.saving} className="space-y-3">
          {submission.error && <p role="alert" className="text-amber-300">{submission.error}</p>}
          {submission.saving && <p role="status" className="text-sky-300">Guardando…</p>}
          {/* Segmented Type Toggle (Revolut Style) */}
          <div className="grid grid-cols-2 gap-1.5 bg-[#0c0f17] p-1 rounded-2xl border border-white/[0.06]">
            <button
              type="button"
              onClick={() => handleTypeChange('GASTO')}
              className={`py-2 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                type === 'GASTO'
                  ? 'bg-rose-500 text-white shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Gasto
            </button>
            <button
              type="button"
              onClick={() => handleTypeChange('INGRESO')}
              className={`py-2 rounded-xl font-bold text-xs transition-colors cursor-pointer ${
                type === 'INGRESO'
                  ? 'bg-emerald-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Ingreso
            </button>
          </div>

          {/* Amount input */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold block text-[11px]">
              Importe Total (€) <span className="text-rose-400">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                placeholder="0,00"
                value={amount || ''}
                onChange={e => setAmount(parseFloat(e.target.value) || 0)}
                className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2.5 text-base font-bold text-white focus:outline-none focus:border-sky-500"
              />
              <span className="absolute right-3 top-3 text-slate-400 font-bold">€</span>
            </div>
          </div>

          {/* Category / Partida Selection */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold block text-[11px]">
              Partida Presupuestaria <span className="text-rose-400">*</span>
            </label>
            <select
              value={code}
              onChange={e => setCode(e.target.value)}
              className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500 truncate cursor-pointer"
            >
              {filteredPartidas.map(p => (
                <option key={`${p.type}-${p.code}`} value={p.code}>
                  [{p.code}] {p.groupName}: {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Concept Description */}
          <div className="space-y-1">
            <label className="text-slate-400 font-semibold block text-[11px]">
              Concepto / Descripción <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              required
              placeholder="ej. Cena restaurante, Compra Zara, Supermercado..."
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* 🌟 Split / Shared Expense Section */}
          <div className="bg-[#0c0f17] rounded-2xl border border-white/[0.08] p-3 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-white text-xs">
                <input
                  type="checkbox"
                  checked={isShared}
                  onChange={e => setIsShared(e.target.checked)}
                  className="rounded text-sky-500 focus:ring-0 cursor-pointer accent-sky-500"
                />
                <span className="flex items-center gap-1.5">
                  <Users className="w-3.5 h-3.5 text-sky-400" />
                  ¿Gasto compartido / Dividir entre varios?
                </span>
              </label>

              {isShared && (
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-bold">
                  Activo
                </span>
              )}
            </div>

            {isShared && (
              <div className="space-y-3 pt-2 border-t border-white/[0.06] animate-fadeIn">
                {/* Total participants stepper */}
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-semibold text-white block text-[11px]">
                      Personas en total (contándote a ti)
                    </span>
                    <span className="text-[10px] text-slate-400">
                      Tú + {safeParticipantsCount - 1} {safeParticipantsCount - 1 === 1 ? 'amigo' : 'amigos'}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 bg-[#141926] p-1 rounded-xl border border-white/[0.06]">
                    <button
                      type="button"
                      disabled={totalParticipants <= 2}
                      onClick={() => setTotalParticipants(prev => Math.max(2, prev - 1))}
                      className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] disabled:opacity-30 text-white font-bold flex items-center justify-center cursor-pointer"
                    >
                      -
                    </button>
                    <span className="w-6 text-center font-bold text-white text-xs">
                      {totalParticipants}
                    </span>
                    <button
                      type="button"
                      onClick={() => setTotalParticipants(prev => prev + 1)}
                      className="w-7 h-7 rounded-lg bg-white/[0.06] hover:bg-white/[0.12] text-white font-bold flex items-center justify-center cursor-pointer"
                    >
                      +
                    </button>
                  </div>
                </div>

                {/* Calculation Preview Banner */}
                {amount > 0 && (
                  <div className="grid grid-cols-2 gap-2 bg-[#141926] p-2.5 rounded-xl border border-sky-500/20 text-center">
                    <div>
                      <span className="text-[10px] text-slate-400 font-medium block">Tu parte real</span>
                      <span className="text-xs font-black text-white">
                        {formatCurrency(myShare)}
                      </span>
                    </div>
                    <div className="border-l border-white/[0.06]">
                      <span className="text-[10px] text-slate-400 font-medium block">Te deben en total</span>
                      <span className="text-xs font-black text-emerald-400">
                        {formatCurrency(totalOwedToMe)}
                      </span>
                    </div>
                  </div>
                )}

                {/* Contact selection & quick add */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-slate-300">
                      ¿Quiénes participan? (Opcional)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowQuickContactInput(!showQuickContactInput)}
                      className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-1 cursor-pointer font-semibold"
                    >
                      <UserPlus className="w-3 h-3" />
                      <span>{showQuickContactInput ? 'Cancelar' : '+ Nuevo Contacto'}</span>
                    </button>
                  </div>

                  {/* Inline quick contact creator */}
                  {showQuickContactInput && (
                    <div className="flex items-center gap-1.5 bg-[#141926] p-1.5 rounded-xl border border-sky-500/30 animate-fadeIn">
                      <input
                        type="text"
                        placeholder="Nombre del nuevo contacto..."
                        value={newContactName}
                        onChange={e => setNewContactName(e.target.value)}
                        className="flex-1 bg-transparent text-white px-2 py-1 text-xs focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={handleCreateQuickContact}
                        disabled={!newContactName.trim()}
                        className="px-2.5 py-1 bg-sky-500 hover:bg-sky-400 disabled:opacity-40 text-slate-950 font-bold rounded-lg text-[10px] cursor-pointer"
                      >
                        Añadir
                      </button>
                    </div>
                  )}

                  {/* Contact Badges / Checkboxes */}
                  {contacts.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {contacts.map(c => {
                        const isSelected = selectedContactIds.includes(c.id);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleToggleContactSelection(c.id)}
                            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-all cursor-pointer ${
                              isSelected
                                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                                : 'bg-white/[0.04] text-slate-400 border-white/[0.06] hover:text-white'
                            }`}
                          >
                            <span
                              className={`w-2 h-2 rounded-full ${
                                isSelected ? 'bg-sky-400' : 'bg-slate-500'
                              }`}
                            />
                            <span>{c.name}</span>
                            {isSelected && (
                              <span className="text-[10px] text-emerald-400 font-bold ml-0.5">
                                ({formatCurrency(perPersonShare)})
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-[10px] text-slate-400">
                      No tienes contactos creados aún. Se asignarán como amigos anónimos o puedes pulsar "+ Nuevo Contacto".
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Wallet & Status */}
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Cartera u Origen</label>
              <select
                value={wallet}
                onChange={e => setWallet(e.target.value)}
                className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
              >
                {wallets.map(w => (
                  <option key={w.id} value={w.name}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-slate-400 mb-1 font-medium">Estado Tramitación</label>
              <select
                value={processed ? 'true' : 'false'}
                onChange={e => setProcessed(e.target.value === 'true')}
                className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
              >
                <option value="true">Tramitado (SÍ)</option>
                <option value="false">Pendiente (NO)</option>
              </select>
            </div>
          </div>

          {/* Date */}
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Fecha</label>
            <input
              type="date"
              required
              value={date}
              onChange={e => setDate(e.target.value)}
              className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-slate-400 mb-1 font-medium">Notas (opcional)</label>
            <input
              type="text"
              placeholder="Detalles adicionales..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500"
            />
          </div>

          {/* Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
            <button
              type="button"
              onClick={() => submission.close(onClose)} disabled={submission.saving}
              className="px-4 py-2.5 rounded-xl text-slate-400 hover:text-white cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="bg-white hover:bg-slate-100 text-slate-950 font-bold px-5 py-2.5 rounded-xl transition-all shadow active:scale-95 cursor-pointer"
            >
              {transactionToEdit ? 'Guardar Cambios' : 'Guardar Movimiento'}
            </button>
          </div>
          </fieldset>
        </form>
      </div>
    </div>
  );
};
