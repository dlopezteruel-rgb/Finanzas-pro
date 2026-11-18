import {BUDGET_GROUPS} from '../constants/categories';
import {memoryFinanceStorage} from '../platform/financeBinding';
import {FinanceStore, type ExclusiveWrite} from '../utils/financeStore';
import {type FinanceData, makeBackup, parseBackup} from '../utils/backup';
import {systemCatalogNames} from '../utils/catalogNames';
import {demoAvailable, disabledDemoPolicy, type DemoPolicy} from './policy';

export type DemoAction = 'add-fictional-wallet' | 'record-fictional-expense';
export interface IsolatedDemo {
  readonly capabilities: Readonly<{dataClass: 'fictitious'; persistence: 'none'; import: false; export: false; synchronization: false; remoteAPI: false; account: false}>;
  isOpen(): boolean;
  snapshot(): FinanceData;
  dispatch(action: DemoAction): Promise<FinanceData>;
  close(): void;
}
function fictitiousSeed(): FinanceData {
  return parseBackup(JSON.stringify(makeBackup({theme: 'dark', budgetGroups: structuredClone(BUDGET_GROUPS), catalogNames: systemCatalogNames(),
    wallets: [{id: 'demo-wallet', name: 'DEMO FICTICIA', type: 'CASH', initialBalance: 100, color: '#2563eb'}],
    transactions: [], budgetPlans: [], contacts: [], loans: []})));
}
/** No storage, native driver, tokens, profile, importer or remote service can be injected.
 * The only inputs are governance and curated actions; arbitrary personal snapshots are unsupported.
 * Each instance owns a private memory adapter. Its queue never replaces persistent Web Locks/CAS.
 */
export function openIsolatedDemo(policySource: () => DemoPolicy = () => disabledDemoPolicy, now: () => number = Date.now): IsolatedDemo {
  let active = true, store: FinanceStore | null = null, sequence = 0;
  let pending: Promise<unknown> = Promise.resolve();
  const close = () => { active = false; store = null; };
  function requireActive() {
    if (!active) throw new Error('DEMO_CLOSED');
    let enabled = false;
    try { enabled = demoAvailable(policySource(), now()); } catch { /* Fail closed without leaking policy/credential errors. */ }
    if (!enabled) { close(); throw new Error('DEMO_DISABLED'); }
  }
  requireActive();
  const exclusive: ExclusiveWrite = <T>(write: () => T) => {
    const task = pending.then(() => { requireActive(); return write(); });
    pending = task.then(() => undefined, () => undefined);
    return task;
  };
  store = new FinanceStore(memoryFinanceStorage(), fictitiousSeed(), exclusive);
  return Object.freeze({
    capabilities: Object.freeze({dataClass: 'fictitious', persistence: 'none', import: false, export: false, synchronization: false, remoteAPI: false, account: false} as const),
    isOpen() { try { requireActive(); return true; } catch { return false; } },
    snapshot() { requireActive(); return structuredClone(store!.data); },
    async dispatch(action: DemoAction) {
      requireActive();
      if (action !== 'add-fictional-wallet' && action !== 'record-fictional-expense') throw new Error('DEMO_ACTION_BLOCKED');
      const id = 'demo-fixture-' + (++sequence);
      const result = await store!.mutate(draft => {
        if (action === 'add-fictional-wallet') return {...draft, wallets: [...draft.wallets, {id, name: 'DEMO FICTICIA ' + sequence, type: 'CASH' as const, initialBalance: 0, color: '#2563eb'}]};
        const family = draft.budgetGroups.find(g => g.type === 'GASTO' && !g.archived)!;
        const partida = family.partidas.find(p => !p.archived)!;
        return {...draft, transactions: [...draft.transactions, {id, date: '2026-11-18', amount: 1.23, type: 'GASTO' as const, code: partida.code,
          categoryName: family.name, subcategoryName: partida.name, description: 'OPERACION FICTICIA DEMO', wallet: draft.wallets[0].name, processed: true}]};
      });
      requireActive();
      return structuredClone(result);
    },
    close,
  });
}
