import { assertStorageRevision, Backup, commitRestoration, DATA_KEY, FinanceData, makeBackup, parseBackup, parseSnapshot, serializeSnapshot, StorageAccess, StorageConflictError } from './backup';
import { browserStorageSupportError } from './storageSupport';

const legacyKeys: Record<keyof FinanceData, string> = {
  theme: 'finanzas_pro_theme', transactions: 'finanzas_pro_transactions_v2',
  budgetPlans: 'finanzas_pro_plans_v2', budgetGroups: 'finanzas_pro_groups_v2',
  contacts: 'finanzas_pro_contacts_v2', loans: 'finanzas_pro_loans_v2', wallets: 'finanzas_pro_wallets_v2',
};

export function loadFinanceData(storage: Pick<Storage, 'getItem'>, defaults: FinanceData): FinanceData {
  const active = storage.getItem(DATA_KEY);
  if (active !== null) return parseSnapshot(active);
  const data = { ...defaults };
  for (const field of Object.keys(legacyKeys) as (keyof FinanceData)[]) {
    const saved = storage.getItem(legacyKeys[field]);
    if (saved !== null) (data as any)[field] = field === 'theme' ? saved : JSON.parse(saved);
  }
  return parseBackup(JSON.stringify(makeBackup(data)));
}

export type ExclusiveWrite = <T>(write: () => T) => Promise<T>;
export type RestorationInput = Backup | ((current: FinanceData) => Backup);
export const STORAGE_LOCK = 'finanzas-pro-data-write';
export const browserExclusiveWrite: ExclusiveWrite = write => {
  const reason = browserStorageSupportError();
  if (reason) return Promise.reject(new Error(reason));
  return navigator.locks.request(STORAGE_LOCK, write);
};

/** Validate and persist every mutation before showing it, under a cross-tab lock. */
export class FinanceStore {
  data: FinanceData;
  private revision: string | null;
  private conflict = false;

  constructor(private storage: StorageAccess, defaults: FinanceData, private exclusive: ExclusiveWrite) {
    this.revision = storage.getItem(DATA_KEY);
    this.data = loadFinanceData(storage, defaults);
    assertStorageRevision(storage, this.revision);
  }

  checkForConflict() {
    if (this.storage.getItem(DATA_KEY) !== this.revision) this.conflict = true;
    return this.conflict;
  }

  private checkRevision() {
    if (this.checkForConflict()) throw new StorageConflictError();
  }

  update<K extends keyof FinanceData>(field: K, value: FinanceData[K] | ((previous: FinanceData[K]) => FinanceData[K])) {
    return this.exclusive(() => {
      this.checkRevision();
      const candidate = { ...this.data, [field]: typeof value === 'function' ? value(this.data[field]) : value };
      // Existing forms legitimately produce optional undefined properties.
      const validated = parseBackup(JSON.stringify(makeBackup(candidate)));
      const serialized = serializeSnapshot(validated);
      assertStorageRevision(this.storage, this.revision);
      this.storage.setItem(DATA_KEY, serialized);
      this.revision = serialized;
      this.data = validated;
      return this.data;
    });
  }

  restore(next: RestorationInput) {
    return this.exclusive(() => {
      this.checkRevision();
      const replacement = typeof next === 'function' ? next(this.data) : next;
      const restored = commitRestoration(this.storage, this.data, replacement, this.revision);
      this.revision = this.storage.getItem(DATA_KEY);
      this.data = restored;
      return restored;
    });
  }
}
