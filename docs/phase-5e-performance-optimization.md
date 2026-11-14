# Fase 5E — Rendimiento, carga diferida y estabilidad móvil

Base: `c9d70bf85f20ad983d13f5652b26f7fe91c231a8` (merge PR #28), sin commits posteriores al comenzar. Rama `perf/phase-5e-performance-optimization`, creada con árbol limpio desde origin/main. El checkout base se conserva separado e inmutable. Primera aplicación medida: `65b6a82`. La corrección posterior de identidad React.lazy se está remidiendo: los números/PNG actuales conservan su fuente65b6a82 hasta sustituir los informes por el código corregido.

La fase reduce el JS inicial de la landing española de **321.042 a 137.121 bytes gzip (−57,29%)** y el de la aplicación con 100 movimientos de **454.961 a 245.353 (−46,07%)**. La mediana móvil de entrada baja **3.775,11→2.339,97 ms**. Se conservan también todos los costes desfavorables: Catálogo en primera visita **400,10→993,89 ms**, primer francés **587,87→746,49 ms** y recarga con caché **734,56→766,32 ms**. No son resultados de un teléfono físico ni garantías de rendimiento en campo.

**Estado de cierre:** validación integral local y CI del checkpoint en curso. Los resultados focalizados son 599 unitarias, 22 de infraestructura, 57 originales de operaciones, 15 de presupuestos y 9 de auditoría general (128 superficies), además de las suites nuevas. No se declara todavía aprobada la batería completa de 41 suites. Esta sección se actualizará con los informes completos antes de la entrega.

## Arquitectura y versiones

El estado anterior cargaba estáticamente los cinco diccionarios en messages.ts. Root ya difería App y ChartSlot ya difería FinancialCharts. App importaba las pantallas secundarias; ambos paneles de presupuestos se montaban antes de usarlos. isLanguageAvailable repetía la validación completa durante lecturas/renderizados.

Entorno real: Node 24.22.1, Vite **8.3.7**, React/React DOM **19.3.1**, TypeScript 7.0.2, playwright-core 1.64.1, axe-core 4.14.0 y Chromium local 156.0.8078.79/Debian 13. npm ci instala 188 paquetes; se conserva lockfile, dependencias, workflow, APP_BASE_PATH y DISABLE_HMR. [Versiones](phase-5e-environment.json). Los resultados de GitHub se registran por separado.

## Inventario real de bundles y dependencias

Las medidas proceden de Vite8/Rolldown en producción; gzip zlib nivel6 aplicado igual a ambas versiones. Puede diferir del estimador histórico de Vite. renderedLength de módulos es anterior a la minificación final y no permite asignar una cuota gzip exacta a cada librería. [Base](phase-5e-baseline-bundles.json) y [resultado completo](phase-5e-bundle-results.json).

| Recurso/grafo | Antes minificado/gzip (bytes) | Después minificado/gzip (bytes) |
| --- | ---: | ---: |
| Grafo estático inicial completo | 1.181.075 / 321.042 | 465.583 / 137.121 |
| App | 532.661 / 133.919 | 251.117 / 68.356 |
| Total todos los idiomas y funciones | 1.754.515 / 467.528 | 1.770.116 / 491.655 |

Hay **29 chunks** frente a3: el total gzip de todas las funciones/idiomas crece aproximadamente5,16% por la separación y menor compresión conjunta; solo se descargan según uso. No se oculta ese coste. El inventario detecta **cero módulos con renderedLength positivo duplicados**. React DOM y el español siguen en la entrada; los cuatro diccionarios extranjeros quedan fuera del grafo inicial. D3/gráficos permanecen bajo demanda. El SDK/backend del asistente no se añade al cliente inicial. Los chunks compartidos (incluido i18n) se suman, evitando presentar solo index como tamaño total. No se cambia el umbral Vite de500kB; desaparece el aviso por la división real, no como criterio de aceptación.

## Método reproducible de navegador

Builds reales de producción servidos con gzip por un servidor de pruebas idéntico en ambos casos. Contexto aislado para cargas frías; recarga dentro del mismo contexto para caché. Sin routing Playwright en estas medidas (deshabilitaría caché HTTP). CDP bloquea servicios externos y controla CPU/red. No hubo otras baterías de navegador concurrentes durante las comparaciones. Tres muestras por escenario y perfil; se publica mediana y rango completo, sin umbrales temporales de CI. Los recorridos exploratorios anteriores con concurrencia no se usan para aceptar mejoras.

| Perfil | Viewport | CPU emulada | Latencia/red |
| --- | --- | --- | --- |
| Móvil | 390×900 | 4× | 80ms /1,6Mbps |
| Tablet | 768×900 | 2× | 40ms /5Mbps |
| Escritorio | 1280×900 | 1× | 20ms /10Mbps |

Se registran FCP, último LCP disponible, CLS sin interacción reciente, long tasks, ScriptDuration/TaskDuration CDP, solicitudes, transferSize/encodedBodySize/decodedBodySize y heap aproximado. LCP es la última observación al tomar la muestra, no el valor final de una sesión de campo. La latencia incluye automatización y dos frames; no equivale a INP. ScriptDuration es ejecución acumulada; no se mide por separado compilación V8 ni bytes exactos ejecutados. decodedBodySize es código recibido descomprimido. El heap no incluye toda la memoria del navegador y depende de GC; no se fuerza una colección ni se certifica ausencia de fugas o una sesión prolongada.

Los16 escenarios producen144 observaciones por build. Incluyen landing es/en, entrada nueva/vacía, apertura/recarga con preferencia, gráficos, planificación, catálogo, listado100/1.000/5.000, búsqueda y cambios de idioma. Se comparan hashes exactos del almacenamiento ficticio; todas esas acciones tienen cero escrituras. [Antes](phase-5e-performance-before.json), [después](phase-5e-performance-after.json) y [comparación de todos los perfiles/métricas](phase-5e-performance-comparison.json).

### Entrada a la aplicación: móvil,100 registros, n=3

Cada celda contiene mediana [mín–máx].

| Métrica | Antes | Después | Variación mediana |
| --- | ---: | ---: | ---: |
| JS gzip recibido (bytes de cuerpo) | 454.961,00 [454.961,00–454.961,00] | 245.353,00 [245.353,00–245.353,00] | -46,07% |
| JS transferido con cabeceras (bytes) | 455.561,00 [455.561,00–455.561,00] | 249.253,00 [249.253,00–249.253,00] | -45,29% |
| JS recibido descomprimido (bytes) | 1.713.736,00 [1.713.736,00–1.713.736,00] | 846.596,00 [846.596,00–846.596,00] | -50,60% |
| Ejecución acumulada JS/CDP (ms) | 460,34 [427,34–511,18] | 386,46 [378,21–417,29] | -16,05% |
| FCP (ms) | 2.300,00 [2.268,00–2.400,00] | 1.336,00 [1.328,00–1.364,00] | -41,91% |
| Último LCP observado (ms) | 3.432,00 [3.396,00–3.476,00] | 2.256,00 [2.244,00–2.276,00] | -34,27% |
| CLS observado | 0,00 [0,00–0,00] | 0,00 [0,00–0,00] | — |
| Heap JS aproximado (bytes) | 5.833.324,00 [5.833.308,00–5.927.188,00] | 4.963.924,00 [4.940.280,00–4.973.308,00] | -14,90% |
| Solicitudes de recursos | 6,00 [6,00–6,00] | 17,00 [17,00–17,00] | 183,33% |

### Latencias de todos los escenarios principales

| Perfil/escenario | Antes, ms [mín–máx] | Después, ms [mín–máx] | Variación |
| --- | ---: | ---: | ---: |
| mobile/landing-es-cold | 2.635,59 [2.528,14–2.791,88] | 1.564,26 [1.550,69–1.654,86] | -40,65% |
| mobile/landing-en-cold | 2.547,27 [2.540,28–2.557,74] | 2.507,10 [2.286,68–2.514,63] | -1,58% |
| mobile/application-empty-cold | 3.713,91 [3.703,46–3.714,95] | 2.437,05 [2.372,71–2.714,90] | -34,38% |
| mobile/application-cold | 3.775,11 [3.733,54–3.845,73] | 2.339,97 [2.306,07–2.406,49] | -38,02% |
| mobile/application-warm | 734,55 [702,08–735,30] | 766,29 [750,46–930,88] | 4,32% |
| mobile/chart-first-open | 625,69 [581,99–658,48] | 599,62 [563,01–897,41] | -4,17% |
| mobile/planning-first-open | 682,71 [674,53–880,01] | 609,59 [575,80–722,37] | -10,71% |
| mobile/catalog-first-open | 400,11 [367,48–534,80] | 993,88 [682,31–1.342,85] | 148,40% |
| mobile/ledger-100-first-open | 899,83 [869,44–1.035,28] | 693,58 [679,66–873,62] | -22,92% |
| mobile/ledger-100-filter | 233,60 [230,87–253,90] | 212,85 [185,94–218,17] | -8,88% |
| mobile/language-first-fr | 587,89 [569,33–655,61] | 746,53 [738,94–850,53] | 26,99% |
| mobile/language-cached-es | 279,86 [265,73–369,57] | 177,76 [156,07–211,96] | -36,48% |
| mobile/ledger-1000-first-open | 7.397,59 [7.258,32–8.060,72] | 5.526,32 [5.071,12–5.969,88] | -25,30% |
| mobile/ledger-1000-filter | 693,01 [679,63–729,84] | 710,49 [653,31–858,75] | 2,52% |
| mobile/ledger-5000-first-open | 38.255,61 [35.698,36–38.632,33] | 27.691,39 [27.442,98–27.829,88] | -27,61% |
| mobile/ledger-5000-filter | 3.575,98 [3.418,88–3.738,59] | 3.049,05 [3.015,59–3.287,00] | -14,74% |
| tablet/landing-es-cold | 1.075,82 [1.033,75–1.212,68] | 660,37 [639,49–687,93] | -38,62% |
| tablet/landing-en-cold | 1.005,46 [1.004,26–1.010,81] | 792,94 [733,69–802,99] | -21,14% |
| tablet/application-empty-cold | 1.801,24 [1.712,02–1.855,96] | 998,25 [979,03–1.012,90] | -44,58% |
| tablet/application-cold | 1.846,36 [1.820,35–1.939,54] | 1.026,52 [955,30–1.487,99] | -44,40% |
| tablet/application-warm | 562,17 [550,28–601,04] | 566,37 [532,42–592,96] | 0,75% |
| tablet/chart-first-open | 882,83 [867,95–901,09] | 850,43 [448,35–999,17] | -3,67% |
| tablet/planning-first-open | 380,89 [363,65–469,68] | 507,42 [466,29–609,70] | 33,22% |
| tablet/catalog-first-open | 243,64 [234,41–248,81] | 573,68 [561,80–919,67] | 135,46% |
| tablet/ledger-100-first-open | 434,79 [349,62–553,13] | 329,90 [297,86–334,50] | -24,12% |
| tablet/ledger-100-filter | 117,59 [116,87–130,61] | 118,01 [117,37–132,21] | 0,36% |
| tablet/language-first-fr | 267,97 [266,18–284,90] | 299,52 [299,28–315,09] | 11,77% |
| tablet/language-cached-es | 149,78 [147,15–164,62] | 82,88 [82,27–99,78] | -44,67% |
| tablet/ledger-1000-first-open | 2.764,77 [2.684,09–3.103,48] | 2.235,06 [2.026,40–2.388,52] | -19,16% |
| tablet/ledger-1000-filter | 385,70 [344,58–487,36] | 373,08 [339,33–425,38] | -3,27% |
| tablet/ledger-5000-first-open | 16.703,91 [16.106,69–16.929,04] | 11.563,31 [11.490,31–12.455,69] | -30,77% |
| tablet/ledger-5000-filter | 1.785,97 [1.657,43–2.157,86] | 1.802,68 [1.598,59–1.910,85] | 0,94% |
| desktop/landing-es-cold | 552,03 [541,31–568,86] | 403,93 [363,64–421,92] | -26,83% |
| desktop/landing-en-cold | 591,98 [579,81–618,71] | 448,46 [435,91–489,58] | -24,24% |
| desktop/application-empty-cold | 838,44 [799,59–1.277,04] | 731,20 [729,89–737,37] | -12,79% |
| desktop/application-cold | 1.020,62 [881,85–1.331,73] | 708,45 [699,91–709,53] | -30,59% |
| desktop/application-warm | 434,38 [423,50–477,87] | 416,29 [415,93–448,12] | -4,16% |
| desktop/chart-first-open | 849,26 [832,86–883,99] | 850,21 [848,77–865,71] | 0,11% |
| desktop/planning-first-open | 228,76 [163,40–349,05] | 847,82 [832,15–904,47] | 270,62% |
| desktop/catalog-first-open | 133,68 [115,98–238,03] | 850,44 [833,28–881,25] | 536,19% |
| desktop/ledger-100-first-open | 166,53 [166,50–184,53] | 168,89 [166,32–197,68] | 1,42% |
| desktop/ledger-100-filter | 83,85 [82,53–84,63] | 89,45 [83,57–136,64] | 6,67% |
| desktop/language-first-fr | 165,94 [165,92–166,60] | 182,85 [163,14–241,86] | 10,19% |
| desktop/language-cached-es | 84,71 [82,23–84,74] | 54,32 [51,81–66,99] | -35,87% |
| desktop/ledger-1000-first-open | 1.227,37 [1.214,11–1.263,30] | 880,32 [799,91–936,91] | -28,28% |
| desktop/ledger-1000-filter | 181,64 [180,95–224,52] | 211,16 [179,70–297,86] | 16,25% |
| desktop/ledger-5000-first-open | 6.168,78 [6.111,13–6.468,98] | 4.513,60 [4.414,64–4.634,21] | -26,83% |
| desktop/ledger-5000-filter | 903,56 [786,52–909,57] | 805,90 [734,76–836,43] | -10,81% |

La entrada genera más solicitudes pequeñas (6→17 recursos en el escenario móvil App), pero menos bytes/ejecución y una entrada más rápida en estas condiciones. La primera visita a módulos y primera descarga de idioma pagan red adicional; no se atribuyen mejoras a la caché. Las pequeñas variaciones con rangos superpuestos no se consideran por sí solas regresiones confirmadas. Los costes fríos mayores quedan explícitos para revisión. No se incorpora precarga especulativa sin una medida posterior que justifique su intercambio de bytes/latencia.

## Carga diferida de idiomas y contratos

Se reutilizan I18nProvider/useI18n, messages.ts, es.ts, preference.ts, Intl y el registro/readiness. Español queda como referencia inmediata; en/it/fr/pt usan imports dinámicos explícitos. Una caché de promesas deduplica solicitudes y publica únicamente diccionarios completos validados e inmutables. Los fallos se retiran para permitir reintento. Se mantienen los validadores de claves, duplicados de fuente, parámetros y plurales. La disponibilidad revisada es independiente de estar cargado. Validación de objetos congelados se memoriza por identidad; objetos mutables inyectados en pruebas se vuelven a validar.

**setLanguage conserva booleano**: true significa selección válida aceptada; no significa descarga terminada. Se auditaron sus consumidores (el selector no esperaba promesas). Durante la espera se conservan contenido, formato, lang y metadatos previos y se anuncia carga en ese idioma. Al terminar se aplican juntos antes de pintar; una generación de solicitud descarta respuestas/errores antiguos. En arranque extranjero se muestra un estado español coherente y no se monta App hasta disponer del diccionario. Un fallo conserva idioma/preferencia y ofrece reintento. La cuota mantiene el cambio en memoria con el aviso original; la sincronización storage nunca escribe en respuesta. finanzas.ui.language conserva su clave y formato.

activeLanguage resuelve solicitudes válidas; useI18n.language representa el idioma mostrado. translatorFor exige un diccionario cargado para no mezclar idiomas silenciosamente. Los helpers t/tn/I18nText/pluralText y parámetros tipados se conservan. En Node/SSR se preparan los diccionarios para los traductores síncronos/SSR existentes; Vite elimina esa rama del navegador. No existe segundo sistema i18n.

Los cinco idiomas siguen habilitados. Las nuevas frases de carga/error y tema tienen traducciones nativas; Gráficos en pt-PT comparte ortografía con español y se documenta por clave como homógrafo, sin exención general de residuales. No se traduce ningún nombre personal ni histórico. EUR, ISO y Europe/Madrid permanecen invariantes. El reconocimiento libre del asistente sigue siendo el español previo: no se amplían parser, prompts ni API.

Sin conexión, los diccionarios ya cargados en memoria funcionan en ese documento. Uno ausente falla sin sustituir el contenido y puede reintentarse al recuperar red. No hay service worker ni nuevo modo offline; una navegación/recarga necesita los recursos del servidor/caché del navegador. Las pruebas no certifican disponibilidad offline permanente.

## División de módulos y estado

App difiere nueve pantallas secundarias: planificación, gestor/ejecución de catálogo, préstamos, contactos, asistente, tesorería, deudas y cuentas. Inicio, Movimientos y formularios bancarios críticos permanecen inmediatos. Se usa división estándar de Vite8/Rolldown, sin manualChunks heredado ni ajustes de HMR/base. Un límite local con estado accesible, error y reintento mantiene el shell. Se comparten módulos/promesas, nunca instancias de stores/proveedores.

Catálogo se solicita en su primera visita y después permanece montado al alternar con Planificación: borradores, selección, foco y scroll se conservan. La protección de cambios de periodo/módulo sigue siendo la original. Navegar durante una descarga no aplica efectos al módulo abandonado. Reintentar enfoca el selector/panel/main persistente, sin dejar el foco en un botón desmontado.

## Perfiles y optimizaciones localizadas

Un perfil V8 del listado de1.000 registros identifica la construcción repetida de Intl.DateTimeFormat en presentationDate. Se conserva un [perfil antes](phase-5e-before-mobile-1000.cpuprofile) y [después](phase-5e-after-mobile-1000.cpuprofile), además del procedimiento reproducible. Se cachean hasta64 instancias, con locale y todas las opciones en la clave. No se cachean fechas/valores financieros. Los inputs/opciones mutables se vuelven a leer y las excepciones/Madrid/fechas antiguas se conservan.

Los totales visibles sustituyen filtered.some repetido por Set de identidades y una única proyección economicTransactions. Se mantienen filtros, orden de reducción y suma IEEE: transferencias/reintegros/parte propia/pendientes conservan la semántica original. Cuatro pruebas comparan literalmente contra el algoritmo anterior, incluidas1.000/5.000 filas y cantidades0,1/0,2. No se introduce memoización masiva ni virtualización.

Microbenchmark Node: para5.000, mediana de fechas296,01→22,39ms y pertenencia96,48→1,03ms; tres muestras tras calentamiento excluido. [Datos](phase-5e-hotspots.json). Son costes de helpers, no latencia React/INP.

Los [perfiles React](phase-5e-react-profile.json) usan builds temporales con el renderer existente react-dom/profiling y React.Profiler en Root/listado. El frontend de producción, fuentes, configuración y dependencias no se instrumentan. Tres muestras por390/CPU4× y1280/CPU1×,1.000 registros. Los tiempos incluyen coste de profiling en ambas revisiones y se separan de las medidas normales de producción.

| React/listado | Antes actualDuration (ms) | Después (ms) |
| --- | ---: | ---: |
| 390/mount | 1.713,40 | 738,30 |
| 390/filter | 100,50 | 36,30 |
| 1280/mount | 386,50 | 143,50 |
| 1280/filter | 24,10 | 12,40 |

Cada recorrido conserva los bytes financieros y las filas esperadas. No se atribuye al render React todo el coste de DOM/estilos/GC: los tiempos de interacción de producción siguen siendo mayores.

## Volumen y recorridos móviles

Fixtures validados por el parser real:100/1.000/5.000 movimientos, catálogo de sistema más familia/partida personal y subítem, presupuestos de2025–2027, aprobación, regla de planificación, contactos, gasto compartido/reintegros/compensación y transferencia. No se elevan límites de dominio o tamaño. La lista mantiene todos los registros y su orden, búsqueda, foco y navegación; no se pagina/trunca para maquillar tiempos.5.000 en móvil4× sigue siendo lento (27,69s de mediana al abrir;3,05s al filtrar).

Otros72 recorridos por revisión miden mes, formularios/importe, reparto, asistente/propuesta, importación y restauración. [Antes](phase-5e-journeys-before.json), [después](phase-5e-journeys-after.json) y [comparación](phase-5e-journeys-comparison.json). Solo la confirmación explícita de restauración permite escribir; se verifica copia recuperable y equivalencia de todos los campos importados, preservando la revisión aleatoria original. Sin llamadas API ni errores de página.

| Móvil/acción | Antes, ms [mín–máx] | Después, ms [mín–máx] |
| --- | ---: | ---: |
| mobile/month-previous | 232,53 [214,99–272,00] | 204,42 [191,53–225,28] |
| mobile/movement-form-open | 235,86 [223,90–316,30] | 248,94 [217,49–257,92] |
| mobile/movement-amount-input | 81,26 [68,12–112,05] | 84,31 [79,78–95,56] |
| mobile/shared-expense-open | 713,70 [693,04–811,24] | 654,33 [518,32–654,55] |
| mobile/assistant-first-open | 1.032,81 [999,95–1.033,38] | 1.273,72 [1.235,40–1.329,75] |
| mobile/assistant-proposal | 176,15 [175,79–202,01] | 212,90 [175,12–216,43] |
| mobile/import-validate-preview | 178,56 [174,45–178,74] | 223,78 [210,49–234,52] |
| mobile/restore-verified-confirmation | 222,56 [185,15–241,67] | 219,96 [187,03–221,75] |

## Superficies y protección financiera

La regresión conserva las37 suites originales y sus747 resultados; añade4 suites/37 resultados: idiomas15, módulos/gráficos8, volumen4 y tema10. Se verifican Inicio/resumen, movimientos, cuentas/saldos, transferencias, préstamos/deudas, contactos/compartidos/reintegros, planificación/aprobaciones/multiperiodo/subítems, catálogo/arrastre/archivo/reglas, automatizaciones, tesorería/calendario, asistente/registro rápido y almacenamiento/importación/exportación/restauración. La matriz visual original recorre cinco idiomas,390/768/1280 y ambos temas; la auditoría general añade1920.

[46 archivos protegidos](phase-5e-protected-files.json) permanecen byte a byte respecto a la base: FinanceStore, Web Locks/revisiones, escritura atómica/recuperación, cálculos, modelos, validadores, calendarios, parsers, API/prompts, identificadores/catalogNames, JSON2.5–3.5, lockfile, servidor, configuración Vite y workflow. No hay migración ni nueva representación financiera. Cambiar idioma, navegar, diferir, consultar gráficos/planificación o filtrar no escribe los datos financieros.

**Tema visual:** el botón anterior reserializaba FinanceStore. Para cumplir el invariante solicitado se guarda la preferencia exclusivamente en finanzas.ui.theme (dark/light), independiente como el idioma. El campo theme de JSON antiguo permanece intacto como fallback; abrirlo no escribe ni migra preferencias. Una selección visual explícita tiene prioridad, incluso tras restaurar datos financieros, y no se exporta dentro de sus copias. Sin preferencia se respeta el tema del archivo restaurado. Cuota/acceso denegados conservan el cambio en memoria con aviso nativo; storage sincroniza sin bucles. No se modifica FinanceStore ni su campo theme.

## Incidencias reproducidas y correcciones

| ID | Problema/evidencia | Corrección/estado |
| --- | --- | --- |
| 5E-01 | Entrada incluye cuatro idiomas no utilizados y validación repetida | Imports diferidos, caché validada; mejoras reales medidas |
| 5E-02 | Listado crea un Intl por fecha y usa pertenencia cuadrática | Caché acotada/índice; pruebas de equivalencia y perfiles |
| 5E-03 | Fallo del chunk de gráficos desmonta formulario bancario pendiente | Límite local; input original conectado y concepto conservado, reintento real |
| 5E-04 | Tema cambia revisión/JSON financiero | Preferencia visual aislada; prueba roja en los cinco idiomas y10 resultados verdes posteriores |
| 5E-05 | transition-all cruza estados de contraste4,32:1/4,23:1 al cambiar tema | Aplicación atómica de colores durante dos frames; axe estricto pasa sin esperar/ignorar reglas |
| 5E-06 | Reintento desmonta el botón enfocado | Foco en selector/panel/main persistente, probado |
| 5E-07 | Pruebas de conflicto usaban tema como escritura financiera | Disparador cambia a cuenta ficticia de saldo cero por la UI/Store reales; conserva todas las aserciones y añade rechazo/campos |
| 5E-08 | budgetUx cuenta paneles antes del editor diferido; axe puede observar placeholder | Espera por contenido real; misma aserción de dos paneles, mismos casos y reglas |
| Pendientes de rendimiento | Primer Catálogo/francés más lentos y5.000 filas aún costosas | Costes publicados; optimizaciones futuras requieren nueva medición y accesibilidad |

## Accesibilidad y límites

Se mantienen todas las reglas axe; los nuevos estados de carga/error y cambios de tema también se auditan. Tab/Shift+Tab/Escape, foco, labels, lang, metadata, borradores y desbordamiento tienen comprobaciones automatizadas. Se espera el módulo real antes de la auditoría general, sin considerar aprobado un estado de carga. Los informes definitivos local/CI se incorporarán al cerrar la batería.

Los **944 grupos incompletos/51 conjuntos equivalentes de5D** siguen pendientes de revisión contextual. No son944 defectos distintos ni una revisión manual aprobada. Se conservarán separados los nuevos resultados locales y de GitHub, con causas/ejemplos/referencias. No se han usado lectores de pantalla ni dispositivos físicos. Tampoco se certifica contraste manual de todos los estados, una sesión larga o ausencia total de fugas.

## Capturas de la aplicación real

[Manifiesto de12 PNG](phase-5e-capture-manifest.json): antes/después de Inicio y Planificación a390/768/1280, datos ficticios idénticos y hash financiero por pareja. Proceden del build medido; no hay generación/edición de imágenes ni datos de Google AI Studio. Los cambios posteriores son de pruebas/documentación: las capturas se regenerarán contra el código corregido antes de la entrega.

| Superficie | Antes | Después |
| --- | --- | --- |
| mobile/application-cold | [PNG](phase-5e-screenshots/before-mobile-application-cold.png) | [PNG](phase-5e-screenshots/after-mobile-application-cold.png) |
| mobile/planning-first-open | [PNG](phase-5e-screenshots/before-mobile-planning-first-open.png) | [PNG](phase-5e-screenshots/after-mobile-planning-first-open.png) |
| tablet/application-cold | [PNG](phase-5e-screenshots/before-tablet-application-cold.png) | [PNG](phase-5e-screenshots/after-tablet-application-cold.png) |
| tablet/planning-first-open | [PNG](phase-5e-screenshots/before-tablet-planning-first-open.png) | [PNG](phase-5e-screenshots/after-tablet-planning-first-open.png) |
| desktop/application-cold | [PNG](phase-5e-screenshots/before-desktop-application-cold.png) | [PNG](phase-5e-screenshots/after-desktop-application-cold.png) |
| desktop/planning-first-open | [PNG](phase-5e-screenshots/before-desktop-planning-first-open.png) | [PNG](phase-5e-screenshots/after-desktop-planning-first-open.png) |

## Reproducción

```bash
npm ci
npm test
npm run lint
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:ui
git diff --check

# Worktree separado; no modificar ni limpiar el checkout que contiene trabajo pendiente.
git worktree add --detach ../Finanzas-pro-5e-base c9d70bf85f20ad983d13f5652b26f7fe91c231a8
(cd ../Finanzas-pro-5e-base && npm ci && npm run build)
# Ejecutar antes/después secuencialmente, sin otras pruebas de navegador.
PERF_DIST=../Finanzas-pro-5e-base/dist PERF_OUTPUT=/tmp/before.json CHROMIUM_PATH=/usr/bin/chromium npm run measure:performance
PERF_DIST=dist PERF_OUTPUT=/tmp/after.json CHROMIUM_PATH=/usr/bin/chromium npm run measure:performance
node scripts/performance/compare.mjs /tmp/before.json /tmp/after.json /tmp/comparison.json
# Repetir ambos PERF_DIST con npm run measure:journeys y comparar:
node scripts/performance/compareJourneys.mjs /tmp/journeys-before.json /tmp/journeys-after.json /tmp/journeys-comparison.json
PERF_BASE_SOURCE=../Finanzas-pro-5e-base CHROMIUM_PATH=/usr/bin/chromium node --import tsx scripts/performance/reactProfile.ts
PERF_BASE_SOURCE=../Finanzas-pro-5e-base node --import tsx scripts/performance/hotspots.ts
npm run audit:bundles
```

Los valores PERF_SAMPLES/PERF_PROFILE permiten exploración; la comparación publicada usa3 muestras y los tres perfiles completos. Los temporales profiling se borran solo tras cerrar sus contextos, nunca el repositorio/datos originales. El límite exploratorio de5.000 se fija en120s tras observar una acción base mayor de30s; ningún timeout de regresión/CI se amplía. El gate obligatorio de rendimiento es determinista (gzip inicial≤ceil(0,8×321.042)), junto con la ausencia de idiomas/chunks anticipados; no se añaden umbrales temporales inestables.

## Checkpoints, CI y entrega

- f5a6d3f: inventario y herramientas de línea base.
- 83523f5: idiomas diferidos, carreras/reintentos,587 unitarias y15 resultados nuevos.
- 5f81e2d: módulos diferidos,6 resultados iniciales de módulos.
- 12c41b3: formatos/índice y volumen,596 unitarias y4 resultados de volumen.
- 65b6a82: gráficos/formularios, tema y contraste;599 unitarias, módulos7 y tema10.
- d66d4a4: disparadores financieros reales y recorridos móviles.
- 585e996: readiness explícito y perfiles React.

Base reejecutada:585 unitarias,22 infraestructura,747 Chromium/37 suites, lint/build correctos; [resumen verificable](phase-5e-baseline-validation.json). Los intentos parciales/fallidos se documentarán separados de la ejecución final. La [CI43650839122](https://github.com/dlopezteruel-rgb/Finanzas-pro/actions/runs/43650839122) en d66d4a4 falló en Chromium por5E-08; unitarias y código fueron verdes. La CI corregida en585e996 y la batería local están en curso: no se presentan todavía como aprobadas. No se modifican workflows, permisos, protecciones o límites para aprobar.

## Recomendaciones posteriores

1. Medir precarga por intención para Catálogo/asistente/idiomas frecuentes, publicando su coste adicional y efecto en primera visita.
2. Estudiar una lista de volumen accesible (búsqueda, teclado, lectura/impresión, foco y totales completos) antes de virtualizar/paginar;5.000 sigue siendo lento en CPU4×.
3. Evaluar aislar el formateador legado en un módulo hoja para evitar dependencias de dominio en la landing, con equivalencia exacta y sin cambiar modelos.
4. Ampliar muestras/dispositivos físicos y sesiones largas para INP/memoria real. Revisar manualmente grupos axe equivalentes con su contexto, sin descartarlos ni tratarlos como violaciones.

Sin fusión, despliegue, sincronización de Google AI Studio, cambios de main/protecciones, nuevas dependencias o datos personales.

## Corrección de la identidad cacheada de módulos

La siguiente regresión completa detectó una suspensión repetida al cambiar el mes: se compartía la promesa de importación, pero cada montaje creaba una identidad React.lazy nueva. El editor anterior podía permanecer visible hasta resolver la nueva identidad y una selección inmediata de Multiperiodo se perdía al reemplazarlo. Se comparte también la identidad ya cumplida por funcionalidad, manteniendo un intento nuevo al reintentar un fallo. No se duplica ni modifica ningún Store, proveedor o modelo. Se conserva el cambio de key por mes y su reseteo financiero original; se evita únicamente una suspensión innecesaria.

Automatizaciones vuelve a15/15 y módulos/gráficos a8/8 con un caso específico: cambiar el mes y seleccionar inmediatamente Multiperiodo conserva el área, no vuelve a pedir el módulo y no escribe finanzas. La batería final tendrá784 resultados en41 suites, sin eliminar los747 anteriores. Se repiten los informes después de esta corrección; el intento rojo sigue registrado.
