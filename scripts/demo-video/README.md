# Grabaciones de demostración de FinanZas

Diez recorridos automáticos sobre la aplicación React real, en español, tema claro y 1920 × 1080. Sin voz, música ni subtítulos. El cursor y el indicador de clic se insertan solamente en el contexto de captura. No se modifica código de producción.

## Repetir

Requisitos: Node compatible con el proyecto, Chromium, FFmpeg con H.264, FFprobe y Python 3. Se reutilizan Express, Playwright Core y tsx del proyecto; no se añaden dependencias npm.

```sh
git switch feature/demo-video-capture
npm ci
npm test
npm run lint
npm run build
npm run demo:check

# Playwright necesita su propio ejecutable de grabación, además de FFmpeg del sistema.
export PLAYWRIGHT_BROWSERS_PATH=artifacts/demo-video-browser
node node_modules/playwright-core/cli.js install ffmpeg
export CHROMIUM_PATH=/usr/bin/chromium

npm run demo:smoke -- --output=artifacts/demo-video-comprobacion
npm run demo:record -- --output=artifacts/demo-video-nueva-toma
npm run demo:package -- --output=artifacts/demo-video-nueva-toma
```

Las descargas de dependencias son preparación del entorno, anteriores a la captura. Durante las escenas no se utiliza ningún servicio externo. `FFMPEG_PATH` y `FFPROBE_PATH` permiten seleccionar otros binarios. El servidor se inicia y detiene automáticamente; no hay que ejecutar `npm run dev`.

Usar un destino nuevo para cada toma. El grabador rechaza destinos con un manifiesto existente. Para ensayar un recorrido concreto, se puede añadir `--only=03,09` y elegir otra carpeta. Un lote parcial no se puede empaquetar como una entrega completa. `demo:smoke` reproduce las mismas acciones sin grabar y con pausas reducidas; no sirve como vídeo comercial.

## Implementación e aislamiento

- `fixture.ts`: snapshots JSON 3.1 validados con `makeBackup`/`parseBackup`. Movimientos, repartos, reintegros, transferencias, planificación aprobada, reglas y liquidaciones se crean con funciones del dominio existente.
- `record.ts`: servidor Express independiente que sirve `dist` solamente en `127.0.0.1`, con puerto efímero. No importa `server.ts`, dotenv ni el SDK de Gemini; las rutas API quedan desactivadas. La aplicación sigue siendo el mismo build React de producción.
- Cada escena utiliza un contexto nuevo de Chromium, sin perfil persistente, con `DATA_KEY` precargado exclusivamente con la fixture. Un contexto testigo comprueba que las operaciones no afectan a otra sesión. Los contextos se cierran antes de finalizar los WebM.
- El navegador recibe un entorno mínimo sin claves; se bloquean service workers, peticiones API y todo origen distinto al servidor local. Cualquier intento externo, error JavaScript o error de consola hace fallar la escena. El reloj se fija al 10/11/2026, 10:00 de Madrid.
- `scenes.ts`: interacciones reales por roles y etiquetas accesibles. Las consultas comparan el almacenamiento antes y después; las escrituras de las escenas 03–05 se comprueban contra los resultados del dominio. Las escenas del asistente utilizan respuestas locales calculadas, sin Gemini.
- `media.ts`: FFprobe comprueba los flujos reales; FFmpeg decodifica íntegramente los WebM y MP4, genera tres controles por escena y rechaza imágenes uniformes. Conserva los originales, convierte a H.264/yuv420p a 30 fps sin audio y prepara una previsualización muda de 175 s. Los MP4 individuales conservan el ritmo de la toma; solamente el montaje ajusta ligeramente cada clip a su duración orientativa.
- El ZIP contiene rutas relativas, datos ficticios, medios y documentación. El manifiesto inventaría tamaño y SHA-256 de los archivos. `--repack` actualiza el inventario y el ZIP sin recodificar; exige que todos los medios conserven sus hashes previamente validados.

## Relato y cifras

Los contextos son independientes pero reconstruyen la continuidad entre escenas:

| Momento         | Situación ficticia                                                                                   |
| --------------- | ---------------------------------------------------------------------------------------------------- |
| Inicio          | 7.102,01 € líquidos: principal 2.582,01 €, ahorro 4.400 € y efectivo 120 €                           |
| Tras escena 03  | Compra de supermercado de 32,50 € confirmada pendiente y después tramitada: 7.069,51 € líquidos      |
| Tras escena 04  | Supermercado previsto de 250 a 300 €; ahorro objetivo 500 €; aprobación explícita; banco sin cambios |
| Tras escena 05  | Suscripción del 05/12 pendiente: banco sin cambios; se evita duplicarla en las propuestas            |
| Compartidos     | Comida de 90 €; tres partes de 30 €; reintegro de Amistad A de 10 €; pendientes 20 + 30 €            |
| Compromisos     | Principal por cobrar 150 € tras liquidar 50 €; por pagar 90 € tras un ajuste de 30 €                 |
| Tesorería final | Proyección de 30 días de 8.699,52 €, estimación informativa y no saldo garantizado                   |

La escena 02 prepara un traspaso de 50 € y lo cancela; la fixture incluye uno anterior de 400 €. La escena 03 usa el formulario de revisión que la aplicación ofrece desde el asistente local y después vuelve a Movimientos. La exportación final es una copia ficticia real y no representa cifrado ni medidas de seguridad adicionales.

## Archivos generados

```text
artifacts/demo-video-nueva-toma/
  originals/01_inicio.webm ... 10_cierre.webm
  scenes/01_inicio.mp4 ... 10_cierre.mp4
  thumbnails/                 # diez imágenes representativas
  qa/                         # treinta controles extraídos de los vídeos
  contact_sheet.jpg
  preview_sin_voz.mp4
  storyboard.md
  guion_locucion.md
  repetir_grabacion.md
  capture.json
  recording_manifest.json
  demo_backup_ficticio.json
  FinanZas_grabaciones_demo.zip
  FinanZas_grabaciones_demo.zip.sha256
```

Los medios están excluidos de Git mediante `/artifacts/demo-video*/`. Solo se publica el sistema de captura y su documentación. Si faltan FFmpeg o FFprobe, se conservan los WebM, se identifica el bloqueo en el manifiesto y el proceso termina con código 2; no declara MP4 ni previsualización generados.

## Regenerar y descargar con GitHub Actions

El workflow `.github/workflows/demo-video.yml` se ejecuta con `pull_request` (`opened`, `synchronize` y `reopened`) contra `main`, exclusivamente para la PR #16 desde `feature/demo-video-capture` del mismo repositorio. Funciona con la PR en Draft y no requiere fusionar el workflow en la rama predeterminada. Un nuevo commit en esta rama lo inicia; después se puede utilizar **Re-run all jobs** en una ejecución existente. No depende de `workflow_dispatch` ni utiliza Codespaces.

Utiliza un runner estándar `ubuntu-24.04`, Node 24, el Chromium y el grabador correspondientes al Playwright Core del lockfile, y FFmpeg/FFprobe. Las dependencias se descargan antes de capturar. Ejecuta `npm ci`, las pruebas unitarias y de fixture, lint, build, diff-check desde el SHA base de la PR, ensayo, grabación y empaquetado. El checkout incluye el historial para comparar correctamente ese diff. No recibe secretos ni claves API; checkout usa permiso de lectura y no conserva credenciales. La captura mantiene el servidor local y las restricciones de red del grabador existente.

Antes de publicar, `verify_archive.py` comprueba CRC/SHA-256, los diez MP4 y WebM, las diez miniaturas, treinta controles, previsualización de 175 s, guion, storyboard y manifiesto. Comprueba el inventario de hashes, la validación de cada escena, la ausencia de escrituras por consulta y que los contactos sean los ficticios de la fixture. También rechaza correos y rutas privadas en los documentos. FFmpeg/FFprobe ya han decodificado y comprobado los medios durante el empaquetado.

Para descargar: abre **Actions → FinanZas · grabaciones de demostración → una ejecución correcta** y, al final, **Artifacts → FinanZas_grabaciones_demo**. Descomprime ese artefacto de Actions: dentro están `FinanZas_grabaciones_demo.zip` y su SHA-256. Descomprime el ZIP interior para obtener todos los materiales. GitHub puede pedir que inicies sesión para descargar artefactos de Actions. El resumen de la ejecución también enlaza directamente al artefacto.

Se conservan durante **14 días**. Los registros y los informes se publican por separado como `FinanZas_validacion_<run_id>_<attempt>`, incluso si falla una fase. Si falla la validación, no se publica el ZIP como entrega correcta; consulta el primer paso fallido y sus registros. No se publican medios en Git ni se crean releases.

## Validación realizada el 10/11/2026

Base de la aplicación: `66a045e17e310527c790a15ff2fe5dceaaba48a3`, HEAD remoto de main comprobado antes de crear la rama independiente. Entorno: Node 24.22.1, Chromium 156.0.8078.79 y FFmpeg/FFprobe 7.1.5.

- `npm test`: **255 pruebas superadas**.
- `npm run demo:check`: **2 pruebas superadas**, incluyendo los diez snapshots y consultas sin escritura.
- `npm run lint`, `npm run build` y `git diff --check`: correctos. Build conserva el aviso de tamaño del bundle.
- Dos ensayos completos de los diez recorridos (el segundo con los scripts finales) y grabación real de los diez; cero errores JavaScript/consola, cero peticiones externas/API y contexto testigo sin modificaciones.
- Diez WebM y diez MP4 íntegramente decodificados, todos 1920 × 1080 y sin pista de audio. Diez miniaturas, treinta controles no vacíos y revisión visual de las pantallas y diálogos. Previsualización H.264 de **175,00 s** y ZIP con CRC verificado.

| Escena          | MP4 real (s) | Montaje (s) |
| --------------- | -----------: | ----------: |
| 01 Inicio       |        14,97 |          15 |
| 02 Cuentas      |        17,00 |          17 |
| 03 Movimientos  |        20,77 |          20 |
| 04 Presupuestos |        19,97 |          20 |
| 05 Periódicos   |        18,00 |          18 |
| 06 Compartidos  |        16,97 |          17 |
| 07 Deudas       |        17,00 |          17 |
| 08 Tesorería    |        17,97 |          18 |
| 09 Asistente    |        20,97 |          21 |
| 10 Cierre       |        11,97 |          12 |

Las tomas iniciales se hicieron con la automatización todavía sin commit: el manifiesto distingue el HEAD base en el momento de captura, ese estado y el commit publicado posteriormente. No atribuye los scripts a un commit que aún no los contenía.

## Límites

Todavía no hay locución, música, subtítulos, transiciones ni montaje comercial final. Las preguntas del asistente seleccionadas funcionan de forma local; no se demuestra una conversación con un servicio externo. Las previsiones siguen siendo estimaciones y el histórico de préstamos conserva la aproximación documentada en Fase 5. Firefox y Safari no se han verificado. Los UUID, latencias y bytes de codificación pueden variar al repetir; importes, fechas y acciones son repetibles.

La captura inicial local no pudo adjuntarse desde la tarea. El workflow añade la regeneración y publicación como artefacto de GitHub Actions; la disponibilidad y la ejecución concreta deben comprobarse antes de dar por resuelta la descarga. No se utiliza una release ni otro almacenamiento externo.
