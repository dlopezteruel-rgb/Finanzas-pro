import {assertCatalogTransition,editCatalog,type CatalogEdit} from './budgetCatalog';
import { assertSubitemTransition } from './budgetSubitems';
import { assertIntelligentTransition } from './intelligentValidation';
import { reconcileAutomation } from './planningAutomation';
import { invalidatePlanning, reconcilePlanning } from './planning';
import { assertDeletionTransition } from './deletion';
import { confirmedClearData, type ClearDataOptions } from './clearData';
import { assertSharedTransition } from './sharedExpenses';
import { isLegacyTransfer } from './transfers';
import { assertStorageRevision, Backup, commitRestoration, DATA_KEY, FinanceData, makeBackup, parseBackup, parseSnapshot, serializeSnapshot, StorageAccess, StorageConflictError } from './backup';
import { browserStorageSupportError } from './storageSupport';
import { assertWalletTransition, reconcileDefaultWallet } from './defaultWallet';

const legacyKeys: Partial<Record<keyof FinanceData, string>> = {
  theme: 'finanzas_pro_theme', transactions: 'finanzas_pro_transactions_v2',
  budgetPlans: 'finanzas_pro_plans_v2', budgetGroups: 'finanzas_pro_groups_v2',
  contacts: 'finanzas_pro_contacts_v2', loans: 'finanzas_pro_loans_v2', wallets: 'finanzas_pro_wallets_v2',
};

export function loadFinanceData(storage: Pick<Storage, 'getItem'>, defaults: FinanceData): FinanceData {
  const active = storage.getItem(DATA_KEY);
  if (active !== null) return parseSnapshot(active);
  const data = { ...defaults };
  for (const field of Object.keys(legacyKeys) as (keyof FinanceData)[]) {
    const saved = storage.getItem(legacyKeys[field]!);
    if (saved !== null) (data as any)[field] = field === 'theme' ? saved : JSON.parse(saved);
  }
  return parseBackup(JSON.stringify(makeBackup(data)));
}

export type FinanceMutation = ((current: FinanceData) => FinanceData) | { clear: ClearDataOptions; scope: string } | { catalog: CatalogEdit };
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
    return this.mutate(current => ({ ...current, [field]: typeof value === 'function' ? value(current[field]) : value }));
  }

  /** Build, validate and commit multi-collection changes under the same lock/revision. */
  mutate(transform: FinanceMutation) {
    return this.exclusive(() => {
      this.checkRevision();
      const clearing = typeof transform !== 'function' && 'clear' in transform;
      const catalogEdit = typeof transform !== 'function' && 'catalog' in transform ? transform.catalog : undefined;
      let candidate = typeof transform === 'function' ? transform(this.data) : 'clear' in transform ? confirmedClearData(this.data, transform.clear, transform.scope) : editCatalog(this.data, transform.catalog);
      if(candidate===this.data)return this.data;
      candidate = reconcileDefaultWallet(this.data, candidate);
      if (!clearing) candidate = reconcileAutomation(this.data, reconcilePlanning(this.data, invalidatePlanning(this.data, candidate)));
      assertDeletionTransition(this.data, candidate);
      assertWalletTransition(this.data, candidate);
      assertCatalogTransition(this.data,candidate,catalogEdit);
      if (!clearing) {
        assertSubitemTransition(this.data, candidate);
        assertSharedTransition(this.data, candidate);
        assertIntelligentTransition(this.data, candidate);
        // Existing structured legs can only remain linked, or disappear together.
        for (const old of this.data.transactions.filter(t => t.transfer)) {
          const next = candidate.transactions.find(t => t.id === old.id);
          if (next && next.transfer?.id !== old.transfer!.id) throw new Error('No se puede desvincular un extremo del traspaso.');
        }
        // Historic transfer records are immutable until the explicit backed-up migration.
        for (const old of this.data.transactions.filter(isLegacyTransfer)) {
          const next = candidate.transactions.find(t => t.id === old.id);
          if (JSON.stringify(next) !== JSON.stringify(old)) throw new Error('Revisa y vincula el traspaso histórico antes de editarlo o eliminarlo.');
        }
        for (const old of this.data.wallets) {
          if (this.data.transactions.some(t => isLegacyTransfer(t) && t.wallet === old.name) &&
            !candidate.wallets.some(w => w.id === old.id && w.name === old.name)) {
            throw new Error('Vincula o revisa los traspasos históricos de esta cartera antes de renombrarla o eliminarla.');
          }
        }
      }
      // Existing forms legitimately produce optional undefined properties.
      const validated = parseBackup(JSON.stringify(makeBackup(candidate)));
      if (clearing || makeBackup(this.data).version < validated.version) {
        // Mass clearing and schema upgrades preserve a verified recovery copy first.
        this.data = commitRestoration(this.storage, this.data, validated, this.revision);
        this.revision = this.storage.getItem(DATA_KEY);
        return this.data;
      }
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
