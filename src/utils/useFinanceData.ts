import { useEffect, useRef, useState } from 'react';
import { Backup, commitRestoration, DATA_KEY, FinanceData, makeBackup, parseBackup } from './backup';

const legacyKeys: Record<keyof FinanceData, string> = {
  theme: 'finanzas_pro_theme', transactions: 'finanzas_pro_transactions_v2',
  budgetPlans: 'finanzas_pro_plans_v2', budgetGroups: 'finanzas_pro_groups_v2',
  contacts: 'finanzas_pro_contacts_v2', loans: 'finanzas_pro_loans_v2', wallets: 'finanzas_pro_wallets_v2',
};

export function loadFinanceData(storage: Pick<Storage, 'getItem'>, defaults: FinanceData): FinanceData {
  const active = storage.getItem(DATA_KEY);
  if (active !== null) return parseBackup(active);
  const data = { ...defaults };
  for (const field of Object.keys(legacyKeys) as (keyof FinanceData)[]) {
    const saved = storage.getItem(legacyKeys[field]);
    if (saved !== null) (data as any)[field] = field === 'theme' ? saved : JSON.parse(saved);
  }
  // No migration deletes or overwrites the original keys.
  return parseBackup(JSON.stringify(makeBackup(data)));
}

export function useFinanceData(defaults: FinanceData) {
  const [initial] = useState(() => {
    try { return { data: loadFinanceData(localStorage, defaults), error: '' }; }
    catch (error) { return { data: defaults, error: `No se han podido cargar los datos: ${error instanceof Error ? error.message : 'almacenamiento no disponible'}. Los datos guardados no se han sobrescrito.` }; }
  });
  const [data, setData] = useState<FinanceData>(initial.data);
  const [saveError, setSaveError] = useState('');
  const current = useRef(data);
  current.current = data;
  const firstRender = useRef(true);

  useEffect(() => {
    // Loading does not rewrite legacy data or a damaged active snapshot.
    if (firstRender.current) { firstRender.current = false; return; }
    if (initial.error) return;
    try { localStorage.setItem(DATA_KEY, JSON.stringify(makeBackup(data))); setSaveError(''); }
    catch { setSaveError('No se pudieron guardar los cambios en este navegador. Exporta una copia antes de cerrar la página.'); }
  }, [data, initial.error]);

  function update<K extends keyof FinanceData>(field: K, value: FinanceData[K] | ((previous: FinanceData[K]) => FinanceData[K])) {
    setData(previous => ({ ...previous, [field]: typeof value === 'function' ? value(previous[field]) : value }));
  }
  function restore(next: Backup) {
    const restored = commitRestoration(localStorage, current.current, next);
    current.current = restored;
    setData(restored);
    setSaveError('');
  }
  return { data, update, restore, loadError: initial.error, saveError };
}
