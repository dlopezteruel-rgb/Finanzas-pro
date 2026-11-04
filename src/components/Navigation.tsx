import React from 'react';
import { Home, ArrowLeftRight, PieChart, CreditCard, Sparkles, Landmark, Users } from 'lucide-react';

export type NavTab = 'dashboard' | 'transactions' | 'budgets' | 'contacts' | 'loans' | 'wallets' | 'assistant';

interface NavigationProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  pendingTransactionsCount: number;
  exceededBudgetsCount: number;
  pendingDebtsCount?: number;
}

export const Navigation: React.FC<NavigationProps> = ({
  activeTab,
  onSelectTab,
  pendingTransactionsCount,
  exceededBudgetsCount,
  pendingDebtsCount = 0,
}) => {
  const tabs = [
    {
      id: 'dashboard' as NavTab,
      label: 'Inicio',
      icon: Home,
      badge: null,
    },
    {
      id: 'transactions' as NavTab,
      label: 'Movimientos',
      icon: ArrowLeftRight,
      badge: pendingTransactionsCount > 0 ? `${pendingTransactionsCount}` : null,
      badgeColor: 'bg-amber-500 text-slate-950',
    },
    {
      id: 'budgets' as NavTab,
      label: 'Presupuestos',
      icon: PieChart,
      badge: exceededBudgetsCount > 0 ? `${exceededBudgetsCount}` : null,
      badgeColor: 'bg-rose-500 text-white',
    },
    {
      id: 'contacts' as NavTab,
      label: 'Contactos',
      icon: Users,
      badge: pendingDebtsCount > 0 ? `${pendingDebtsCount}` : null,
      badgeColor: 'bg-sky-500 text-white',
    },
    {
      id: 'loans' as NavTab,
      label: 'Deudas',
      icon: CreditCard,
      badge: null,
    },
    {
      id: 'wallets' as NavTab,
      label: 'Cuentas',
      icon: Landmark,
      badge: null,
    },
    {
      id: 'assistant' as NavTab,
      label: 'Asistente',
      icon: Sparkles,
      badge: null,
    },
  ];

  return (
    <>
      {/* Desktop Segmented Navigation Bar */}
      <nav className="hidden md:block bg-[#0c0f17] border-b border-white/[0.06] py-2">
        <div className="max-w-4xl mx-auto px-4 flex items-center justify-center">
          <div className="flex items-center gap-1 bg-[#141926] p-1 rounded-full border border-white/[0.06]">
            {tabs.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => onSelectTab(tab.id)}
                  className={`relative flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white text-slate-950 shadow-md font-bold'
                      : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-slate-400'}`} />
                  <span>{tab.label}</span>
                  {tab.badge && (
                    <span
                      className={`text-[9px] px-1.5 py-0.2 rounded-full font-bold leading-none ${
                        tab.badgeColor || 'bg-slate-700 text-slate-200'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile Fixed Bottom Navigation Bar (Revolut Style) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-[#0c0f17]/95 backdrop-blur-xl border-t border-white/[0.08] pb-safe">
        <div className="grid grid-cols-7 items-center px-0.5 py-1.5 max-w-lg mx-auto">
          {tabs.map(tab => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                  aria-current={isActive ? 'page' : undefined}
                onClick={() => onSelectTab(tab.id)}
                className={`flex flex-col items-center justify-center py-1 relative transition-transform active:scale-90 cursor-pointer ${
                  isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <div className="relative">
                  <Icon
                    className={`w-5 h-5 transition-colors ${
                      isActive ? 'text-sky-400 stroke-[2.5]' : 'stroke-[1.8]'
                    }`}
                  />
                  {tab.badge && (
                    <span
                      className={`absolute -top-1 -right-2 text-[9px] min-w-[14px] h-[14px] flex items-center justify-center rounded-full font-bold px-0.5 leading-none shadow-sm ${
                        tab.badgeColor || 'bg-sky-500 text-white'
                      }`}
                    >
                      {tab.badge}
                    </span>
                  )}
                </div>
                <span className={`text-[10px] mt-1 font-medium tracking-tight ${
                  isActive ? 'text-white font-bold' : 'text-slate-400'
                }`}>
                  {tab.label}
                </span>
                {isActive && (
                  <span className="w-1 h-1 rounded-full bg-sky-400 absolute bottom-0" />
                )}
              </button>
            );
          })}
        </div>
      </nav>
    </>
  );
};
