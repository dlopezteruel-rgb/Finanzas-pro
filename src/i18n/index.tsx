import React, { createContext, useContext, useEffect, useState } from 'react';
import { activeLanguage, languages, translate, translatorFor, type Language } from './messages';
import { LANGUAGE_KEY, readLanguagePreference, writeLanguagePreference } from './preference';
export * from './messages';
export * from './preference';
const Context = createContext({ language: 'es' as Language, t: translate, setLanguage: (_value: string): boolean => false, preferenceError: false });
export function I18nProvider({ children, requested }: { children: React.ReactNode; requested?: string }) {
  const [language, update] = useState<Language>(() => requested === undefined ? readLanguagePreference() : activeLanguage(requested));
  const [preferenceError, setError] = useState(false);
  useEffect(() => { document.documentElement.lang = languages[language].locale; }, [language]);
  useEffect(() => { if (requested !== undefined) update(activeLanguage(requested)); }, [requested]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== LANGUAGE_KEY && event.key !== null) return;
      try { if (event.storageArea && event.storageArea !== window.localStorage) return; } catch { return; }
      update(activeLanguage(event.newValue ?? 'es')); setError(false);
    };
    window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync);
  }, []);
  const setLanguage = (value: string) => {
    if (!Object.hasOwn(languages, value) || activeLanguage(value) !== value) return false;
    update(value as Language); setError(!writeLanguagePreference(value)); return true;
  };
  return <Context.Provider value={{ language, t: translatorFor(language), setLanguage, preferenceError }}>{children}</Context.Provider>;
}
export const useI18n = () => useContext(Context);

/** Presentation only; never parse these strings or change accounting currency/timezone. */
export const presentationMoney = (amount: number, language: Language = 'es') => new Intl.NumberFormat(languages[language].locale, { style: 'currency', currency: 'EUR' }).format(amount);
export const presentationDate = (date: Date, language: Language = 'es') => new Intl.DateTimeFormat(languages[language].locale, { timeZone: 'Europe/Madrid', year: 'numeric', month: 'long', day: 'numeric' }).format(date);
