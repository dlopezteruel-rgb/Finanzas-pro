import React, { useState } from 'react';
import { PeriodSelector } from './PeriodSelector';
import { Calendar, Download, Upload, RotateCcw, MoreHorizontal, ChevronDown, Check, Sparkles, Trash2, Sun, Moon } from 'lucide-react';
import { formatCurrency } from '../utils/finance';

interface HeaderProps {
  currentMonthYear: string;
  onChangeMonthYear: (my: string) => void;
  availableMonths: string[];
  totalLiquidBalance: number;
  theme: 'dark' | 'light';
  onToggleTheme: () => void;
  onOpenNewTransaction: () => void;
  onExportJSON: () => void;
  onImportJSON: () => void;
  onOpenRecovery: () => void;
  onResetDemo: () => void;
  onClearAllData: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentMonthYear,
  onChangeMonthYear,
  availableMonths,
  totalLiquidBalance,
  theme,
  onToggleTheme,
  onOpenNewTransaction,
  onExportJSON,
  onImportJSON,
  onOpenRecovery,
  onResetDemo,
  onClearAllData,
}) => {
  const [showMenu, setShowMenu] = useState(false);

  // Format month name cleanly e.g. "Oct 2026"
  const formatShortMonth = (my: string) => {
    const [year, month] = my.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    const m = date.toLocaleDateString('es-ES', { month: 'short' });
    return `${m.charAt(0).toUpperCase() + m.slice(1)} ${year}`;
  };

  return (
    <header className="sticky top-0 z-40 bg-[#0c0f17]/90 backdrop-blur-xl border-b border-white/[0.06]">
      <div className="app-shell app-header-inner h-14 flex items-center justify-between gap-3">
        {/* Left: Avatar & App Name */}
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-inner ring-1 ring-white/20">
            FP
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-1.5 leading-none">
              <span className="font-bold text-sm tracking-tight text-white">FinanZas</span>
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-white/10 text-white/80">
                PRO
              </span>
            </div>
            <span className="text-[10px] text-slate-400 font-medium">Control Presupuestario</span>
          </div>
        </div>

        {/* Center / Right: Compact Period Selector & Actions */}
        <div className="flex items-center gap-2">
          {/* Period Selector Pill */}
          <PeriodSelector month={currentMonthYear} periods={availableMonths} onChange={onChangeMonthYear}/>

          {/* Theme Toggle Button (Claro / Oscuro) */}
          <button
            onClick={onToggleTheme}
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white flex items-center justify-center border border-white/[0.08] transition-all cursor-pointer"
            aria-label={`Cambiar a modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
            title={`Modo ${theme === 'dark' ? 'claro' : 'oscuro'}`}
          >
            {theme === 'dark' ? (
              <Sun className="w-4 h-4 text-amber-300 hover:rotate-45 transition-transform" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-400" />
            )}
          </button>

          {/* Quick Menu Popover Button */}
          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white flex items-center justify-center border border-white/[0.08] transition-colors cursor-pointer"
              aria-label="Opciones y datos"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>

            {/* Dropdown Menu */}
            {showMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowMenu(false)}
                />
                <div className="absolute right-0 mt-2 w-48 bg-[#161c2b] border border-white/10 rounded-2xl p-1.5 shadow-2xl z-50 text-xs animate-fadeIn">
                  <button
                    onClick={() => {
                      onExportJSON();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-slate-200 hover:bg-white/10 flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-400" />
                    <span>Exportar JSON</span>
                  </button>

                  <button
                    onClick={() => {
                      onImportJSON();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-slate-200 hover:bg-white/10 flex items-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-indigo-400" />
                    <span>Importar JSON</span>
                  </button>

                  <button onClick={() => { onOpenRecovery(); setShowMenu(false); }} className="w-full text-left px-3 py-2 rounded-xl text-slate-200 hover:bg-white/10 flex items-center gap-2 cursor-pointer">
                    <Download className="w-3.5 h-3.5 text-sky-400" />
                    <span>Copias de recuperación</span>
                  </button>
                  <div className="my-1 border-t border-white/[0.06]" />

                  <button
                    onClick={() => {
                      onResetDemo();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-amber-400 hover:bg-white/10 flex items-center gap-2 cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Restablecer datos demo</span>
                  </button>

                  <button
                    onClick={() => {
                      onClearAllData();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Limpiar todo (Borrar datos)</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
