# Fase 5E — Rendimiento, carga diferida y estabilidad móvil

Base: `c9d70bf85f20ad983d13f5652b26f7fe91c231a8` (merge PR #28), sin commits posteriores al comenzar. Rama `perf/phase-5e-performance-optimization`, creada con árbol limpio desde origin/main. El checkout base se conserva separado e inmutable. Código de aplicación medido: `d9ccb7d7e0a7a6e95362217c252d9d9b58460320`.

La fase reduce el JS inicial de la landing española de **321.042 a 137.119 bytes gzip (-57,29%)** y el de la aplicación con100 movimientos de **454.961 a 245.354 (-46,07%)**. La mediana móvil de entrada baja **3.775,11→2.752,34 ms**. Se conservan los costes: primer Catálogo **400,11→892,09 ms**, primer francés **587,89→661,01 ms** y recarga con caché **734,55→785,46 ms**. No son resultados de un teléfono físico ni garantías de rendimiento en campo.

**Estado de cierre:** validación integral local y CI del checkpoint en curso. Los resultados focalizados son 599 unitarias, 22 de infraestructura, 57 originales de operaciones, 15 de presupuestos y 9 de auditoría general (128 superficies), además de las suites nuevas. No se declara todavía aprobada la batería completa de 41 suites. Esta sección se actualizará con los informes completos antes de la entrega.

## Arquitectura y versiones

El estado anterior cargaba estáticamente los cinco diccionarios en messages.ts. Root ya difería App y ChartSlot ya difería FinancialCharts. App importaba las pantallas secundarias; ambos paneles de presupuestos se montaban antes de usarlos. isLanguageAvailable repetía la validación completa durante lecturas/renderizados.

Entorno real: Node 24.22.1, Vite **8.3.7**, React/React DOM **19.3.1**, TypeScript 7.0.2, playwright-core 1.64.1, axe-core 4.14.0 y Chromium local 156.0.8078.79/Debian 13. npm ci instala 188 paquetes; se conserva lockfile, dependencias, workflow, APP_BASE_PATH y DISABLE_HMR. [Versiones](phase-5e-environment.json). Los resultados de GitHub se registran por separado.

## Inventario real de bundles y dependencias

Las medidas proceden de Vite8/Rolldown en producción; gzip zlib nivel6 aplicado igual a ambas versiones. Puede diferir del estimador histórico de Vite. renderedLength de módulos es anterior a la minificación final y no permite asignar una cuota gzip exacta a cada librería. [Base](phase-5e-baseline-bundles.json) y [resultado completo](phase-5e-bundle-results.json).

| Recurso/grafo | Antes minificado/gzip (bytes) | Después minificado/gzip (bytes) |
| --- | ---: | ---: |
| Grafo estático inicial completo | 1.181.075 / 321.042 | 465.583 / 137.119 |
| App | 532.661 / 133.919 | 251.125 / 68.356 |
| Total todos los idiomas y funciones | 1.754.515 /467.528 | 1.770.124 /491.663 |

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
| JS gzip recibido (bytes de cuerpo) | 454.961,00 [454.961,00–454.961,00] | 245.354,00 [245.354,00–245.354,00] | -46,07% |
| JS transferido con cabeceras (bytes) | 455.561,00 [455.561,00–455.561,00] | 249.254,00 [249.254,00–249.254,00] | -45,29% |
| JS recibido descomprimido (bytes) | 1.713.736,00 [1.713.736,00–1.713.736,00] | 846.604,00 [846.604,00–846.604,00] | -50,60% |
| Ejecución acumulada JS/CDP (ms) | 460,34 [427,34–511,18] | 436,44 [434,59–477,33] | -5,19% |
| FCP (ms) | 2.300,00 [2.268,00–2.400,00] | 1.360,00 [1.332,00–1.500,00] | -40,87% |
| Último LCP observado (ms) | 3.432,00 [3.396,00–3.476,00] | 2.380,00 [2.360,00–2.428,00] | -30,65% |
| CLS observado | 0,00 [0,00–0,00] | 0,00 [0,00–0,00] | — |
| Heap JS aproximado (bytes) | 5.833.324,00 [5.833.308,00–5.927.188,00] | 4.949.608,00 [4.934.684,00–4.981.536,00] | -15,15% |
| Solicitudes de recursos | 6,00 [6,00–6,00] | 17,00 [17,00–17,00] | 183,33% |

### Latencias de todos los escenarios principales

| Perfil/escenario | Antes, ms [mín–máx] | Después, ms [mín–máx] | Variación |
| --- | ---: | ---: | ---: |
| mobile/landing-es-cold | 2.635,59 [2.528,14–2.791,88] | 1.665,76 [1.565,38–1.681,53] | -36,80% |
| mobile/landing-en-cold | 2.547,27 [2.540,28–2.557,74] | 2.217,85 [2.176,22–2.334,06] | -12,93% |
| mobile/application-empty-cold | 3.713,91 [3.703,46–3.714,95] | 2.496,78 [2.364,14–2.746,43] | -32,77% |
| mobile/application-cold | 3.775,11 [3.733,54–3.845,73] | 2.752,34 [2.538,28–2.769,87] | -27,09% |
| mobile/application-warm | 734,55 [702,08–735,30] | 785,46 [744,96–816,74] | 6,93% |
| mobile/chart-first-open | 625,69 [581,99–658,48] | 641,58 [516,84–691,11] | 2,54% |
| mobile/planning-first-open | 682,71 [674,53–880,01] | 758,53 [627,55–1.043,20] | 11,10% |
| mobile/catalog-first-open | 400,11 [367,48–534,80] | 892,09 [730,49–1.021,64] | 122,96% |
| mobile/ledger-100-first-open | 899,83 [869,44–1.035,28] | 728,21 [686,04–847,56] | -19,07% |
| mobile/ledger-100-filter | 233,60 [230,87–253,90] | 205,72 [201,93–241,21] | -11,94% |
| mobile/language-first-fr | 587,89 [569,33–655,61] | 661,01 [615,21–691,99] | 12,44% |
| mobile/language-cached-es | 279,86 [265,73–369,57] | 164,62 [148,30–173,30] | -41,18% |
| mobile/ledger-1000-first-open | 7.397,59 [7.258,32–8.060,72] | 5.528,11 [5.166,94–5.988,83] | -25,27% |
| mobile/ledger-1000-filter | 693,01 [679,63–729,84] | 705,67 [684,10–788,36] | 1,83% |
| mobile/ledger-5000-first-open | 38.255,61 [35.698,36–38.632,33] | 27.228,37 [25.734,42–27.440,56] | -28,83% |
| mobile/ledger-5000-filter | 3.575,98 [3.418,88–3.738,59] | 3.333,84 [2.979,20–3.685,85] | -6,77% |
| tablet/landing-es-cold | 1.075,82 [1.033,75–1.212,68] | 694,11 [618,51–694,94] | -35,48% |
| tablet/landing-en-cold | 1.005,46 [1.004,26–1.010,81] | 831,33 [741,26–941,18] | -17,32% |
| tablet/application-empty-cold | 1.801,24 [1.712,02–1.855,96] | 989,78 [913,47–1.429,97] | -45,05% |
| tablet/application-cold | 1.846,36 [1.820,35–1.939,54] | 1.410,51 [1.353,87–1.462,75] | -23,61% |
| tablet/application-warm | 562,17 [550,28–601,04] | 532,82 [507,52–567,89] | -5,22% |
| tablet/chart-first-open | 882,83 [867,95–901,09] | 847,92 [847,35–867,95] | -3,95% |
| tablet/planning-first-open | 380,89 [363,65–469,68] | 464,13 [453,78–519,89] | 21,86% |
| tablet/catalog-first-open | 243,64 [234,41–248,81] | 548,62 [518,35–548,67] | 125,18% |
| tablet/ledger-100-first-open | 434,79 [349,62–553,13] | 313,92 [281,91–396,58] | -27,80% |
| tablet/ledger-100-filter | 117,59 [116,87–130,61] | 101,26 [100,56–118,30] | -13,89% |
| tablet/language-first-fr | 267,97 [266,18–284,90] | 350,09 [301,02–352,99] | 30,64% |
| tablet/language-cached-es | 149,78 [147,15–164,62] | 83,82 [82,22–84,71] | -44,04% |
| tablet/ledger-1000-first-open | 2.764,77 [2.684,09–3.103,48] | 2.197,99 [2.146,09–2.226,37] | -20,50% |
| tablet/ledger-1000-filter | 385,70 [344,58–487,36] | 375,53 [319,89–441,16] | -2,64% |
| tablet/ledger-5000-first-open | 16.703,91 [16.106,69–16.929,04] | 12.061,09 [11.657,34–12.214,64] | -27,79% |
| tablet/ledger-5000-filter | 1.785,97 [1.657,43–2.157,86] | 1.666,80 [1.601,99–1.737,73] | -6,67% |
| desktop/landing-es-cold | 552,03 [541,31–568,86] | 418,52 [363,80–493,78] | -24,19% |
| desktop/landing-en-cold | 591,98 [579,81–618,71] | 453,38 [435,45–463,45] | -23,41% |
| desktop/application-empty-cold | 838,44 [799,59–1.277,04] | 679,27 [654,26–733,11] | -18,98% |
| desktop/application-cold | 1.020,62 [881,85–1.331,73] | 693,00 [689,97–775,19] | -32,10% |
| desktop/application-warm | 434,38 [423,50–477,87] | 436,10 [434,24–449,48] | 0,40% |
| desktop/chart-first-open | 849,26 [832,86–883,99] | 842,73 [831,51–897,57] | -0,77% |
| desktop/planning-first-open | 228,76 [163,40–349,05] | 901,54 [850,06–935,28] | 294,10% |
| desktop/catalog-first-open | 133,68 [115,98–238,03] | 524,81 [431,75–831,12] | 292,60% |
| desktop/ledger-100-first-open | 166,53 [166,50–184,53] | 189,32 [149,86–226,14] | 13,69% |
| desktop/ledger-100-filter | 83,85 [82,53–84,63] | 79,26 [67,24–83,26] | -5,48% |
| desktop/language-first-fr | 165,94 [165,92–166,60] | 169,82 [166,80–198,46] | 2,34% |
| desktop/language-cached-es | 84,71 [82,23–84,74] | 49,96 [49,07–71,87] | -41,02% |
| desktop/ledger-1000-first-open | 1.227,37 [1.214,11–1.263,30] | 912,86 [900,96–1.031,42] | -25,62% |
| desktop/ledger-1000-filter | 181,64 [180,95–224,52] | 189,10 [180,50–242,66] | 4,10% |
| desktop/ledger-5000-first-open | 6.168,78 [6.111,13–6.468,98] | 5.010,39 [4.838,97–5.029,88] | -18,78% |
| desktop/ledger-5000-filter | 903,56 [786,52–909,57] | 740,72 [728,73–814,01] | -18,02% |

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
| 390/mount | 1.931,50 | 683,20 |
| 390/filter | 136,50 | 44,50 |
| 1280/mount | 330,50 | 166,80 |
| 1280/filter | 24,40 | 9,30 |

Cada recorrido conserva los bytes financieros y las filas esperadas. No se atribuye al render React todo el coste de DOM/estilos/GC: los tiempos de interacción de producción siguen siendo mayores.

## Volumen y recorridos móviles

Fixtures validados por el parser real:100/1.000/5.000 movimientos, catálogo de sistema más familia/partida personal y subítem, presupuestos de2025–2027, aprobación, regla de planificación, contactos, gasto compartido/reintegros/compensación y transferencia. No se elevan límites de dominio o tamaño. La lista mantiene todos los registros y su orden, búsqueda, foco y navegación; no se pagina/trunca para maquillar tiempos.5.000 en móvil4× sigue siendo lento (27,23s de mediana al abrir;3,33s al filtrar).

Otros72 recorridos por revisión miden mes, formularios/importe, reparto, asistente/propuesta, importación y restauración. [Antes](phase-5e-journeys-before.json), [después](phase-5e-journeys-after.json) y [comparación](phase-5e-journeys-comparison.json). Solo la confirmación explícita de restauración permite escribir; se verifica copia recuperable y equivalencia de todos los campos importados, preservando la revisión aleatoria original. Sin llamadas API ni errores de página.

| Móvil/acción | Antes, ms [mín–máx] | Después, ms [mín–máx] |
| --- | ---: | ---: |
| mobile/month-previous | 232,53 [214,99–272,00] | 190,73 [182,24–204,94] |
| mobile/movement-form-open | 235,86 [223,90–316,30] | 251,76 [234,85–383,35] |
| mobile/movement-amount-input | 81,26 [68,12–112,05] | 90,04 [60,26–92,76] |
| mobile/shared-expense-open | 713,70 [693,04–811,24] | 547,22 [543,56–618,01] |
| mobile/assistant-first-open | 1.032,81 [999,95–1.033,38] | 1.278,38 [1.271,06–1.287,64] |
| mobile/assistant-proposal | 176,15 [175,79–202,01] | 165,34 [159,11–179,62] |
| mobile/import-validate-preview | 178,56 [174,45–178,74] | 155,19 [151,75–171,82] |
| mobile/restore-verified-confirmation | 222,56 [185,15–241,67] | 174,64 [174,62–192,36] |

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

### Clasificación contextual de registros incompletos

Se han inspeccionado los mecanismos, selectores, HTML serializado y checks conservados por axe. Esta clasificación no cierra su revisión manual ni certifica contraste visual o uso de lector de pantalla.

| Mecanismo registrado | Ejemplo real del registro | Revisión contextual pendiente |
| --- | --- | --- |
| `nonBmp` | Flecha ▾ decorativa, `aria-hidden="true"`, de un desplegable | Separar símbolo decorativo y texto/nombre accesible del control; conservar la observación |
| `elmPartiallyObscuring` / `bgOverlap` | Ayuda de Cartera y acción Nuevo Contacto | Comprobar fondo efectivo, intersecciones y posición del viewport |
| `elmPartiallyObscured` | Cabecera Después de una vista previa de copia | Revisar clipping/solapamiento y fondos de tabla/modal en su contexto |
| `shortTextContent` | Cabecera A del histórico | Revisar el texto breve dentro del encabezado y su fondo, sin inferir falta de etiqueta |
| `imgNode` | Texto SVG de ejes de gráficos (por ejemplo, 0 €) | Verificar contraste sobre el fondo real del SVG; el motor no lo ha determinado |
| `controlsWithinPopup` (`aria-valid-attr-value`) | Selector de partida con listbox abierto | Revisar el ID de aria-controls, el listbox y su ciclo de foco; la prioridad del motor no convierte un incompleto en violación |

Los recuentos finales local/CI se informan separados. Una ocurrencia puede registrar varios checks; ni las ocurrencias de nodos ni los grupos repetidos equivalen a defectos distintos. No se modifica ninguna regla ni se elimina un resultado incompleto para obtener una aprobación.

## Capturas de la aplicación real

[Manifiesto de12 PNG](phase-5e-capture-manifest.json): antes/después de Inicio y Planificación a390/768/1280, datos ficticios idénticos y hash financiero por pareja. Proceden del build medido; no hay generación/edición de imágenes ni datos de Google AI Studio. Los cambios posteriores son de pruebas/documentación: el frontend fotografiado coincide con el código de entrega. La captura móvil de Planificación conserva un desplazamiento distinto durante el recorrido real (la carga diferida cambia la altura transitoria de la página). Estas vistas no son una comparación píxel a píxel; no se han alineado ni retocado las imágenes. Las pruebas de scroll por panel se conservan y se ejecutan por separado.

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
- d9ccb7d: identidad React.lazy cumplida compartida para evitar resuspensiones al cambiar mes/visitar módulos; automatizaciones15/15 y módulos8/8.

Base reejecutada:585 unitarias,22 infraestructura,747 Chromium/37 suites, lint/build correctos; [resumen verificable](phase-5e-baseline-validation.json). Los intentos parciales/fallidos se documentarán separados de la ejecución final. La [CI43650839122](https://github.com/dlopezteruel-rgb/Finanzas-pro/actions/runs/43650839122) en d66d4a4 falló en Chromium por5E-08; unitarias y código fueron verdes. La CI corregida en585e996 y la batería local están en curso: no se presentan todavía como aprobadas. No se modifican workflows, permisos, protecciones o límites para aprobar.

## Recomendaciones posteriores

1. Medir precarga por intención para Catálogo/asistente/idiomas frecuentes, publicando su coste adicional y efecto en primera visita.
2. Estudiar una lista de volumen accesible (búsqueda, teclado, lectura/impresión, foco y totales completos) antes de virtualizar/paginar;5.000 sigue siendo lento en CPU4×.
3. Evaluar aislar el formateador legado en un módulo hoja para evitar dependencias de dominio en la landing, con equivalencia exacta y sin cambiar modelos.
4. Ampliar muestras/dispositivos físicos y sesiones largas para INP/memoria real. Revisar manualmente grupos axe equivalentes con su contexto, sin descartarlos ni tratarlos como violaciones.

Sin fusión, despliegue, sincronización de Google AI Studio, cambios de main/protecciones, nuevas dependencias o datos personales.

## Resuspensión en cambios de mes (5E-09)

La segunda CI roja, [43652265177](https://github.com/dlopezteruel-rgb/Finanzas-pro/actions/runs/43652265177), reprodujo una pérdida de selección inmediata de Multiperiodo en móvil: la importación estaba cacheada, pero una identidad React.lazy nueva volvía a suspender al cambiar la key del mes. La corrección comparte la identidad cumplida por funcionalidad, manteniendo una identidad nueva para reintentar errores. No se duplican stores/proveedores ni se cambia el reset financiero por mes. Automatizaciones15/15 y módulos8/8 pasan con el caso nuevo; los informes después y las capturas se han regenerado para d9ccb7d. La batería completa local de784 resultados/41 suites y la CI corregida43653525846 están en ejecución.

[Intentos completos, parciales y fallidos](phase-5e-validation-attempts.json): se conservan los estados rojos y las cancelaciones; no se cuentan como aprobación ni se ocultan con reintentos automáticos.

## Entorno del sondeo aislado de navegación (5E-10)

La CI43653525846 pasó unitarias/código y señaló dos compilaciones de sondeo de intelligent.browser: esbuild IIFE incluía la preparación Node/SSR con top-level await porque ese bundle aislado no recibía las constantes de entorno del navegador. Se definen exactamente import.meta.env.SSR=false e import.meta.env.BASE_URL="/", conservando NODE_ENV=production, como en Vite. El build real de producción y la preparación Node/SSR no cambian. Se mantienen las comprobaciones originales de movimiento/ocurrencia enlazada, filtros, foco y ausencia de escrituras. La suite original completa vuelve a25/25, sin omisiones/cancelaciones ni cambios de límites. Las sondas incompletas/fallidas no se presentan como prueba aprobada.

## Contenido real antes de recuentos visuales (5E-11)

La CI43655068796 y la ejecución local reprodujeron el recuento prematuro de cero tarjetas al abrir Cuentas (se esperaban tres). Las comprobaciones visuales esperan ahora los contenedores reales de Cuentas y Planificación, y la matriz de presentación espera la región del planificador antes de contar sus pestañas. Se conservan todos los recuentos y umbrales AA. Resultado focalizado: visual12/12 y presentación7/7, sin omisiones/cancelaciones. Son cambios del arnés; no alteran el frontend medido/fotografiado ni amplían tiempos de espera.

## Selección fría de Multiperiodo en el arnés (5E-12)

La CI43656155672 detectó que selectPlanningArea consultaba count() antes de que existiera el tablist diferido. Interpretaba cero pestañas como escritorio y omitía la activación móvil, aunque el details ya estaba abierto. El helper espera ahora el tablist visible antes de distinguir las variantes; no cambia el componente, sus reglas, los casos originales ni los límites. La suite de subítems conserva sus19 resultados y la batería completa vuelve a ejecutarse.

## Aserciones tras carga diferida: cierre del diagnóstico

El diagnóstico posterior completó569/569 resultados en29 suites, sin fallos, omisiones o cancelaciones. No equivale por sí solo a una aprobación de npm run test:ui. Se verificó adicionalmente customCatalog6/6 esperando el catálogo real antes de afirmar la ausencia de una partida retirada. La regresión de módulo cacheado añade un MutationObserver antes del cambio de mes: exige cero inserciones transitorias de loader, incluso aunque el helper espere al tablist. Módulos8/8 pasan con esa aserción, de modo que la nueva espera no enmascara una resuspensión. Lint/diff-check pasan; la secuencia integral final se ejecuta después de publicar este checkpoint.
