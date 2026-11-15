import React from 'react';
import {createRoot} from 'react-dom/client';
import {I18nProvider,useI18n} from '../../i18n';
import {Brand} from '../../components/Brand';
import {LanguageSelector} from '../../components/LanguageSelector';

/** Checkpoint2 fails closed until the prototype adapters are wired. */
function NativePrototype(){const {t}=useI18n();return <main className="app-load-failure"><Brand/><LanguageSelector/><h1>{t('native.title')}</h1><p role="status">{t('native.warning')}</p><p>{t('native.packagingError')}</p></main>;}
export function mountNative(node:HTMLElement){createRoot(node).render(<I18nProvider><NativePrototype/></I18nProvider>);}
