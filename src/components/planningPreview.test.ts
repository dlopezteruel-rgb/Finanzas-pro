import test from 'node:test';
import assert from 'node:assert/strict';
import { planningDraftPreview } from './planningPreview';
import { formatPlanningCents } from '../utils/planning';

const input = (income = '3000', expense = '1800') => [
  { type: 'INGRESO' as const, code: 'salary', input: income },
  { type: 'GASTO' as const, code: 'food', input: expense },
];
const carry = [{ type: 'GASTO' as const, code: 'food', amountCents: 10000 }];

test('4: borrador distingue pendiente 600, base 1800, efectivo 1900 y margen efectivo 500', () => {
  const preview = planningDraftPreview(input(), '600', carry);
  assert.equal(preview.baseTotals?.income, 300000);
  assert.equal(preview.baseTotals?.savings, 60000);
  assert.equal(preview.baseTotals?.expenses, 180000);
  assert.equal(preview.baseTotals?.margin, 60000);
  assert.equal(preview.carryCents, 10000);
  assert.equal(preview.totals?.expenses, 190000);
  assert.equal(preview.totals?.margin, 50000);
  assert.deepEqual(preview.edits.map(l => l.amountCents), [300000, 180000]);
});
test('4: céntimos españoles exactos, varios arrastres y ninguna mutación de entradas', () => {
  const inputs = input('3.000,01', '1.800,02'), adjustments = [...carry, { type: 'GASTO' as const, code: 'other', amountCents: 1 }];
  const before = JSON.stringify({ inputs, adjustments });
  const p = planningDraftPreview(inputs, '600,03', adjustments);
  assert.equal(p.baseTotals?.margin, 59996);
  assert.equal(p.totals?.margin, 49995);
  assert.equal(formatPlanningCents(p.totals!.margin), '499,95 €');
  assert.equal(JSON.stringify({ inputs, adjustments }), before);
});
test('4: sin arrastre los dos márgenes coinciden; objetivo y déficit nunca ajustan importes', () => {
  const p = planningDraftPreview(input('100', '80'), '30', []);
  assert.equal(p.baseTotals?.margin, -1000);
  assert.equal(p.totals?.margin, -1000);
  assert.equal(p.carryCents, 0);
  assert.equal(p.edits[1].amountCents, 8000);
  assert.equal(planningDraftPreview(input('100', '0'), '150', carry).totals?.margin, -15000);
});
for (const invalid of ['', '1,', '1.234', '-1', '1e3', '0.001', '90071992547409.92']) test(`4: importe parcial/inválido ${JSON.stringify(invalid)} retira ambos totales`, () => {
  const p = planningDraftPreview(input('3000', invalid), '600', carry);
  assert.ok(p.errors['GASTO:food']);
  assert.equal(p.baseTotals, null);
  assert.equal(p.totals, null);
  assert.equal(p.carryCents, 10000);
});
test('4: objetivo inválido y desbordamientos de suma no presentan totales antiguos', () => {
  const invalidGoal = planningDraftPreview(input(), '6,', carry);
  assert.ok(invalidGoal.savingsError);
  assert.equal(invalidGoal.baseTotals, null);
  const overflow = planningDraftPreview(input('0', '90071992547409.91'), '0', carry);
  assert.ok(overflow.errors['GASTO:food']);
  assert.equal(overflow.totals, null);
  const sum = planningDraftPreview([...input('0', '90071992547409.91'), { type: 'GASTO', code: 'second', input: '1' }], '0', []);
  assert.ok(sum.totalError);
  assert.equal(sum.baseTotals, null);
  assert.equal(sum.totals, null);
});
