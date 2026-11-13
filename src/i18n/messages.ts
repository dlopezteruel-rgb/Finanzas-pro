import { languageReadiness } from './readiness';
export { languageReadiness } from './readiness';
import { en } from './en';
import { it } from './it';
import { fr } from './fr';
import { pt } from './pt';
export const languages = {
  es: { locale: 'es-ES', label: 'Español', status: 'ready' },
  en: { locale: 'en-GB', label: 'English', status: 'planned' },
  it: { locale: 'it-IT', label: 'Italiano', status: 'planned' },
  fr: { locale: 'fr-FR', label: 'Français', status: 'planned' },
  pt: { locale: 'pt-PT', label: 'Português', status: 'planned' },
} as const;
export type Language = keyof typeof languages;
import { es } from './es';
export { es } from './es';
export type MessageKey = keyof typeof es;
export type Messages = Record<MessageKey, string>;
export const dictionaries: Readonly<Partial<Record<Language, Readonly<Messages>>>> = { es, en, it, fr, pt };
export function isLanguageAvailable(requested: string): requested is Language {
  if (!Object.hasOwn(languages, requested)) return false;
  const language = requested as Language, dictionary = dictionaries[language], readiness = languageReadiness[language];
  return languages[language].status === 'ready' && readiness.uiComplete && readiness.flowsVerified && !!dictionary && validateDictionary(Object.entries(dictionary)).length === 0;
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

export const translatorFor = (language: Language): typeof translate => (key, ...args) => translateFrom(dictionaries[language] ?? es, key, args[0]);

export const pluralFamilies = {
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
