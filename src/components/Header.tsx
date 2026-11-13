import { useI18n } from '../i18n';
import { LanguageSelector } from './LanguageSelector';
import React, { useState, useRef, useEffect } from 'react';
import { Brand } from './Brand';
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
  const { t } = useI18n();
  const menuButton = useRef<HTMLButtonElement>(null);
  const menuPanel = useRef<HTMLDivElement>(null);
  const [showMenu, setShowMenu] = useState(false);
  useEffect(() => {
    if (!showMenu) return;
    menuPanel.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setShowMenu(false); menuButton.current?.focus(); } };
    document.addEventListener('keydown', close, true);
    return () => document.removeEventListener('keydown', close, true);
  }, [showMenu]);

  // Format month name cleanly e.g. "Oct 2026"
  const formatShortMonth = (my: string) => {
    const [year, month] = my.split('-');
    const date = new Date(parseInt(year, 10), parseInt(month, 10) - 1, 1);
    const m = date.toLocaleDateString('es-ES', { month: 'short' });
    return `${m.charAt(0).toUpperCase() + m.slice(1)} ${year}`;
  };

  return (
    <header className="app-header sticky top-0 z-40 border-b">
      <div className="app-shell app-header-inner">
        <span className="header-brand"><Brand description /></span>
        <div className="header-period"><PeriodSelector month={currentMonthYear} periods={availableMonths} onChange={onChangeMonthYear}/></div>
        <div className="header-actions">
          {/* Theme Toggle Button (Claro / Oscuro) */}
          <button
            onClick={onToggleTheme}
            className="w-8 h-8 rounded-full bg-white/[0.06] hover:bg-white/[0.12] text-slate-300 hover:text-white flex items-center justify-center border border-white/[0.08] transition-all cursor-pointer"
            aria-label={t('theme.switch', { mode: t(theme === 'dark' ? 'theme.light' : 'theme.dark') })}
            title={t('theme.title', { mode: t(theme === 'dark' ? 'theme.light' : 'theme.dark') })}
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
              ref={menuButton} aria-label={t('options.title')} aria-expanded={showMenu} aria-controls="options-panel"
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
                <div id="options-panel" ref={menuPanel} role="region" aria-label={t('options.title')} className="absolute right-0 mt-2 w-64 max-w-[calc(100vw-2rem)] max-h-[calc(100dvh-5rem)] overflow-y-auto bg-[#161c2b] border border-white/10 rounded-2xl p-1.5 shadow-2xl z-50 text-xs animate-fadeIn">
                  <button
                    onClick={() => {
                      onExportJSON();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-slate-200 hover:bg-white/10 flex items-center gap-2 cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 text-sky-400" />
                    <span>{t('options.export')}</span>
                  </button>

                  <button
                    onClick={() => {
                      onImportJSON();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-slate-200 hover:bg-white/10 flex items-center gap-2 cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5 text-indigo-400" />
                    <span>{t('options.import')}</span>
                  </button>

                  <button onClick={() => { onOpenRecovery(); setShowMenu(false); }} className="w-full text-left px-3 py-2 rounded-xl text-slate-200 hover:bg-white/10 flex items-center gap-2 cursor-pointer">
                    <Download className="w-3.5 h-3.5 text-sky-400" />
                    <span>{t('options.recovery')}</span>
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
                    <span>{t('options.demo')}</span>
                  </button>

                  <button
                    onClick={() => {
                      onClearAllData();
                      setShowMenu(false);
                    }}
                    className="w-full text-left px-3 py-2 rounded-xl text-rose-400 hover:bg-rose-500/10 flex items-center gap-2 cursor-pointer font-medium"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t('options.clear')}</span>
                  </button>
                  <LanguageSelector />
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
