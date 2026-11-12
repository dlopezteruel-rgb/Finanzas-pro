import type { FinanceData } from '../utils/backup';
import { SubitemManager } from './SubitemManager';
import { monthlySubitems, subitemBudgetRows, subitemsFor, type SubitemEdit } from '../utils/budgetSubitems';
import { formatPlanningCents } from '../utils/planningMoney';
import { parsePlanningMoney } from '../utils/planning';
import { useAsyncForm } from '../utils/useAsyncForm';
import type { SaveResult } from '../utils/saveResult';
import { Overlay } from './Overlay';
import React, { useState, useEffect } from 'react';
import { BudgetPartida, MonthlyBudgetRow, Transaction, MovementType } from '../types/finance';
import { formatCurrency } from '../utils/finance';
import { X, Plus, Edit2, Trash2, Check, CheckCircle2, Clock, Calendar, ArrowRight } from 'lucide-react';

interface PartidaDetailModalProps {
  data: FinanceData;
  onEditSubitem: (edit:SubitemEdit)=>Promise<SaveResult>;
  isOpen: boolean;
  onClose: () => void;
  partida: BudgetPartida | null;
  budgetRow: MonthlyBudgetRow | null;
  transactions: Transaction[];
  monthYear: string;
  onEditTransaction: (tx: Transaction) => void;
  onDeleteTransaction: (id: string) => void;
  onToggleProcessed: (id: string) => void;
  onAddMovementToPartida: (partidaCode: string, type: MovementType, subitemId?:string) => void;
  onViewSharedDetails: (id: string) => void;
  error?: string;
  onUpdatePrevisto: (code: string, type: MovementType, amount: number) => Promise<SaveResult>;
}

export const PartidaDetailModal: React.FC<PartidaDetailModalProps> = ({
  data, onEditSubitem, isOpen,
  onClose,
  partida,
  budgetRow,
  transactions,
  monthYear,
  onEditTransaction,
  onDeleteTransaction,
  onToggleProcessed,
  onAddMovementToPartida,
  onUpdatePrevisto, onViewSharedDetails, error = '',
}) => {
  const [selectedSubitem,setSelectedSubitem]=useState<string|null>(null),[subitemBusy,setSubitemBusy]=useState(false);
  const [isEditingPrevisto, setIsEditingPrevisto] = useState(false);
  const [previstoInput, setPrevistoInput] = useState('0');
  const previstoSubmission = useAsyncForm();
  const [previstoError, setPrevistoError] = useState('');

  useEffect(() => {
    if (budgetRow) {
      setPrevistoInput((budgetRow.basePrevisto ?? budgetRow.previsto).toString());
    } else {
      setPrevistoInput('0');
    }
    setIsEditingPrevisto(false);
  }, [budgetRow, isOpen, partida]);

  useEffect(()=>{setSelectedSubitem(null);},[isOpen,partida?.code,partida?.type,monthYear]);

  if (!isOpen || !partida) return null;

  // Filter transactions for this partida in this month
  const partidaTransactions = transactions.filter(
    t => t.code === partida.code && t.type === partida.type && t.date.startsWith(monthYear) && (selectedSubitem===null || (t.subitemId ?? '')===selectedSubitem)
  ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const handleSavePrevisto = () => {
    try {
      const val = parsePlanningMoney(previstoInput) / 100;
      setPrevistoError('');
      void previstoSubmission.submit(() => onUpdatePrevisto(partida.code, partida.type, val), () => setIsEditingPrevisto(false));
    } catch (error) { setPrevistoError((error as Error).message); }
  };

  return (
    <Overlay title="Detalle de partida" level="panel" onClose={() => (!subitemBusy&&previstoSubmission.close(onClose))}>
      <div className="bg-[#141926] border border-white/10 max-w-xl w-full sm:w-[min(36rem,90vw)] h-dvh p-5 shadow-2xl text-xs space-y-4 flex flex-col overflow-y-auto subitem-detail">
        {/* Handle on mobile */}
        <div className="w-10 h-1 rounded-full bg-white/20 mx-auto sm:hidden -mt-1 mb-1" />

        {/* Header */}
        <div className="flex items-start justify-between pb-3 border-b border-white/[0.06]">
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-2">
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                partida.type === 'INGRESO'
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
              }`}>
                {partida.type}
              </span>
            </div>
            <h2 className="text-base font-bold text-white mt-1 truncate" title={partida.name}>
              {partida.name}
            </h2>
            <span className="text-[11px] text-slate-400 block mt-0.5">
              Paquete: {partida.groupName} • Periodo: {monthYear}
            </span>
          </div>

          <button
            onClick={() => (!subitemBusy&&previstoSubmission.close(onClose))}
            disabled={previstoSubmission.saving||subitemBusy}
            className="text-slate-400 hover:text-white p-1 rounded-full hover:bg-white/10 shrink-0"
            aria-label="Cerrar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {(previstoError || previstoSubmission.error) && <p role="alert">{previstoError || previstoSubmission.error}</p>}
        {error && <p role="alert" className="text-amber-300">{error}</p>}
        {!!budgetRow?.arrastre&&<p>Base {formatCurrency(budgetRow.basePrevisto)} + arrastre {formatCurrency(budgetRow.arrastre)} = efectivo {formatCurrency(budgetRow.previsto)}. Editar previsto modifica solo la base.</p>}
        {/* Metrics Grid */}
        <div className="grid grid-cols-3 gap-2 bg-[#0c0f17] p-3 rounded-2xl border border-white/[0.06]">
          {/* Previsto */}
          <div>
            <span className="text-[10px] text-slate-400 block">Previsto</span>
            {isEditingPrevisto ? (
              <div className="flex items-center gap-1 mt-0.5">
                <input
                  aria-label="Previsto de la partida"
                  inputMode="decimal"
                  disabled={previstoSubmission.saving||subitemBusy}
                  value={previstoInput}
                  onChange={e => setPrevistoInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') handleSavePrevisto();
                    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); setIsEditingPrevisto(false); }
                  }}
                  className="w-16 bg-[#161c2b] border border-sky-500 rounded px-1.5 py-0.5 text-xs text-white font-mono text-right"
                  autoFocus
                />
                <button aria-label="Guardar previsto de la partida" disabled={previstoSubmission.saving||subitemBusy} onClick={handleSavePrevisto} className="text-emerald-400 p-0.5">
                  <Check className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 mt-0.5 group">
                <span className="font-mono font-bold text-sm text-slate-200">
                  {formatCurrency(budgetRow?.previsto || 0)}
                </span>
                <button
                  onClick={() => {
                    setPrevistoInput((budgetRow?.basePrevisto ?? budgetRow?.previsto ?? 0).toString());
                    setIsEditingPrevisto(true);
                  }}
                  className="text-slate-400 hover:text-white p-0.5 opacity-60 group-hover:opacity-100"
                  disabled={!!monthlySubitems(data,monthYear,partida)}
                  title={monthlySubitems(data,monthYear,partida)?"Base calculada: edita el desglose en Planificación":"Editar previsto"}
                >
                  <Edit2 className="w-2.5 h-2.5" />
                </button>
              </div>
            )}
          </div>

          {/* Ejecutado */}
          <div>
            <span className="text-[10px] text-slate-400 block">Ejecutado</span>
            <span className="font-mono font-bold text-sm text-white mt-0.5 block">
              {formatCurrency(budgetRow?.ejecutado || 0)}
            </span>
          </div>

          {/* Resto */}
          <div className="text-right">
            <span className="text-[10px] text-slate-400 uppercase font-semibold block">RESTO</span>
            <span className={`font-mono font-black text-sm mt-0.5 block ${
              partida.type === 'GASTO'
                ? (budgetRow?.resto || 0) < 0
                  ? 'text-rose-400'
                  : 'text-emerald-400'
                : (budgetRow?.resto || 0) <= 0
                ? 'text-emerald-400'
                : 'text-amber-400'
            }`}>
              {formatCurrency(budgetRow?.resto || 0)}
            </span>
          </div>
        </div>

        <SubitemManager data={data} partida={partida} onEdit={onEditSubitem} onBusy={setSubitemBusy}/>
        {subitemsFor(data,partida).length>0&&<section className="subitem-breakdown" aria-label="Desglose de subítems">
          <h3>Subítems · {monthYear}</h3>
          {!monthlySubitems(data,monthYear,partida)&&<p role="status">Pendiente de desglose mensual. La previsión global se conserva sin repartir; distribúyela explícitamente en Planificación.</p>}
          <p>Ejecutado: solo tramitados, parte propia en gastos compartidos. Resto = previsto − ejecutado; desviación = ejecutado − previsto.</p>
          {subitemBudgetRows(data,monthYear,partida).map(r=><div className="subitem-summary-row" key={r.id ?? 'unassigned'}>
            <strong>{r.name}{r.archived?' · Archivado':''}</strong><span>Previsto: {formatPlanningCents(r.planned)}</span><span>Ejecutado: {formatPlanningCents(r.executed)}</span><span>Resto: {formatPlanningCents(r.remainder)}</span><span>Desviación: {formatPlanningCents(r.deviation)}</span>
            <button type="button" aria-pressed={selectedSubitem===(r.id ?? '')} onClick={()=>setSelectedSubitem(r.id ?? '')}>Ver movimientos de {r.name}</button>
            {!r.archived&&<button type="button" onClick={()=>onAddMovementToPartida(partida.code,partida.type,r.id)}>Registrar en {r.name}</button>}
          </div>)}
          {selectedSubitem!==null&&<button type="button" onClick={()=>setSelectedSubitem(null)}>Ver todos los movimientos de la partida</button>}
        </section>}
        {/* Action button to add movement directly to this partida */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
            Movimientos ({partidaTransactions.length})
          </span>
          <button
            onClick={() => onAddMovementToPartida(partida.code, partida.type)}
            className="bg-white/[0.08] hover:bg-white/[0.15] text-sky-400 hover:text-white text-xs font-bold px-3 py-1.5 rounded-xl border border-white/[0.08] transition-colors flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Añadir a esta partida</span>
          </button>
        </div>

        {/* Movements Scroll List */}
        <div className="space-y-2 pr-1">
          {partidaTransactions.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-xs">
              No hay movimientos registrados en esta partida para este mes.
            </div>
          ) : (
            partidaTransactions.map(t => (
              <div
                key={t.id} data-movement-id={t.id}
                className="bg-[#0c0f17] border border-white/[0.04] rounded-xl p-3 flex items-center justify-between gap-3 hover:border-white/[0.1] transition-colors"
              >
                {/* Movement Details */}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-bold text-white truncate" title={t.description}>
                      {t.description}
                    </span>
                  </div>
                  {t.splitInfo?.isShared && <div className="flex flex-wrap items-center gap-2 mt-1"><span className="rounded-full bg-sky-500/15 px-2 py-1 text-[10px] text-sky-300">Compartido</span><button className="text-sky-300 underline text-xs" onClick={() => onViewSharedDetails(t.id)}>Ver reparto</button></div>}
                  {(t.transfer || t.reimbursement) && <p className="text-xs text-sky-300">{t.transfer ? 'Traspaso interno' : 'Reintegro'} · sin efecto presupuestario</p>}
                  <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                    <span className="text-slate-300 font-semibold">{t.wallet}</span>
                    <span>•</span>
                    <span>{t.date}</span>
                    {t.notes && (
                      <>
                        <span>•</span>
                        <span className="truncate max-w-[140px] italic">{t.notes}</span>
                      </>
                    )}
                  </div>
                </div>

                {/* Amount, status & edit/delete actions */}
                <div className="flex items-center gap-2 shrink-0">
                  <div className="text-right">
                    {t.splitInfo?.isShared ? <div className="text-xs space-y-1"><p>Total pagado: <strong>{formatCurrency(t.amount)}</strong></p><p>Tu gasto: <strong>{formatCurrency(t.processed ? t.splitInfo.accountingVersion === '2.7' ? t.splitInfo.myShare : t.amount : 0)}</strong></p>
                      {t.splitInfo.accountingVersion !== '2.7' && <p className="text-amber-300 text-[10px]">Histórico sin migrar: se imputa el total.</p>}</div> : <span className={`text-xs sm:text-sm font-bold font-mono block ${t.type === 'INGRESO' ? 'text-emerald-400' : 'text-white'}`}>{t.type === 'INGRESO' ? '+' : '-'}{formatCurrency(t.amount)}</span>}

                    <button
                      type="button"
                      onClick={() => onToggleProcessed(t.id)}
                      className={`inline-flex items-center gap-1 text-[9px] font-semibold px-2 py-0.5 rounded-full transition-all cursor-pointer ${
                        t.processed
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-300 border border-amber-500/30'
                      }`}
                      title="Alternar estado de tramitación"
                    >
                      <span className={`w-1 h-1 rounded-full ${t.processed ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                      <span>{t.processed ? 'SÍ' : 'NO'}</span>
                    </button>
                  </div>

                  {/* Edit action */}
                  <button
                    onClick={() => onEditTransaction(t)}
                    className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-white/[0.12] text-slate-300 hover:text-white transition-colors cursor-pointer"
                    title="Editar movimiento"
                    aria-label="Editar movimiento"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {/* Delete action */}
                  <button
                    onClick={() => onDeleteTransaction(t.id)}
                    className="p-1.5 rounded-lg bg-white/[0.05] hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 transition-colors cursor-pointer"
                    title="Eliminar movimiento"
                    aria-label="Eliminar movimiento"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </Overlay>
  );
};
