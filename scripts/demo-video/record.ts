import assert from "node:assert/strict";
import express from "express";
import { chromium, type Locator, type Page } from "playwright-core";
import {
  mkdir,
  writeFile,
  readFile,
  mkdtemp,
  rm,
  access,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { performance } from "node:perf_hooks";
import { DATA_KEY, makeBackup } from "../../src/utils/backup";
import { formatCurrency } from "../../src/utils/finance";
import { demoData, demoMetrics, DEMO_TIME } from "./fixture";
import { SCENES } from "./story";
import { performScene, rawState } from "./scenes";

const root = process.cwd();
const arg = (name: string) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const smoke = process.argv.includes("--smoke");
const output = path.resolve(
  arg("output") ?? `artifacts/demo-video${smoke ? "-smoke" : ""}`,
);
const only = arg("only")?.split(",");
const sceneList = only ? SCENES.filter((s) => only.includes(s.id)) : SCENES;
if (!sceneList.length)
  throw new Error("Selecciona al menos una escena válida (01–10).");
const resolution = { width: 1920, height: 1080 };
const beat = async (ms: number) =>
  new Promise<void>((r) => setTimeout(r, smoke ? Math.min(ms, 10) : ms));
const cleanEnv = {
  PATH: process.env.PATH ?? "/usr/bin:/bin",
  LANG: "es_ES.UTF-8",
  TZ: "Europe/Madrid",
};

async function main() {
  await access(path.join(root, "dist/index.html"));
  await mkdir(output, { recursive: true });
  try {
    await access(path.join(output, "recording_manifest.json"));
    throw new Error(
      "El destino ya tiene un manifiesto. Usa otra carpeta para conservar la toma anterior.",
    );
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code !== "ENOENT") throw e;
  }
  for (const dir of ["scenes", "originals", "thumbnails", "qa"])
    await mkdir(path.join(output, dir), { recursive: true });
  const app = express();
  app.disable("x-powered-by");
  // A separate local static host: never import server.ts, dotenv or the Gemini SDK.
  app.get("/favicon.ico", (_req, res) => {
    res.status(204).end();
  });
  app.use("/api", (_req, res) => {
    res.status(403).json({ error: "API desactivada en la captura ficticia" });
  });
  app.use(express.static(path.join(root, "dist")));
  app.get("*", (_req, res) => res.sendFile(path.join(root, "dist/index.html")));
  const server = await new Promise<ReturnType<typeof app.listen>>((resolve) => {
    const s = app.listen(0, "127.0.0.1", () => resolve(s));
  });
  const port = (server.address() as { port: number }).port,
    url = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? "/usr/bin/chromium",
    headless: true,
    env: cleanEnv,
    args: [
      "--no-sandbox",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-sync",
      "--no-first-run",
    ],
  });
  const scratch = await mkdtemp(path.join(tmpdir(), "finanzas-demo-"));
  const records: any[] = [];
  async function isolated(scene: number, record: boolean) {
    const data = demoData(scene),
      expected = demoMetrics(data),
      errors: string[] = [],
      requests: string[] = [],
      external: string[] = [],
      apis: string[] = [];
    const context = await browser.newContext({
      viewport: resolution,
      screen: resolution,
      deviceScaleFactor: 1,
      locale: "es-ES",
      timezoneId: "Europe/Madrid",
      colorScheme: "light",
      serviceWorkers: "block",
      acceptDownloads: true,
      ...(record ? { recordVideo: { dir: scratch, size: resolution } } : {}),
    });
    await context.route("**/*", async (route) => {
      const u = new URL(route.request().url());
      if (u.origin !== url) {
        external.push(`${u.protocol}//${u.hostname}`);
        await route.abort("blockedbyclient");
        return;
      }
      if (u.pathname.startsWith("/api/")) {
        apis.push(u.pathname);
        await route.abort("blockedbyclient");
        return;
      }
      requests.push(u.pathname);
      await route.continue();
    });
    await context.addInitScript(
      ({ key, value }) => {
        if (localStorage.getItem(key) !== null)
          throw new Error("El contexto debe empezar sin datos previos.");
        localStorage.setItem(key, value);
        (window as any).__demoWrites = [];
        const set = Storage.prototype.setItem;
        Storage.prototype.setItem = function (k, v) {
          (window as any).__demoWrites.push(k === key ? "active" : "other");
          return set.call(this, k, v);
        };
        document.addEventListener("DOMContentLoaded", () => {
          document.documentElement.lang = "es";
          const pointer = document.createElement("div");
          pointer.id = "demo-cursor";
          pointer.style.cssText =
            "position:fixed;left:-50px;top:-50px;width:23px;height:30px;pointer-events:none;z-index:2147483647;filter:drop-shadow(0 1px 2px #0007)";
          pointer.innerHTML =
            '<svg viewBox="0 0 24 32" width="23" height="30"><path d="M2 2 L2 25 L8 20 L13 30 L18 28 L13 18 L22 18 Z" fill="white" stroke="#0f172a" stroke-width="1.5"/></svg>';
          const ring = document.createElement("div");
          ring.style.cssText =
            "position:fixed;pointer-events:none;z-index:2147483646;width:34px;height:34px;border:2px solid #0ea5e9;border-radius:50%;opacity:0;transition:opacity .25s,transform .25s";
          document.body.append(pointer, ring);
          document.addEventListener(
            "mousemove",
            (e) => {
              pointer.style.left = `${e.clientX}px`;
              pointer.style.top = `${e.clientY}px`;
            },
            { passive: true },
          );
          document.addEventListener(
            "mousedown",
            (e) => {
              ring.style.left = `${e.clientX - 17}px`;
              ring.style.top = `${e.clientY - 17}px`;
              ring.style.transform = "scale(.6)";
              ring.style.opacity = ".6";
              setTimeout(() => {
                ring.style.transform = "scale(1.1)";
                ring.style.opacity = "0";
              }, 160);
            },
            { passive: true },
          );
        });
      },
      {
        key: DATA_KEY,
        value: JSON.stringify({ ...makeBackup(data), exportedAt: DEMO_TIME }),
      },
    );
    const createdAt = performance.now(),
      page = await context.newPage();
    page.setDefaultTimeout(8000);
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    await page.clock.setFixedTime(new Date(DEMO_TIME));
    await page.goto(url, { waitUntil: "networkidle" });
    await page
      .getByLabel("Seleccionar periodo contable", { exact: true })
      .waitFor();
    assert.equal(
      await page.getByLabel("Seleccionar periodo contable").inputValue(),
      "2026-11",
    );
    assert.equal(
      await page.locator("html").getAttribute("data-theme"),
      "light",
    );
    await page
      .getByText(formatCurrency(expected.liquidCents / 100), { exact: true })
      .first()
      .waitFor();
    return {
      context,
      page,
      createdAt,
      errors,
      requests,
      external,
      apis,
      expected,
    };
  }
  let witness: Awaited<ReturnType<typeof isolated>> | undefined;
  try {
    witness = await isolated(1, false);
    const untouched = await rawState(witness.page);
    for (const scene of sceneList) {
      const session = await isolated(Number(scene.id), !smoke),
        { page, context } = session;
      console.log(`Escena ${scene.id} — ${scene.title}`);
      const source = page.video();
      await beat(1300);
      const start = performance.now(),
        leadSeconds = (start - session.createdAt) / 1000;
      let cursor = { x: 1600, y: 900 },
        hasThumbnail = false;
      const reveal = async (target: Locator) => {
        await target.waitFor({ state: "visible" });
        const moved = await target.evaluate((el, smooth) => {
          const r = el.getBoundingClientRect();
          if (r.top < 110 || r.bottom > innerHeight - 35) {
            el.scrollIntoView({
              block: "center",
              behavior: smooth ? "smooth" : "instant",
            });
            return true;
          }
          return false;
        }, !smoke);
        await beat(moved ? 550 : 100);
      };
      const point = async (target: Locator) => {
        await reveal(target);
        const box = await target.boundingBox();
        if (!box) throw new Error("Control no visible durante la captura.");
        const goal = {
          x: box.x + Math.min(box.width / 2, 450),
          y: box.y + Math.min(box.height / 2, 180),
        };
        for (let i = 1; i <= 14; i++) {
          const t = i / 14,
            e = t * t * (3 - 2 * t);
          await page.mouse.move(
            cursor.x + (goal.x - cursor.x) * e,
            cursor.y + (goal.y - cursor.y) * e,
          );
          await beat(12);
        }
        cursor = goal;
        await beat(120);
      };
      const click = async (target: Locator) => {
        await point(target);
        await target.click({ delay: smoke ? 0 : 65 });
        await beat(240);
      };
      const fill = async (target: Locator, value: string) => {
        await point(target);
        await target.fill(value);
        await beat(350);
      };
      const type = async (target: Locator, value: string) => {
        await click(target);
        await target.press("ControlOrMeta+A");
        await target.pressSequentially(value, { delay: smoke ? 0 : 25 });
        await beat(250);
      };
      const select = async (target: Locator, value: string) => {
        await point(target);
        await target.selectOption(value);
        await beat(240);
      };
      const nav = async (name: string) => {
        const moved = await page.evaluate((smooth) => {
          const moved = scrollY > 5;
          window.scrollTo({ top: 0, behavior: smooth ? "smooth" : "instant" });
          return moved;
        }, !smoke);
        await beat(moved ? 550 : 100);
        await click(
          page
            .getByRole("navigation", { name: "Navegación principal" })
            .getByRole("button", {
              name: new RegExp(`^(?:\\d+\\s*)?${name}(?:\\s*\\d+)?$`),
            })
            .first(),
        );
      };
      const thumbnail = async () => {
        await page.screenshot({
          path: path.join(
            output,
            "thumbnails",
            `${scene.id}_${scene.slug}.png`,
          ),
          animations: "disabled",
        });
        hasThumbnail = true;
      };
      let endMetrics;
      try {
        endMetrics = await performScene(Number(scene.id), {
          page,
          output,
          beat,
          click,
          point,
          type,
          fill,
          select,
          nav,
          thumbnail,
        });
        if (!hasThumbnail) await thumbnail();
        const elapsed = (performance.now() - start) / 1000;
        if (!smoke && elapsed < scene.seconds)
          await beat((scene.seconds - elapsed) * 1000);
        await beat(650);
        assert.deepEqual(
          session.errors,
          [],
          "No debe haber errores de JavaScript ni de consola.",
        );
        assert.deepEqual(
          session.external,
          [],
          "La aplicación no debe intentar contactar servicios externos.",
        );
        assert.deepEqual(
          session.apis,
          [],
          "Solo se admiten consultas locales deterministas.",
        );
        assert.equal(
          await rawState(witness.page),
          untouched,
          "La escena ha afectado a otra sesión.",
        );
        const duration = (performance.now() - start) / 1000;
        const writes = await page.evaluate(() => (window as any).__demoWrites);
        await context.close();
        if (source && !smoke) {
          await source.saveAs(
            path.join(output, "originals", `${scene.id}_${scene.slug}.webm`),
          );
          await source.delete();
        }
        records.push({
          ...scene,
          file: `originals/${scene.id}_${scene.slug}.webm`,
          thumbnail: `thumbnails/${scene.id}_${scene.slug}.png`,
          leadSeconds,
          durationSeconds: duration,
          actionDurationSeconds: elapsed,
          startMetrics: session.expected,
          endMetrics,
          validation: {
            reactRendered: true,
            javascriptErrors: 0,
            externalRequests: 0,
            apiRequests: 0,
            isolated: true,
            storageWrites: writes.length,
            metricsMatch: true,
          },
          issues: [],
        });
      } catch (error) {
        await page
          .screenshot({
            path: path.join(output, "qa", `${scene.id}_fallo.png`),
          })
          .catch(() => {});
        await context.close();
        throw new Error(
          `La escena ${scene.id} no se ha completado. ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
    const report = {
      product: "FinanZas",
      fixture: "Datos exclusivamente ficticios",
      sourceAppCommit: "66a045e17e310527c790a15ff2fe5dceaaba48a3",
      automationHeadAtCapture: execFileSync("git", ["rev-parse", "HEAD"], {
        cwd: root,
        encoding: "utf8",
      }).trim(),
      automationUncommittedAtCapture: Boolean(
        execFileSync(
          "git",
          [
            "status",
            "--porcelain",
            "--",
            "scripts/demo-video",
            "package.json",
            ".gitignore",
          ],
          { cwd: root, encoding: "utf8" },
        ).trim(),
      ),
      clock: DEMO_TIME,
      locale: "es-ES",
      timezone: "Europe/Madrid",
      viewport: resolution,
      mode: smoke ? "smoke" : "record",
      sceneCount: records.length,
      complete: records.length === 10,
      scenes: records,
    };
    await writeFile(
      path.join(output, smoke ? "smoke_validation.json" : "capture.json"),
      JSON.stringify(report, null, 2) + "\n",
    );
    console.log(
      smoke
        ? "Recorridos reproducidos sin vídeo."
        : "Capturas originales finalizadas.",
    );
  } finally {
    await witness?.context.close();
    await browser.close();
    await new Promise<void>((r) => server.close(() => r()));
    await rm(scratch, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
