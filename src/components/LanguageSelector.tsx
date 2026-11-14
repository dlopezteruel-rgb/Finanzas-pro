import React from 'react';
import { languages, isLanguageAvailable, useI18n } from '../i18n';
export function LanguageSelector({ appearance = 'menu' }: { appearance?: 'menu' | 'landing' }) {
  const { language, setLanguage, t, preferenceError } = useI18n();
  const landing = appearance === 'landing', id = landing ? 'landing-language' : 'ui-language';
  return <div className={landing ? 'language-selector--landing' : 'px-3 py-2 border-t border-white/10'}>
    <label htmlFor={id} className="block mb-1 font-medium">{t('language.label')}</label>
    <select id={id} value={language} onChange={e => setLanguage(e.target.value)} aria-describedby={`${id}-help`} className={landing ? 'landing-language-input' : 'w-full min-h-10 rounded-lg border border-slate-500 bg-slate-800 text-white px-2'}>
      {Object.entries(languages).map(([code, item]) => <option key={code} value={code} disabled={!isLanguageAvailable(code)}>{item.label}{!landing && ' — '}{!landing && t(isLanguageAvailable(code) ? 'language.available' : 'language.planned')}</option>)}
    </select>
    <p id={`${id}-help`} className={landing ? 'sr-only' : 'mt-2 text-slate-300 leading-relaxed'}>{t('language.help')}</p>
    {preferenceError && <p role="status" className="mt-2">{t('language.storageError')}</p>}
  </div>;
}
