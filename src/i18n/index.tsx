import {presentationFormatters} from './presentation';
export * from './presentation';
import React, { createContext, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { activeLanguage, languages, translate, translatorFor, es, dictionaries, isDictionaryLoaded, loadDictionary, isLanguageAvailable, type MessageKey, type MessageSlots, type Language, pluralText, type PluralFamily } from './messages';
import { LANGUAGE_KEY, readLanguagePreference, writeLanguagePreference } from './preference';
export * from './messages';
export * from './preference';
const Context = createContext({ ...presentationFormatters('es'), language: 'es' as Language, t: translate, tn: (family: PluralFamily, count: number) => pluralText('es', family, count), setLanguage: (_value: string): boolean => false, preferenceError: false, pendingLanguage: null as Language | null, languageError: null as Language | null, retryLanguage: (): boolean => false });
export function I18nProvider({ children, requested }: { children: React.ReactNode; requested?: string }) {
  const [initial] = useState(() => requested === undefined ? readLanguagePreference() : activeLanguage(requested));
  const [language, update] = useState<Language>(() => isDictionaryLoaded(initial) ? initial : 'es');
  const [booting, setBooting] = useState(() => !isDictionaryLoaded(initial));
  const [preferenceError, setError] = useState(false);
  const [pendingLanguage, setPending] = useState<Language | null>(null);
  const [languageError, setLanguageError] = useState<Language | null>(null);
  const requestId = useRef(0);
  const failedRequest = useRef<{ language: Language; persist: boolean } | null>(null);
  const requestLanguage = useCallback((value: string, persist: boolean): boolean => {
    if (!isLanguageAvailable(value)) return false;
    const id = ++requestId.current;
    setLanguageError(null); failedRequest.current = null;
    const commit = () => {
      if (id !== requestId.current) return;
      update(value); setPending(null); setBooting(false);
      setError(persist ? !writeLanguagePreference(value) : false);
    };
    if (isDictionaryLoaded(value)) commit();
    else {
      setPending(value);
      void loadDictionary(value).then(commit, () => {
        if (id !== requestId.current) return;
        setPending(null); setBooting(false); setLanguageError(value);
        failedRequest.current = { language: value, persist };
      });
    }
    // True means a valid selection was accepted. It never silently becomes a Promise.
    return true;
  }, []);
  useLayoutEffect(() => {
    const text = translatorFor(language);
    document.documentElement.lang = languages[language].locale;
    document.title = text('document.title');
    for (const selector of ['meta[name="description"]', 'meta[property="og:description"]']) document.querySelector(selector)?.setAttribute('content', text('document.description'));
    document.querySelector('meta[property="og:title"]')?.setAttribute('content', text('document.title'));
  }, [language]);
  useEffect(() => {
    requestLanguage(requested === undefined ? initial : activeLanguage(requested), false);
    return () => { ++requestId.current; };
  }, [requested, initial, requestLanguage]);
  useEffect(() => {
    const sync = (event: StorageEvent) => {
      if (event.key !== LANGUAGE_KEY && event.key !== null) return;
      try { if (event.storageArea && event.storageArea !== window.localStorage) return; } catch { return; }
      requestLanguage(activeLanguage(event.newValue ?? 'es'), false);
    };
    window.addEventListener('storage', sync); return () => window.removeEventListener('storage', sync);
  }, [requestLanguage]);
  const setLanguage = useCallback((value: string) => requestLanguage(value, true), [requestLanguage]);
  const retryLanguage = useCallback(() => failedRequest.current ? requestLanguage(failedRequest.current.language, failedRequest.current.persist) : false, [requestLanguage]);
  const value = useMemo(() => ({ ...presentationFormatters(language), language, t: translatorFor(language), tn: (family: PluralFamily, count: number) => pluralText(language, family, count), setLanguage, preferenceError, pendingLanguage, languageError, retryLanguage }), [language, setLanguage, preferenceError, pendingLanguage, languageError, retryLanguage]);
  return <Context.Provider value={value}>{booting ? <main className="app-splash" role="status" aria-live="polite"><p>{translate('language.loading', { language: languages[initial].label })}</p></main> : children}</Context.Provider>;
}
export const useI18n = () => useContext(Context);

/** Rich text uses the same loaded dictionary and context; named React slots never become HTML. */
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
