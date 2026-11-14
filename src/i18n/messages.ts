import { languageReadiness } from './readiness';
export { languageReadiness } from './readiness';
export const languages = {
  es: { locale: 'es-ES', label: 'Español', status: 'ready' },
  en: { locale: 'en-GB', label: 'English', status: 'ready' },
  it: { locale: 'it-IT', label: 'Italiano', status: 'ready' },
  fr: { locale: 'fr-FR', label: 'Français', status: 'ready' },
  pt: { locale: 'pt-PT', label: 'Português', status: 'ready' },
} as const;
export type Language = keyof typeof languages;
import { es } from './es';
export { es } from './es';
export type MessageKey = keyof typeof es;
export type Messages = Record<MessageKey, string>;
export const dictionaries: Readonly<Partial<Record<Language, Readonly<Messages>>>> = { es };
// Availability is the reviewed product contract; loading is a separate runtime state.
const loaders: Record<Exclude<Language, 'es'>, () => Promise<Messages>> = {
  en: () => import('./en').then(module => module.en),
  it: () => import('./it').then(module => module.it),
  fr: () => import('./fr').then(module => module.fr),
  pt: () => import('./pt').then(module => module.pt),
};
const pending = new Map<Language, Promise<Readonly<Messages>>>();
const validity = new WeakMap<object, boolean>();
function valid(dictionary: Readonly<Messages>): boolean {
  let result = validity.get(dictionary);
  if (result === undefined) { result = validateDictionary(Object.entries(dictionary)).length === 0; validity.set(dictionary, result); }
  return result;
}
export const isDictionaryLoaded = (language: Language) => !!dictionaries[language];
/** Deduplicated, validated and immutable. Failed requests are evicted so selection can retry. */
export function loadDictionary(language: Language): Promise<Readonly<Messages>> {
  if (!isLanguageAvailable(language)) return Promise.reject(new Error('Language is not available.'));
  const cached = dictionaries[language];
  if (cached) return Promise.resolve(cached);
  const existing = pending.get(language); if (existing) return existing;
  const request = loaders[language as Exclude<Language, 'es'>]().then(dictionary => {
    const errors = validateDictionary(Object.entries(dictionary));
    if (errors.length) throw new Error('Incompatible language dictionary.');
    const immutable = Object.freeze({ ...dictionary }); validity.set(immutable, true);
    (dictionaries as Partial<Record<Language, Readonly<Messages>>>)[language] = immutable;
    return immutable;
  }).finally(() => { pending.delete(language); });
  pending.set(language, request); return request;
}
export function isLanguageAvailable(requested: string): requested is Language {
  if (!Object.hasOwn(languages, requested)) return false;
  const language = requested as Language, dictionary = dictionaries[language], readiness = languageReadiness[language];
  return languages[language].status === 'ready' && readiness.uiComplete && readiness.flowsVerified && (!dictionary || valid(dictionary));
}
export function activeLanguage(requested: string): Language {
  return isLanguageAvailable(requested) ? requested : 'es';
}
export type Slots<S extends string> = S extends `${string}{${infer P}}${infer Tail}` ? P | Slots<Tail> : never;
export type MessageSlots<K extends MessageKey> = Slots<(typeof es)[K]>;
type Arguments<K extends MessageKey> = [Slots<(typeof es)[K]>] extends [never] ? [params?: Record<string, string | number>] : [params: Record<Slots<(typeof es)[K]>, string | number>];
/** React renders this as text, never HTML. Parameters are replaced once, never evaluated. */
export function translate<K extends MessageKey>(key: K, ...[params]: Arguments<K>): string {
  return translateFrom(es, key, params);
}
export function translateFrom(dictionary: Partial<Messages>, key: MessageKey, params?: Record<string, string | number>): string {
  const template = dictionary[key] || es[key];
  return template.replace(/\{([^{}]+)\}/g, (token, name) => Object.hasOwn(params ?? {}, name) ? String(params![name]) : token);
}
const placeholders = (s: string) => [...new Set([...s.matchAll(/\{([^{}]+)\}/g)].map(m => m[1]))].sort().join(',');
/** Use entry arrays when adding dictionaries: detects duplicates before object construction loses them. */
export function validateDictionary(entries: readonly (readonly [string, string])[]): string[] {
  const errors: string[] = [], seen = new Set<string>();
  for (const [key, value] of entries) {
    if (seen.has(key)) errors.push(`Duplicate: ${key}`); seen.add(key);
    if (!Object.hasOwn(es, key)) errors.push(`Unknown: ${key}`);
    else if (!value.trim() || placeholders(value) !== placeholders(es[key as MessageKey])) errors.push(`Incompatible: ${key}`);
  }
  for (const key of Object.keys(es)) if (!seen.has(key)) errors.push(`Missing: ${key}`);
  return errors;
}
/** Future plural dictionaries can select typed message keys with standard Intl categories. */
export const pluralCategory = (count: number, language: Language = 'es') => new Intl.PluralRules(languages[language].locale).select(count);

export const translatorFor = (language: Language): typeof translate => (key, ...args) => {
  const dictionary = dictionaries[language];
  if (!dictionary) throw new Error('Load the dictionary before applying its language.');
  return translateFrom(dictionary, key, args[0]);
};

export const pluralFamilies = {
  contactDebtors: {one:'count.contactDebtors.one',other:'count.contactDebtors.other'},
  contactDebts: {one:'count.contactDebts.one',other:'count.contactDebts.other'},
  contactConcepts: {one:'count.contactConcepts.one',other:'count.contactConcepts.other'},

  recordedTransactionsHint: { one: 'count.recordedTransactionsHint.one', other: 'count.recordedTransactionsHint.other' },
  invalidAmountsVisible: { one: 'count.invalidAmountsVisible.one', other: 'count.invalidAmountsVisible.other' },
  invalidAmountsHidden: { one: 'count.invalidAmountsHidden.one', other: 'count.invalidAmountsHidden.other' },
  loans: { one: 'count.loans.one', other: 'count.loans.other' },
  overBudget: { one: 'count.overBudget.one', other: 'count.overBudget.other' },
  budgetAlert: { one: 'count.budgetAlert.one', other: 'count.budgetAlert.other' },
  transactionsFound: { one: 'count.transactionsFound.one', other: 'count.transactionsFound.other' },
  activeAccountsHint: { one: 'count.activeAccountsHint.one', other: 'count.activeAccountsHint.other' },

  more: { one: 'count.more.one', other: 'count.more.other' },
  budgetItems: { one: 'count.budgetItems.one', other: 'count.budgetItems.other' },
  transactions: { one: 'count.transactions.one', other: 'count.transactions.other' },
  contacts: { one: 'count.contacts.one', other: 'count.contacts.other' },
} as const satisfies Record<string, { one: MessageKey; other: MessageKey }>;
export type PluralFamily = keyof typeof pluralFamilies;
export function pluralText(language: Language, family: PluralFamily, count: number): string {
  const variants = pluralFamilies[family], key = pluralCategory(count, language) === 'one' ? variants.one : variants.other;
  return translatorFor(language)(key, { count: new Intl.NumberFormat(languages[language].locale).format(count) });
}

// Node/SSR needs synchronous translators for renderToStaticMarkup and the existing tests.
// Vite replaces SSR with false in the browser: no eager foreign imports or top-level await there.
if (import.meta.env?.SSR !== false) await Promise.all((['en', 'it', 'fr', 'pt'] as const).map(loadDictionary));
