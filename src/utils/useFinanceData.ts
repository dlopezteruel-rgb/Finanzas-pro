import { useEffect, useState } from 'react';
import { DATA_KEY, FinanceData, StorageConflictError } from './backup';
import { browserExclusiveWrite, FinanceStore, RestorationInput } from './financeStore';
import { SaveResult, saveErrorMessage } from './saveResult';
import { browserStorageSupportError } from './storageSupport';
export { loadFinanceData } from './financeStore';

export function useFinanceData(defaults: FinanceData) {
  const [initial] = useState(() => {
    try {
      const store = new FinanceStore(localStorage, defaults, browserExclusiveWrite);
      return { store, data: store.data, error: '' };
    } catch (error) {
      return { store: null, data: defaults, error: `No se han podido cargar los datos: ${error instanceof Error ? error.message : 'almacenamiento no disponible'}. Los datos guardados no se han sobrescrito.` };
    }
  });
  const [data, setData] = useState<FinanceData>(initial.data);
  const [saveError, setSaveError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [capabilityError, setCapabilityError] = useState(browserStorageSupportError);

  function reportError(error: unknown) {
    if (error instanceof StorageConflictError) setConflict(true);
    setSaveError(saveErrorMessage(error));
  }

  useEffect(() => {
    const check = () => {
      if (initial.store?.checkForConflict()) {
        setConflict(true);
        setSaveError(new StorageConflictError().message);
      }
    };
    const changed = (event: StorageEvent) => {
      if (event.storageArea === localStorage && (event.key === DATA_KEY || event.key === null)) check();
    };
    window.addEventListener('storage', changed);
    window.addEventListener('focus', check);
    check();
    return () => { window.removeEventListener('storage', changed); window.removeEventListener('focus', check); };
  }, [initial.store]);

  useEffect(() => {
    let active = true;
    if (!browserStorageSupportError()) {
      // Probe the API in the actual document/iframe, without changing stored data.
      browserExclusiveWrite(() => undefined).catch(error => { if (active) setCapabilityError(saveErrorMessage(error)); });
    }
    return () => { active = false; };
  }, []);

  function update<K extends keyof FinanceData>(field: K, value: FinanceData[K] | ((previous: FinanceData[K]) => FinanceData[K])): Promise<SaveResult> {
    return mutate(current => ({ ...current, [field]: typeof value === 'function' ? value(current[field]) : value }));
  }
  function mutate(transform: (current: FinanceData) => FinanceData): Promise<SaveResult> {
    if (!initial.store) return Promise.resolve({ ok: false, error: initial.error });
    return initial.store.mutate(transform)
      .then(() => { setData(initial.store!.data); setSaveError(''); return { ok: true } as const; })
      .catch(error => { reportError(error); return { ok: false, error: saveErrorMessage(error) }; });
  }
  async function restore(next: RestorationInput) {
    if (!initial.store) throw new Error(initial.error);
    try { setData(await initial.store.restore(next)); setSaveError(''); }
    catch (error) { reportError(error); throw error; }
  }
  return { data, update, mutate, restore, conflict, capabilityError, loadError: initial.error, saveError };
}
