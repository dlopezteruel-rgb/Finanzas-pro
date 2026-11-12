# Fase 4B: integración continua con GitHub Actions

Base verificada de `main`: **`8f9b5dd1f7a5da39f38eea46d22daf08864cfdc2`**, merge de PR #23. Rama `feature/phase-4b-github-actions`, creada con árbol limpio. Esta fase añade CI, sin CD ni cambios de reglas de protección del repositorio.

## Arquitectura y activación

`.github/workflows/ci.yml` define tres trabajos independientes sobre **ubuntu-24.04**:

| Trabajo | Comprobaciones | Timeout |
| --- | --- | --- |
| Unitarias | `npm ci`, 22 pruebas del ejecutor de CI y `npm test` completo. | 10 min |
| Lint, build y diff | `npm ci`, diff real contra la base, `npm run lint`, `npm run build`. | 10 min |
| Chromium y axe | `npm ci`, instalación del navegador, resolución/verificación de la ruta y `npm run test:ui` completo con axe estricta. | 30 min |

Se activa en PR hacia `main` (incluidas Draft: apertura, sincronización, reapertura y cambio a lista para revisión), push a `main` y `workflow_dispatch`. Nunca utiliza `pull_request_target`. La concurrencia cancela ejecuciones anteriores de la misma PR/rama al llegar una revisión nueva; una cancelación no es un resultado correcto. No hay filtros por archivos ni condiciones que omitan pruebas por ser Draft.

## Entorno reproducible

- Node **24.22.1**, verificado también en la fase 4A; se utiliza el npm distribuido con esa instalación y se registra el entorno. `npm ci` usa el lockfile, sin actualizar dependencias.
- La caché de `setup-node` contiene descargas npm; no sustituye la instalación ni cachea `node_modules` o respaldos financieros.
- `playwright-core` **1.64.1**, fijado en `package.json` y lockfile. Se verificó su binario declarado `playwright-core: cli.js`, ayuda y `install --dry-run`.
- Instalación en el runner: `node node_modules/playwright-core/cli.js install --with-deps --no-shell chromium`. No se usa `npx` para descargar otra versión de Playwright. Instala las dependencias Linux y el Chromium declarado por esa dependencia.
- Navegador declarado: **Chrome for Testing 156.0.8078.4**, revisión Playwright **1248**. Se instala Chromium completo, que admiten los scripts existentes; no se sustituye por un headless shell ni por un Chromium del sistema.
- `resolve-browser.mjs` verifica la versión instalada de Playwright contra el manifiesto, obtiene `chromium.executablePath()`, comprueba que existe y es ejecutable, consulta `--version` y establece `CHROMIUM_PATH` mediante `GITHUB_ENV`. Registra arquitectura y versión de imagen del runner, sin volcar variables de entorno.

Las acciones oficiales están fijadas a hashes completos. Se contrastaron con las referencias oficiales v6 y sus `action.yml` (runtime Node 24):

| Acción | Commit |
| --- | --- |
| actions/checkout | `d23441a48e516b6c34aea4fa41551a30e30af803` |
| actions/setup-node | `249970729cb0ef3589644e2896645e5dc5ba9c38` |
| actions/upload-artifact | `b7c566a772e6b6bfb58ed0dc250532a479d7789f` |

## Diff correcto y resultados estrictos

Checkout obtiene el **head SHA real de la PR**, con historial completo. `check-diff.mjs` lee el evento desde el archivo de GitHub, valida los SHA, comprueba que HEAD coincide y calcula el merge-base entre base/head. Ejecuta `git diff --check merge-base..head`, registra ambos extremos y el número de archivos, y rechaza un diff de PR vacío inesperado. No compara HEAD consigo mismo. Para push compara `before..after`; en ejecución manual usa el padre de HEAD. Los SHA se pasan a Git con argumentos, sin interpolar texto de la PR en un shell.

`run-check.mjs` ejecuta los comandos sin tuberías que oculten su salida real, conserva logs y propaga cualquier código de error o señal. Además analiza los resúmenes spec/TAP de Node: exige campos completos, al menos un test, `tests === pass` y cero fallos, cancelados, omitidos o pendientes. La batería de navegador debe contener al menos las 21 suites integradas y producir exactamente tantos resúmenes como suites declaradas. No se usa `continue-on-error`, reintento automático ni reglas axe ignoradas.

Tras Chromium se exige la auditoría axe completa de **128 superficies**, sin violaciones. Los grupos incompletos aparecen por separado y requieren revisión manual; no se convierten en aprobaciones de accesibilidad.

## Diagnóstico y artefactos

Cada trabajo publica un resumen en GitHub y conserva los logs y JSON de diagnóstico durante **7 días**. El trabajo de navegador añade versión real de Chrome/Node/Playwright y resultados axe por superficie. Al fallar sube también capturas.

Un preload exclusivo de CI intercepta el cierre de contextos creados por los scripts Playwright y captura sus últimas páginas locales. Conserva cada contexto con una secuencia única (máximo 500 por suite y dos páginas por contexto), con URL local. No sobrescribe una captura fallida cuando se cierran después otros casos de la suite. Así conserva el estado cercano al fallo aunque un `finally` cierre el navegador. Las capturas son de fixtures; no se guardan volcados de localStorage, claves ni perfiles personales. Los errores del diagnóstico se registran sin sustituir el código de salida de la prueba. Si la instalación o el lanzamiento fallan antes de abrir una página, habrá logs en lugar de una captura inexistente.

Los artefactos de éxito contienen logs/JSON; los de fallo incluyen además imágenes. `ci-artifacts/` está excluido del repositorio. Los informes unitarios y de herramientas se distinguen: los 22 casos de infraestructura no se suman a las pruebas de aplicación para inflar su referencia.

## Seguridad y aislamiento

Permiso global único: **`contents: read`**. Checkout usa `persist-credentials: false`. No hay secretos referenciados, publicación de paquetes, despliegues ni permisos de escritura del repositorio. Gemini/Google API keys están vacías; el ejecutor tampoco propaga GH_TOKEN/GITHUB_TOKEN a los procesos de prueba. Los scripts existentes usan almacenamiento aislado, fixtures ficticios y servicios externos simulados o bloqueados.

No se cambia producción, Google AI Studio, carteras, modelos contables, clave de almacenamiento o JSON. El único ajuste de Vite sustituye `path.resolve(__dirname, '.')` por `path.resolve(import.meta.dirname, '.')`, con la misma ruta; elimina el aviso del cargador nativo en Node 24. Se conservan DISABLE_HMR, HMR y vigilancia de AI Studio.

## Verificación local inicial

Sobre la base, antes de cambiar configuración: **435 unitarias y 291 resultados Chromium** (270 casos y 21 contenedores), sin fallos, omisiones ni cancelaciones. `npm ci` instaló 188 paquetes; lint y build correctos. Chromium del entorno: 156.0.8078.79.

Se descargó además el navegador declarado por la dependencia, en un almacenamiento de herramientas separado: Chrome for Testing **156.0.8078.4**. El resolver confirmó la ruta real; no se asumió `/usr/bin/chromium`. Las 22 pruebas del ejecutor y su ejecución sobre las 435 unitarias pasan. Lint y build pasan con el ajuste mínimo de Vite y ya no muestran el aviso de `__dirname`.

## Prueba real de Actions

**Pendiente al publicar este primer checkpoint. No se considera CI validado hasta observar las ejecuciones reales.**

La PR Draft se utilizará para un fallo deliberado, señalado como tal, después de ejecutar las 21 suites reales. Se verificará un check rojo y su diagnóstico; después se retirará la prueba temporal y se ejecutará de nuevo la batería completa. No se tocará `main` ni se mantendrá una prueba rota en la entrega final.

## Incidencias durante la validación real

La [primera ejecución](https://github.com/dlopezteruel-rgb/Finanzas-pro/actions/runs/43287265075), SHA `c2135e934fde7e62c5320d1a69853cfbe14d6ec8`, terminó con Unitarias y Código verdes y Chromium rojo **antes** de alcanzar el fallo deliberado. No se cuenta como prueba controlada superada ni como batería completa: 12 resúmenes de suites, 213 resultados correctos y dos fallidos (caso y contenedor).

| Incidencia | Causa y corrección | Verificación |
| --- | --- | --- |
| CI-001: lectura prematura de cartera al cambiar de creación a edición | El test leía un select reutilizado antes del efecto React que carga el registro. Ocurrió en GitHub con Préstamo y se reprodujo localmente con Movimiento histórico. La segunda ejecución añadió dos fallos de selección de subítem al abrir otro movimiento antes de cargar el borrador. Las esperas de identidad en el test no resolvían el origen común. El ajuste final cambia únicamente la inicialización local de los borradores de Movimiento, Préstamo, Liquidación, Traspaso, Cartera, Contacto y detalle de partida a `useLayoutEffect`, para que el borrador correspondiente esté listo antes de hacer visible el diálogo. Se restauró `defaultWallet.browser.ts` exactamente como en la base: mismas aserciones inmediatas de cartera y persistencia. No se añaden sleeps, reintentos ni timeouts mayores; no se cambia almacenamiento, importes o validadores. | Suite completa `defaultWallet.browser.ts`, 390/1280 px, con el Chrome for Testing fijado y diagnóstico activo. |
| CI-002: capturas tempranas sobrescritas | Un búfer circular podía perder el estado de un caso fallido cuando continuaban otros casos de la misma suite. Se conservan secuencias únicas, con límite de 500 contextos por suite. | Prueba de infraestructura que falló antes de corregirlo: nueve contextos deben conservar nueve imágenes, incluidas primera y última. Otra prueba verifica que un error real de cierre sigue propagándose. |
| CI-003: aviso Vite `__dirname` | Sustitución mínima por `import.meta.dirname`, conservando el alias y los ajustes HMR. | Builds locales y trabajo Código de GitHub correctos, sin el aviso anterior. |

La [segunda ejecución](https://github.com/dlopezteruel-rgb/Finanzas-pro/actions/runs/43289789623), SHA `49d2527cb17a2f7349d1cf97d7ce51f38b2ca57d`, también terminó antes del fallo deliberado: 13 resúmenes, 231 resultados correctos y tres fallidos (dos casos de subítems y su contenedor). No se declara como validación completa ni como prueba roja deliberada. El cambio de inicialización conserva las pruebas originales de cartera y subítems; ambas baterías se ejecutan completas con el navegador fijado.

La [tercera ejecución](https://github.com/dlopezteruel-rgb/Finanzas-pro/actions/runs/43291853386), SHA `a6ee1135b30ca9011014341875f74f14e274e11e`, detectó el mismo patrón en la cartera de una liquidación: 12 resúmenes, 212 correctos y tres fallidos (dos casos y contenedor). El cierre revisa los inicializadores visuales de los diálogos reutilizados y mantiene sus valores, dependencias y callbacks; no cambia lógica económica ni escrituras. También esta ejecución terminó antes de la prueba deliberada.

Los artefactos de la primera ejecución se descargaron y verificaron; el archivo ZIP coincide con su SHA-256 publicado por GitHub. El primer diagnóstico permitió localizar la aserción exacta. La siguiente ejecución conserva la prueba deliberada para completar esa comprobación después de corregir la sincronización.

## Interpretación de errores

- Fallo de `npm ci`: revisar instalación/registro/lockfile en el log del paso; no se continúa con pruebas inexistentes.
- Fallo o señal del proceso: el trabajo queda rojo, incluso si el texto del test imprime PASS.
- Exit 0 con un test omitido o un resumen incompleto: el ejecutor también falla.
- Diff vacío inesperado o SHA incorrecto: se rechaza la comprobación, sin una falsa aprobación por ausencia de cambios.
- Fallo de navegador: el log identifica la suite que estaba ejecutándose; descargar el artefacto de fallo para ver las capturas locales y los metadatos.
- Violación axe: trabajo rojo. Resultado axe incompleto: revisión manual documentada, sin declararlo probado con lector de pantalla.

## Reproducción local

```sh
npm ci
npm test
npm run lint
npm run build
node node_modules/playwright-core/cli.js install --no-shell chromium
# Usar --with-deps en una máquina Linux que necesite dependencias del sistema.
node scripts/ci/resolve-browser.mjs
CHROMIUM_PATH="$(node -e 'process.stdout.write(require("playwright-core").chromium.executablePath())')" npm run test:ui
node scripts/ci/run-check.mjs tools
node scripts/ci/run-check.mjs unit
# El modo code exige GITHUB_EVENT_NAME y GITHUB_EVENT_PATH para verificar el diff real.
# El modo browser exige el CHROMIUM_PATH resuelto y añade diagnóstico/resúmenes.
```

## Protección recomendada de main y límites

Cuando esta PR se revise y fusione, recomendar requerir los tres checks **Unitarias**, **Lint, build y diff**, **Chromium y axe**, vinculados a GitHub Actions, y exigir PR revisada/actualizada según la política del proyecto. No se cambian esas reglas sin autorización. Al publicar por primera vez un workflow, una ejecución manual desde la rama solo está disponible según el registro del workflow en la rama predeterminada; el evento de PR permite validarlo antes de fusionar.

Actions no impide fusiones por sí solo si no existen reglas de protección. Tampoco certifica Safari/iPhone, dispositivos físicos ni lector de pantalla. Los P3 de controles táctiles compactos y jerarquía de encabezados de fase 4A permanecen documentados; no se amplía su alcance aquí. Los runners hospedados y las descargas oficiales pueden sufrir fallos de servicio: se conservan como fallos reales, sin reintentos automáticos que los oculten.
