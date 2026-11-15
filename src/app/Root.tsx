import React, { lazy, Suspense } from 'react';
import { LandingPage } from '../components/LandingPage';
import { Brand } from '../components/Brand';
import { I18nProvider, useI18n } from '../i18n';
import { isApplicationPath } from '../../config/appPaths';
import { paths } from './paths';
import {installedContainer} from '../platform/environment';
const Application = lazy(() => import('../App'));
export function AppSplash() {
  const { t } = useI18n();
  return <div className="app-splash" role="status" aria-live="polite"><Brand description /><span className="loading-line" aria-hidden="true" /><h1>{t('loading.title')}</h1><p>{t('loading.description')}</p></div>;
}
function LoadFailure() {
  const { t } = useI18n();
  return <main className="app-load-failure"><Brand /><h1>{t('loading.error')}</h1><p>{t('loading.safe')}</p><button className="button-primary" onClick={() => location.reload()}>{t('loading.retry')}</button><a href={paths.home}>{t('loading.back')}</a></main>;
}
class LoadBoundary extends React.Component<{ children: React.ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() { return this.state.failed ? <LoadFailure /> : this.props.children; }
}
function NativeBuildRequired(){const {t}=useI18n();return <main className="app-load-failure"><Brand/><h1>{t('native.title')}</h1><p role="alert">{t('native.packagingError')}</p></main>;}
export function Root({blockedContainer=false}:{blockedContainer?:boolean}) {
  const appRoute = isApplicationPath(window.location.pathname, paths.home);
  return <I18nProvider><LoadBoundary>{blockedContainer||installedContainer()?<NativeBuildRequired/>:appRoute ? <Suspense fallback={<AppSplash />}><Application /></Suspense> : <LandingPage />}</LoadBoundary></I18nProvider>;
}
