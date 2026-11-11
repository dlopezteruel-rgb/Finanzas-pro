import { BUDGET_GROUPS } from '../src/constants/categories';
import { intelligentFixture, personalObligation } from './intelligentFixture';
import { makeBackup, parseBackup, type FinanceData } from '../src/utils/backup';
import { saveSharedTransaction } from '../src/utils/sharedExpenses';
import { savePlanning, planningScope } from '../src/utils/planning';
import { saveObligation } from '../src/utils/personalObligations';

export const VISUAL_TIME = '2026-11-11T09:00:00.000Z';
export function visualFixture(theme: 'light' | 'dark' = 'light'): FinanceData {
  let data: FinanceData = { ...intelligentFixture(), theme, budgetGroups: structuredClone(BUDGET_GROUPS), wallets: [
    { id: 'bank', name: 'CUENTA PRINCIPAL FICTICIA', type: 'BANK', initialBalance: 1000, color: '#244E78' },
    { id: 'savings', name: 'AHORRO FICTICIO', type: 'SAVINGS', initialBalance: 2500, color: '#176445' },
    { id: 'cash', name: 'EFECTIVO FICTICIO', type: 'CASH', initialBalance: 80, color: '#7B5200' },
  ] };
  const partidas = data.budgetGroups.flatMap(g => g.partidas);
  for (const [code, type, amount, day, description, processed] of [
    ['L.001.001', 'INGRESO', 3000, '01', 'Nómina ficticia', true],
    ['F.001.001', 'GASTO', 900, '03', 'Alquiler ficticio', true],
    ['V.001.001', 'GASTO', 135.35, '08', 'Supermercado ficticio', true],
    ['V.001.001', 'GASTO', 65, '16', 'Compra pendiente ficticia', false],
  ] as const) {
    const p = partidas.find(p => p.code === code && p.type === type)!;
    data = saveSharedTransaction(data, { type, code, amount, date: `2026-11-${day}`, description, processed, categoryName: p.groupName, subcategoryName: p.name, wallet: data.wallets[0].name });
  }
  data = savePlanning(data, '2026-11', [
    { code: 'L.001.001', type: 'INGRESO', amountCents: 300000 },
    { code: 'F.001.001', type: 'GASTO', amountCents: 90000 },
    { code: 'V.001.001', type: 'GASTO', amountCents: 30000 },
  ], 50000, planningScope(data, '2026-11'), true);
  data = { ...data, planningMonths: data.planningMonths!.map(m => ({ ...m, approval: { ...m.approval!, approvedAt: VISUAL_TIME } })) };
  data = saveObligation(data, personalObligation({ date: '2026-11-02' }));
  return parseBackup(JSON.stringify({ ...makeBackup(data), exportedAt: VISUAL_TIME }));
}
