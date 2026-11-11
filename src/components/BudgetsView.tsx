import { parsePlanningMoney } from '../utils/planning';
import { Overlay } from './Overlay';
import { useAsyncForm } from '../utils/useAsyncForm';
import type { SaveResult } from '../utils/saveResult';
import React, { useState, useMemo } from 'react';
import {
  MonthlySummary,
  MonthlyBudgetRow,
  BudgetGroup,
  BudgetPartida,
  MovementType
} from '../types/finance';
import { formatCurrency } from '../utils/finance';
import {
  ChevronDown,
  ChevronUp,
  ArrowUp,
  ArrowDown,
  Copy,
  FolderInput,
  Edit2,
  Check,
  X,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Plus
} from 'lucide-react';

interface BudgetsViewProps {
  currentMonthYear: string;
  summary: MonthlySummary;
  budgetRows: MonthlyBudgetRow[];
  budgetGroups: BudgetGroup[];
  onUpdateBudgetPlan: (code: string, type: MovementType, amount: number) => Promise<SaveResult>;
  onMovePartida: (groupCode: string, partidaIndex: number, direction: 'UP' | 'DOWN') => Promise<SaveResult>;
  onDuplicatePartida: (partida: BudgetPartida) => Promise<SaveResult>;
  onChangePartidaGroup: (partida: BudgetPartida, targetGroupCode: string) => Promise<SaveResult>;
  onSelectPartidaToView: (partida: BudgetPartida, row: MonthlyBudgetRow) => void;
}

export const BudgetsView: React.FC<BudgetsViewProps> = ({
  currentMonthYear,
  summary,
  budgetRows,
  budgetGroups,
  onUpdateBudgetPlan,
  onMovePartida,
  onDuplicatePartida,
  onChangePartidaGroup,
  onSelectPartidaToView,
}) => {
  const [activeTab, setActiveTab] = useState<'GASTO' | 'INGRESO'>('GASTO');
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editValue, setEditValue] = useState<string>('');
  const editSubmission = useAsyncForm();
  const [editError, setEditError] = useState('');

  // Moving out of package confirmation state
  const [movingPartida, setMovingPartida] = useState<BudgetPartida | null>(null);
  const [targetGroupCode, setTargetGroupCode] = useState<string>('');
  const moveSubmission = useAsyncForm();
  const catalogSubmission = useAsyncForm();

  // Quick lookup of budget rows by key
  const rowMap = useMemo(() => {
    const map: Record<string, MonthlyBudgetRow> = {};
    budgetRows.forEach(r => {
      map[`${r.type}:${r.code}`] = r;
    });
    return map;
  }, [budgetRows]);

  // Filter groups by active tab
  const filteredGroups = useMemo(() => {
    return budgetGroups.filter(g => g.type === activeTab);
  }, [budgetGroups, activeTab]);

  // Toggle accordion group open/close
  const toggleGroup = (groupCode: string) => {
    setOpenGroups(prev => {
      // Default open if not touched yet
      const current = prev[groupCode] ?? true;
      return { ...prev, [groupCode]: !current };
    });
  };

  const isGroupOpen = (groupCode: string) => {
    return openGroups[groupCode] ?? true;
  };

  const handleExpandAll = (expand: boolean) => {
    const next: Record<string, boolean> = {};
    filteredGroups.forEach(g => {
      next[g.code] = expand;
    });
    setOpenGroups(next);
  };

  const startEdit = (row: MonthlyBudgetRow) => {
    setEditingKey(`${row.type}:${row.code}`);
    setEditValue((row.basePrevisto ?? row.previsto).toString());
  };

  const saveEdit = (row: MonthlyBudgetRow) => {
    try {
      const val = parsePlanningMoney(editValue) / 100;
      setEditError('');
      void editSubmission.submit(() => onUpdateBudgetPlan(row.code, row.type, val), () => setEditingKey(null));
    } catch (error) { setEditError((error as Error).message); }
  };

  return (
    <div className="catalog-view space-y-4 pb-16 md:pb-6">
      {(editError || editSubmission.error) && <p role="alert">{editError || editSubmission.error}</p>}
      {catalogSubmission.error && <p role="alert">{catalogSubmission.error}</p>}
      {catalogSubmission.saving && <p role="status">Guardando catálogo…</p>}
      {/* 1. Top Summary Banner */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="bg-[#141926] border border-white/[0.06] rounded-2xl p-3">
          <span className="text-[10px] text-slate-400 font-medium block">Balance Real Mes</span>
          <span className={`text-base sm:text-lg font-black font-mono mt-0.5 block ${
            summary.balanceReal >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {summary.balanceReal >= 0 ? '+' : ''}{formatCurrency(summary.balanceReal)}
          </span>
          <span className="text-[9px] text-slate-400 mt-1 block">
            Ingr: {formatCurrency(summary.ingresosReales)}
          </span>
        </div>

        <div className="bg-[#141926] border border-white/[0.06] rounded-2xl p-3">
          <span className="text-[10px] text-slate-400 font-medium block">Balance Previsto</span>
          <span className="text-base sm:text-lg font-black font-mono text-sky-400 mt-0.5 block">
            {formatCurrency(summary.balancePrevisto)}
          </span>
          <span className="text-[9px] text-slate-400 mt-1 block">
            Ingr. prev: {formatCurrency(summary.ingresosPrevistos)}
          </span>
        </div>

        <div className="bg-[#141926] border border-white/[0.06] rounded-2xl p-3">
          <span className="text-[10px] text-slate-400 font-medium block">Margen / Resto Total</span>
          <span className={`text-base sm:text-lg font-black font-mono mt-0.5 block ${
            summary.restoTotal >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}>
            {summary.restoTotal >= 0 ? '+' : ''}{formatCurrency(summary.restoTotal)}
          </span>
          <span className="text-[9px] text-slate-400 mt-1 block">
            PREVISTO - EJECUTADO
          </span>
        </div>

        <div className="bg-[#141926] border border-white/[0.06] rounded-2xl p-3">
          <span className="text-[10px] text-slate-400 font-medium block">Tasa de Ahorro</span>
          <span className="text-base sm:text-lg font-black font-mono text-white mt-0.5 block">
            {summary.tasaAhorroReal}%
          </span>
          <span className="text-[9px] text-emerald-400 mt-1 block">
            Prevista: {summary.tasaAhorroPrevista}%
          </span>
        </div>
      </div>

      {/* 2. Type Selector Tabs & Expand/Collapse Controls */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {/* Gastos vs Ingresos Segmented Toggle */}
        <div className="flex items-center gap-1.5 bg-[#141926] p-1 rounded-2xl border border-white/[0.06]">
          <button
            onClick={() => setActiveTab('GASTO')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'GASTO'
                ? 'bg-rose-500 text-white shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Paquetes de Gastos ({budgetGroups.filter(g => g.type === 'GASTO').length})
          </button>
          <button
            onClick={() => setActiveTab('INGRESO')}
            className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'INGRESO'
                ? 'bg-emerald-500 text-slate-950 shadow'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            Paquetes de Ingresos ({budgetGroups.filter(g => g.type === 'INGRESO').length})
          </button>
        </div>

        {/* Expand / Collapse All buttons */}
        <div className="flex items-center gap-1 text-[11px] text-slate-400">
          <button
            onClick={() => handleExpandAll(true)}
            className="hover:text-white underline cursor-pointer px-1"
          >
            Desplegar todos
          </button>
          <span>•</span>
          <button
            onClick={() => handleExpandAll(false)}
            className="hover:text-white underline cursor-pointer px-1"
          >
            Contraer todos
          </button>
        </div>
      </div>

      {/* 3. Collapsible Packages List */}
      <div className="catalog-families">
        {filteredGroups.map(group => {
          const isOpen = isGroupOpen(group.code);

          // Calculate package totals
          let pkgPrevisto = 0;
          let pkgEjecutado = 0;
          group.partidas.forEach(p => {
            const row = rowMap[`${p.type}:${p.code}`];
            if (row) {
              pkgPrevisto += row.previsto;
              pkgEjecutado += row.ejecutado;
            }
          });
          pkgPrevisto = Math.round(pkgPrevisto * 100) / 100;
          pkgEjecutado = Math.round(pkgEjecutado * 100) / 100;
          const pkgResto = Math.round((pkgPrevisto - pkgEjecutado) * 100) / 100;
          const pkgPercent = pkgPrevisto > 0 ? Math.round((pkgEjecutado / pkgPrevisto) * 100) : 0;

          return (
            <div
              key={group.code}
              className="bg-[#141926] border border-white/[0.06] rounded-2xl overflow-hidden shadow-sm transition-all"
            >
              {/* Accordion Package Header */}
              <div
                role="button" tabIndex={0} aria-expanded={isOpen} aria-label={`Familia ${group.name}`}
                onKeyDown={e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();toggleGroup(group.code)}}}
                onClick={() => toggleGroup(group.code)}
                className="catalog-family-toggle p-3.5 flex items-center justify-between gap-3 hover:bg-white/[0.02] cursor-pointer transition-colors select-none"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                    group.type === 'GASTO' ? 'bg-rose-500/20 text-rose-300' : 'bg-emerald-500/20 text-emerald-300'
                  }`}>
                    {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </div>

                  <div className="truncate">
                    <div className="flex items-center gap-2">
                      <h3 className="text-xs sm:text-sm font-bold text-white truncate">
                        {group.name}
                      </h3>
                      <span className="text-[10px] bg-white/[0.05] text-slate-300 px-1.5 py-0.2 rounded-full font-mono">
                        {group.partidas.length} partidas
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-0.5">
                      <span>Prev: <strong className="text-slate-200 font-mono">{formatCurrency(pkgPrevisto)}</strong></span>
                      <span>•</span>
                      <span>Ejec: <strong className="text-white font-mono">{formatCurrency(pkgEjecutado)}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Right: Package RESTO highlight */}
                <div className="text-right shrink-0">
                  <span className="text-[9px] text-slate-400 uppercase font-semibold block">RESTO PAQUETE</span>
                  <span className={`text-xs sm:text-sm font-black font-mono ${
                    group.type === 'GASTO'
                      ? pkgResto < 0
                        ? 'text-rose-400'
                        : 'text-emerald-400'
                      : pkgResto <= 0
                      ? 'text-emerald-400'
                      : 'text-amber-400'
                  }`}>
                    {formatCurrency(pkgResto)}
                  </span>
                  <span className="text-[9px] text-slate-400 font-mono block">
                    {pkgPercent}% usado
                  </span>
                </div>
              </div>

              {/* Progress bar across bottom of package header */}
              <div className="w-full bg-slate-800 h-1 overflow-hidden">
                <div
                  className={`h-full transition-all ${
                    group.type === 'GASTO'
                      ? pkgPercent > 100
                        ? 'bg-rose-500'
                        : pkgPercent >= 90
                        ? 'bg-amber-400'
                        : 'bg-emerald-500'
                      : 'bg-emerald-500'
                  }`}
                  style={{ width: `${Math.min(100, pkgPercent)}%` }}
                />
              </div>

              {/* Accordion Package Content: Partidas list */}
              {isOpen && (
                <div className="divide-y divide-white/[0.04] bg-[#0c0f17]/40">
                  {group.partidas.map((partida, index) => {
                    const row = rowMap[`${partida.type}:${partida.code}`] || {
                      code: partida.code,
                      groupName: partida.groupName,
                      name: partida.name,
                      type: partida.type,
                      previsto: 0,
                      ejecutado: 0,
                      resto: 0,
                      percent: 0,
                      status: 'neutral',
                      transactionCount: 0,
                    };

                    const key = `${partida.type}:${partida.code}`;
                    const isEditing = editingKey === key;

                    return (
                      <div
                        key={key}
                        className="p-3 hover:bg-white/[0.02] transition-colors space-y-2"
                      >
                        {/* Partida Row */}
                        <div className="flex items-start justify-between gap-2">
                          {/* Left: accessible opener for the contextual panel */}
                          <button type="button" onClick={() => onSelectPartidaToView(partida, row)}
                            aria-label={`Ver partida ${partida.code} ${partida.name}`} className="min-w-0 flex-1 text-left cursor-pointer group">
                            <span className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-mono text-[10px] font-bold text-sky-400 bg-white/[0.05] px-1.5 py-0.5 rounded border border-white/[0.08]">{partida.code}</span>
                              <span className="text-xs font-bold text-white group-hover:text-sky-300 transition-colors truncate" title={partida.name}>{partida.name}</span>
                              <Eye className="w-3 h-3 text-slate-500 group-hover:text-sky-400 opacity-0 group-hover:opacity-100 transition-opacity" />
                            </span>
                            <span className="text-[10px] text-slate-400 block mt-0.5">{row.transactionCount > 0 ? `${row.transactionCount} mov. registrados • Toca para ver` : '0 movimientos • Toca para ver'}</span>
                          </button>

                          {/* Center / Right: RESTO and Reordering Actions */}
                          <div className="flex items-center gap-2.5 shrink-0">
                            {/* Resto */}
                            <div className="text-right">
                              <span className="text-[9px] text-slate-400 uppercase font-semibold block">RESTO</span>
                              <span className={`text-xs sm:text-sm font-black font-mono ${
                                row.type === 'GASTO'
                                  ? row.resto < 0
                                    ? 'text-rose-400'
                                    : 'text-emerald-400'
                                  : row.resto <= 0
                                  ? 'text-emerald-400'
                                  : 'text-amber-400'
                              }`}>
                                {formatCurrency(row.resto)}
                              </span>
                            </div>

                            {/* Reordering Up/Down controls */}
                            <div className="flex flex-col gap-0.5 bg-white/[0.04] p-0.5 rounded-lg border border-white/[0.06]">
                              <button
                                type="button"
                                disabled={index === 0 || catalogSubmission.saving}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void catalogSubmission.submit(() => onMovePartida(group.code, index, 'UP'), () => {});
                                }}
                                className="p-1 hover:text-white text-slate-400 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                                title="Subir partida dentro del paquete"
                                aria-label={`Subir partida ${partida.name}`}
                              >
                                <ArrowUp className="w-3 h-3" />
                              </button>
                              <button
                                type="button"
                                disabled={index === group.partidas.length - 1 || catalogSubmission.saving}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  void catalogSubmission.submit(() => onMovePartida(group.code, index, 'DOWN'), () => {});
                                }}
                                className="p-1 hover:text-white text-slate-400 disabled:opacity-20 cursor-pointer disabled:cursor-not-allowed"
                                title="Bajar partida dentro del paquete"
                                aria-label={`Bajar partida ${partida.name}`}
                              >
                                <ArrowDown className="w-3 h-3" />
                              </button>
                            </div>

                            {/* Duplicate partida */}
                            <button
                              type="button"
                              disabled={catalogSubmission.saving}
                              onClick={(e) => {
                                e.stopPropagation();
                                void catalogSubmission.submit(() => onDuplicatePartida(partida), () => {});
                              }}
                              className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-slate-400 hover:text-white transition-colors cursor-pointer border border-white/[0.06]"
                              title="Duplicar partida presupuestaria"
                              aria-label={`Duplicar partida ${partida.name}`}
                            >
                              <Copy className="w-3 h-3" />
                            </button>

                            {/* Change group / Move package */}
                            <button
                              type="button"
                              disabled={catalogSubmission.saving}
                              onClick={(e) => {
                                e.stopPropagation();
                                moveSubmission.clearError();
                                setMovingPartida(partida);
                                setTargetGroupCode(group.code);
                              }}
                              className="p-1.5 rounded-lg bg-white/[0.04] hover:bg-white/[0.1] text-slate-400 hover:text-sky-400 transition-colors cursor-pointer border border-white/[0.06]"
                              title="Cambiar a otro paquete"
                              aria-label={`Mover de paquete ${partida.name}`}
                            >
                              <FolderInput className="w-3 h-3" />
                            </button>
                          </div>
                        </div>

                        {/* Partida mini progress meter */}
                        <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              row.type === 'GASTO'
                                ? row.percent > 100
                                  ? 'bg-rose-500'
                                  : row.percent >= 90
                                  ? 'bg-amber-400'
                                  : 'bg-emerald-500'
                                : 'bg-emerald-500'
                            }`}
                            style={{ width: `${Math.min(100, row.percent)}%` }}
                          />
                        </div>

                        {/* Previsto edit & Ejecutado row */}
                        <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                          <div className="flex items-center gap-3">
                            {isEditing ? (
                              <div className="flex items-center gap-1">
                                <span className="text-slate-400">Previsto:</span>
                                <input
                                  inputMode="decimal"
                                  disabled={editSubmission.saving}
                                  value={editValue}
                                  onChange={e => setEditValue(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') saveEdit(row);
                                    if (e.key === 'Escape') setEditingKey(null);
                                  }}
                                  className="w-16 bg-[#0c0f17] border border-sky-500 rounded px-1.5 py-0.5 text-xs text-white font-mono text-right"
                                  autoFocus
                                />
                                <button onClick={() => saveEdit(row)} className="text-emerald-400 p-0.5">
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setEditingKey(null)} className="text-slate-400 p-0.5">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex items-center gap-1">
                                <span>Previsto efectivo: <strong className="text-slate-200 font-mono">{formatCurrency(row.previsto)}</strong>{!!row.arrastre&&<> · Base {formatCurrency(row.basePrevisto)} + arrastre {formatCurrency(row.arrastre)}</>}</span>
                                <button
                                  onClick={() => startEdit(row)}
                                  className="text-slate-400 hover:text-white p-0.5 cursor-pointer"
                                  title="Editar importe previsto"
                                >
                                  <Edit2 className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            )}

                            <span>Ejecutado: <strong className="text-white font-mono">{formatCurrency(row.ejecutado)}</strong></span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            <span className="font-mono text-slate-400 font-semibold">{row.percent}%</span>
                            {row.status === 'exceeded' && row.type === 'GASTO' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                Excedido
                              </span>
                            )}
                            {row.status === 'warning' && row.type === 'GASTO' && (
                              <span className="text-[9px] font-bold px-1.5 py-0.2 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                                90%+
                              </span>
                            )}
                            {row.status === 'ok' && (
                              <span className="text-[9px] font-semibold text-emerald-400">
                                ✓ En margen
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal for Moving a Partida across packages */}
      {movingPartida && (
        <Overlay title="Mover partida" onClose={() => moveSubmission.close(() => setMovingPartida(null))}>
          <form role="dialog" aria-modal="true" aria-label="Mover partida" aria-busy={moveSubmission.saving}
            onSubmit={e => { e.preventDefault(); void moveSubmission.submit(() => budgetGroups.some(g => g.code === targetGroupCode && g.type === movingPartida.type)
              ? onChangePartidaGroup(movingPartida, targetGroupCode)
              : Promise.resolve({ ok: false, error: 'Elige una familia del mismo tipo. No se permite cambiar entre Ingresos y Gastos.' }), () => setMovingPartida(null)); }}
            className="bg-[#141926] border border-white/10 rounded-2xl max-w-sm w-full p-5 shadow-2xl text-xs space-y-3.5">
          <fieldset disabled={moveSubmission.saving} className="space-y-3.5">
            {moveSubmission.error && <p role="alert" className="text-rose-300">{moveSubmission.error}</p>}
            <h3 className="text-sm font-bold text-white">Mover Partida a Otro Paquete</h3>
            <p className="text-slate-300">
              ¿A qué paquete deseas mover la partida <strong className="text-white">[{movingPartida.code}] {movingPartida.name}</strong>?
            </p>

            <div>
              <label className="block text-slate-400 mb-1 font-medium">Paquete de destino</label>
              <select
                aria-label="Paquete de destino"
                value={targetGroupCode}
                onChange={e => setTargetGroupCode(e.target.value)}
                className="w-full bg-[#0c0f17] border border-white/[0.08] rounded-xl px-3 py-2 text-white focus:outline-none focus:border-sky-500 text-xs"
              >
                {budgetGroups.filter(g => g.type === movingPartida.type).map(g => (
                  <option key={g.code} value={g.code}>
                    {g.type}: {g.name}
                  </option>
                ))}
              </select>
            </div>

            <p>Solo puedes mover la partida entre familias del mismo tipo. Sus movimientos y presupuestos guardados se conservan.</p>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-white/[0.06]">
              <button
                type="button"
                onClick={() => moveSubmission.close(() => setMovingPartida(null))} disabled={moveSubmission.saving}
                className="px-3.5 py-2 rounded-xl text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
              <button
                type="submit" disabled={moveSubmission.saving}
                className="bg-white hover:bg-slate-100 text-slate-950 font-bold px-4 py-2 rounded-xl transition-all shadow cursor-pointer"
              >
                {moveSubmission.saving ? 'Guardando…' : 'Confirmar Traslado'}
              </button>
            </div>
          </fieldset>
          </form>
        </Overlay>
      )}
    </div>
  );
};
