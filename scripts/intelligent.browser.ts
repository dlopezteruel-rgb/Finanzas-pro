import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdir } from "node:fs/promises";
import { chromium, type Page, type BrowserContext } from "playwright-core";
import {
  DATA_KEY,
  RECOVERY_PREFIX,
  makeBackup,
  type FinanceData,
} from "../src/utils/backup";
import { STORAGE_LOCK } from "../src/utils/financeStore";
import {
  intelligentFixture as fixture,
  movementRule as rule,
  personalObligation as obligation,
} from "./intelligentFixture";
import {
  applyOccurrenceBatch,
  occurrenceScope,
  occurrencePreviews,
  saveMovementRule,
} from "../src/utils/recurringMovements";
import { saveObligation } from "../src/utils/personalObligations";
import { savePlanning, planningScope } from "../src/utils/planning";

const nav = (p: Page, name: string) =>
  p
    .getByRole("button", {
      name: new RegExp(`^(?:\\d+\\s*)?${name}(?:\\s*\\d+)?$`),
    })
    .first()
    .click();
const saved = (p: Page) =>
  p.evaluate((k) => JSON.parse(localStorage.getItem(k)!), DATA_KEY);
const snapshot = (p: Page) =>
  p.evaluate(() =>
    Object.fromEntries(
      Object.entries(localStorage).filter(([k]) =>
        k.startsWith("finanzas_pro_"),
      ),
    ),
  );
const review = (p: Page, title: string) =>
  p.getByRole("dialog", { name: title, exact: true });
async function confirm(p: Page, title: string) {
  const d = review(p, title);
  await d
    .getByRole("button", { name: "Confirmar operación", exact: true })
    .click();
  await d.waitFor({ state: "hidden" });
}
async function openRecurring(p: Page) {
  await nav(p, "Movimientos");
  await p
    .getByRole("button", { name: "Movimientos periódicos", exact: true })
    .click();
}
async function newRule(p: Page) {
  await p
    .getByRole("button", { name: "Nueva regla periódica", exact: true })
    .click();
  const d = review(p, "Regla de movimiento periódico");
  await d.getByLabel("Concepto", { exact: true }).fill("Alquiler 31 ficticio");
  await d.getByLabel("Importe periódico (€)", { exact: true }).fill("950");
  await d
    .getByLabel("Partida periódica", { exact: true })
    .selectOption("GASTO:g");
  await d.getByLabel("Día del mes", { exact: true }).fill("31");
  await d.getByLabel("Inicio", { exact: true }).fill("2028-01-31");
  await d.getByRole("button", { name: "Revisar regla", exact: true }).click();
}
const fakeTime = "2026-11-10T12:00:00Z";
function populated(): FinanceData {
  let d = saveMovementRule(fixture(), rule({ day: 20 }));
  d = saveMovementRule(
    d,
    rule({
      id: "salary",
      type: "INGRESO",
      code: "i",
      concept: "Nómina ficticia",
      amountCents: 150000,
      day: 15,
    }),
  );
  const row = occurrencePreviews(d, "2026-11").find(
    (r) => r.ruleId === "rent",
  )!;
  d = applyOccurrenceBatch(d, {
    first: "2026-11",
    last: "2026-11",
    ids: [row.id],
    action: "register",
    scope: occurrenceScope(d),
    acknowledgeCollisions: false,
  });
  d = saveObligation(d, obligation({ dueDate: undefined }));
  return savePlanning(
    d,
    "2026-11",
    [
      { type: "INGRESO", code: "i", amountCents: 150000 },
      { type: "GASTO", code: "g", amountCents: 95000 },
    ],
    30000,
    planningScope(d, "2026-11"),
    true,
  );
}
test(
  "Fase 5: integración segura y responsive en Chromium aislado",
  { timeout: 300000 },
  async (t) => {
    const listener = createServer();
    await new Promise<void>((r) => listener.listen(0, "127.0.0.1", r));
    const port = (listener.address() as { port: number }).port;
    await new Promise<void>((r) => listener.close(() => r()));
    const server = spawn(process.execPath, ["--import", "tsx", "server.ts"], {
      env: {
        ...process.env,
        GEMINI_API_KEY: "",
        PORT: String(port),
        NODE_ENV: "production",
      },
      stdio: "pipe",
    });
    let log = "";
    server.stdout.on("data", (c) => (log += c));
    server.stderr.on("data", (c) => (log += c));
    t.after(() => {
      server.kill();
    });
    const url = `http://127.0.0.1:${port}`;
    let ready = false;
    for (let i = 0; i < 100; i++) {
      if (server.exitCode !== null) throw new Error(log);
      try {
        if ((await fetch(url)).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((r) => setTimeout(r, 100));
    }
    assert.ok(ready, log);
    const browser = await chromium.launch({
      executablePath: process.env.CHROMIUM_PATH || "/usr/bin/chromium",
      args: ["--no-sandbox"],
    });
    t.after(() => browser.close());
    async function setup(
      initial = fixture(),
      width = 1280,
      theme: "light" | "dark" = "dark",
      time = fakeTime,
    ) {
      const context = await browser.newContext({
        viewport: { width, height: 1000 },
        timezoneId: "America/Los_Angeles",
        ...(width === 390 ? { isMobile: true, hasTouch: true } : {}),
      });
      await context.addInitScript(
        ({ key, value }) => {
          if (localStorage.getItem(key) === null)
            localStorage.setItem(key, value);
        },
        {
          key: DATA_KEY,
          value: JSON.stringify(makeBackup({ ...initial, theme })),
        },
      );
      await context.route("**/*", (route) =>
        new URL(route.request().url()).origin === url
          ? route.continue()
          : route.abort(),
      );
      const page = await context.newPage();
      await page.clock.setFixedTime(new Date(time));
      page.setDefaultTimeout(7000);
      const errors: string[] = [];
      page.on("pageerror", (e) => errors.push(e.message));
      await page.goto(url);
      await page
        .getByLabel("Seleccionar periodo contable", { exact: true })
        .waitFor();
      return {
        page,
        context,
        close: async () => {
          await context.close();
          assert.deepEqual(errors, []);
        },
      };
    }
    await t.test(
      "calendario Madrid, periodos vacíos, límites y guardia guardar/descartar sin escrituras de consulta",
      async () => {
        const s = await setup(fixture(), 1280, "dark", "2026-10-31T23:30:00Z");
        const { page: p } = s;
        try {
          assert.equal(
            await p.getByLabel("Seleccionar periodo contable").inputValue(),
            "2026-11",
          );
          const before = await snapshot(p);
          const choose = async (year: string, month: string) => {
            await p.getByRole("button", { name: "Elegir mes y año" }).click();
            const d = review(p, "Elegir mes y año");
            await d.getByLabel("Año", { exact: true }).fill(year);
            await d.getByLabel("Mes", { exact: true }).selectOption(month);
            await d.getByRole("button", { name: "Consultar periodo" }).click();
          };
          await choose("2029", "02");
          assert.equal(
            await p.getByLabel("Seleccionar periodo contable").inputValue(),
            "2029-02",
          );
          await choose("1", "01");
          assert.equal(
            await p
              .getByRole("button", { name: "Mes anterior", exact: true })
              .isDisabled(),
            true,
          );
          await choose("9999", "12");
          assert.equal(
            await p
              .getByRole("button", { name: "Mes siguiente", exact: true })
              .isDisabled(),
            true,
          );
          await p
            .getByRole("button", { name: "Ir al mes actual", exact: true })
            .click();
          assert.deepEqual(await snapshot(p), before);
          await nav(p, "Presupuestos");
          const planner = p.getByRole("region", {
            name: "Planificación financiera",
          });
          await planner
            .getByRole("textbox", {
              name: "Previsto INGRESO Nómina ficticia",
              exact: true,
            })
            .fill("2000");
          await p
            .getByRole("button", { name: "Mes siguiente", exact: true })
            .click();
          const guard = review(p, "Cambios de planificación sin guardar");
          await guard
            .getByRole("button", { name: "Seguir editando", exact: true })
            .click();
          assert.equal(
            await planner
              .getByRole("textbox", {
                name: "Previsto INGRESO Nómina ficticia",
                exact: true,
              })
              .inputValue(),
            "2000",
          );
          assert.deepEqual(await snapshot(p), before);
          await p
            .getByRole("button", { name: "Mes siguiente", exact: true })
            .click();
          await p.evaluate((key) => {
            const set = Storage.prototype.setItem;
            (window as any).restorePlanningStorage = () =>
              (Storage.prototype.setItem = set);
            Storage.prototype.setItem = function (k, v) {
              if (k === key)
                throw new DOMException("Ficticio", "QuotaExceededError");
              return set.call(this, k, v);
            };
          }, DATA_KEY);
          await guard
            .getByRole("button", { name: "Guardar y continuar", exact: true })
            .click();
          await guard.getByRole("alert").waitFor();
          assert.equal(
            await p
              .locator('select[aria-label="Seleccionar periodo contable"]')
              .inputValue(),
            "2026-11",
          );
          assert.equal((await saved(p)).budgetPlans.length, 0);
          await p.evaluate(() => (window as any).restorePlanningStorage());
          await guard
            .getByRole("button", { name: "Guardar y continuar", exact: true })
            .click();
          await guard.waitFor({ state: "hidden" });
          assert.equal(
            await p.getByLabel("Seleccionar periodo contable").inputValue(),
            "2026-12",
          );
          assert.equal(
            (await saved(p)).budgetPlans.find(
              (b: any) => b.monthYear === "2026-11",
            ).plannedAmount,
            2000,
          );
        } finally {
          await s.close();
        }
      },
    );
    await t.test(
      "el listado conserva filtros al cambiar de periodo y un mes vacío no muestra otros meses",
      async () => {
        const s = await setup(populated());
        const { page: p } = s;
        try {
          const before = await snapshot(p);
          await nav(p, "Movimientos");
          await p.getByLabel("Periodo del listado").selectOption("selected");
          assert.equal(
            await p
              .getByRole("list", { name: "Movimientos filtrados" })
              .getByRole("listitem")
              .count(),
            1,
          );
          await p.getByRole("button", { name: "Elegir mes y año" }).click();
          const d = review(p, "Elegir mes y año");
          await d.getByLabel("Año", { exact: true }).fill("2029");
          await d.getByLabel("Mes", { exact: true }).selectOption("02");
          await d.getByRole("button", { name: "Consultar periodo" }).click();
          assert.equal(
            await p.getByLabel("Periodo del listado").inputValue(),
            "selected",
          );
          assert.equal(
            await p
              .getByRole("list", { name: "Movimientos filtrados" })
              .getByRole("listitem")
              .count(),
            0,
          );
          assert.deepEqual(await snapshot(p), before);
        } finally {
          await s.close();
        }
      },
    );
    await t.test(
      "regla con copia previa, cancelación, lote bajo lock, doble clic, recarga e idempotencia",
      async () => {
        const s = await setup();
        const { page: p } = s;
        try {
          await openRecurring(p);
          const before = await snapshot(p);
          await newRule(p);
          await review(p, "Confirmar regla periódica")
            .getByRole("button", { name: "Cancelar", exact: true })
            .click();
          assert.deepEqual(await snapshot(p), before);
          await review(p, "Regla de movimiento periódico")
            .getByRole("button", { name: "Revisar regla", exact: true })
            .click();
          await confirm(p, "Confirmar regla periódica");
          const created = await saved(p);
          assert.equal(created.version, "3.1");
          assert.equal(created.transactions.length, 0);
          const copies = await snapshot(p);
          assert.equal(
            Object.keys(copies).filter((k) => k.startsWith(RECOVERY_PREFIX))
              .length,
            1,
          );
          await p.getByLabel("Ocurrencias desde").fill("2028-01");
          await p.getByLabel("Ocurrencias hasta").fill("2028-03");
          await p
            .getByRole("button", {
              name: "Seleccionar propuestas",
              exact: true,
            })
            .click();
          await p
            .getByRole("button", {
              name: "Revisar registro pendiente",
              exact: true,
            })
            .click();
          assert.match(
            await review(p, "Confirmar ocurrencias").innerText(),
            /2028-02-29/,
          );
          const untouched = await snapshot(p);
          await p.evaluate(async (lock) => {
            let enter!: () => void;
            const ready = new Promise<void>((r) => (enter = r));
            (window as any).held = navigator.locks.request(lock, async () => {
              enter();
              await new Promise<void>((r) => ((window as any).release = r));
            });
            await ready;
          }, STORAGE_LOCK);
          await review(p, "Confirmar ocurrencias")
            .getByRole("button", { name: "Confirmar operación", exact: true })
            .evaluate((el) => {
              (el as HTMLButtonElement).click();
              (el as HTMLButtonElement).click();
            });
          await p.waitForFunction(
            () =>
              document.querySelector("[role=dialog] button:disabled") !== null,
          );
          await p.keyboard.press("Escape");
          assert.deepEqual(await snapshot(p), untouched);
          await p.evaluate(() => (window as any).release());
          await review(p, "Confirmar ocurrencias").waitFor({ state: "hidden" });
          const recorded = await saved(p);
          assert.equal(recorded.transactions.length, 3);
          assert.ok(
            recorded.transactions.every((tx: any) => tx.processed === false),
          );
          assert.equal(recorded.intelligentFinance.occurrences.length, 3);
          await p.reload();
          await openRecurring(p);
          await p.getByLabel("Ocurrencias desde").fill("2028-01");
          await p.getByLabel("Ocurrencias hasta").fill("2028-03");
          assert.equal(
            await p
              .getByRole("checkbox", { name: /Seleccionar Alquiler/ })
              .count(),
            0,
          );
          await p
            .getByRole("button", {
              name: "Pausar Alquiler 31 ficticio",
              exact: true,
            })
            .click();
          await confirm(p, "Confirmar regla periódica");
          assert.equal((await saved(p)).transactions.length, 3);
        } finally {
          await s.close();
        }
      },
    );
    await t.test(
      "coincidencia manual exige decisión y omitir no altera el movimiento",
      async () => {
        let d = saveMovementRule(fixture(), rule({ day: 15 }));
        d.transactions = [
          {
            id: "manual",
            date: "2026-11-15",
            amount: 950,
            type: "GASTO",
            code: "g",
            categoryName: "G",
            subcategoryName: "Gasto",
            description: "Alquiler manual ficticio",
            wallet: "BANCO FICTICIO",
            processed: false,
          },
        ];
        const s = await setup(d);
        const { page: p } = s;
        try {
          await openRecurring(p);
          const original = (await saved(p)).transactions;
          await p
            .getByRole("button", {
              name: "Seleccionar propuestas",
              exact: true,
            })
            .click();
          await p
            .getByRole("button", {
              name: "Revisar registro pendiente",
              exact: true,
            })
            .click();
          assert.equal(
            await review(p, "Confirmar ocurrencias")
              .getByRole("button", { name: "Confirmar operación", exact: true })
              .isDisabled(),
            true,
          );
          await p.keyboard.press("Escape");
          await p
            .getByRole("button", { name: "Revisar omisión", exact: true })
            .click();
          await confirm(p, "Confirmar ocurrencias");
          assert.deepEqual((await saved(p)).transactions, original);
          assert.equal(
            (await saved(p)).intelligentFinance.occurrences[0].status,
            "skipped",
          );
        } finally {
          await s.close();
        }
      },
    );
    await t.test(
      "deuda independiente, cobro parcial y principal sin ingreso económico",
      async () => {
        const s = await setup();
        const { page: p } = s;
        try {
          await nav(p, "Deudas");
          await p
            .getByRole("button", { name: "Me deben", exact: true })
            .click();
          await p
            .getByRole("button", {
              name: "Nuevo compromiso personal",
              exact: true,
            })
            .click();
          let d = review(p, "Compromiso personal");
          await d
            .getByLabel("Contraparte", { exact: true })
            .fill("Persona ficticia");
          await d
            .getByLabel("Concepto", { exact: true })
            .fill("Presté 200 ficticio");
          await d.getByLabel("Principal (€)", { exact: true }).fill("200");
          await d
            .getByRole("button", { name: "Revisar compromiso", exact: true })
            .click();
          await confirm(p, "Confirmar compromiso o liquidación");
          assert.equal((await saved(p)).transactions.length, 0);
          await p
            .getByRole("button", {
              name: "Registrar cobro parcial",
              exact: true,
            })
            .click();
          d = review(p, "Liquidación personal");
          await d
            .getByLabel("Importe a liquidar (€)", { exact: true })
            .fill("50");
          await d
            .getByRole("button", { name: "Revisar liquidación", exact: true })
            .click();
          await confirm(p, "Confirmar compromiso o liquidación");
          const state = await saved(p);
          assert.equal(
            state.intelligentFinance.obligations[0].settlements[0].amountCents,
            5000,
          );
          assert.equal(state.transactions.length, 0);
          assert.match(
            await p
              .getByRole("region", { name: "Deudas y cobros" })
              .innerText(),
            /150,00/,
          );
          await p
            .getByRole("button", {
              name: "Registrar cobro parcial",
              exact: true,
            })
            .click();
          d = review(p, "Liquidación personal");
          await d
            .getByLabel("Importe a liquidar (€)", { exact: true })
            .fill("151");
          await d
            .getByRole("button", { name: "Revisar liquidación", exact: true })
            .click();
          await d.getByRole("alert").waitFor();
          assert.deepEqual(
            (await saved(p)).intelligentFinance,
            state.intelligentFinance,
          );
          await d
            .getByRole("button", { name: "Cancelar", exact: true })
            .click();
          await p
            .getByRole("button", {
              name: "Registrar cobro parcial",
              exact: true,
            })
            .click();
          d = review(p, "Liquidación personal");
          await d
            .getByLabel("Importe a liquidar (€)", { exact: true })
            .fill("50");
          await d
            .getByLabel("Modalidad de liquidación", { exact: true })
            .selectOption("bank");
          await d
            .getByRole("button", { name: "Revisar liquidación", exact: true })
            .click();
          await confirm(p, "Confirmar compromiso o liquidación");
          let bank = await saved(p);
          assert.equal(bank.transactions[0].processed, false);
          assert.ok(bank.transactions[0].obligationSettlement);
          await nav(p, "Movimientos");
          await p.getByRole("button", { name: "NO", exact: true }).click();
          await p.waitForFunction(
            (k) =>
              JSON.parse(localStorage.getItem(k)!).transactions[0].processed,
            DATA_KEY,
          );
          bank = await saved(p);
          assert.equal(
            bank.intelligentFinance.obligations[0].settlements[1].processed,
            true,
          );
          await nav(p, "Deudas");
          await p
            .getByRole("button", { name: "Me deben", exact: true })
            .click();
          assert.match(
            await p
              .getByRole("region", { name: "Deudas y cobros" })
              .innerText(),
            /100,00/,
          );
        } finally {
          await s.close();
        }
      },
    );
    await t.test(
      "primera escritura 3.1 aborta si falla la copia y permite reintentar sin perder el formulario",
      async () => {
        const s = await setup();
        const { page: p } = s;
        try {
          await openRecurring(p);
          const before = await snapshot(p);
          await newRule(p);
          await p.evaluate((prefix) => {
            const set = Storage.prototype.setItem;
            (window as any).restoreSet = () =>
              (Storage.prototype.setItem = set);
            Storage.prototype.setItem = function (k, v) {
              if (k.startsWith(prefix))
                throw new DOMException("Ficticio", "QuotaExceededError");
              return set.call(this, k, v);
            };
          }, RECOVERY_PREFIX);
          await review(p, "Confirmar regla periódica")
            .getByRole("button", { name: "Confirmar operación", exact: true })
            .click();
          await review(p, "Confirmar regla periódica")
            .getByRole("alert")
            .waitFor();
          assert.deepEqual(await snapshot(p), before);
          await p.evaluate(() => (window as any).restoreSet());
          await confirm(p, "Confirmar regla periódica");
          assert.equal(
            (await saved(p)).intelligentFinance.recurringRules[0].concept,
            "Alquiler 31 ficticio",
          );
        } finally {
          await s.close();
        }
      },
    );
    await t.test(
      "restaurar JSON anterior y 3.1 mantiene recuperación, identidades e históricos",
      async () => {
        const initial = populated(),
          s = await setup(initial);
        const { page: p } = s;
        try {
          const before = await saved(p),
            importFile = (value: unknown) =>
              p.locator("input[type=file]").setInputFiles({
                name: "fixture-ficticia.json",
                mimeType: "application/json",
                buffer: Buffer.from(JSON.stringify(value)),
              });
          const malformed = structuredClone(makeBackup(initial));
          malformed.intelligentFinance!.occurrences[0].transactionId =
            "missing";
          await importFile(malformed);
          await p
            .getByRole("alert")
            .filter({ hasText: /vinculados/ })
            .waitFor();
          assert.deepEqual(
            (await saved(p)).intelligentFinance,
            before.intelligentFinance,
          );
          await p
            .getByRole("button", { name: "Cerrar aviso", exact: true })
            .click();
          await importFile(makeBackup(fixture()));
          await p
            .getByRole("button", { name: "Confirmar sustitución", exact: true })
            .click();
          await p.getByRole("dialog").waitFor({ state: "hidden" });
          assert.equal((await saved(p)).version, "2.5");
          await importFile(makeBackup(initial));
          await p
            .getByRole("button", { name: "Confirmar sustitución", exact: true })
            .click();
          await p.getByRole("dialog").waitFor({ state: "hidden" });
          await p.reload();
          assert.deepEqual(
            (await saved(p)).intelligentFinance,
            before.intelligentFinance,
          );
          assert.deepEqual(
            (await saved(p)).planningMonths,
            before.planningMonths,
          );
          assert.equal((await saved(p)).transactions.length, 1);
          const all = await snapshot(p);
          assert.equal(
            Object.keys(all).filter((k) => k.startsWith(RECOVERY_PREFIX))
              .length,
            2,
          );
        } finally {
          await s.close();
        }
      },
    );
    await t.test(
      "cuota de almacenamiento y conflicto real entre pestañas conservan propuesta sin duplicar",
      async () => {
        const s = await setup(saveMovementRule(fixture(), rule({ day: 15 })));
        const { page: p, context } = s;
        try {
          await openRecurring(p);
          await p
            .getByRole("button", {
              name: "Seleccionar propuestas",
              exact: true,
            })
            .click();
          await p
            .getByRole("button", {
              name: "Revisar registro pendiente",
              exact: true,
            })
            .click();
          const before = await snapshot(p);
          await p.evaluate((key) => {
            const set = Storage.prototype.setItem;
            (window as any).restoreSet = () =>
              (Storage.prototype.setItem = set);
            Storage.prototype.setItem = function (k, v) {
              if (k === key)
                throw new DOMException("Ficticio", "QuotaExceededError");
              return set.call(this, k, v);
            };
          }, DATA_KEY);
          await review(p, "Confirmar ocurrencias")
            .getByRole("button", { name: "Confirmar operación", exact: true })
            .click();
          await review(p, "Confirmar ocurrencias").getByRole("alert").waitFor();
          assert.deepEqual(await snapshot(p), before);
          await p.evaluate(() => (window as any).restoreSet());
          const other = await context.newPage();
          await other.clock.setFixedTime(new Date(fakeTime));
          await other.goto(url);
          await other.getByRole("button", { name: /Cambiar a modo/ }).click();
          await p.waitForFunction(() =>
            document.body.textContent?.includes("Otra pestaña"),
          );
          await review(p, "Confirmar ocurrencias")
            .getByRole("button", { name: "Confirmar operación", exact: true })
            .click();
          assert.equal((await saved(p)).transactions.length, 0);
          assert.equal(await review(p, "Confirmar ocurrencias").count(), 1);
        } finally {
          await s.close();
        }
      },
    );
    await t.test(
      "tesorería y preguntas locales/fallback no escriben ni solicitan servicios nuevos",
      async () => {
        const s = await setup(populated());
        const { page: p } = s;
        try {
          const before = await snapshot(p);
          await p
            .getByRole("button", { name: "Próximos 30 días", exact: true })
            .click();
          assert.match(
            await p
              .getByRole("region", { name: "Previsión de tesorería" })
              .innerText(),
            /1\.550,00/,
          );
          await nav(p, "Asistente");
          let calls = 0;
          await p.route("**/api/assistant-chat", (route) => {
            calls++;
            return route.abort();
          });
          for (const text of [
            "¿Cuánto tengo realmente disponible?",
            "¿Qué pagos se aproximan?",
            "¿Qué partidas sobrepasan el presupuesto?",
            "¿Qué gastos puedo reducir para ahorrar 150 € más?",
            "No registres 100 euros",
            "¿Cómo distribuir mis ingresos?",
            "Consejos generales de organización",
          ]) {
            await p.getByLabel("Mensaje para el asistente").fill(text);
            await p
              .getByRole("button", { name: "Enviar", exact: true })
              .click();
            await p.waitForFunction(
              () => !document.body.innerText.includes("Consultando datos..."),
            );
            assert.equal(await p.getByRole("dialog").count(), 0);
            assert.deepEqual(await snapshot(p), before);
          }
          assert.equal(calls, 1);
          assert.match(
            await p
              .getByRole("region", { name: "Asistente financiero" })
              .innerText(),
            /Datos guardados.*2026-11/s,
          );
          const result = await p.request.post(`${url}/api/assistant-chat`, {
            data: { message: "Sin datos" },
          });
          assert.equal((await result.json()).reply.includes("2.691"), false);
        } finally {
          await s.close();
        }
      },
    );
    for (const width of [390, 768, 1280, 1440, 1920])
      for (const theme of ["light", "dark"] as const)
        await t.test(
          `responsive ${width}px ${theme}: calendario, reglas, deudas, tesorería y asistente`,
          async () => {
            const s = await setup(populated(), width, theme);
            const { page: p } = s;
            try {
              const before = await snapshot(p);
              const check = async (name: string) => {
                assert.equal(
                  await p.evaluate(
                    () =>
                      document.documentElement.scrollWidth <= innerWidth + 1,
                  ),
                  true,
                  name,
                );
                if (
                  process.env.PHASE5_ARTIFACT_DIR &&
                  ((width === 1280 && theme === "light") ||
                    (width === 390 && theme === "dark"))
                ) {
                  await mkdir(process.env.PHASE5_ARTIFACT_DIR, {
                    recursive: true,
                  });
                  await p.screenshot({
                    path: `${process.env.PHASE5_ARTIFACT_DIR}/${width}-${theme}-${name}.png`,
                    animations: "disabled",
                  });
                }
              };
              await check("inicio");
              await p
                .getByRole("button", { name: "Próximos 30 días", exact: true })
                .click();
              await check("tesoreria");
              await openRecurring(p);
              await check("periodicos");
              await nav(p, "Deudas");
              await p
                .getByRole("button", { name: "Me deben", exact: true })
                .click();
              await check("deudas");
              await nav(p, "Asistente");
              await check("asistente");
              await p
                .getByRole("button", { name: "Elegir mes y año", exact: true })
                .click();
              assert.equal(
                await review(p, "Elegir mes y año").evaluate((el) =>
                  el.contains(document.activeElement),
                ),
                true,
              );
              for (let i = 0; i < 8; i++) await p.keyboard.press("Tab");
              assert.equal(
                await review(p, "Elegir mes y año").evaluate((el) =>
                  el.contains(document.activeElement),
                ),
                true,
              );
              await p.keyboard.press("Escape");
              assert.deepEqual(await snapshot(p), before);
              if (width === 1280)
                for (const zoom of [1.25, 1.5, 2]) {
                  await p.locator("html").evaluate((el, z) => {
                    (el as HTMLElement).style.zoom = String(z);
                  }, zoom);
                  await check(`zoom-${zoom}`);
                }
            } finally {
              await s.close();
            }
          },
        );
  },
);
