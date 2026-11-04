import { Overlay } from './Overlay';
import { useAsyncForm } from '../utils/useAsyncForm';
import type { SaveResult } from '../utils/saveResult';
import { parseTransferAmount } from '../utils/transfers';
import React, { useState, useMemo } from 'react';
import { Contact, Transaction, Wallet, SplitParticipant } from '../types/finance';
import { formatCurrency } from '../utils/finance';
import {
  Users,
  UserPlus,
  Search,
  CheckCircle2,
  Clock,
  ArrowDownLeft,
  ChevronRight,
  ChevronDown,
  Trash2,
  Edit2,
  Phone,
  Mail,
  Receipt,
  Sparkles,
  TrendingUp,
  X,
} from 'lucide-react';
import { DebtItemToSettle } from './SettleDebtModal';

interface ContactsViewProps {
  contacts: Contact[];
  transactions: Transaction[];
  wallets: Wallet[];
  onOpenCreateContact: (contact?: Contact | null) => void;
  onDeleteContact: (id: string) => void;
  onOpenSettleDebt: (debtItem: DebtItemToSettle) => void;
  onOpenNewSharedTransaction: (preselectedContactId?: string) => void;
  onEditTransaction?: (tx: Transaction) => void;
  onUpdateDebtAmount?: (transactionId: string, contactId: string, newAmount: number) => Promise<SaveResult>;
  onEditSettlement: (expenseId: string, id: string, deleting?: boolean) => void;
}

export const ContactsView: React.FC<ContactsViewProps> = ({
  contacts,
  transactions,
  wallets,
  onOpenCreateContact,
  onDeleteContact,
  onOpenSettleDebt,
  onOpenNewSharedTransaction,
  onEditTransaction,
  onUpdateDebtAmount, onEditSettlement,
}) => {
  const debtSubmission = useAsyncForm();
  const [searchQuery, setSearchQuery] = useState('');
  const [expandedContactId, setExpandedContactId] = useState<string | null>(null);
  const [editingDebt, setEditingDebt] = useState<{
    transactionId: string;
    contactId: string;
    description: string;
    currentAmount: number;
  } | null>(null);
  const [newDebtAmountInput, setNewDebtAmountInput] = useState('');

  // Calculate detailed debts for each contact
  const contactsWithDebts = useMemo(() => {
    return contacts.map(c => {
      // Find all transaction split items for this contact
      const pendingDebts: DebtItemToSettle[] = [];
      const settledDebts: {
        item: DebtItemToSettle;
        paidDate?: string;
      }[] = [];

      transactions.forEach(t => {
        if (!t.splitInfo || !t.splitInfo.participants || (t.splitInfo.accountingVersion === '2.7' && !t.processed)) return;
        t.splitInfo.participants.forEach(p => {
          if (p.contactId === c.id) {
            const debtItem: DebtItemToSettle = {
              transactionId: t.id,
              transactionDescription: t.description,
              transactionCode: t.code,
              transactionCategory: t.categoryName,
              transactionSubcategory: t.subcategoryName,
              participant: p,
              contact: c,
            };

            if (p.isPaid) {
              settledDebts.push({ item: debtItem, paidDate: p.paidDate });
            } else {
              pendingDebts.push(debtItem);
            }
          }
        });
      });

      const totalPendingAmount = pendingDebts.reduce((sum, d) => sum + Math.round((d.participant.remainingAmount ?? d.participant.amount) * 100), 0) / 100;
      const totalSettledAmount = transactions.reduce((sum, t) => sum + (t.splitInfo?.accountingVersion === '2.7' ? (t.splitInfo.settlements ?? []).filter(s => s.contactId === c.id && s.processed).reduce((n, s) => n + Math.round(s.amount * 100), 0) / 100 : 0), 0) + settledDebts.filter(d => !transactions.find(t => t.id === d.item.transactionId)?.splitInfo?.accountingVersion).reduce((sum, d) => sum + d.item.participant.amount, 0);

      // Group pending debts by Category/Partida for clear insight (e.g., Restaurante vs Ropa)
      const debtsByCategory: { [key: string]: { category: string; code: string; total: number; count: number } } = {};
      pendingDebts.forEach(d => {
        const key = `${d.transactionCode}-${d.transactionSubcategory}`;
        if (!debtsByCategory[key]) {
          debtsByCategory[key] = {
            category: `${d.transactionCategory} · ${d.transactionSubcategory}`,
            code: d.transactionCode,
            total: 0,
            count: 0,
          };
        }
        debtsByCategory[key].total = Math.round((debtsByCategory[key].total * 100) + Math.round((d.participant.remainingAmount ?? d.participant.amount) * 100)) / 100;
        debtsByCategory[key].count += 1;
      });

      return {
        contact: c,
        pendingDebts,
        settledDebts,
        totalPendingAmount,
        totalSettledAmount,
        debtsByCategory: Object.values(debtsByCategory),
      };
    });
  }, [contacts, transactions]);

  // Overall metrics
  const totalPendingOwed = useMemo(() => {
    return contactsWithDebts.reduce((sum, c) => sum + Math.round(c.totalPendingAmount * 100), 0) / 100;
  }, [contactsWithDebts]);

  const debtorsCount = useMemo(() => {
    return contactsWithDebts.filter(c => c.totalPendingAmount > 0).length;
  }, [contactsWithDebts]);

  // Filtered contacts
  const filteredContacts = useMemo(() => {
    if (!searchQuery.trim()) return contactsWithDebts;
    const q = searchQuery.toLowerCase();
    return contactsWithDebts.filter(
      c =>
        c.contact.name.toLowerCase().includes(q) ||
        (c.contact.phoneOrEmail && c.contact.phoneOrEmail.toLowerCase().includes(q)) ||
        (c.contact.notes && c.contact.notes.toLowerCase().includes(q))
    );
  }, [contactsWithDebts, searchQuery]);

  return (
    <div className="space-y-4 pb-16 animate-fadeIn">
      {/* Top Banner Card (Revolut Fintech Style) */}
      <div className="bg-gradient-to-br from-[#141926] via-[#161e31] to-[#121724] border border-white/10 rounded-3xl p-5 shadow-xl relative overflow-hidden">
        <div className="absolute -right-6 -bottom-6 w-32 h-32 bg-sky-500/10 rounded-full blur-2xl pointer-events-none" />

        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-sky-400 font-semibold tracking-wide uppercase">
              <Users className="w-3.5 h-3.5" />
              <span>Contactos y Cuentas Compartidas</span>
            </div>
            <div className="text-2xl sm:text-3xl font-black text-white tracking-tight">
              {formatCurrency(totalPendingOwed)}
            </div>
            <p className="text-xs text-slate-400">
              {debtorsCount === 0
                ? 'Nadie te debe dinero actualmente · Cuentas al día'
                : `${debtorsCount} ${debtorsCount === 1 ? 'persona te debe' : 'personas te deben'} dinero en gastos compartidos`}
            </p>
          </div>

          <button
            onClick={() => onOpenCreateContact(null)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs shadow-lg shadow-sky-500/20 transition-all active:scale-95 cursor-pointer"
          >
            <UserPlus className="w-4 h-4" />
            <span>Nuevo Contacto</span>
          </button>
        </div>
      </div>

      {/* Search Bar & Quick Filter */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
          <input
            type="text"
            placeholder="Buscar contactos o teléfono..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-[#141926] text-white placeholder-slate-400 text-xs pl-9 pr-4 py-2.5 rounded-2xl border border-white/[0.08] focus:outline-none focus:border-sky-500"
          />
        </div>
        <button
          onClick={() => onOpenNewSharedTransaction()}
          className="px-3.5 py-2.5 bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 text-xs font-semibold rounded-2xl border border-white/[0.08] flex items-center gap-1.5 cursor-pointer"
          title="Crear un gasto compartido"
        >
          <Receipt className="w-4 h-4 text-sky-400" />
          <span className="hidden sm:inline">Dividir Gasto</span>
        </button>
      </div>

      {/* Contact Cards List */}
      <div className="space-y-3">
        {filteredContacts.length === 0 ? (
          <div className="bg-[#141926] border border-white/[0.06] rounded-2xl p-8 text-center space-y-2">
            <Users className="w-8 h-8 text-slate-500 mx-auto" />
            <p className="text-sm font-semibold text-white">No hay contactos registrados</p>
            <p className="text-xs text-slate-400">
              Añade contactos para gestionar deudas de comidas, viajes o compras compartidas.
            </p>
            <button
              onClick={() => onOpenCreateContact(null)}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-sky-500 text-slate-950 font-bold text-xs cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5" />
              <span>Añadir primer contacto</span>
            </button>
          </div>
        ) : (
          filteredContacts.map(
            ({ contact, pendingDebts, settledDebts, totalPendingAmount, totalSettledAmount, debtsByCategory }) => {
              const isExpanded = expandedContactId === contact.id;

              return (
                <div
                  key={contact.id}
                  className={`bg-[#141926] border transition-all rounded-2xl overflow-hidden ${
                    totalPendingAmount > 0
                      ? 'border-sky-500/20 shadow-sm'
                      : 'border-white/[0.06]'
                  }`}
                >
                  {/* Contact Summary Header */}
                  <div
                    onClick={() => setExpandedContactId(isExpanded ? null : contact.id)}
                    className="p-3.5 sm:p-4 flex items-center justify-between gap-3 cursor-pointer hover:bg-white/[0.02]"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-10 h-10 rounded-full bg-gradient-to-tr ${
                          contact.avatarColor || 'from-sky-500 to-indigo-600'
                        } flex items-center justify-center text-white font-bold text-sm shadow-md ring-1 ring-white/20 shrink-0`}
                      >
                        {contact.name.slice(0, 2).toUpperCase()}
                      </div>

                      <div className="space-y-0.5">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-sm text-white">{contact.name}</span>
                          {pendingDebts.length > 0 && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/20 font-semibold">
                              {pendingDebts.length} {pendingDebts.length === 1 ? 'deuda' : 'deudas'}
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-2">
                          {contact.phoneOrEmail && <span>{contact.phoneOrEmail}</span>}
                          {contact.notes && <span className="text-slate-500 truncate max-w-[150px]">{contact.notes}</span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        {totalPendingAmount > 0 ? (
                          <>
                            <div className="text-xs text-slate-400 font-medium">Te debe</div>
                            <div className="text-base font-black text-emerald-400">
                              {formatCurrency(totalPendingAmount)}
                            </div>
                          </>
                        ) : (
                          <div className="flex items-center gap-1 text-xs text-slate-400 font-medium bg-white/[0.03] px-2.5 py-1 rounded-full border border-white/[0.06]">
                            <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                            <span>Al día</span>
                          </div>
                        )}
                      </div>

                      <div className="text-slate-400 hover:text-white p-1">
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 text-sky-400" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail Panel */}
                  {isExpanded && (
                    <div className="border-t border-white/[0.06] bg-[#0c0f17]/60 p-4 space-y-4 animate-fadeIn text-xs">
                      {/* Breakdown by Partida / Category (Restaurante vs Ropa vs otros) */}
                      {debtsByCategory.length > 0 && (
                        <div className="space-y-1.5">
                          <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Resumen de deudas por partida
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {debtsByCategory.map(cat => (
                              <div
                                key={cat.code}
                                className="bg-[#141926] p-2.5 rounded-xl border border-white/[0.06] flex items-center justify-between"
                              >
                                <div className="space-y-0.5">
                                  <span className="font-semibold text-white block text-xs">
                                    {cat.category}
                                  </span>
                                  <span className="text-[10px] font-mono text-sky-400">
                                    {cat.code} ({cat.count} {cat.count === 1 ? 'concepto' : 'conceptos'})
                                  </span>
                                </div>
                                <span className="font-bold text-emerald-400 text-sm">
                                  {formatCurrency(cat.total)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Detailed Pending Debts List */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                            Deudas pendientes ({pendingDebts.length})
                          </span>
                          {pendingDebts.length > 1 && (
                            <span className="text-[10px] text-slate-400">
                              Puedes saldarlas individualmente
                            </span>
                          )}
                        </div>

                        {pendingDebts.length === 0 ? (
                          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/[0.04] text-center text-slate-400">
                            No hay deudas pendientes con este contacto.
                          </div>
                        ) : (
                          <div className="space-y-2">
                            {pendingDebts.map(debt => (
                              <div
                                key={`${debt.transactionId}-${debt.participant.contactId}`}
                                onClick={() => {
                                  debtSubmission.clearError();
                                  setEditingDebt({
                                    transactionId: debt.transactionId,
                                    contactId: debt.participant.contactId,
                                    description: debt.transactionDescription,
                                    currentAmount: debt.participant.amount,
                                  });
                                  setNewDebtAmountInput(debt.participant.amount.toString());
                                }}
                                className="bg-[#141926] p-3 rounded-xl border border-sky-500/20 hover:border-sky-500/40 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 transition-all cursor-pointer group"
                              >
                                <div className="space-y-1">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold text-white text-xs group-hover:text-sky-300 transition-colors">
                                      {debt.transactionDescription}
                                    </span>
                                    <span className="text-[10px] px-2 py-0.2 rounded-full bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                      Pendiente
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-400 flex items-center gap-2">
                                    <span className="font-mono text-sky-400">{debt.transactionCode}</span>
                                    <span>·</span>
                                    <span>{debt.transactionSubcategory}</span>
                                    <span>•</span>
                                    <span className="text-slate-500">Clica para editar</span>
                                  </div>
                                </div>

                                <div className="flex items-center justify-between sm:justify-end gap-2.5 pt-1 sm:pt-0 border-t sm:border-0 border-white/[0.04]">
                                  <div className="text-right">
                                    <div className="text-sm font-black text-emerald-400">
                                      {formatCurrency(debt.participant.remainingAmount ?? debt.participant.amount)}
                                    </div>
                                  </div>

                                  <button
                                    type="button"
                                    onClick={e => {
                                      e.stopPropagation();
                                      debtSubmission.clearError();
                                      setEditingDebt({
                                        transactionId: debt.transactionId,
                                        contactId: debt.participant.contactId,
                                        description: debt.transactionDescription,
                                        currentAmount: debt.participant.amount,
                                      });
                                      setNewDebtAmountInput(debt.participant.amount.toString());
                                    }}
                                    className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-sky-500/10 text-slate-400 hover:text-sky-400 border border-white/[0.06] transition-colors cursor-pointer"
                                    title="Editar importe de la deuda"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>

                                  <button
                                    onClick={e => {
                                      e.stopPropagation();
                                      onOpenSettleDebt(debt);
                                    }}
                                    className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/10 transition-colors cursor-pointer shrink-0"
                                  >
                                    <ArrowDownLeft className="w-3.5 h-3.5" />
                                    <span>Saldar deuda</span>
                                  </button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Settled Debts History */}
                      {settledDebts.length > 0 && (
                        <div className="space-y-1.5 pt-2 border-t border-white/[0.06]">
                          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                            Historial saldado recientemente ({settledDebts.length})
                          </span>
                          <div className="space-y-1.5 opacity-80">
                            {settledDebts.map(({ item, paidDate }) => (
                              <div
                                key={`${item.transactionId}-settled`}
                                className="bg-[#141926]/50 p-2.5 rounded-xl border border-white/[0.04] flex items-center justify-between text-xs"
                              >
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5">
                                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                                    <span className="text-slate-300 font-medium">
                                      {item.transactionDescription}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-500">
                                    {item.transactionSubcategory} · Saldado {paidDate || '✓'}
                                  </span>
                                </div>
                                <span className="font-semibold text-slate-300 line-through">
                                  {formatCurrency(item.participant.amount)}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {transactions.flatMap(t => (t.splitInfo?.settlements ?? []).filter(s => s.contactId === contact.id).map(s => <div key={s.id} className="flex gap-2 items-center text-slate-300">
                        <span>{s.kind === 'cash' ? 'Reintegro' : 'Compensación'} · {formatCurrency(s.amount)} · {s.date} · {s.processed ? 'Tramitado' : 'Pendiente'}</span>
                        <button aria-label={`Editar liquidación ${s.id}`} className="text-sky-300" onClick={() => onEditSettlement(t.id, s.id)}>Editar</button>
                        <button aria-label={`Eliminar liquidación ${s.id}`} className="text-rose-300" onClick={() => onEditSettlement(t.id, s.id, true)}>Eliminar</button>
                      </div>))}
                      {/* Bottom actions for this contact */}
                      <div className="flex items-center justify-between pt-2 border-t border-white/[0.06]">
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => onOpenCreateContact(contact)}
                            className="px-2.5 py-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.08] text-slate-300 flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Edit2 className="w-3 h-3 text-sky-400" />
                            <span>Editar</span>
                          </button>
                          <button
                            onClick={() => onDeleteContact(contact.id)}
                            className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                            <span>Eliminar</span>
                          </button>
                        </div>

                        <button
                          onClick={() => onOpenNewSharedTransaction(contact.id)}
                          className="px-3 py-1.5 rounded-xl bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/20 font-semibold flex items-center gap-1.5 cursor-pointer"
                        >
                          <Receipt className="w-3.5 h-3.5 text-sky-400" />
                          <span>Dividir nuevo gasto con {contact.name.split(' ')[0]}</span>
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            }
          )
        )}
      </div>

      {/* Quick Edit Pending Debt Modal */}
      {editingDebt && (
        <Overlay title="Corregir deuda" onClose={() => debtSubmission.close(() => setEditingDebt(null))}>
          <div role="dialog" aria-modal="true" aria-label="Corregir deuda" className="bg-[#141926] border border-white/10 rounded-3xl max-w-sm w-full p-5 shadow-2xl text-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-white/[0.06]">
              <div>
                <h3 className="text-sm font-bold text-white">Editar Deuda Pendiente</h3>
                <p className="text-[11px] text-slate-400 truncate max-w-[240px]">
                  {editingDebt.description}
                </p>
              </div>
              <button
                onClick={() => debtSubmission.close(() => setEditingDebt(null))} disabled={debtSubmission.saving}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <fieldset disabled={debtSubmission.saving} className="space-y-3">
              {debtSubmission.error && <p role="alert" className="text-amber-300">{debtSubmission.error}</p>}
              <p>Corrige la deuda total de esta persona. La parte propia se ajustará para conservar el total pagado; los cobros ya registrados no se modificarán.</p>
              <div>
                <label className="block text-slate-400 mb-1 font-medium">
                  Importe que debe el contacto (€)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    aria-label="Deuda total del participante (€)"
                    value={newDebtAmountInput}
                    onChange={e => setNewDebtAmountInput(e.target.value)}
                    className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white font-mono text-base font-bold focus:outline-none focus:border-sky-500 pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">
                    €
                  </span>
                </div>
              </div>

              {onEditTransaction && (
                <button
                  type="button"
                  onClick={() => {
                    const tx = transactions.find(t => t.id === editingDebt.transactionId);
                    if (tx) {
                      setEditingDebt(null);
                      onEditTransaction(tx);
                    }
                  }}
                  className="w-full py-2 px-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] text-sky-400 text-[11px] font-semibold flex items-center justify-center gap-1.5 cursor-pointer border border-white/[0.06]"
                >
                  <Receipt className="w-3.5 h-3.5" />
                  <span>Editar movimiento completo</span>
                </button>
              )}

              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/[0.06]">
                <button
                  type="button"
                  onClick={() => debtSubmission.close(() => setEditingDebt(null))} disabled={debtSubmission.saving}
                  className="py-2 px-3 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] text-slate-200 font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (onUpdateDebtAmount) void debtSubmission.submit(() => onUpdateDebtAmount(editingDebt.transactionId, editingDebt.contactId, parseTransferAmount(newDebtAmountInput)), () => setEditingDebt(null));
                  }}
                  className="py-2 px-3 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold flex items-center justify-center gap-1 cursor-pointer"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Guardar</span>
                </button>
              </div>
            </fieldset>
          </div>
        </Overlay>
      )}
    </div>
  );
};
