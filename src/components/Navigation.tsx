import React, { useState } from 'react';
import { Home, ArrowLeftRight, PieChart, CreditCard, Sparkles, Landmark, Users, MoreHorizontal } from 'lucide-react';
import { Overlay } from './Overlay';
import { useI18n } from '../i18n';

export type NavTab = 'dashboard' | 'transactions' | 'budgets' | 'contacts' | 'loans' | 'wallets' | 'assistant';
interface NavigationProps {
  activeTab: NavTab; onSelectTab: (tab: NavTab) => void;
  pendingTransactionsCount: number; exceededBudgetsCount: number; pendingDebtsCount?: number;
}
export const Navigation: React.FC<NavigationProps> = ({ activeTab, onSelectTab, pendingTransactionsCount, exceededBudgetsCount, pendingDebtsCount = 0 }) => {
  const { t } = useI18n();
  const [moreOpen, setMoreOpen] = useState(false);
  const tabs = [
    { id: 'dashboard' as NavTab, label: t('nav.home'), icon: Home, badge: 0 },
    { id: 'transactions' as NavTab, label: t('nav.movements'), icon: ArrowLeftRight, badge: pendingTransactionsCount },
    { id: 'budgets' as NavTab, label: t('nav.budgets'), icon: PieChart, badge: exceededBudgetsCount },
    { id: 'contacts' as NavTab, label: t('nav.contacts'), icon: Users, badge: pendingDebtsCount },
    { id: 'loans' as NavTab, label: t('nav.debts'), icon: CreditCard, badge: 0 },
    { id: 'wallets' as NavTab, label: t('nav.accounts'), icon: Landmark, badge: 0 },
    { id: 'assistant' as NavTab, label: t('nav.assistant'), icon: Sparkles, badge: 0 },
  ];
  const primary = tabs.filter(tab => ['dashboard', 'transactions', 'budgets', 'wallets'].includes(tab.id));
  const secondary = tabs.filter(tab => ['contacts', 'loans', 'assistant'].includes(tab.id));
  const select = (tab: NavTab) => { setMoreOpen(false); onSelectTab(tab); };
  const item = (tab: typeof tabs[number]) => <button type="button" key={tab.id} className="nav-button" aria-current={activeTab === tab.id ? 'page' : undefined} onClick={() => select(tab.id)}>
    <tab.icon size={20} aria-hidden="true" /><span>{tab.label}</span>{tab.badge > 0 && <span className="nav-badge">{tab.badge}</span>}
  </button>;
  return <>
    <nav aria-label={t('nav.label')} className="desktop-navigation hidden md:block"><div className="app-shell"><div className="desktop-nav-items">{tabs.map(item)}</div></div></nav>
    <nav aria-label={t('nav.label')} className="mobile-navigation md:hidden"><div className="mobile-nav-items">{primary.map(item)}
      <button type="button" className="nav-button" aria-current={secondary.some(tab => tab.id === activeTab) ? 'page' : undefined} aria-haspopup="dialog" aria-expanded={moreOpen} onClick={() => setMoreOpen(true)}>
        <MoreHorizontal size={20} aria-hidden="true" /><span>{t('nav.more')}</span>{pendingDebtsCount > 0 && <span className="nav-badge">{pendingDebtsCount}</span>}
      </button>
    </div></nav>
    {moreOpen && <Overlay title={t('nav.moreTitle')} onClose={() => setMoreOpen(false)}>
      <section role="dialog" aria-modal="true" aria-label={t('nav.moreTitle')} className="more-dialog">
        <h2>{t('nav.moreTitle')}</h2><div className="more-options">{secondary.map(item)}</div>
        <button type="button" className="button-secondary" onClick={() => setMoreOpen(false)}>{t('nav.close')}</button>
      </section>
    </Overlay>}
  </>;
};
