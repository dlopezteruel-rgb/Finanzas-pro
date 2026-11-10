import assert from "node:assert/strict";
import type { Page, Locator } from "playwright-core";
import {
  CODES,
  SHOP_CONCEPT,
  SHARED_CONCEPT,
  demoMetrics,
  demoData,
} from "./fixture";
import { parseSnapshot, parseBackup } from "../../src/utils/backup";
import { DATA_KEY } from "../../src/utils/backup";

export interface Director {
  page: Page;
  output: string;
  beat: (ms: number) => Promise<void>;
  click: (target: Locator) => Promise<void>;
  point: (target: Locator) => Promise<void>;
  type: (target: Locator, text: string) => Promise<void>;
  fill: (target: Locator, value: string) => Promise<void>;
  select: (target: Locator, value: string) => Promise<void>;
  nav: (name: string) => Promise<void>;
  thumbnail: () => Promise<void>;
}
export const rawState = (p: Page) =>
  p.evaluate((k) => localStorage.getItem(k)!, DATA_KEY);
export const financialData = async (p: Page) =>
  parseSnapshot(await rawState(p));
const dialog = (p: Page, name: string) =>
  p.getByRole("dialog", { name, exact: true });
export async function performScene(index: number, d: Director) {
  const { page: p, beat, click, point, type, fill, select, nav, thumbnail } = d;
  const before = await rawState(p),
    metrics = demoMetrics(await financialData(p));
  switch (index) {
    case 1:
      await point(p.getByText("Patrimonio Total en Cuentas", { exact: true }));
      await beat(2300);
      await point(p.getByText("Presupuesto Restante", { exact: true }));
      await beat(2000);
      await point(p.locator(".home-recent"));
      await beat(1200);
      await p.evaluate(() => window.scrollTo({ top: 0, behavior: "smooth" }));
      await beat(600);
      await thumbnail();
      break;
    case 2:
      await nav("Cuentas");
      await beat(1400);
      await point(
        p.getByRole("heading", { name: "CUENTA PRINCIPAL", exact: true }),
      );
      await beat(800);
      await click(
        p.getByRole("button", {
          name: "Editar cuenta y patrimonio CUENTA PRINCIPAL",
          exact: true,
        }),
      );
      await beat(1500);
      await click(
        dialog(p, "Cartera").getByRole("button", {
          name: "Cancelar",
          exact: true,
        }),
      );
      await click(
        p.getByRole("button", { name: "Ordenar Traspaso", exact: true }),
      );
      await fill(
        p.getByLabel("Importe a transferir (€)", { exact: true }),
        "50",
      );
      await select(
        p.getByLabel("Cuenta de destino", { exact: true }),
        "ahorro",
      );
      await beat(1500);
      await thumbnail();
      await click(
        dialog(p, "Traspaso").getByRole("button", {
          name: "Cancelar",
          exact: true,
        }),
      );
      break;
    case 3: {
      await nav("Movimientos");
      await beat(600);
      await nav("Asistente");
      await type(
        p.getByLabel("Mensaje para el asistente"),
        "Registra un gasto de supermercado de 32,50 euros",
      );
      await click(p.getByRole("button", { name: "Enviar", exact: true }));
      const form = dialog(p, "Revisar propuesta de movimiento");
      await form.waitFor();
      await select(
        form.getByLabel("Cartera", { exact: true }),
        "CUENTA PRINCIPAL",
      );
      await select(
        form.getByLabel("Categoría", { exact: true }),
        CODES.grocery,
      );
      await fill(form.getByLabel("Concepto", { exact: true }), SHOP_CONCEPT);
      await select(form.getByLabel("Estado", { exact: true }), "false");
      await beat(1100);
      await thumbnail();
      assert.equal(await rawState(p), before);
      await click(
        form.getByRole("button", {
          name: "Confirmar y registrar",
          exact: true,
        }),
      );
      await form.waitFor({ state: "hidden" });
      assert.equal(
        demoMetrics(await financialData(p)).liquidCents,
        metrics.liquidCents,
      );
      await nav("Movimientos");
      await fill(p.getByLabel("Buscar movimientos"), SHOP_CONCEPT);
      const row = p.getByRole("listitem").filter({ hasText: SHOP_CONCEPT });
      await row.waitFor();
      await beat(900);
      await click(row.getByRole("button", { name: "NO", exact: true }));
      await p.waitForFunction(
        (k) =>
          JSON.parse(localStorage.getItem(k)!).transactions.some(
            (t: any) =>
              t.description === "Compra semanal de supermercado" && t.processed,
          ),
        DATA_KEY,
      );
      assert.equal(
        demoMetrics(await financialData(p)).liquidCents,
        metrics.liquidCents - 3250,
      );
      await beat(1000);
      break;
    }
    case 4: {
      await nav("Presupuestos");
      await beat(1200);
      const region = p.getByRole("region", {
        name: "Planificación financiera",
        exact: true,
      });
      await point(region.getByLabel("Ahorro objetivo (€)", { exact: true }));
      await beat(1200);
      await fill(
        region.getByRole("textbox", {
          name: "Previsto GASTO Supermercado",
          exact: true,
        }),
        "300",
      );
      await beat(1000);
      await click(
        region.getByRole("button", {
          name: "Revisar y aprobar previsión",
          exact: true,
        }),
      );
      const approval = dialog(p, "Revisar y aprobar previsión");
      await approval.waitFor();
      await beat(1800);
      await thumbnail();
      await click(
        approval.getByRole("button", {
          name: "Confirmar aprobación",
          exact: true,
        }),
      );
      await approval.waitFor({ state: "hidden" });
      assert.equal(
        (await financialData(p)).budgetPlans.find(
          (b) => b.code === CODES.grocery,
        )!.plannedAmount,
        300,
      );
      assert.equal(
        demoMetrics(await financialData(p)).liquidCents,
        metrics.liquidCents,
      );
      break;
    }
    case 5: {
      await nav("Movimientos");
      await click(
        p.getByRole("button", { name: "Movimientos periódicos", exact: true }),
      );
      await beat(1400);
      await fill(p.getByLabel("Ocurrencias hasta"), "2026-12");
      await fill(p.getByLabel("Ocurrencias desde"), "2026-12");
      await click(
        p.getByRole("checkbox", {
          name: "Seleccionar Suscripción digital 2026-12-05",
          exact: true,
        }),
      );
      await click(
        p.getByRole("button", {
          name: "Revisar registro pendiente",
          exact: true,
        }),
      );
      const preview = dialog(p, "Confirmar ocurrencias");
      await preview.waitFor();
      await beat(1900);
      await thumbnail();
      await click(
        preview.getByRole("button", {
          name: "Confirmar operación",
          exact: true,
        }),
      );
      await preview.waitFor({ state: "hidden" });
      const saved = await financialData(p),
        tx = saved.transactions.find(
          (t) => t.recurrence?.dueDate === "2026-12-05",
        );
      assert.ok(tx && !tx.processed);
      assert.equal(demoMetrics(saved).liquidCents, metrics.liquidCents);
      await point(
        p.getByRole("row").filter({ hasText: "Suscripción digital" }),
      );
      await beat(900);
      break;
    }
    case 6: {
      await nav("Contactos");
      await beat(1100);
      await click(
        p.getByRole("button", { name: "Detalle de Amistad A", exact: true }),
      );
      await beat(1700);
      await point(p.getByText(/Reintegro · 10,00/));
      await beat(900);
      await nav("Movimientos");
      await fill(p.getByLabel("Buscar movimientos"), SHARED_CONCEPT);
      await click(
        p
          .getByRole("listitem")
          .filter({ hasText: SHARED_CONCEPT })
          .filter({
            has: p.getByRole("button", { name: "Ver reparto", exact: true }),
          })
          .getByRole("button", { name: "Ver reparto", exact: true }),
      );
      const split = dialog(p, "Reparto del gasto");
      await split.waitFor();
      await beat(2600);
      await thumbnail();
      assert.match(await split.innerText(), /90,00/);
      assert.match(await split.innerText(), /Reintegrado: 10,00/);
      await click(
        split.getByRole("button", { name: "Cerrar reparto", exact: true }),
      );
      break;
    }
    case 7: {
      await nav("Deudas");
      await click(p.getByRole("button", { name: "Me deben", exact: true }));
      await beat(1000);
      let personal = p
        .getByRole("article")
        .filter({ hasText: "Préstamo personal concedido" });
      await click(personal.locator("summary"));
      await beat(1600);
      await thumbnail();
      await click(p.getByRole("button", { name: "Debo", exact: true }));
      await beat(1700);
      await click(p.getByRole("button", { name: "Me deben", exact: true }));
      personal = p
        .getByRole("article")
        .filter({ hasText: "Préstamo personal concedido" });
      await click(personal.locator("summary"));
      await click(
        personal.getByRole("button", {
          name: "Revisar movimiento de liquidación",
          exact: true,
        }),
      );
      await p.locator('[data-focused-transaction="true"]').waitFor();
      await beat(1100);
      break;
    }
    case 8:
      await click(
        p.getByRole("button", { name: "Próximos 30 días", exact: true }),
      );
      await beat(2200);
      await point(p.getByText("Saldo proyectado", { exact: true }));
      await beat(1700);
      await thumbnail();
      await point(p.getByRole("table", { name: "Proyección por vencimiento" }));
      await beat(3300);
      break;
    case 9: {
      await nav("Asistente");
      for (const question of [
        "¿Cuánto dinero tengo disponible?",
        "¿Qué gastos puedo reducir para ahorrar 150 € más?",
      ]) {
        await type(p.getByLabel("Mensaje para el asistente"), question);
        await click(p.getByRole("button", { name: "Enviar", exact: true }));
        await p.waitForFunction(
          () => !document.body.innerText.includes("Consultando datos..."),
        );
        await p
          .locator(".assistant-messages")
          .evaluate((el) =>
            el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }),
          );
        await beat(2400);
      }
      await thumbnail();
      assert.match(
        await p.locator(".assistant-messages").innerText(),
        /150,00/,
      );
      break;
    }
    case 10: {
      await click(
        p.getByRole("button", { name: "Opciones y datos", exact: true }),
      );
      await beat(1500);
      await thumbnail();
      const promise = p.waitForEvent("download");
      await click(
        p.getByRole("button", { name: "Exportar JSON", exact: true }),
      );
      const download = await promise;
      const localPath = await download.path();
      if (!localPath)
        throw new Error("No se ha finalizado la exportación ficticia.");
      const { readFile, copyFile } = await import("node:fs/promises");
      const backup = parseBackup(await readFile(localPath, "utf8"));
      assert.equal(demoMetrics(backup).liquidCents, metrics.liquidCents);
      await copyFile(localPath, `${d.output}/demo_backup_ficticio.json`);
      await nav("Inicio");
      await beat(1600);
      break;
    }
  }
  if (![3, 4, 5].includes(index))
    assert.equal(
      await rawState(p),
      before,
      "Consultar la escena no debe escribir datos.",
    );
  const actual = demoMetrics(await financialData(p));
  const expected = demoMetrics(
    demoData(index === 3 ? 4 : index === 4 ? 5 : index === 5 ? 6 : index),
  );
  assert.deepEqual(actual.wallets, expected.wallets);
  assert.equal(actual.projectedCents, expected.projectedCents);
  return actual;
}
