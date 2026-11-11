import React from 'react';
import { ArrowUpRight, Wallet, ChartNoAxesCombined, CalendarDays, HardDrive } from 'lucide-react';
import { Brand } from './Brand';
import { useI18n } from '../i18n';
import { paths } from '../app/paths';
export function LandingPage() {
  const { t } = useI18n();
  return <div className="landing">
    <a className="skip-link" href="#landing-content">{t('common.skip')}</a>
    <header className="landing-header"><Brand /><a className="button-primary" href={paths.app}>{t('landing.open')}<ArrowUpRight size={18} aria-hidden="true" /></a></header>
    <main id="landing-content" tabIndex={-1}>
      <section className="landing-hero">
        <div><p className="eyebrow">{t('landing.eyebrow')}</p><h1>{t('landing.title')}</h1><p className="landing-intro">{t('landing.description')}</p>
          <div className="landing-cta"><a className="button-primary" href={paths.app}>{t('landing.open')}<ArrowUpRight size={20} aria-hidden="true" /></a><a className="button-secondary" href="#beneficios">{t('landing.details')}</a></div>
          <p className="landing-local"><HardDrive size={20} aria-hidden="true" />{t('landing.local')}</p>
        </div>
        <figure className="landing-preview"><img src={paths.preview} width="1440" height="900" alt={t('landing.previewAlt')} fetchPriority="high" /><figcaption>{t('landing.preview')}</figcaption></figure>
      </section>
      <section id="beneficios" className="landing-benefits" aria-labelledby="benefits-title"><h2 id="benefits-title">{t('landing.benefits')}</h2><div className="benefits-grid">
        {([
          [Wallet, 'landing.accountsTitle', 'landing.accountsBody'],
          [ChartNoAxesCombined, 'landing.budgetTitle', 'landing.budgetBody'],
          [CalendarDays, 'landing.futureTitle', 'landing.futureBody'],
        ] as const).map(([Icon, title, body]) => <article key={title}><Icon size={26} aria-hidden="true" /><h3>{t(title)}</h3><p>{t(body)}</p></article>)}
      </div></section>
      <section className="landing-data" aria-labelledby="data-title"><div><p className="eyebrow">{t('landing.dataEyebrow')}</p><h2 id="data-title">{t('landing.dataTitle')}</h2></div><div><p>{t('landing.dataBody')}</p><p>{t('landing.assistantBody')}</p><p>{t('landing.notice')}</p><a className="button-primary" href={paths.app}>{t('landing.open')}<ArrowUpRight size={18} aria-hidden="true" /></a></div></section>
    </main><footer className="landing-footer"><Brand /><p>{t('landing.footer')}</p></footer>
  </div>;
}
