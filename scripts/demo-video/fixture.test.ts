import test from "node:test";
import assert from "node:assert/strict";
import { demoData, demoMetrics, DEMO_TIME } from "./fixture";
import { makeBackup, parseBackup } from "../../src/utils/backup";
import {
  financialAssistantContext,
  localFinancialAdvice,
} from "../../src/utils/financialAssistant";
test("la fixture ficticia 3.1 es coherente para los diez puntos del relato", () => {
  for (let scene = 1; scene <= 10; scene++) {
    const d = demoData(scene),
      b = makeBackup(d);
    assert.equal(b.version, "3.1");
    parseBackup(JSON.stringify(b));
    assert.equal(d.wallets.length, 3);
    assert.ok(d.contacts.every((c) => !c.phoneOrEmail));
    assert.equal(demoMetrics(d).liquidCents, scene >= 4 ? 706951 : 710201);
    assert.equal(demoMetrics(d).shared.remainingA, 20);
    assert.equal(demoMetrics(d).shared.remainingB, 30);
    assert.equal(d.planningMonths![0].savingsCents, 50000);
    assert.equal(d.planningMonths![0].approval!.approvedAt, DEMO_TIME);
    const before = JSON.stringify(d),
      context = financialAssistantContext(d, "2026-11", "2026-11-10");
    assert.ok(
      localFinancialAdvice(context, "¿Cuánto dinero tengo disponible?"),
    );
    assert.ok(
      localFinancialAdvice(
        context,
        "¿Qué gastos puedo reducir para ahorrar 150 € más?",
      ),
    );
    assert.equal(JSON.stringify(d), before);
  }
});
test("las siguientes escenas reproducen exclusivamente los cambios narrados", () => {
  const a = demoMetrics(demoData(3)),
    b = demoMetrics(demoData(4)),
    c = demoMetrics(demoData(6));
  assert.equal(a.liquidCents - b.liquidCents, 3250);
  assert.equal(c.liquidCents, b.liquidCents);
  assert.equal(
    demoData(5).budgetPlans.find((p) => p.code === "V.001.001")!.plannedAmount,
    300,
  );
  assert.equal(
    demoData(6).transactions.filter(
      (t) => t.recurrence?.dueDate === "2026-12-05",
    ).length,
    1,
  );
});
