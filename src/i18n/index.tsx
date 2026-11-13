import React, { createContext, useContext, useEffect, useState } from 'react';
import { activeLanguage, languages, translate, translatorFor, es, dictionaries, type MessageKey, type MessageSlots, type Language, pluralText, type PluralFamily } from './messages';
import { LANGUAGE_KEY, readLanguagePreference, writeLanguagePreference } from './preference';
export * from './messages';
export * from './preference';
const Context = createContext({ language: 'es' as Language, t: translate, tn: (family: PluralFamily, count: number) => pluralText('es', family, count), setLanguage: (_value: string): boolean => false, preferenceError: false });
export function I18nProvider({ children, requested }: { children: React.ReactNode; requested?: string }) {
  const [language, update] = useState<Language>(() => requested === undefined ? readLanguagePreference() : activeLanguage(requested));
  const [preferenceError, setError] = useState(false);
  useEffect(() => {
    const text = translatorFor(language);
    document.documentElement.lang = languages[language].locale;
    document.title = text('document.title');
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]']) document.querySelector(selector)?.setAttribute('content', text('document.description'));
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', text('document.title'));
  }, [language]);
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
  return <Context.Provider value={{ language, t: translatorFor(language), tn: (family, count) => pluralText(language, family, count), setLanguage, preferenceError }}>{children}</Context.Provider>;
}
export const useI18n = () => useContext(Context);

/** Presentation only; never parse these strings or change accounting currency/timezone. */
export const presentationMoney = (amount: number, language: Language = 'es') => new Intl.NumberFormat(languages[language].locale, { style: 'currency', currency: 'EUR' }).format(amount);
export const presentationDate = (date: Date, language: Language = 'es') => new Intl.DateTimeFormat(languages[language].locale, { timeZone: 'Europe/Madrid', year: 'numeric', month: 'long', day: 'numeric' }).format(date);

/** Rich text uses the same dictionary and context; named React slots never become HTML. */
type RichMessageProps<K extends MessageKey> = { id: K } & ([MessageSlots<K>] extends [never] ? { values?: never } : { values: Record<MessageSlots<K>, React.ReactNode> });
export function I18nText<K extends MessageKey>(props: RichMessageProps<K>) {
  const { id } = props;
  const values: Record<string, React.ReactNode> = props.values ?? {};
  const { language } = useI18n();
  const template = dictionaries[language]?.[id] || es[id];
  return <>{template.split(/(\{[^{}]+\})/g).map((part, position) => {
    const name = /^\{([^{}]+)\}$/.exec(part)?.[1];
    return <React.Fragment key={name ? `slot:${name}` : `text:${position}`}>{name && Object.hasOwn(values, name) ? values[name] : part}</React.Fragment>;
  })}</>;
}
