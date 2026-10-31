import { useEffect, useState } from 'react';
import { DATA_KEY, FinanceData, StorageConflictError } from './backup';
import { browserExclusiveWrite, FinanceStore, RestorationInput } from './financeStore';
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

  function reportError(error: unknown) {
    if (error instanceof StorageConflictError) setConflict(true);
    setSaveError(error instanceof Error ? error.message : 'No se pudieron guardar los cambios. Los datos anteriores se conservan.');
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

  function update<K extends keyof FinanceData>(field: K, value: FinanceData[K] | ((previous: FinanceData[K]) => FinanceData[K])) {
    if (!initial.store) return Promise.resolve(false);
    return initial.store.update(field, value)
      .then(saved => { setData(saved); setSaveError(''); return true; })
      .catch(error => { reportError(error); return false; });
  }
  async function restore(next: RestorationInput) {
    if (!initial.store) throw new Error(initial.error);
    try { setData(await initial.store.restore(next)); setSaveError(''); }
    catch (error) { reportError(error); throw error; }
  }
  return { data, update, restore, conflict, loadError: initial.error, saveError };
}
