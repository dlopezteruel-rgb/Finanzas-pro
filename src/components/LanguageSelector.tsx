import React from 'react';
import { languages, useI18n } from '../i18n';
export function LanguageSelector() {
  const { language, setLanguage, t, preferenceError } = useI18n();
  return <div className="px-3 py-2 border-t border-white/10">
    <label htmlFor="ui-language" className="block mb-1 font-medium">{t('language.label')}</label>
    <select id="ui-language" value={language} onChange={e => setLanguage(e.target.value)} aria-describedby="ui-language-help" className="w-full min-h-10 rounded-lg border border-slate-500 bg-slate-800 text-white px-2">
      {Object.entries(languages).map(([code, item]) => <option key={code} value={code} disabled={item.status !== 'ready'}>{item.label} — {t(item.status === 'ready' ? 'language.available' : 'language.planned')}</option>)}
    </select>
    <p id="ui-language-help" className="mt-2 text-slate-300 leading-relaxed">{t('language.help')}</p>
    {preferenceError && <p role="status" className="mt-2">{t('language.storageError')}</p>}
  </div>;
}
