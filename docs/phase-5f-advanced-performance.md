# Fase 5F — Rendimiento avanzado y base web móvil

## Estado y alcance

Base verificada: `540cfcf269024e3b0d3399b653a2d5b16b1845c5`, merge de PR #29. La referencia remota `origin/main` se volvió a obtener explícitamente y sigue en ese SHA, sin commits posteriores. Rama independiente `perf/phase-5f-advanced-performance`, creada con árbol limpio. Se conservan los worktrees anteriores y el checkout base separado. Se revisaron documentación, perfiles y herramientas de 5E.

Frontend medido: **`d11c41f752be8641002fdd279dc577ffe70e4a83`**. Los commits de cierre posteriores contienen evidencias/documentación; el manifiesto permite comprobar las fuentes. El SHA exacto de entrega y sus tres checks se enlazan en el cuerpo de la única PR Draft para evitar un ciclo de commits que cambien el SHA documentado.

Se pagina únicamente la presentación de listados grandes y se precargan selectivamente tres destinos. No hay virtualización, dependencia nueva, funcionalidad financiera nueva, Capacitor, proyecto Android/iOS, despliegue ni sincronización de Google AI Studio. No se modifica main ni sus protecciones. Los46 archivos protegidos de dominio, FinanceStore, Web Locks, modelos, parsers, API/prompts, esquemas, configuración, workflow y lockfile mantienen sus bytes de la base: [manifiesto](phase-5f-protected-files.json), sin excepciones.

## Diagnóstico y decisión

La [línea base nueva](phase-5f-baseline-core.json) contiene144observaciones de producción. No se reutilizan como aprobación las cifras históricas. [Validación inicial real](phase-5f-baseline-validation.json): npm ci188paquetes,599/599 unitarias,22/22 infraestructura, lint/build y784/784 resultados Chromium en 41 suites. Sin fallos, omisiones, cancelaciones o casos pendientes. Su ejecución local completa duró55m42,479s; pudo coexistir con pruebas de desarrollo y no sirve como comparación temporal. Las mediciones de rendimiento son ejecuciones separadas y secuenciales.

El listado es plano. Sus filtros/ordenación toman unos54,10 ms y la proyección económica/totales8,90 ms en una muestra exploratoria. No justifican cambiar identidades, sumas o redondeos. Construcción/formato de elementos587,20 ms y React actualDuration5.002 ms; estilos/layout dominan. [Perfil CPU](phase-5f-before-mobile-5000.cpuprofile), [timeline gzip](phase-5f-baseline-ledger-trace.json.gz), [resumen](phase-5f-baseline-ledger-trace.summary.json) y [experimento React aislado](phase-5f-ledger-diagnosis.json) conservan la evidencia. UpdateLayoutTree11.858,52 ms/Layout6.788,08 ms/Paint69,54 ms pueden solaparse y no deben sumarse como costes exclusivos.

| Alternativa exploratoria,5.000 datos,CPU4× | Filas DOM | Presentación,ms |
| --- | ---: | ---: |
| DOM completo | 5.000 | 25.187,51 |
| content-visibility:auto | 5.000 | 7.413,58 |
| Prototipo de50filas | 50 | 683,03 |

Una muestra por alternativa, no medianas de aceptación. Las tres preservaron bytes y totales23.824,96€/62.539,88€. content-visibility conserva miles de nodos/fibers y no alcanzaba el objetivo. Se elige **paginación accesible nativa**, más sencilla que reciclar filas de altura variable y foco interactivo. No se refactorizan cálculos económicos ni se introduce procesamiento parcial.

## Grandes listados: datos y presentación

| Conjunto | Alcance |
| --- | --- |
| Datos | Todos los movimientos originales y sus relaciones |
| Resultados filtrados | Búsqueda, filtros y orden cronológico originales sobre el conjunto completo |
| Totales/CSV | Conjunto completo correspondiente, mismo cálculo/orden de sumas/formato anterior |
| Filas DOM | Todos hasta200 resultados; por encima,50 por página salvo modo completo/impresión |

Todos los datos, filtros y totales están listos antes de mostrar la primera página. No queda contabilización pendiente para simular rapidez. La ordenación estable original se conserva literalmente. No se almacenan preferencias de página en los datos financieros.

Controles nativos arriba/abajo, selector directo de cualquier página, anterior/siguiente y modo completo explícito. Posición y total mediante aria-posinset/aria-setsize; rango anunciado una vez. La búsqueda global accesible encuentra registros no montados con los mismos criterios anteriores:concepto,código,partida,cartera e importe interno. No amplía el parser ni añade búsqueda por fecha/notas; para Ctrl+F sobre cualquier texto montado se ofrece el modo completo. Cambiar filtros vuelve a la primera página. Idioma/tema mantienen página; cambiar mes con periodo Todos no altera el cursor. Las identidades enlazadas desde históricos/deudas se revelan y reciben foco, sin abrir un editor. La edición mantiene anclada la identidad aunque su nueva fecha cambie la posición cronológica. Los controles conservan foco/scroll; en un extremo se enfoca el selector antes de deshabilitar el botón.

**Limitaciones explícitas:** Ctrl+F nativo solo encuentra filas montadas. La búsqueda propia cubre todos los registros; Mostrar todos recupera búsqueda nativa con el coste anterior. beforeprint monta todos los resultados y afterprint restaura página/foco/scroll. La impresión y el modo completo siguen siendo costosos. Si una WebView no ofrece eventos de impresión, se usa el modo completo manual, sin garantía de impresión nativa. No se eliminan registros de exportación o impresión.

Impresión real a PDF de Chromium:1.000 filas antes/50después,85 páginas en el PDF local verificado. pdftotext recuperó los994conceptos sintéticos únicos6–999 en orden estable, más los seis registros originales comprobados aparte, sin omisiones/extras. El PDF reproduce la presentación existente, incluido el truncado visual de textos largos; no es una nueva exportación documental íntegra de conceptos/notas. No es una impresora física ni una certificación de impresión WebView. El PDF ficticio se genera en los artefactos de navegador; la prueba verifica documento PDF multipágina y restauración nativa.

## Precarga selectiva y segura

Se reutilizan petición, módulo y componente lazy cacheados de 5E. preload() solo evalúa importaciones: no monta componentes/proveedores/almacenes ni modifica FinanceStore. Una petición en vuelo se comparte con navegación; error elimina la petición cacheada y conserva carga/error/reintento explícito. No hay reintentos automáticos de descarga.

Solo Planificación, Catálogo (sus dos módulos asociados) y Asistente. Señal sostenida200 ms: ratón/pen, foco visible por teclado o pulsación táctil. Un tap corto mantiene carga bajo demanda. Salir, blur, cancelar, usar el destino o desmontar cancela la cola. Máximo una funcionalidad en vuelo/no consumida. No hay descarga por mero tiempo transcurrido ni de todos los módulos.

Antes de iniciar import() se revalidan: documento completo/visible,4g, downlink≥2 Mbps, rtt≤300 ms, ahorro de datos desactivado, más de2CPU/2 GB cuando existen esas señales, API idle y ausencia de input pendiente. La intención puede registrarse durante el gesto de entrada; el trabajo solo se autoriza después. Se espera un intervalo natural con≥10 ms disponibles; si el primero está ocupado se espera otro, con caducidad1 s/60 oportunidades, sin deadline forzado. APIs desconocidas/restringidas mantienen navegación normal. Se bloquea durante borradores/guardado/restauración de planificación, navegación pendiente, diccionario solicitado por el usuario, diálogos financieros, aria-busy, campos enfocados y registro rápido pendiente. Más permite intención sobre Asistente.

Una importación ya iniciada no puede abortarse; su posible tráfico no consumido es el coste acotado de una funcionalidad. Catálogo puede descargar dos chunks. No hay duplicación de proveedores/almacenamiento, red/API del asistente ni efectos financieros.

## Medición comparativa

[Resultados completos con medianas, rangos, CPU, heap y bytes](phase-5f-performance-results.md). Node 24.22.1, Chromium 156.0.8078.79, Linux, 3 CPU AMD EPYC 9V74,10.452.459.520 bytes de memoria. Builds de producción servidos con gzip, fixtures JSON 3.5 fijas, EUR/Europe/Madrid. Tres muestras por escenario, sin otros navegadores locales durante las mediciones. Los dos lados usan el mismo arnés.

| Perfil | Viewport | CPU | Latencia/red |
| --- | --- | --- | --- |
| Móvil | 390×900 | 4× | 80 ms/1,6 Mbps |
| Tablet | 768×900 | 2× | 40 ms/5 Mbps |
| Escritorio | 1280×900 | 1× | 20 ms/10 Mbps |
| Móvil rápido,suplementario | 390×900 | 4× | 80 ms/5 Mbps |

| Móvil,mediana [mín–máx],ms | Antes | Después |
| --- | ---: | ---: |
| Abrir100 | 744,07 [708,00–814,55] | 883,10 [805,93–951,00] |
| Abrir1.000 | 5.809,41 [5.784,47–6.333,25] | 620,35 [591,58–627,61] |
| Abrir5.000, datos/totales listos | 26.587,94 [26.278,53–29.507,90] | 967,18 [939,74–1.047,50] |
| Filtrar5.000 | 2.801,70 [2.793,44–3.569,74] | 528,59 [483,73–699,12] |
| Primer Catálogo,sin precarga | 1.049,73 [1.019,93–1.052,22] | 1.094,30 [1.023,56–1.103,72] |
| Primera Planificación,sin precarga | 695,31 [636,61–1.056,33] | 781,99 [779,33–1.080,34] |
| Entrada aplicación | 2.761,71 [2.711,40–2.814,66] | 2.722,95 [2.691,29–2.741,74] |

La apertura de 5.000mejora96,36% y el filtro81,13% en las medianas de este laboratorio. El recorrido adicional comprueba una fila realmente dentro del viewport: clic→fila28.019,45→697,74 ms y entrada→fila30.551,76→3.764,76 ms, con todos los datos/totales completos. Son señales distintas, no deben mezclarse ni presentarse como tiempo de campo. Heap vivo aproximado tras abrir:68.046.672→11.302.472 bytes, sin GC forzado ni equivalencia con RSS.

Sobre5.000, cambiar tema37.058,48→654,48 ms, idioma francés22.760,58→945,89 ms, periodo3.582,76→260,88 ms, mes11.046,98→565,30 ms y búsqueda remota2.304,22→115,11 ms. Guardado explícito1.417,04→1.450,47 ms con rangos solapados: **sin mejora confirmada**. No se acelera ni altera el guardado financiero. El [análisis de scroll](phase-5f-scroll-analysis.json) separa el desfase inicial de programación de los 19 intervalos rAF reales por muestra; no usa un desfase negativo como intervalo o mejora.

Hay costes observados:100 registros mantienen DOM completo y su mediana móvil sube139,03 ms; entrada tablet1.048,13→1.374,39 ms con rangos solapados y landing escritorio383,66→446,02 ms. No se ocultan estas muestras ni se atribuye una causa demostrada al código. Las muestras son pocas y variables; no permiten afirmar mejora general de todos los escenarios. El tamaño inicial sigue conservando la reducción sustancial de 5E; no se aumentan timeouts para lograr una cifra favorable.

| JS descargado inicial,gzip | Antes | Después | Incremento |
| --- | ---: | ---: | ---: |
| Landing española | 137.119 | 137.397 | 278 bytes /0,20% |
| Aplicación española | 245.354 | 248.196 | 2.842 bytes /1,16% |

El CSS global pasa de 94.823 a 95.783 bytes minificados y de 17.092 a 17.264 bytes gzip (+172, con gzipSync como el servidor de medición); es un coste separado de la métrica JavaScript. El incremento corresponde a controles/traducciones de paginación y coordinación selectiva. No se adelantan los otros cuatro diccionarios ni todos los módulos. No reaparece el aviso de chunk>500kB; el análisis de bundles conserva el límite de entrada estática aprobado, sin elevar umbrales.

### Beneficio y coste de intención

Misma anticipación nominal500 ms en ambas revisiones, con timers/idle nativos; se registran anticipación real, clic→contenido e intención→contenido.72 observaciones antes y144después; los72casos adicionales de ahorro de datos/capacidades ausentes son comprobaciones de seguridad solo-después, sin inventar cifras de base.

| Destino | Tablet,clic antes→después,ms | Escritorio,clic antes→después,ms |
| --- | ---: | ---: |
| Planificación | 453,2→233,8 | 434,0→134,6 |
| Catálogo | 584,0→332,7 | 850,9→199,5 |
| Asistente | 866,2→171,7 | 852,0→84,3 |

Incluyendo anticipación, Catálogo tablet1.145,3→879,3 ms y escritorio1.384,0→733,4 ms. Segunda apertura, red/CPU/memoria y rangos figuran en el informe completo. En móvil1,6 Mbps las9 intenciones se bloquean deliberadamente:0 precargas, sin prometer menor espera. En móvil rápido se precargan9/9; Catálogo982,4→791,5 ms tiene rangos solapados y no confirma mejora. Los bytes totales tras visitar el destino no se reducen: se adelantan12.090de Planificación,8.174de Catálogo o4.968de Asistente. Antes de una señal válida,0 peticiones de esos destinos. Ahorro de datos/APIs ausentes:0 precargas en72casos, navegación normal funcional.

## Regresión funcional, móvil y accesibilidad

Se conservan todas las41suites originales y sus aserciones. Único ajuste de preparación en la prueba antigua de volumen: seleccionar Mostrar todos antes de sus recuentos/orden/filtros de1.000/5.000 filas DOM. No se reduce ningún recuento ni aserción. Se añaden dos suites,44 resultados de listado y17de intención. Unitarias:599 originales+9 límites de página+21 política/coordinación+4 idle=633. Infraestructura sin cambios:22.

| Cobertura nueva | Comprobación |
| --- | --- |
|100/201/1.000/5.000 | Todas las páginas,orden estable,IDs sin duplicados,totales exactos |
| Filtros/periodos | Búsqueda fuera de página,mes/periodo y conjunto completo |
| Edición/enlaces | Registro fuera de página,reordenación por fecha,borrador cancelado,vínculo histórico entre5.001 |
| Foco/teclado | Tab/Shift+Tab,nativos,extremos deshabilitados,retorno desde editor,ARIA global |
| Impresión/exportación | CSV íntegro,montaje nativo de1.000/restauración de50,PDF multipágina |
| Idiomas/temas |5 idiomas × 390/768/1280 × claro/oscuro=30 superficies,zoom de texto125%,sin overflow |
| Intención | Ratón,teclado,tacto,entrada transitoria,idle inicialmente ocupado,cancelación y límite |
| Seguridad | Sin APIs/red externa/escrituras visuales,fallo y recuperación,sin reintento automático |
| Concurrencia | Navegación/importación/idioma,borrador y diccionario con prioridad |

La fixture de 5.000conserva hash472fd3fd66a61f595649d9ce21e1ab8fbe03cbb20cb926c9bd1894d9f8c3e17d en acciones visuales. El recorrido de guardado explícito cambia solo un concepto ficticio y la normalización previa de notas; valida el documento completo. Se valida exportedAt ISO regenerado por el guardado anterior; solo ese metadato se excluye del hash comparativo entre ejecuciones. IDs, importes, estados, relaciones y versión3.5 permanecen iguales. La compatibilidad2.5–3.5 y los módulos financieros se conservan en las baterías originales; no se migra ningún dato personal.

### Axe y revisión contextual

Sin reglas desactivadas ni resultados incompletos convertidos en aprobación. La referencia CI verde [43741726133](https://github.com/dlopezteruel-rgb/Finanzas-pro/actions/runs/43741726133), fuente773bd90, conserva22 informes/1.511 observaciones, 0 violaciones automatizadas,947 grupos incompletos/53 conjuntos equivalentes/5.770 ocurrencias de nodos. La base local nueva:17 informes/1.481 observaciones, 0 violaciones,906 grupos/49 conjuntos. No deben mezclarse los entornos.

Los945 grupos/52 conjuntos de 5E siguen pendientes de revisión contextual. Se inspeccionan y agrupan registros, selectores, HTML/checks; no se certifica revisión con lector de pantalla. [Agrupación base](phase-5f-baseline-axe-review.json) y [referencia CI](phase-5f-reference-axe-review.json) preservan procedencia y ejemplos.

| Mecanismo | Clasificación/revisión pendiente |
| --- | --- |
|nonBmp | Símbolos decorativos:comprobar su papel frente al nombre accesible |
|elmPartiallyObscuring/elmPartiallyObscured/bgOverlap | Fondos,clipping y solapamientos requieren contexto real |
|shortTextContent | Contraste del texto breve,no equivale a ausencia de etiqueta |
|imgNode | Texto SVG de gráficos:medir contraste sobre fondo efectivo |
|controlsWithinPopup | Revisar relación aria-controls/listbox y ciclo de foco del desplegable |

Dos observaciones adicionales de CI se agrupan en **un** conjunto:span Movimientos de navegación,768px, español, claro/oscuro, elmPartiallyObscured relacionado con su propio botón. El valor0es un cálculo indeterminado, no una ratio medida0:1. No es evidencia suficiente para un cambio especulativo ni un defecto independiente por cada repetición. Se mantiene pendiente; no se elimina del informe. La matriz nueva local focalizada de30 superficies no registró incompletos. No se declaran resueltos los945históricos ni los adicionales sin revisión. No se han usado lectores de pantalla, dispositivos físicos, impresoras ni Safari/iPhone real.

## Incidencias reproducidas y corregidas

| ID | Problema | Corrección mínima/prueba |
| --- | --- | --- |
|5F-01 | Limpiar búsqueda recuperaba página anterior | Cursor ligado al filtro;regresión de listado |
|5F-02 | Paginador superior demasiado alto en390px | Controles compactos44px,ayuda completa en pie;matriz/axe |
|5F-03 | Getter de conectividad restringido lanzaba error | Adaptador con fallback bajo demanda;throwingNetwork |
|5F-04 | Precarga competía con diccionario solicitado | Respetar pendingLanguage existente;0 peticiones mientras está pendiente |
|5F-05 | Botón al pasar a disabled enviaba foco a body | Enfocar selector antes del extremo;Tab/Enter primera/última |
|5F-06 | Intención perdida durante inputPending/idle ocupado | Cola de gesto sin autorizar import,otro intervalo natural acotado;unitarias y2casos nuevos |
|5F-07 | Cadena extra de promesas retrasaba apertura fría | Observar aparte la promesa original loader.catch;8regresiones originales del cargador |

[Intentos completos y fallidos](phase-5f-validation-attempts.json). Una CI roja real43735323745 completó837/843con cancelaciones:la espera no acotada del arnés de precarga fue sustituida por waitForRequest con el límite existente8 s, sin elevar120 s del padre ni50 minutos de CI. La traza remota no identifica una única condición causal; se reprodujeron y cubrieron input transitorio/primer idle ocupado. Los errores iniciales del arnés, fuentes de reloj simuladas y muestras incompletas se separan de la aceptación. La ejecución local de773se interrumpió al sustituir el cargador y no cuenta como aprobación.

## Capturas y artefactos ficticios

[Manifiesto de fuentes y PNG](phase-5f-capture-manifest.json). Las capturas proceden de builds reales y datos sintéticos, sin retoques. [Antes del paginador compacto](phase-5f-screenshots/before-compact-fr-390-light-ledger.png)/[después](phase-5f-screenshots/fr-390-light-ledger.png).

| Comparación de fila realmente visible | Antes | Después |
| --- | --- | --- |
|390px | [PNG](phase-5f-screenshots/before-mobile-ledger-5000.png) | [PNG](phase-5f-screenshots/after-mobile-ledger-5000.png) |
|768px | [PNG](phase-5f-screenshots/before-tablet-ledger-5000.png) | [PNG](phase-5f-screenshots/after-tablet-ledger-5000.png) |
|1280px | [PNG](phase-5f-screenshots/before-desktop-ledger-5000.png) | [PNG](phase-5f-screenshots/after-desktop-ledger-5000.png) |

| Idioma,390px | Claro | Oscuro |
| --- | --- | --- |
|es-ES | [PNG](phase-5f-screenshots/es-390-light-ledger.png) | [PNG](phase-5f-screenshots/es-390-dark-ledger.png) |
|en-GB | [PNG](phase-5f-screenshots/en-390-light-ledger.png) | [PNG](phase-5f-screenshots/en-390-dark-ledger.png) |
|it-IT | [PNG](phase-5f-screenshots/it-390-light-ledger.png) | [PNG](phase-5f-screenshots/it-390-dark-ledger.png) |
|fr-FR | [PNG](phase-5f-screenshots/fr-390-light-ledger.png) | [PNG](phase-5f-screenshots/fr-390-dark-ledger.png) |
|pt-PT | [PNG](phase-5f-screenshots/pt-390-light-ledger.png) | [PNG](phase-5f-screenshots/pt-390-dark-ledger.png) |

## Base para Android/iOS y pendientes

Se conservan React/TypeScript/Vite y base compartida web. Sin dependencias exclusivas de escritorio. Las capacidades de red/idle/input quedan aisladas en intentPreload/preloadIdle; si no existen en WebView no hay precarga. La aplicación funcional no depende de ellas. Impresión se aísla en useCompletePrint y dispone del modo completo manual. No se cambia almacenamiento para sincronización futura ni se eluden Web Locks/origen seguro:habrá que verificar su disponibilidad real antes de integrar un contenedor móvil.

Pendientes:lector de pantalla y contraste contextual;945 grupos históricos/52 conjuntos y adicionales descritos;pruebas físicas Android/iOS;coste del modo completo/impresión;Ctrl+F paginado;variabilidad y algunos aumentos en escenarios pequeños/fríos;política conservadora sin beneficio de precarga en1,6 Mbps/APIs ausentes. No se afirma ausencia de fugas en sesiones largas ni mejora estadística con tres muestras.

## Reproducción y checkpoints

```bash
npm ci
npm test
node scripts/ci/run-check.mjs tools
npm run lint
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:ui
git diff origin/main...HEAD --check
git diff --check
node scripts/performance/bundles.mjs /tmp/5f-bundles.json
```

Usar la ruta real del Chromium instalado; CI resuelve su propia ruta. Para comparar, conservar checkout540y su dist separado y ejecutar **el mismo arnés actual** cambiando PERF_DIST/PERF_SOURCE_SHA/PERF_OUTPUT. measure.ts, measureIntent.ts ymeasureLedgerInteractions.ts admiten PERF_SAMPLES=3;beforeIntent usa PERF_MODES=cold, intent ydespués los cuatro modos. Registrar PERF_SCREENSHOTS;no ejecutar navegadores/builds competidores mientras se mide. Los JSON contienen configuración, fechas de ejecución, errores, peticiones, bytes y hashes;gzip -dc recupera los datos comprimidos. CI mantiene sus límites y dependencias originales.

Commits recuperables publicados:356e8fc diagnóstico, c1bf449 listado,14c93b6 intención,084dc8c matriz, d63b5e0 controles/seguridad,081d198 foco,773bd90 cola idle, d11c41f promesa original. No se fusionan por separado. El inventario completo de archivos y los resultados de cierre acompañan a la entrega.

<!-- VALIDATION_START -->
## Cierre en curso

Sobre d11c41f:npm ci,633/633 unitarias,22/22 infraestructura, lint/build/diff correctos. La batería local integral sigue ejecutándose y la CI43746276687 de esta fuente está en curso. No se presentan como aprobadas. La referencia anterior [43741726133](https://github.com/dlopezteruel-rgb/Finanzas-pro/actions/runs/43741726133) sí tiene los tres trabajos verdes,845/845Chromium en 43 suites y633/22 unitarias/infraestructura; [resumen verificable](phase-5f-reference-ci.json), ZIP comprobados porSHA-256. Aún faltan el cierre local, la única PR Draft y los tres checks de su SHA exacto.
<!-- VALIDATION_END -->
