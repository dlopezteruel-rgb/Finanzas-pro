import type { FinanceData } from '../src/utils/backup';
import { planningScope, savePlanning } from '../src/utils/planning';
import { applyAutomationPreview, previewAutomation } from '../src/utils/planningAutomation';
import { chartFixture } from './chartFixture';

/** Entirely synthetic, including every account/contact/movement and approval. */
export function responsiveFixture(stale = true): FinanceData {
  let data = chartFixture();
  const families = [
    { code: 'G', name: 'Vida diaria', parts: [['g', 'Comida ficticia', 200], ['transport', 'Transporte ficticio', 100], ['leisure', 'Ocio ficticio', 0]] },
    { code: 'V', name: 'Vivienda', parts: [['rent', 'Alquiler ficticio', 1000], ['energy', 'Energía ficticia', 100]] },
    { code: 'E', name: 'Educación', parts: [['books', 'Libros ficticios', 50], ['course', 'Cursos ficticios', 50]] },
    { code: 'S', name: 'Salud', parts: [['medicine', 'Medicinas ficticias', 50], ['care', 'Cuidados ficticios', 50]] },
    { code: 'O', name: 'Otros gastos', parts: [['gifts', 'Regalos ficticios', 200]] },
  ];
  data.budgetGroups = [data.budgetGroups[0], ...families.map(f => ({ code: f.code, name: f.name, type: 'GASTO' as const, partidas: f.parts.map(([code, name]) => ({ type: 'GASTO' as const, code: String(code), name: String(name), groupCode: f.code, groupName: f.name, keywords: [] })) }))];
  const expense = (id: string, code: string, amount: number) => ({ id, code, type: 'GASTO' as const, date: '2026-09-15', amount, description: 'Origen de arrastre ficticio', categoryName: 'Vida diaria', subcategoryName: code, wallet: 'BANCO', processed: true });
  data.transactions = [...data.transactions, expense('source-food', 'g', 150), expense('source-transport', 'transport', 50)];
  data.budgetPlans = [{ monthYear: '2026-09', type: 'GASTO', code: 'g', plannedAmount: 200 }, { monthYear: '2026-09', type: 'GASTO', code: 'transport', plannedAmount: 100 }];
  const lines = [{ type: 'INGRESO' as const, code: 'i', amountCents: 300000 }, ...families.flatMap(f => f.parts.map(([code, , amount]) => ({ type: 'GASTO' as const, code: String(code), amountCents: Number(amount) * 100 })))];
  data = savePlanning(data, '2026-10', lines, 60000, planningScope(data, '2026-10'));
  data = applyAutomationPreview(data, previewAutomation(data, { kind: 'carry', source: '2026-09', amounts: [{ code: 'g', amountCents: 5000 }, { code: 'transport', amountCents: 5000 }] }));
  data = savePlanning(data, '2026-10', lines, 60000, planningScope(data, '2026-10'), true);
  if (stale) data = { ...data, budgetPlans: data.budgetPlans.map(p => p.monthYear === '2026-09' && p.code === 'g' ? { ...p, plannedAmount: 220 } : p) };
  data.loans = ['Vivienda', 'Estudios', 'Vehículo'].map((name, i) => ({ id: `fake-loan-${i}`, name: `${name} ficticios`, entity: 'BANCO', principal: 12000, interestRate: 0, totalTermMonths: 60, startDate: '2026-01-01', monthlyPayment: 200, wallet: 'BANCO', code: 'rent' }));
  return data;
}
