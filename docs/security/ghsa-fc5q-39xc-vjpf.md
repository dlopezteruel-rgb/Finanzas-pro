# GHSA-fc5q-39xc-vjpf / CVE-2026-112366

## Resultado y procedencia

**Resultado B: mitigación de exposición — vulnerabilidad upstream pendiente.** No se declara corregido picomatch. Al investigar el 18 de noviembre de 2026, el advisory no identifica parche y npm sigue publicando4.0.7 como última versión. npm audit completo y omit=dev continúan con salida1, 5 paquetes high y 0 critical en la validación local. Un solo advisory se propaga por el árbol.

Base obligatoria: `208f1830581dc6c424118ee0edb77903ec83042e`, merge de PR32 confirmado, sin commits posteriores al preparar la rama. Rama `fix/security-picomatch-redos`; entrega independiente [PR Draft34](https://github.com/dlopezteruel-rgb/Finanzas-pro/pull/34). Checkpoint de auditoría2d4ad00; código de mitigación y pruebas `cf460d0ce4869b1f9fc4f05abc14c00415513b0e`. Los resultados locales corresponden a ese SHA; el commit de documentación no cambia ese código. El SHA final y las ejecuciones exactas posteriores al commit de evidencias se registran en la descripción de PR34 y en sus artefactos `summary.source`, sin atribuir a un SHA pruebas históricas de otro.

Se preservan los diez worktrees anteriores y sus cambios; se crea uno independiente. No se modifica main, PR32 ni evidencias históricas de5H. [Inventario y procedencia](ghsa-fc5q-39xc-vjpf-evidence/initial-audit.json).

## Inventario y auditoría previa

Entorno: Node24.22.1, npm11.9.0, Chromium156.0.8078.79, Linux,2vCPU/8GiB. npm ci instala306 paquetes. Vite, pluginReact y Tailwind/Vite están en dependencies; no se reclasifican para ocultar alertas.

| Paquete | Antes | Después | Papel |
| --- | --- | --- | --- |
| picomatch |4.0.7|4.0.7| Aviso ReDoS directo; patrones extglob manipulados |
| fdir |6.5.0|6.5.0| Dependencia transitiva de picomatch |
| tinyglobby |0.2.17|0.2.17| picomatch y fdir |
| vite |8.3.7|8.3.7| picomatch y tinyglobby; dependencia directa del proyecto |
| @vitejs/plugin-react |6.3.0|6.3.0| Dependencia/peer de Vite |
| @tailwindcss/vite |4.3.5|4.3.5| Consumidor de Vite |
| rolldown |1.2.18|1.2.18| Infraestructura de compilación conservada |

[Comandos previos con códigos reales](ghsa-fc5q-39xc-vjpf-evidence/before/commands.json), [npm ls](ghsa-fc5q-39xc-vjpf-evidence/before/ls-picomatch.json), [npm explain](ghsa-fc5q-39xc-vjpf-evidence/before/explain-picomatch.json), [auditoría completa](ghsa-fc5q-39xc-vjpf-evidence/before/audit.json), [omit=dev](ghsa-fc5q-39xc-vjpf-evidence/before/audit-production.json). Ambas auditorías iniciales salen1:5 high/0 critical. La configuración heredada de este host tenía audit=false; no la establece esta PR. Se ejecutaron explícitamente ambas auditorías, y la instalación final/diagnóstico utilizan npm_config_audit=true por comando. No se modifica configuración global ni se utiliza audit=false como remediación.

Lockfile sin cambios byte a byte. Las integridades de los siete paquetes coinciden con sus metadatos oficiales publicados; se conservan engines, peers y rutas de resolución. [Integridades y compatibilidad](ghsa-fc5q-39xc-vjpf-evidence/sources/installed-integrities-and-compatibility.json). Node24 cumple los requisitos efectivos; no se actualizan React19, Vite8, pluginReact6, Tailwind4, TypeScript ni Capacitor8.6.2.

## Fuentes oficiales y opciones evaluadas

- [GitHub Security Advisory](https://github.com/advisories/GHSA-fc5q-39xc-vjpf): afecta a<=4.0.7, first_patched_version=null, sin retirada; actualización consultada2026-11-17T15:56:44Z. [JSON](ghsa-fc5q-39xc-vjpf-evidence/sources/advisory.json).
- [Registro npm](https://registry.npmjs.org/picomatch) y [releases picomatch](https://github.com/micromatch/picomatch/releases): última4.0.7; ninguna4.0.8 publicada en la consulta.
- [PR194 del mantenedor](https://github.com/micromatch/picomatch/pull/194), referenciada por el advisory: abierta/no fusionada, trata semántica del signo? en un extglob; no demuestra un parche publicado de este CVE. Otros commits de globstar/newlines/punct no se consideran su corrección sin evidencia específica.
- Se consultan avisos/releases de Vite, fdir y tinyglobby, además de otros advisories picomatch: [peticiones y fechas](ghsa-fc5q-39xc-vjpf-evidence/sources/research-requests.json). No se confunden otros CVE con éste. [Reconsulta oficial a las02:14UTC](ghsa-fc5q-39xc-vjpf-evidence/after/upstream-recheck.json): sigue sin parche y latest4.0.7.

| Alternativa | Decisión |
| --- | --- |
| Actualización oficial compatible | Bloqueada: sin versión corregida verificable. |
| Override npm | Descartado: no hay parche fiable que forzar. |
| Downgrade mayor de Vite sugerido por npm | Descartado: no demuestra eliminar el CVE y altera compatibilidad. |
| Fork/parche de terceros | Descartado: no existe necesidad ni arreglo auditado demostrado. |
| Reducir exposición del runtime | Seleccionada y probada: Vite sólo se importa en desarrollo. |

No se usa npm audit fix --force ni se modifica manualmente el lockfile. package.json añade exclusivamente test:security:server y audit:security.

## Express, entradas no confiables y mitigación

Antes, server.ts importaba Vite estáticamente aunque createServer sólo se utilizaba fuera de producción. La sonda real de producción confirmó la carga de Vite,picomatch,tinyglobby y fdir, y comprobó una respuesta ficticia del asistente. Cargar un módulo no demuestra por sí solo un exploit. [Sonda previa](ghsa-fc5q-39xc-vjpf-evidence/before/production-import-exposure.json).

El único cambio del servidor mueve esa importación al bloque de desarrollo mediante await import('vite'). Se conservan Express, middleware, HMR, DISABLE_HMR, APP_BASE_PATH, rutas y respuestas, validaciones, prompts y configuración de Gemini. **Producción debe arrancar con NODE_ENV=production**; npm start sin ese entorno sigue teniendo su semántica anterior de desarrollo. No se añade backend, proxy ni autenticación.

No se identifica en los endpoints actuales una entrada HTTP convertida en patrón glob: usan mensajes, fechas y categorías; los archivos de aplicación/configuración no consumen picomatch/tinyglobby directamente. En el árbol instalado, fdir utiliza picomatch en glob(), tinyglobby compila match/ignore y Vite los utiliza en sus herramientas/configuración. [Búsquedas y alcance](ghsa-fc5q-39xc-vjpf-evidence/after/glob-exposure-search.json). No se presenta esta revisión como prueba universal de ausencia de caminos upstream explotables, especialmente en el servidor de desarrollo.

Seis pruebas reales de HTTP/HMR verifican raíz y subruta: HTML/assets/SPA, redirección, API/fallback sin claves, entradas inválidas, DISABLE_HMR y actualización real de un módulo ficticio por WebSocket. En producción un hook rechaza importar Vite/picomatch; se comprueban también las identidades ESM y caché CommonJS. Antes fallan las2 pruebas de producción y pasan las4 de desarrollo; después6/6. [Fallo previo](ghsa-fc5q-39xc-vjpf-evidence/before/server-isolation-tests.log.gz), [resultado posterior](ghsa-fc5q-39xc-vjpf-evidence/after/security-server/summary.json). Las pruebas no ejecutan payloads ReDoS, no crean datos financieros, no muestran tokens y sólo terminan sus procesos propios.

Vite continúa instalado y vulnerable: la importación dinámica **no remedia el paquete**. Desarrollo/compilación/CI deben utilizar código, plugins y configuraciones de confianza; mantener las herramientas de desarrollo fuera de redes no confiables y no ejecutar globs de terceros sin aislamiento y límites. No se añaden validadores especulativos a los parsers financieros.

## Integridad financiera y compatibilidad

[Verificación del alcance](ghsa-fc5q-39xc-vjpf-evidence/after/scope-verification.json): ningún cambio en src, modelos, FinanceStore, IndexedDB strict, Web Locks, CAS, recibos, SQLCipher, Keystore, Keychain, proyectos nativos o configuración de Vite. El servidor difiere sólo por la ubicación del import. Los tres trabajos previos del workflow y el manifiesto de46 suites permanecen intactos. No se modifican aserciones anteriores.

Se mantienen JSON3.5/lectura2.5–3.5, migración, copias, exportación/recuperación forense, concurrencia, transferencias, préstamos y operaciones vinculadas mediante las baterías originales. Las pruebas sólo utilizan perfiles y fixtures ficticios. El registro vivo de44 huellas auditadas detectó server.ts/workflow; se revisaron únicamente esas2 huellas, conservando42 y todas las aserciones. [Revisión justificada](ghsa-fc5q-39xc-vjpf-evidence/reviewed-protected-hashes.json). El inventario AST i18n se regenera por la huella del servidor, sin cambiar mensajes, prompts ni traducciones.

## Resultados locales de regresión

| Comprobación | Resultado real |
| --- | --- |
| npm ci, auditoría habilitada | Código0; advertencia5high; no equivale a auditoría aprobada |
| npm test |733/733;0 fallos, omitidas o canceladas |
| Infraestructura CI |56/56;50 anteriores+6 del diagnóstico de seguridad |
| Servidor HTTP/HMR |6/6, adicionales y separadas de las733 unitarias |
| npm run lint / build / diff-check | Correctos |
| npm run test:ui |997/997,46 suites completas;0 fallos, omisiones o cancelaciones |
| npm run test:durability dedicado |72/72, incluyendo motor/UI/P0 |
| SIGKILL tras confirmar |20/20 dedicado y repetido dentro de la batería completa |
| Controles SIGKILL |2/2 en cada ejecución |
| Interrupciones de frontera |8/8 en cada ejecución |
| SQLCipher real Linux |11/11,4.20/SQLite3.54.1/OpenSSL3.5.7 |
| Android | APK debug unsigned compilado; **runtime bloqueado** |
| iOS | Fuentes sincronizadas; **compilación/runtime bloqueados** en Linux |
| npm audit completo/omit=dev | **Salida1; alerta upstream abierta** |

[Comandos, códigos, duración y SHA](ghsa-fc5q-39xc-vjpf-evidence/after/commands.json), [batería y resumen](ghsa-fc5q-39xc-vjpf-evidence/after/browser/summary.json), [20 repeticiones y controles dedicados](ghsa-fc5q-39xc-vjpf-evidence/after/dedicated-p0/web-durability.json), [fronteras](ghsa-fc5q-39xc-vjpf-evidence/after/dedicated-p0/web-crash-controls.json). Se comprueban snapshot completo, hashes, revisión, IDs y relaciones; sin esperas artificiales tras confirmar. No se extrapola Chromium a otros navegadores, fallos eléctricos o hardware físico.

Android incluye SQLCipher para4ABI y54 recursos locales, sin firma de distribución; APK13351679bytes. [Hash, contenido y bloqueos](ghsa-fc5q-39xc-vjpf-evidence/after/native-verification.json). No existe /dev/kvm ni dispositivo autorizado. iOS exige macOS/Xcode y runtime; sincronizar no valida Keychain. [Motor Linux](ghsa-fc5q-39xc-vjpf-evidence/after/sqlcipher-environment.json) no certifica seguridad nativa. Datos reales/importación externa/distribución móviles permanecen bloqueados. No se distribuye APK/IPA.

Advertencias conservadas en logs: node-domexception deprecado; Vite advierte sobre import sin extensión en el futuro configLoader:native; Gradle informa APIs/deprecaciones heredadas. No se ocultan ni se introducen refactorizaciones ajenas.

## Accesibilidad y cinco idiomas

La batería conserva las reglas axe y recorre los cinco idiomas, temas, teclado, foco, formularios, planificación y recuperación. Auditoría consolidada local: 1702 observaciones, 0 violaciones automatizadas, 975 grupos incompletos en 54 conjuntos equivalentes. [Informe contextual](ghsa-fc5q-39xc-vjpf-evidence/after/axe-consolidated.json). Los informes detallados se conservan sin pérdida en JSON.gz para evitar duplicar megabytes de texto; [índice y hashes del contenido original/comprimido](ghsa-fc5q-39xc-vjpf-evidence/after/browser-evidence-index.json). Las auditorías npm permanecen como JSON íntegros. Se incluyen los informes web y nativo simulado, sin sumar ejecuciones históricas como defectos nuevos. La comparación local/CI da54 frente a58 conjuntos; la unión conserva58. Cuatro no observados localmente siguen presentes en CI; su ausencia en un entorno no demuestra resolución. [Comparación contextual](ghsa-fc5q-39xc-vjpf-evidence/after/axe-context-comparison.json). Los58 conjuntos incompletos de referencia siguen pendientes; no se presentan como infracciones ni aprobaciones manuales. No se han probado lectores de pantalla o teléfonos físicos.

## Rendimiento reproducible

Build de referencia generado desde el worktree anterior cuyo árbol es exactamente el de main208f183; salida separada, sin modificar sus archivos versionados. [Procedencia y hashes](ghsa-fc5q-39xc-vjpf-evidence/after/build-equivalence.json): los50 archivos web son idénticos. Grafo JS inicial estático:474.856 bytes/140.656gzip antes y después; diccionarios, CSS, assets y separación de módulos iguales. No se carga SQLCipher en la web. [Bundles antes](ghsa-fc5q-39xc-vjpf-evidence/after/bundles-before.json) y [después](ghsa-fc5q-39xc-vjpf-evidence/after/bundles-after.json).

Móvil **emulado**390×900,CPU4×,1,6Mbps/80ms,gzip, mismo Chromium y host;3 muestras secuenciales por versión. Valores ms: mediana[min,max]. No son dispositivos físicos, INP real ni mejora estadística demostrada. La carga fría de cliente es idéntica en código; variación de caché/CPU/GC y muestras escasas impiden atribuir pequeñas diferencias al import del servidor.

| Escenario | main | Mitigación |
| --- | --- | --- |
| Landing ES fría | 1591.5 [1567.0, 1709.7] | 1565.6 [1560.7, 1579.4] |
| Aplicación fría | 2849.9 [2812.9, 2930.8] | 2793.6 [2787.4, 2925.9] |
| Aplicación caliente | 928.5 [859.0, 1276.8] | 1246.2 [1205.9, 1251.7] |
| Planificación primera apertura | 1060.4 [634.7, 1078.3] | 709.2 [624.7, 1073.7] |
| Catálogo primera apertura | 998.6 [929.2, 1022.4] | 1061.8 [828.7, 1067.5] |
| Primer cambio a francés | 679.5 [629.1, 710.6] | 668.6 [636.5, 695.3] |
| Abrir 1.000 movimientos | 634.4 [566.3, 640.7] | 613.4 [577.0, 806.0] |
| Abrir 5.000 movimientos | 961.3 [882.6, 1170.0] | 1006.8 [896.4, 1063.9] |
| Filtrar 5.000 movimientos | 507.8 [481.7, 589.9] | 536.4 [525.7, 599.0] |
| Carga y migración de 1.000 | 3035.0 [2909.5, 3050.7] | 2978.6 [2944.6, 3031.2] |
| Leer documento confirmado de 1.000 | 56.8 [48.2, 112.0] | 76.0 [69.7, 94.1] |
| Guardar cuenta | 756.1 [732.6, 779.5] | 743.3 [603.2, 890.9] |
| Guardar movimiento | 764.5 [750.3, 791.2] | 809.9 [720.8, 930.0] |
| Transferencia | 729.6 [708.2, 758.3] | 736.5 [666.9, 750.7] |
| Cambio de tema | 332.7 [303.7, 393.9] | 370.7 [336.4, 537.5] |
| Cambio de periodo | 114.5 [98.0, 114.6] | 106.6 [97.4, 128.3] |
| Asistente primera apertura | 1348.6 [1198.3, 1378.6] | 1355.6 [1132.6, 1549.6] |
| Restauración confirmada | 439.7 [389.2, 462.7] | 504.7 [419.8, 561.1] |

[Comparativa completa](ghsa-fc5q-39xc-vjpf-evidence/after/performance-comparison.json) y JSON originales/perfiles comprimidos en el mismo directorio. Tras la inicialización, los recorridos de consulta exigen cero escrituras financieras; la migración inicial se identifica aparte. cuentas, movimiento, transferencia y restauración sólo mutan tras confirmación explícita y verifican documentos/totales/recuperación. Las listas siguen filtrando y contabilizando todos los registros; sin reducción de filas o pruebas.

Desglose del guardado, medianas ms; preparación incluye despacho UI y puente, barrera es la transacción real, lectura es la verificación posterior, residual combina verificaciones finales y React (no pintura aislada).

| Operación/versión | Preparación | Commit | Verificación | Residual/render | Total |
| --- | --- | --- | --- | --- | --- |
| Guardar cuenta / before | 419.0 | 14.0 | 7.0 | 271.0 | 756.1 |
| Guardar cuenta / after | 470.0 | 17.0 | 13.0 | 199.0 | 743.3 |
| Guardar movimiento / before | 440.0 | 52.0 | 15.0 | 191.0 | 764.5 |
| Guardar movimiento / after | 427.0 | 36.0 | 25.0 | 202.0 | 809.9 |
| Transferencia / before | 408.0 | 15.0 | 3.0 | 251.0 | 729.6 |
| Transferencia / after | 430.0 | 15.0 | 3.0 | 182.0 | 736.5 |

Arranque Express producción sin instrumentación:5 lanzamientos alternados por versión, mismo build/dependencias, caché del SO caliente. Listo incluye polling y primera respuesta HTTP; RSS aproximada /proc.

| Versión | ms mediana[min,max] | RSS mediana KiB |
| --- | --- | --- |
| before | 758.8 [591.4, 1327.1] | 228116 |
| after | 306.7 [299.7, 353.6] | 76532 |

[Datos de arranque](ghsa-fc5q-39xc-vjpf-evidence/after/server-startup.json). No se atribuye esa reducción a rendimiento del cliente. npm ci inicial7.55s con auditoría activa; referencia5,55s tenía configuración heredada diferente y no es una comparación controlada. Build web final1.22s, referencia1,20s; build+sync+Gradle Android45.07s, sin medición actual equivalente del nativo de referencia, no se afirma mejora. Las dependencias y el lock no cambian.

## Auditoría posterior y CI

[Informe completo posterior](ghsa-fc5q-39xc-vjpf-evidence/after/security/audit.json), [omit=dev](ghsa-fc5q-39xc-vjpf-evidence/after/security/audit-production.json) y [códigos de todos los comandos](ghsa-fc5q-39xc-vjpf-evidence/after/security/summary.json): misma alerta, versiones e integridades; no se detecta un advisory diferente ni una dependencia actualizada. Una ejecución con otra caché informó6high al propagar Vite también a Tailwind/Vite. Se conservan ambos JSON y sus códigos; main virtual con package+lock originales y rama con la misma caché explícita informaron5. Esa variación de diagnóstico no demuestra una vulnerabilidad nueva ni remediación; CI registra su recuento real.

El nuevo job **Seguridad npm (resultado real)** ejecuta ls/explain, verifica instalación/lock e informa ambas auditorías. El proceso termina1 ante vulnerabilidades o errores, sin excepciones de CVE/severidad; también rechaza futuros avisos distintos, informes inválidos o procesos fallidos. Mantiene logs/JSON7días y resumen visible incluso en fallo. No usa continue-on-error ni altera severidad.

Los3checks financieros permanecen independientes del cuarto check. El presupuesto Chromium continúa50minutos,46 suites sin recortes/reintentos y puerta SIGKILL obligatoria. **Mientras upstream siga abierto, seguridad y workflow global están fallidos aunque los3checks financieros sean verdes.** [CI del checkpoint de código](https://github.com/dlopezteruel-rgb/Finanzas-pro/actions/runs/44217560433); [registro del SHA final y checks individuales](https://github.com/dlopezteruel-rgb/Finanzas-pro/pull/34). El checkpoint cf460d0 completó los3checks financieros:733 unitarias,56 infraestructura,6servidor y997Chromium/46 suites; navegador CI156.0.8078.4,20/20+2/2+8/8 P0,0 violaciones en1.702 observaciones axe y1.015 grupos incompletos/58 conjuntos. Chromium duró35min46s; seguridad salió1 con5high/0 critical. Se conservan los JSON de esa ejecución bajo after/ci-code-checkpoint y los hashes descargados se verifican contra GitHub. La descripción final de esa PR conserva URLs, duración, SHA y recuentos del SHA final extraídos de los artefactos. No se presenta una ejecución en curso, cancelada o parcial como aprobada.

## Reproducción y acciones pendientes

```bash
npm_config_audit=true npm ci
npm test
node scripts/ci/run-check.mjs tools
npm run lint
npm run build
npm run test:security:server
CHROMIUM_PATH=/ruta/chromium npm run test:durability
CHROMIUM_PATH=/ruta/chromium npm run test:ui
npm run audit:bundles
npm_config_audit=true npm run audit:security # hoy salida1 real; conservar diagnóstico
npm ls picomatch
npm explain picomatch
npm audit --json
npm audit --omit=dev --json
git diff --check
NODE_ENV=production npm start
```

Para SQLCipher y nativos, seguir los requisitos ya documentados de5H: SQLCIPHER_LIBRARY=<lib4.20> npm run test:native:engine; conJDK21/SDK36 npm run native:android:assemble; npm run native:sync:ios. Compilar/ejecutar iOS requiere macOS/Xcode; no constituye un éxito omitido en Linux. El ejecutor code de CI necesita un evento/base reales; un intento local sin GITHUB_EVENT_PATH falló antes del diff y se conserva. Posteriormente el mismo ejecutor pasó con el payload real de PR34 (base208/headcf), incluido diff no vacío y6pruebas de servidor, sin debilitar la comprobación.

Pendientes: parche oficial específico y regresión completa al adoptarlo; riesgo de desarrollo/CI con patrones/configuración no confiables; auditoría npm roja; revisión contextual axe; runtime/Keystore Android y runtime/Keychain iOS; aprobación separada antes de datos reales o distribución. No se cambian protecciones de main, backend móvil, firma, nube o modelos financieros. Esta PR aporta una mitigación verificada y evidencia auditable, sin declarar cerrado el CVE ni autorizar fusión/despliegue.
