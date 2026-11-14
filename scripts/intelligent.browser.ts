import { selectPlanningArea } from './browserNavigation';
import { navigateModule } from './browserNavigation';
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { mkdir } from "node:fs/promises";
import { build } from "esbuild";
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
import {
  saveObligation,
  settleObligation,
} from "../src/utils/personalObligations";
import { savePlanning, planningScope } from "../src/utils/planning";

const nav = navigateModule;
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
      categoryName: "Ingresos ficticios",
      subcategoryName: "Nómina ficticia",
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
    const url = `http://127.0.0.1:${port}/app`;
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
        new URL(route.request().url()).origin === new URL(url).origin
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
    // Keep the real component mounted while the parent requests another target.
    // This covers retained filters without adding a test-only route to the app.
    async function navigationHarness(kind: "transactions" | "recurring") {
      let initial = fixture();
      if (kind === "transactions") {
        initial.wallets.push({
          id: "other",
          name: "OTRA FICTICIA",
          type: "CASH",
          initialBalance: 0,
          color: "#fff",
        });
        initial.transactions = [
          {
            id: "target-a",
            date: "2026-12-05",
            type: "INGRESO",
            amount: 50,
            code: "i",
            categoryName: "I",
            subcategoryName: "Ingreso",
            description: "Cobro objetivo A",
            wallet: "BANCO FICTICIO",
            processed: false,
          },
          {
            id: "target-b",
            date: "2026-11-05",
            type: "GASTO",
            amount: 20,
            code: "g",
            categoryName: "G",
            subcategoryName: "Gasto",
            description: "Gasto objetivo B",
            wallet: "OTRA FICTICIA",
            processed: true,
          },
        ];
      } else {
        initial = saveMovementRule(initial, rule({ startDate: "2028-01-31" }));
        const row = occurrencePreviews(initial, "2028-01")[0];
        initial = applyOccurrenceBatch(initial, {
          first: "2028-01",
          last: "2028-01",
          ids: [row.id],
          action: "register",
          scope: occurrenceScope(initial),
          acknowledgeCollisions: false,
        });
        initial = saveMovementRule(
          initial,
          rule({ startDate: "2028-01-31", day: 15 }),
        );
      }
      const s = await setup(initial),
        { page: p } = s;
      const css = await p
        .locator("link[rel=stylesheet]")
        .evaluateAll((nodes) => nodes.map((n) => (n as HTMLLinkElement).href));
      const source = `
        import React,{useState} from 'react';
        import {createRoot} from 'react-dom/client';
        import {TransactionsView} from './src/components/TransactionsView';
        import {RecurringMovementsView} from './src/components/RecurringMovementsView';
        const data=${JSON.stringify(initial)};
        function Harness(){
          const [target,setTarget]=useState(null),[month,setMonth]=useState('${kind === "transactions" ? "2026-11" : "2028-01"}');
          const request=(second)=>{setMonth(${kind === "transactions" ? "second?'2026-11':'2026-12'" : "second?'2028-02':'2028-01'"});setTarget(${kind === "transactions" ? "second?'target-b':'target-a'" : "second?'rent@2028-02-15':'rent@2028-01-31'"});};
          return <main><button onClick={()=>request(false)}>Destino A</button><button onClick={()=>request(true)}>Destino B</button>
          ${kind === "transactions" ? "<TransactionsView currentMonthYear={month} focusedTransactionId={target} transactions={data.transactions} onToggleProcessed={()=>{}} onDeleteTransaction={()=>{}} onEditTransaction={()=>{}} onOpenNewTransaction={()=>{}}/>" : "<RecurringMovementsView data={data} month={month} focusedOccurrenceId={target} mutate={async()=>({ok:true})} onEdit={()=>{}}/>"}
          </main>;
        }
        createRoot(document.getElementById('root')).render(<Harness/>);
      `;
      const compiled = await build({
        stdin: { contents: source, resolveDir: process.cwd(), loader: "tsx" },
        bundle: true,
        write: false,
        format: "iife",
        platform: "browser",
        define: { "process.env.NODE_ENV": '"production"' },
      });
      await p.route(`${new URL(url).origin}/navigation-harness.js`, (route) =>
        route.fulfill({
          contentType: "application/javascript",
          body: compiled.outputFiles[0].text,
        }),
      );
      await p.route(`${new URL(url).origin}/navigation-harness.html`, (route) =>
        route.fulfill({
          contentType: "text/html",
          body: `<!doctype html><html lang="es"><head>${css.map((href) => `<link rel="stylesheet" href="${href}">`).join("")}</head><body><div id="root"></div><script src="/navigation-harness.js"></script></body></html>`,
        }),
      );
      await p.goto(`${new URL(url).origin}/navigation-harness.html`);
      return s;
    }
    await t.test(
      "enlace con filtros retenidos muestra el movimiento y no vuelve a robar el foco al buscar",
      async () => {
        const s = await navigationHarness("transactions"),
          { page: p } = s;
        try {
          const before = await snapshot(p);
          await p.getByLabel("Periodo del listado").selectOption("selected");
          await p.getByRole("button", { name: "Gastos", exact: true }).click();
          await p
            .getByLabel("Filtrar por cartera")
            .selectOption("OTRA FICTICIA");
          await p
            .getByLabel("Buscar movimientos")
            .fill("filtro sin coincidencias");
          await p
            .getByRole("button", { name: "Destino A", exact: true })
            .click();
          const focused = p.locator('[data-focused-transaction="true"]');
          await focused.waitFor();
          assert.match(await focused.innerText(), /Cobro objetivo A/);
          await p.waitForFunction(
            () =>
              document.activeElement?.getAttribute(
                "data-focused-transaction",
              ) === "true",
          );
          const search = p.getByLabel("Buscar movimientos");
          await search.pressSequentially("Cobro", { delay: 20 });
          assert.equal(await search.inputValue(), "Cobro");
          assert.equal(
            await search.evaluate((el) => el === document.activeElement),
            true,
          );
          await p
            .getByRole("button", { name: "Destino B", exact: true })
            .click();
          await focused.filter({ hasText: "Gasto objetivo B" }).waitFor();
          assert.equal(await focused.count(), 1);
          assert.match(await focused.innerText(), /Gasto objetivo B/);
          assert.equal(
            await p.getByLabel("Buscar movimientos").inputValue(),
            "",
          );
          await p.waitForFunction(
            () =>
              document.activeElement?.getAttribute(
                "data-focused-transaction",
              ) === "true",
          );
          assert.deepEqual(await snapshot(p), before);
        } finally {
          await s.close();
        }
      },
    );
    await t.test(
      "ocurrencia enlazada recupera su mes persistente y conserva el foco de la casilla al seleccionarla",
      async () => {
        const s = await navigationHarness("recurring"),
          { page: p } = s;
        try {
          const before = await snapshot(p);
          await p.getByLabel("Ocurrencias desde").fill("2028-02");
          await p.getByLabel("Ocurrencias hasta").fill("2028-02");
          await p
            .getByRole("button", { name: "Destino A", exact: true })
            .click();
          const focused = p.locator('[data-focused-occurrence="true"]');
          await focused.waitFor();
          assert.match(await focused.innerText(), /31\/01\/2028/);
          assert.equal(await focused.locator("time").getAttribute("datetime"), "2028-01-31");
          assert.equal(
            await p.getByLabel("Ocurrencias desde").inputValue(),
            "2028-01",
          );
          await p
            .getByRole("button", { name: "Destino B", exact: true })
            .click();
          await p.waitForFunction(
            () =>
              document.activeElement?.getAttribute(
                "data-focused-occurrence",
              ) === "true",
          );
          assert.equal(await focused.count(), 1);
          assert.match(await focused.innerText(), /15\/02\/2028/);
          assert.equal(await focused.locator("time").getAttribute("datetime"), "2028-02-15");
          const choice = p.getByRole("checkbox", {
            name: "Seleccionar Alquiler ficticio 15/02/2028",
            exact: true,
          });
          await choice.check();
          assert.equal(
            await choice.evaluate((el) => el === document.activeElement),
            true,
          );
          assert.deepEqual(await snapshot(p), before);
        } finally {
          await s.close();
        }
      },
    );
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
          await selectPlanningArea(p,"Ingresos");
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
            /29\/02\/2028/,
          );
          assert.equal(
            await review(p, "Confirmar ocurrencias").locator('time[datetime="2028-02-29"]').count(),
            1,
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
          await p
            .getByRole("button", {
              name: "Editar Alquiler 31 ficticio",
              exact: true,
            })
            .click();
          const edited = review(p, "Regla de movimiento periódico");
          await edited.getByLabel("Día del mes", { exact: true }).fill("15");
          await edited
            .getByRole("button", { name: "Revisar regla", exact: true })
            .click();
          await confirm(p, "Confirmar regla periódica");
          assert.equal(
            await p
              .getByRole("checkbox", { name: /Seleccionar Alquiler/ })
              .count(),
            0,
          );
          assert.equal((await saved(p)).transactions.length, 3);
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
      "revisar origen enlazado enfoca el movimiento y la ocurrencia sin modificar datos",
      async () => {
        let d = saveObligation(fixture(), obligation());
        d = settleObligation(d, "personal", {
          id: "cobro-ficticio",
          amountCents: 5000,
          date: "2026-10-15",
          kind: "bank",
          processed: false,
          note: "",
          walletId: "bank",
        });
        d = saveMovementRule(d, rule({ startDate: "2026-12-01", day: 1 }));
        d.transactions.push({
          id: "ordinary-pending",
          date: "2026-11-20",
          type: "GASTO",
          amount: 25,
          code: "g",
          categoryName: "Gastos ficticios",
          subcategoryName: "Compra",
          description: "Compra pendiente objetivo",
          wallet: "BANCO FICTICIO",
          processed: false,
        });
        const s = await setup(d);
        const { page: p } = s;
        try {
          const before = await snapshot(p);
          const checkFocusedTransaction = async () => {
            const row = p.locator('[data-focused-transaction="true"]');
            await row.waitFor();
            assert.match(
              await row.innerText(),
              /Cobro de principal: Préstamo personal ficticio/,
            );
            await p.waitForFunction(
              () =>
                document.activeElement?.getAttribute(
                  "data-focused-transaction",
                ) === "true",
            );
            assert.equal(
              await p.getByLabel("Seleccionar periodo contable").inputValue(),
              "2026-10",
            );
          };

          await nav(p, "Deudas");
          await p
            .getByRole("button", { name: "Me deben", exact: true })
            .click();
          await p
            .getByText("Historial de liquidaciones (1)", { exact: true })
            .click();
          await p
            .getByRole("button", { name: "Revisar movimiento de liquidación" })
            .click();
          await checkFocusedTransaction();
          await p
            .getByRole("button", {
              name: "Editar movimiento Cobro de principal: Préstamo personal ficticio",
              exact: true,
            })
            .click();
          assert.equal(await p.getByRole("dialog").count(), 0);
          await p
            .getByRole("status")
            .filter({ hasText: "El principal y su historial están protegidos" })
            .waitFor();
          await p
            .getByRole("button", { name: "Cerrar aviso", exact: true })
            .click();
          assert.deepEqual(await snapshot(p), before);

          await nav(p, "Inicio");
          await p
            .getByRole("button", { name: "Próximos 30 días", exact: true })
            .click();
          await p
            .getByRole("row")
            .filter({
              hasText: "Cobro de principal: Préstamo personal ficticio",
            })
            .getByRole("button", { name: "Revisar origen", exact: true })
            .click();
          await checkFocusedTransaction();
          assert.deepEqual(await snapshot(p), before);

          await nav(p, "Inicio");
          await p
            .getByRole("button", { name: "Próximos 30 días", exact: true })
            .click();
          await p
            .getByRole("row")
            .filter({ hasText: "Alquiler ficticio" })
            .getByRole("button", { name: "Revisar origen", exact: true })
            .click();
          assert.equal(
            await p.getByLabel("Seleccionar periodo contable").inputValue(),
            "2026-12",
          );
          const occurrence = p.locator('[data-focused-occurrence="true"]');
          await occurrence.waitFor();
          assert.match(await occurrence.innerText(), /Alquiler ficticio/);
          await p.waitForFunction(
            () =>
              document.activeElement?.getAttribute(
                "data-focused-occurrence",
              ) === "true",
          );
          assert.deepEqual(await snapshot(p), before);
          await nav(p, "Inicio");
          await p
            .getByRole("button", { name: "Próximos 30 días", exact: true })
            .click();
          await p
            .getByRole("row")
            .filter({ hasText: "Compra pendiente objetivo" })
            .getByRole("button", { name: "Revisar origen", exact: true })
            .click();
          const ordinary = p.locator('[data-focused-transaction="true"]');
          await ordinary
            .filter({ hasText: "Compra pendiente objetivo" })
            .waitFor();
          assert.equal(await ordinary.count(), 1);
          assert.equal(
            await p.getByLabel("Seleccionar periodo contable").inputValue(),
            "2026-11",
          );
          assert.equal(await p.getByRole("dialog").count(), 0);
          await p.waitForFunction(
            () =>
              document.activeElement?.getAttribute(
                "data-focused-transaction",
              ) === "true",
          );
          assert.deepEqual(await snapshot(p), before);
        } finally {
          await s.close();
        }
      },
    );
    for (const action of ["Guardar y continuar", "Descartar y continuar"])
      await t.test(
        `navegación enlazada tras ${action.toLowerCase()} protege el borrador y no modifica saldos`,
        async () => {
          const s = await setup(populated()),
            { page: p } = s;
          try {
            const original = await saved(p),
              before = await snapshot(p);
            await nav(p, "Presupuestos");
            const planner = p.getByRole("region", {
              name: "Planificación financiera",
              exact: true,
            });
            const field = planner.getByRole("textbox", {
              name: "Previsto GASTO Alquiler ficticio",
              exact: true,
            });
            await field.fill("900");
            await nav(p, "Inicio");
            const guard = review(p, "Cambios de planificación sin guardar");
            await guard.waitFor();
            assert.deepEqual(await snapshot(p), before);
            await guard
              .getByRole("button", { name: "Seguir editando", exact: true })
              .click();
            assert.equal(await field.inputValue(), "900");
            await nav(p, "Inicio");
            await guard
              .getByRole("button", { name: action, exact: true })
              .click();
            await guard.waitFor({ state: "hidden" });
            const after = await saved(p);
            assert.deepEqual(after.transactions, original.transactions);
            assert.deepEqual(after.wallets, original.wallets);
            assert.deepEqual(
              after.intelligentFinance,
              original.intelligentFinance,
            );
            assert.equal(after.version, "3.1");
            assert.deepEqual(
              after.planningMonths[0].approval,
              original.planningMonths[0].approval,
            );
            assert.equal(
              after.budgetPlans.find((b: any) => b.type === "GASTO")
                .plannedAmount,
              action === "Guardar y continuar" ? 900 : 950,
            );
            if (action === "Descartar y continuar")
              assert.deepEqual(await snapshot(p), before);
            const consulted = await snapshot(p);
            await p
              .getByRole("button", { name: "Próximos 30 días", exact: true })
              .click();
            await p
              .getByRole("row")
              .filter({ hasText: "Alquiler ficticio" })
              .getByRole("button", { name: "Revisar origen", exact: true })
              .click();
            const movement = p.locator('[data-focused-transaction="true"]');
            await movement.waitFor();
            assert.match(await movement.innerText(), /Alquiler ficticio/);
            await p.waitForFunction(
              () =>
                document.activeElement?.getAttribute(
                  "data-focused-transaction",
                ) === "true",
            );
            assert.deepEqual(await snapshot(p), consulted);
            await nav(p, "Inicio");
            await p
              .getByRole("button", { name: "Próximos 30 días", exact: true })
              .click();
            await p
              .getByRole("row")
              .filter({ hasText: "Nómina ficticia" })
              .getByRole("button", { name: "Revisar origen", exact: true })
              .click();
            await p.locator('[data-focused-occurrence="true"]').waitFor();
            assert.equal(
              await p.getByLabel("Seleccionar periodo contable").inputValue(),
              "2026-11",
            );
            assert.deepEqual(await snapshot(p), consulted);
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
          const apiPayloads:any[]=[];
          await p.route("**/api/assistant-chat", (route) => {
            calls++;apiPayloads.push(route.request().postDataJSON());
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
          assert.equal(apiPayloads[0].financialContext.month,"2026-11");
          assert.match(apiPayloads[0].fallbackReply,/Datos guardados.*2026-11/s);
          assert.match(
            await p
              .getByRole("region", { name: "Asistente financiero" })
              .innerText(),
            /Datos guardados.*noviembre 2026/s,
          );
          const result = await p.request.post(`${new URL(url).origin}/api/assistant-chat`, {
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
                      document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
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
