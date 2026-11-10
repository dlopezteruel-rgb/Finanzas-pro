import { execFile, execFileSync, spawnSync } from "node:child_process";
import { promisify } from "node:util";
import {
  readFile,
  writeFile,
  readdir,
  stat,
  mkdir,
  mkdtemp,
  rm,
} from "node:fs/promises";
import { createHash } from "node:crypto";
import { tmpdir } from "node:os";
import path from "node:path";
import assert from "node:assert/strict";

const run = promisify(execFile);
const output = path.resolve(
  process.argv.find((a) => a.startsWith("--output="))?.slice(9) ??
    "artifacts/demo-video",
);
const env = { PATH: process.env.PATH ?? "/usr/bin:/bin", LANG: "C.UTF-8" };
const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg",
  ffprobe = process.env.FFPROBE_PATH ?? "ffprobe";
const available = (bin: string) =>
  spawnSync(bin, ["-version"], { env, stdio: "ignore" }).status === 0;
const abs = (relative: string) => path.join(output, relative);
async function encode(args: string[]) {
  await run(ffmpeg, ["-hide_banner", "-loglevel", "error", "-y", ...args], {
    env,
    maxBuffer: 4 * 1024 * 1024,
  });
}
function probe(file: string) {
  const p = JSON.parse(
    execFileSync(
      ffprobe,
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration,format_name:stream=codec_type,codec_name,width,height,r_frame_rate",
        "-of",
        "json",
        file,
      ],
      { env, encoding: "utf8" },
    ),
  );
  const video = p.streams.find((s: any) => s.codec_type === "video");
  if (!video) throw new Error("Archivo sin pista de vídeo.");
  return {
    durationSeconds: Number(p.format.duration),
    resolution: { width: video.width, height: video.height },
    format: p.format.format_name,
    codec: video.codec_name,
    frameRate: video.r_frame_rate,
    audioTracks: p.streams.filter((s: any) => s.codec_type === "audio").length,
  };
}
function assertVideo(p: ReturnType<typeof probe>) {
  assert.ok(p.durationSeconds > 0);
  assert.equal(p.resolution.width, 1920);
  assert.equal(p.resolution.height, 1080);
  assert.equal(p.audioTracks, 0);
}
async function decoded(file: string) {
  await encode(["-i", file, "-an", "-f", "null", "-"]);
}
async function frame(file: string, seconds: number, destination: string) {
  await encode([
    "-ss",
    seconds.toFixed(3),
    "-i",
    file,
    "-frames:v",
    "1",
    destination,
  ]);
  const pixels = execFileSync(
    ffmpeg,
    [
      "-v",
      "error",
      "-i",
      destination,
      "-vf",
      "scale=96:54",
      "-f",
      "rawvideo",
      "-pix_fmt",
      "rgb24",
      "pipe:1",
    ],
    { env, maxBuffer: 100000 },
  );
  const mean = pixels.reduce((n, v) => n + v, 0) / pixels.length;
  const deviation = Math.sqrt(
    pixels.reduce((n, v) => n + (v - mean) ** 2, 0) / pixels.length,
  );
  assert.ok(deviation > 8, "Fotograma vacío o prácticamente uniforme.");
  return {
    file: path.relative(output, destination).split(path.sep).join("/"),
    seconds,
    standardDeviation: Math.round(deviation * 100) / 100,
    blank: false,
  };
}
function time(seconds: number) {
  const s = Math.round(seconds);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
async function instructions(report: any) {
  let at = 0;
  let voice =
    "# Guion de locución — FinanZas\n\nEspañol de España. Tono cercano, claro y sereno. No se ha generado audio. Los tiempos corresponden a la previsualización muda; los clips originales conservan pausas y acciones completas. No afirmar disponibilidad garantizada, cifrado ni servicios no mostrados.\n\n";
  let board =
    "# Storyboard — grabaciones reales de FinanZas\n\nAplicación React real; datos enteramente ficticios; 1920 × 1080, 16:9, sin voz, música ni subtítulos incrustados. Cursor de demostración superpuesto únicamente durante la captura. Cortes directos en la previsualización.\n\n| Escena | Montaje | Acción real | Clip sin acelerar | Captura |\n| --- | --- | --- | --- | --- |\n";
  for (const s of report.scenes) {
    voice += `## ${s.id} — ${s.title} · ${time(at)}–${time(at + s.seconds)}\n\n${s.voice}\n\nDuración orientativa de locución: ${s.seconds} s. Dejar respirar los importes y las confirmaciones.\n\n`;
    board += `| ${s.id} · ${s.title} | ${time(at)}–${time(at + s.seconds)} | ${s.action} | [Ver clip](${s.mp4 ?? s.file}) | [Miniatura](${s.thumbnail}) |\n`;
    at += s.seconds;
  }
  board +=
    "\nLas escenas usan contextos separados y reconstruyen la continuidad: 7.102,01 € al inicio; 7.069,51 € después de tramitar la compra de 32,50 €. El presupuesto de supermercado pasa de 250 a 300 € tras la escena 04. Desde la escena 06, la suscripción de diciembre ya figura pendiente y no cambia el banco. El manifiesto contiene las métricas calculadas para cada toma. Las cuentas y personas son ficticias.\n";
  await writeFile(abs("guion_locucion.md"), voice);
  await writeFile(abs("storyboard.md"), board);
  await writeFile(
    abs("repetir_grabacion.md"),
    "# Repetir las grabaciones\n\nEn el checkout de FinanZas, rama `feature/demo-video-capture`:\n\n```sh\nnpm ci\nnpm run build\nnpm run demo:check\n# Instalar únicamente el grabador oficial de Playwright si falta:\nPLAYWRIGHT_BROWSERS_PATH=artifacts/demo-video-browser node node_modules/playwright-core/cli.js install ffmpeg\nPLAYWRIGHT_BROWSERS_PATH=artifacts/demo-video-browser npm run demo:smoke -- --output=artifacts/demo-video-comprobacion\nPLAYWRIGHT_BROWSERS_PATH=artifacts/demo-video-browser npm run demo:record -- --output=artifacts/demo-video-nueva-toma\nnpm run demo:package -- --output=artifacts/demo-video-nueva-toma\n```\n\nSe necesitan Chromium, FFmpeg, FFprobe y Python 3. Se puede indicar `CHROMIUM_PATH`, `FFMPEG_PATH` y `FFPROBE_PATH`. No se necesitan claves ni servicios externos. El servidor solo escucha en 127.0.0.1 y sirve el build real de React; no importa server.ts ni activa Gemini. Cada contexto se crea de cero con la fixture ficticia 3.1, el reloj fijo del 10/11/2026 y tráfico restringido al origen local. Los selectores actúan sobre la interfaz, no escriben una animación alternativa.\n\nUsar una carpeta nueva para conservar tomas anteriores. `--only=01,03` permite repetir escenas en otra carpeta; un lote parcial no se presenta como entrega completa. `originals/` conserva los WebM completos; `scenes/` contiene H.264 sin acelerar y sin la preparación inicial. La previsualización ajusta cada clip al tiempo orientativo y el manifiesto documenta esa relación. Los UUID de operaciones, latencias y bytes de codificación pueden variar; importes, fechas, recorridos y resultados son repetibles.\n",
  );
}
async function archive() {
  const script = `import pathlib,sys,zipfile\np=pathlib.Path(sys.argv[1])\nwith zipfile.ZipFile(p/'FinanZas_grabaciones_demo.zip','w',zipfile.ZIP_DEFLATED,compresslevel=4) as z:\n for f in sorted(p.rglob('*')):\n  if f.is_file() and f.suffix not in ('.zip','.sha256'):\n   z.write(f,f.relative_to(p))\nwith zipfile.ZipFile(p/'FinanZas_grabaciones_demo.zip') as z:\n assert z.testzip() is None\n`;
  await run("python3", ["-c", script, output], { env });
  const bytes = await readFile(abs("FinanZas_grabaciones_demo.zip"));
  const hash = createHash("sha256").update(bytes).digest("hex");
  await writeFile(
    abs("FinanZas_grabaciones_demo.zip.sha256"),
    `${hash}  FinanZas_grabaciones_demo.zip\n`,
  );
  console.log(
    `ZIP verificado: ${Math.round((bytes.length / 1024 / 1024) * 10) / 10} MB; SHA256 ${hash}`,
  );
}
async function manifest(report: any) {
  const files: any[] = [];
  async function walk(dir: string) {
    for (const name of (await readdir(dir)).sort()) {
      const file = path.join(dir, name),
        s = await stat(file);
      if (s.isDirectory()) await walk(file);
      else if (
        !name.endsWith(".zip") &&
        !name.endsWith(".sha256") &&
        name !== "recording_manifest.json"
      ) {
        const bytes = await readFile(file);
        files.push({
          file: path.relative(output, file).split(path.sep).join("/"),
          bytes: bytes.length,
          sha256: createHash("sha256").update(bytes).digest("hex"),
        });
      }
    }
  }
  await walk(output);
  report.files = files;
  const encoded = JSON.stringify(report, null, 2) + "\n";
  assert.equal(encoded.includes("/workspace/"), false);
  assert.equal(encoded.includes("@gmail"), false);
  await writeFile(abs("recording_manifest.json"), encoded);
  await archive();
}
async function main() {
  if (process.argv.includes("--repack")) {
    const validated = JSON.parse(
      await readFile(abs("recording_manifest.json"), "utf8"),
    );
    assert.equal(validated.status, "passed");
    assert.equal(validated.sceneCount, 10);
    // Metadata-only packaging must preserve the exact previously decoded media.
    const mediaFiles = validated.files.filter((f: any) =>
      /\.(mp4|webm|png|jpg)$/.test(f.file),
    );
    for (const f of mediaFiles) {
      assert.equal(
        createHash("sha256")
          .update(await readFile(abs(f.file)))
          .digest("hex"),
        f.sha256,
        `El medio ${f.file} ha cambiado; vuelve a verificarlo sin --repack.`,
      );
    }
    await manifest(validated);
    return;
  }
  const report = JSON.parse(await readFile(abs("capture.json"), "utf8"));
  if (!report.complete || report.sceneCount !== 10)
    throw new Error(
      "Se requieren las diez escenas completas antes de empaquetar.",
    );
  await mkdir(abs("qa"), { recursive: true });
  if (!available(ffmpeg) || !available(ffprobe)) {
    await instructions(report);
    await writeFile(
      abs("recording_manifest.json"),
      JSON.stringify(
        {
          ...report,
          status: "webm-only-unverified",
          issues: [
            "Conversión y análisis bloqueados: faltan FFmpeg o FFprobe. No se han generado MP4 ni previsualización.",
          ],
        },
        null,
        2,
      ),
    );
    await archive();
    process.exitCode = 2;
    return;
  }
  const scratch = await mkdtemp(path.join(tmpdir(), "finanzas-montaje-"));
  const parts: string[] = [];
  try {
    for (const scene of report.scenes) {
      const source = abs(scene.file),
        original = probe(source);
      assertVideo(original);
      await decoded(source);
      const keep = Math.min(
        Math.max(scene.seconds, scene.actionDurationSeconds + 0.4),
        original.durationSeconds - scene.leadSeconds - 0.04,
      );
      assert.ok(keep > 2, "La captura no contiene un tramo útil suficiente.");
      scene.mp4 = `scenes/${scene.id}_${scene.slug}.mp4`;
      await encode([
        "-ss",
        scene.leadSeconds.toFixed(3),
        "-i",
        source,
        "-t",
        keep.toFixed(3),
        "-vf",
        "fps=30,setsar=1,format=yuv420p",
        "-an",
        "-map_metadata",
        "-1",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "20",
        "-threads",
        "2",
        "-movflags",
        "+faststart",
        abs(scene.mp4),
      ]);
      const final = probe(abs(scene.mp4));
      assertVideo(final);
      assert.equal(final.codec, "h264");
      await decoded(abs(scene.mp4));
      const frames = [];
      for (const fraction of [0.03, 0.5, 0.92])
        frames.push(
          await frame(
            abs(scene.mp4),
            final.durationSeconds * fraction,
            abs(
              `qa/${scene.id}_${scene.slug}_${Math.round(fraction * 100)}.png`,
            ),
          ),
        );
      scene.original = { file: scene.file, ...original };
      scene.video = { file: scene.mp4, ...final };
      scene.qaFrames = frames;
      scene.validation.status = "passed";
      scene.editing = {
        order: Number(scene.id),
        previewSeconds: scene.seconds,
        speedFactor: final.durationSeconds / scene.seconds,
        trimmedLeadSeconds: scene.leadSeconds,
      };
      const part = path.join(scratch, `${scene.id}.mp4`);
      await encode([
        "-i",
        abs(scene.mp4),
        "-vf",
        `setpts=${(scene.seconds / final.durationSeconds).toFixed(8)}*(PTS-STARTPTS),fps=30,setsar=1,format=yuv420p`,
        "-t",
        String(scene.seconds),
        "-an",
        "-map_metadata",
        "-1",
        "-c:v",
        "libx264",
        "-preset",
        "fast",
        "-crf",
        "20",
        "-threads",
        "2",
        part,
      ]);
      parts.push(part);
      console.log(
        `Escena ${scene.id}: WebM y H.264 decodificados, 1920 × 1080, ${final.durationSeconds.toFixed(2)} s; tres controles de imagen correctos.`,
      );
    }
    const concat = path.join(scratch, "montaje.txt");
    await writeFile(
      concat,
      parts.map((p) => `file '${p.replaceAll("'", "'\\''")}'`).join("\n"),
    );
    await encode([
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concat,
      "-c",
      "copy",
      "-an",
      "-map_metadata",
      "-1",
      "-movflags",
      "+faststart",
      abs("preview_sin_voz.mp4"),
    ]);
    report.preview = {
      file: "preview_sin_voz.mp4",
      ...probe(abs("preview_sin_voz.mp4")),
    };
    assertVideo(report.preview);
    assert.ok(Math.abs(report.preview.durationSeconds - 175) < 0.5);
    await decoded(abs("preview_sin_voz.mp4"));
    await encode([
      "-pattern_type",
      "glob",
      "-i",
      abs("thumbnails/*.png"),
      "-vf",
      "scale=640:360,tile=2x5:padding=12:margin=12:color=white",
      "-frames:v",
      "1",
      "-update",
      "1",
      abs("contact_sheet.jpg"),
    ]);
    await instructions(report);
    report.status = "passed";
    report.issues = [];
    await manifest(report);
    console.log(
      `Previsualización muda: ${report.preview.durationSeconds.toFixed(2)} s. Diez escenas validadas.`,
    );
  } finally {
    await rm(scratch, { recursive: true, force: true });
  }
}
main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
