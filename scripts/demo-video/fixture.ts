import {
  makeBackup,
  parseBackup,
  type FinanceData,
} from "../../src/utils/backup";
import type {
  MovementType,
  PlanningLine,
  RecurringMovementRule,
} from "../../src/types/finance";
import {
  saveSharedTransaction,
  saveSettlement,
  splitExactly,
  remainingDebt,
} from "../../src/utils/sharedExpenses";
import { transferPair } from "../../src/utils/transfers";
import { savePlanning, planningScope } from "../../src/utils/planning";
import {
  saveMovementRule,
  applyOccurrenceBatch,
  occurrencePreviews,
  occurrenceScope,
} from "../../src/utils/recurringMovements";
import {
  saveObligation,
  settleObligation,
} from "../../src/utils/personalObligations";
import {
  calculateMonthlySummary,
  calculateWalletBalances,
} from "../../src/utils/finance";
import { treasuryProjection } from "../../src/utils/treasury";

export const DEMO_TIME = "2026-11-10T09:00:00.000Z";
export const DEMO_MONTH = "2026-11";
export const SHOP_CONCEPT = "Compra semanal de supermercado";
export const SHARED_CONCEPT = "Comida compartida";
export const RULES = {
  salary: "demo-nomina",
  rent: "demo-alquiler",
  subscription: "demo-suscripcion",
};
export const CODES = {
  salary: "L.001.001",
  extra: "L.002.001",
  rent: "F.001.001",
  grocery: "V.001.001",
  transport: "V.002.001",
  restaurant: "V.001.002",
  subscription: "V.003.001",
  home: "F.002.001",
};
const catalog = [
  [CODES.salary, "Nómina", "INGRESO"],
  [CODES.extra, "Ingresos extraordinarios", "INGRESO"],
  [CODES.rent, "Alquiler", "GASTO"],
  [CODES.grocery, "Supermercado", "GASTO"],
  [CODES.transport, "Transporte", "GASTO"],
  [CODES.restaurant, "Restaurantes", "GASTO"],
  [CODES.subscription, "Suscripciones", "GASTO"],
  [CODES.home, "Hogar y suministros", "GASTO"],
] as const;

function ordinary(
  data: FinanceData,
  code: string,
  amount: number,
  date: string,
  description: string,
  processed = true,
) {
  const partida = data.budgetGroups
    .flatMap((g) => g.partidas)
    .find((p) => p.code === code)!;
  return saveSharedTransaction(data, {
    date,
    amount,
    description,
    processed,
    type: partida.type,
    code,
    categoryName: partida.groupName,
    subcategoryName: partida.name,
    wallet: "CUENTA PRINCIPAL",
  });
}
function batchOne(data: FinanceData, ruleId: string, month: string) {
  const row = occurrencePreviews(data, month).find((o) => o.ruleId === ruleId);
  if (!row) throw new Error("Falta una ocurrencia de la fixture ficticia.");
  return applyOccurrenceBatch(data, {
    first: month,
    last: month,
    ids: [row.id],
    scope: occurrenceScope(data),
    action: "register",
    acknowledgeCollisions: false,
  });
}
function fixtureApprovalDates(data: FinanceData): FinanceData {
  return {
    ...data,
    planningMonths: data.planningMonths?.map((m) => ({
      ...m,
      ...(m.approval
        ? { approval: { ...m.approval, approvedAt: DEMO_TIME } }
        : {}),
    })),
    ...(data.planningAutomation
      ? {
          planningAutomation: {
            ...data.planningAutomation,
            history: data.planningAutomation.history.map((h) => ({
              ...h,
              approvals: h.approvals.map((a) => ({
                ...a,
                approvedAt: DEMO_TIME,
              })),
            })),
          },
        }
      : {}),
  };
}

/** Only synthetic entities. Relations, principal flows and approvals use the real domain. */
export function demoData(scene = 1): FinanceData {
  let data: FinanceData = {
    theme: "light",
    transactions: [],
    budgetPlans: [],
    loans: [],
    wallets: [
      {
        id: "principal",
        name: "CUENTA PRINCIPAL",
        type: "BANK",
        initialBalance: 1500,
        color: "#0ea5e9",
      },
      {
        id: "ahorro",
        name: "CUENTA DE AHORRO",
        type: "SAVINGS",
        initialBalance: 4000,
        color: "#14b8a6",
      },
      {
        id: "efectivo",
        name: "EFECTIVO",
        type: "CASH",
        initialBalance: 120,
        color: "#f59e0b",
      },
    ],
    contacts: [
      {
        id: "amistad-a",
        name: "Amistad A",
        createdAt: "2026-01-01",
        notes: "Contacto ficticio de demostración",
      },
      {
        id: "amistad-b",
        name: "Amistad B",
        createdAt: "2026-01-01",
        notes: "Contacto ficticio de demostración",
      },
    ],
    budgetGroups: (["INGRESO", "GASTO"] as MovementType[]).map((type) => ({
      code: type === "INGRESO" ? "DEMO.I" : "DEMO.G",
      name: type === "INGRESO" ? "Ingresos" : "Gastos del mes",
      type,
      partidas: catalog
        .filter((p) => p[2] === type)
        .map(([code, name]) => ({
          code,
          name,
          type,
          groupCode: type === "INGRESO" ? "DEMO.I" : "DEMO.G",
          groupName: type === "INGRESO" ? "Ingresos" : "Gastos del mes",
          keywords: [name.toLowerCase()],
        })),
    })),
  };
  for (const [id, code, concept, amountCents, day, type] of [
    [RULES.salary, CODES.salary, "Nómina mensual", 250000, 1, "INGRESO"],
    [RULES.rent, CODES.rent, "Alquiler mensual", 85000, 3, "GASTO"],
    [
      RULES.subscription,
      CODES.subscription,
      "Suscripción digital",
      1499,
      5,
      "GASTO",
    ],
  ] as const) {
    const p = data.budgetGroups
      .flatMap((g) => g.partidas)
      .find((p) => p.code === code)!;
    const rule: RecurringMovementRule = {
      id,
      code,
      concept,
      type,
      amountCents,
      day,
      frequency: "monthly",
      startDate: "2026-11-01",
      walletId: "principal",
      active: true,
      categoryName: p.groupName,
      subcategoryName: p.name,
    };
    data = saveMovementRule(data, rule);
    data = batchOne(data, id, DEMO_MONTH);
    const tx = data.transactions.find((t) => t.recurrence?.ruleId === id)!;
    data = saveSharedTransaction(data, { ...tx, processed: true }, tx.id);
  }
  data = ordinary(
    data,
    CODES.extra,
    180,
    "2026-11-04",
    "Ingreso extraordinario",
  );
  for (const [amount, date] of [
    [75.2, "2026-11-02"],
    [58.3, "2026-11-06"],
    [42.5, "2026-11-08"],
  ] as const)
    data = ordinary(
      data,
      CODES.grocery,
      amount,
      date,
      "Compra de supermercado",
    );
  data = ordinary(
    data,
    CODES.transport,
    45,
    "2026-11-05",
    "Abono de transporte",
  );
  data = ordinary(
    data,
    CODES.restaurant,
    82,
    "2026-11-07",
    "Restaurante del fin de semana",
  );
  data = ordinary(
    data,
    CODES.home,
    65,
    "2026-11-16",
    "Suministros del hogar",
    false,
  );
  data = {
    ...data,
    transactions: [
      ...data.transactions,
      ...transferPair(
        data.wallets,
        {
          fromWalletId: "principal",
          toWalletId: "ahorro",
          amount: 400,
          date: "2026-11-04",
          concept: "Ahorro del mes",
          processed: true,
        },
        "demo-traspaso",
      ),
    ],
  };
  const p = data.budgetGroups
    .flatMap((g) => g.partidas)
    .find((p) => p.code === CODES.restaurant)!;
  data = saveSharedTransaction(data, {
    date: "2026-11-08",
    amount: 90,
    type: "GASTO",
    code: p.code,
    categoryName: p.groupName,
    subcategoryName: p.name,
    description: SHARED_CONCEPT,
    wallet: "CUENTA PRINCIPAL",
    processed: true,
    splitInfo: {
      ...splitExactly(90, data.contacts, "principal"),
      distribution: { method: "equal" },
    },
  });
  const shared = data.transactions.find(
    (t) => t.description === SHARED_CONCEPT,
  )!;
  data = saveSettlement(data, {
    operationId: "demo-reintegro-parcial",
    expenseId: shared.id,
    contactId: "amistad-a",
    amount: 10,
    date: "2026-11-09",
    kind: "cash",
    processed: true,
    walletId: "principal",
  });
  data = saveObligation(data, {
    id: "demo-credito",
    direction: "receivable",
    counterparty: { name: "Amistad A", contactId: "amistad-a" },
    concept: "Préstamo personal concedido",
    principalCents: 20000,
    date: "2026-11-02",
    dueDate: "2026-11-22",
    cancelled: false,
    settlements: [],
  });
  data = settleObligation(data, "demo-credito", {
    id: "demo-cobro-parcial",
    amountCents: 5000,
    date: "2026-11-09",
    kind: "bank",
    walletId: "principal",
    processed: true,
    note: "Devolución parcial ficticia",
  });
  data = saveObligation(data, {
    id: "demo-deuda",
    direction: "payable",
    counterparty: { name: "Contraparte demo" },
    concept: "Compromiso personal pendiente",
    principalCents: 12000,
    date: "2026-11-01",
    dueDate: "2026-11-25",
    cancelled: false,
    settlements: [],
  });
  data = settleObligation(data, "demo-deuda", {
    id: "demo-pago-parcial",
    amountCents: 3000,
    date: "2026-11-06",
    kind: "adjustment",
    processed: true,
    note: "Acuerdo ficticio sin movimiento bancario",
  });
  const lines: PlanningLine[] = [
    { type: "INGRESO", code: CODES.salary, amountCents: 250000 },
    { type: "INGRESO", code: CODES.extra, amountCents: 20000 },
    { type: "GASTO", code: CODES.rent, amountCents: 85000 },
    { type: "GASTO", code: CODES.grocery, amountCents: 25000 },
    { type: "GASTO", code: CODES.transport, amountCents: 12000 },
    { type: "GASTO", code: CODES.restaurant, amountCents: 7000 },
    { type: "GASTO", code: CODES.subscription, amountCents: 2000 },
    { type: "GASTO", code: CODES.home, amountCents: 9000 },
  ];
  data = fixtureApprovalDates(
    savePlanning(
      data,
      DEMO_MONTH,
      lines,
      50000,
      planningScope(data, DEMO_MONTH),
      true,
    ),
  );
  // Independent contexts replay the narrative state established by earlier scenes.
  if (scene >= 4)
    data = ordinary(data, CODES.grocery, 32.5, "2026-11-10", SHOP_CONCEPT);
  if (scene >= 5)
    data = fixtureApprovalDates(
      savePlanning(
        data,
        DEMO_MONTH,
        [{ type: "GASTO", code: CODES.grocery, amountCents: 30000 }],
        50000,
        planningScope(data, DEMO_MONTH),
        true,
      ),
    );
  if (scene >= 6) data = batchOne(data, RULES.subscription, "2026-12");
  return parseBackup(
    JSON.stringify({ ...makeBackup(data), exportedAt: DEMO_TIME }),
  );
}

export function demoMetrics(data: FinanceData) {
  const projection = treasuryProjection(data, "2026-11-10");
  const shared = data.transactions.find(
    (t) => t.description === SHARED_CONCEPT,
  )!;
  return {
    wallets: calculateWalletBalances(data.wallets, data.transactions),
    liquidCents: projection.liquidCents,
    projectedCents: projection.projectedCents,
    summary: calculateMonthlySummary(
      DEMO_MONTH,
      data.transactions,
      data.budgetPlans,
      data.budgetGroups.flatMap((g) => g.partidas),
    ),
    shared: {
      total: 90,
      own: 30,
      assignedEach: 30,
      reimbursed: 10,
      remainingA: remainingDebt(shared, "amistad-a"),
      remainingB: remainingDebt(shared, "amistad-b"),
    },
    personal: { receivableCents: 15000, payableCents: 9000 },
    futureEvents: projection.events.length,
  };
}
