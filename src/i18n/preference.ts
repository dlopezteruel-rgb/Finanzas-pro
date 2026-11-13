import { activeLanguage } from './messages';
export const LANGUAGE_KEY = 'finanzas.ui.language';
type PreferenceStorage = Pick<Storage, 'getItem' | 'setItem'>;
// Resolve storage inside the try: even accessing the browser property can throw.
export function readLanguagePreference(storage?: PreferenceStorage | null) {
  try { return activeLanguage((storage === undefined ? window.localStorage : storage)?.getItem(LANGUAGE_KEY) ?? 'es'); }
  catch { return activeLanguage('es'); }
}
export function writeLanguagePreference(value: string, storage?: PreferenceStorage | null): boolean {
  if (activeLanguage(value) !== value) return false;
  try { const target = storage === undefined ? window.localStorage : storage; if (!target) return false; target.setItem(LANGUAGE_KEY, value); return true; }
  catch { return false; }
}
