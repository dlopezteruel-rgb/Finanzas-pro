import test from 'node:test';
import assert from 'node:assert/strict';
import { currentMonth, shiftMonth, dateAtDay, madridDate, realDate, addDays } from './financialCalendar';
test('calendario universal: Madrid, límites, bisiestos y cambio de año',()=>{
  assert.equal(currentMonth(new Date('2026-10-31T23:30:00Z')),'2026-11');
  assert.equal(madridDate(new Date('2028-03-26T23:30:00Z')),'2028-03-27');
  assert.equal(shiftMonth('2026-12',1),'2027-01'); assert.equal(shiftMonth('0001-01',-1),null); assert.equal(shiftMonth('9999-12',1),null);
  assert.equal(dateAtDay('2028-02',31),'2028-02-29');assert.equal(dateAtDay('2100-02',31),'2100-02-28'); assert.equal(dateAtDay('2000-02',31),'2000-02-29');
  assert.equal(dateAtDay('0001-02',31),'0001-02-28');assert.equal(realDate('0000-01-01'),false);assert.equal(realDate('2026-02-29'),false);
  assert.equal(addDays('9999-12-31',29),'9999-12-31');assert.equal(addDays('0001-01-01',-1),'0001-01-01');
});
