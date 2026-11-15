# Fase 5F — Rendimiento avanzado

## Estado de partida y checkpoint 1

Base verificada: `540cfcf269024e3b0d3399b653a2d5b16b1845c5`, merge de PR #29 en origin/main. Rama nueva `perf/phase-5f-advanced-performance`; árbol inicial limpio. Los worktrees anteriores permanecen intactos. No había commits posteriores en origin/main al iniciar. Se revisaron el documento, perfiles, recorridos y herramientas de 5E.

Entorno local: Node 24.22.1, Chromium 156.0.8078.79, Linux, 3 CPU AMD EPYC 9V74 y 10.452.459.520 bytes de memoria disponibles al medir. Datos exclusivamente ficticios JSON 3.5, EUR y Europe/Madrid. No son teléfonos físicos ni pruebas con lector de pantalla.

Validación inicial realmente ejecutada: npm ci (188 paquetes), 599/599 unitarias, 22/22 infraestructura, lint y build correctos. La ejecución completa de las 41 suites Chromium está pendiente; las referencias anteriores no se presentan como resultados de esta fase. Se conserva la advertencia de dependencia obsoleta node-domexception; no se actualizan dependencias.

## Diagnóstico medido

[Línea base](phase-5f-baseline-core.json): 144 observaciones de producción, 3 muestras por escenario y perfil, sin errores, peticiones API ni escrituras financieras. Perfiles: 390×900/CPU4×/80ms/1,6Mbps; 768×900/CPU2×/40ms/5Mbps; 1280×900/CPU1×/20ms/10Mbps. La instrumentación registra heap, scripts, tareas largas, recursos y hashes financieros. Se conservan muestras y rangos, sin atribuir a mejoras diferencias menores que su variabilidad.

| Móvil, mediana [mín–máx], ms | Base actual | Después |
| --- | ---: | ---: |
| Abrir 100 | 744,07 [708,00–814,55] | Pendiente |
| Abrir 1.000 | 5.809,41 [5.784,47–6.333,25] | Pendiente |
| Abrir 5.000 | 26.587,94 [26.278,53–29.507,90] | Pendiente |
| Filtrar 5.000 | 2.801,70 [2.793,44–3.569,74] | Pendiente |
| Primera Planificación | 695,31 [636,61–1.056,33] | Pendiente |
| Primer Catálogo | 1.049,73 [1.019,93–1.052,22] | Pendiente |

Landing: 137.119 bytes gzip; aplicación inicial: 245.354 bytes gzip. No se modifica el presupuesto global de CI (50 minutos), reglas axe, límites individuales ni aserciones.

[Perfil CPU de 5.000](phase-5f-before-mobile-5000.cpuprofile), [timeline comprimido](phase-5f-baseline-ledger-trace.json.gz) y [resumen](phase-5f-baseline-ledger-trace.summary.json): en una muestra exploratoria, UpdateLayoutTree ocupa 11.858,52ms, Layout 6.788,08ms y Paint 69,54ms. Las categorías pueden solaparse: no deben sumarse como costes exclusivos. El listado actual es plano, sin agrupaciones adicionales.

[Experimento React aislado](phase-5f-ledger-diagnosis.json): builds temporales con react-dom/profiling, misma fuente, datos, filtros, orden y proyección económica. Una muestra por alternativa, **no** medianas de aceptación. Preparación/filtro/orden: 54,10ms; proyección y totales: 8,90ms. La identidad y proyección económica optimizada en 5E no es el cuello dominante. Construcción de elementos/formato: 587,20ms; React actualDuration: 5.002ms; estilos/layout dominan la espera restante.

| Experimento CPU4×, 5.000 datos completos | Filas DOM | Primera presentación, ms |
| --- | ---: | ---: |
| DOM completo | 5.000 | 25.187,51 |
| content-visibility:auto | 5.000 | 7.413,58 |
| Prototipo de límite visual de 50 | 50 | 683,03 |

Las tres variantes conservan literalmente los bytes financieros y los totales 23.824,96€ / 62.539,88€. El prototipo no tiene navegación y no es una implementación entregable. Se descarta content-visibility como estrategia principal porque conserva miles de nodos/fibers y no alcanza el objetivo exploratorio. No se justifica refactorizar cálculos financieros que consumen unos 63ms.

Estrategia elegida: paginación accesible de 50 filas para listados grandes, búsqueda y filtros sobre el conjunto íntegro, totales completos antes de presentar la primera página, navegación directa a páginas, modo completo explícito e impresión completa. Se evita reciclado de filas y una dependencia nueva. La búsqueda nativa del navegador solo alcanzará filas montadas en modo paginado; la búsqueda propia encontrará todos los registros. El modo completo recuperará la búsqueda nativa, con su coste original. Implementación y regresión todavía pendientes.

## Pendientes y garantías

Faltan checkpoints 2–5: implementación, precarga selectiva, matrices móviles, batería completa y CI del SHA final. No se declara preparada para integración esta fase parcial. Permanecen pendientes de revisión contextual los 945 grupos axe incompletos de 5E en 52 conjuntos equivalentes; no son 945 violaciones ni se consideran resueltos.

No se modifica FinanceStore, modelos, Web Locks, semántica financiera, importación/restauración, JSON, prompts/API, main, sus protecciones ni Google AI Studio. No se instala Capacitor, no se despliega y no se fusiona.

## Checkpoint 2 — Presentación paginada

Los filtros, ordenación, pertenencia económica y reducciones permanecen en su código original. Solo se selecciona la franja de presentación después de calcular el conjunto completo. Hasta 200 resultados se muestran íntegros; por encima, páginas de 50. No hay virtualización ni reciclado. El número de resultados y sus totales siempre corresponde al conjunto filtrado completo, disponible antes de la primera página. Los índices ARIA globales identifican posición y tamaño del conjunto.

Hay controles nativos arriba y abajo, navegación directa a cualquier página, búsqueda global y modo completo explícito. Cambiar filtros vuelve a la primera página; cambiar idioma/tema no modifica la selección de página. La edición mantiene anclada la identidad incluso si una fecha nueva cambia su posición cronológica. Se conserva el foco nativo y el scroll al paginar. La impresión mediante beforeprint monta todos los resultados y afterprint restaura presentación/scroll; el modo completo es la alternativa explícita si una WebView no ofrece esos eventos. Imprimir o mostrar todo conserva el coste de miles de nodos. La búsqueda nativa del navegador solo encuentra la página montada; la búsqueda propia encuentra todos los registros. CSV sigue incluyendo todos los resultados y conserva su formato anterior.

Validación focalizada del código de este checkpoint: 608/608 unitarias (9 nuevas de límites y exhaustividad), lint/build/diff correctos; 42/42 resultados nuevos Chromium. Incluye recorrido de todas las páginas de100/201/1.000/5.000, orden estable e identidades sin duplicados, búsqueda remota, totales completos, cambio de periodo, edición reordenada con retorno del foco, borrador cancelado, CSV completo y eventos de impresión/restauración. Matriz de30 superficies (5 idiomas ×3 anchos ×2 temas), teclado y texto125%: cero violaciones axe automatizadas; incompletos requieren revisión contextual. La batería anterior no se ha reducido: su prueba de volumen selecciona explícitamente el modo completo antes de conservar literalmente sus recuentos y aserciones anteriores.

Se corrigió un fallo reproducido por la nueva prueba: borrar una búsqueda recuperaba una página antigua. El cursor se sincroniza ahora con la identidad del filtro. Los primeros intentos también señalaron errores del arnés nuevo (clave de navegación inexistente, nombre accesible con puntuación incorrecta y expectativa de notas vacías distinta de la normalización preexistente); se corrigió el arnés sin cambiar el editor financiero. Estos intentos fallidos no se cuentan como aprobación. Las mediciones comparativas finales siguen pendientes mientras termina la batería de base, evitando competir por CPU.

## Checkpoint 3 — Precarga selectiva

Se reutiliza la petición única de deferredFeature y su componente/identidad cacheados. `preload()` solo importa el módulo: no monta componentes, proveedores ni almacenes. La primera visita a una funcionalidad precargada utiliza el componente ya resuelto; las visitas y cambios de mes siguen compartiendo la identidad cumplida. Se conserva el panel de carga/error/reintento de5E y se libera la petición rechazada para una nueva acción explícita.

Señales:200ms de intención sostenida con ratón/pen, foco visible por teclado o pulsación táctil. Salir, perder foco, cancelar el gesto o completar un tap corto cancela la cola. La descarga solo comienza en un intervalo idle con al menos10ms disponibles. No hay precarga por simple paso del tiempo ni de todos los módulos: solo Planificación, Catálogo (sus dos módulos asociados) o Asistente. Se limita a una funcionalidad en vuelo/no consumida. Un fallo no inicia reintentos automáticos ni cambia la pantalla actual.

El adaptador de capacidades consulta nuevamente, antes de importar: visibilidad, documento completo,4g, downlink≥2Mbps, rtt≤300ms, ahorro de datos desactivado, más de2CPU/2GB si esas señales están disponibles, API idle y ausencia de input pendiente. Con conectividad o capacidades esenciales desconocidas se mantiene la navegación bajo demanda. No se depende de hover en móvil. No se precarga durante borradores/guardados/restauraciones de planificación, diálogos financieros, regiones ocupadas, campos enfocados o registro rápido pendiente. El diálogo Más permite la intención sobre su opción Asistente.

Validación focalizada:628/628 unitarias (20 nuevas de política, cancelación, revalidación, límite, consumo, fallo y descarte);13/13 nuevos resultados Chromium con ratón/teclado/tacto, red lenta, ahorro de datos, capacidades ausentes, navegación simultánea/cambio de idioma, borrador y fallo de descarga;8/8 regresiones originales de módulos diferidos. Sin escrituras financieras ni montajes anticipados. Un primer intento del arnés no marcaba modalidad de teclado después de hacer clic: focus programático no implica focus-visible. Se corrigió para enviar Tab real, conservando la política de producto y los límites de prueba. Ese intento incluyó una cancelación y no cuenta como aprobación.

La herramienta `scripts/performance/measureIntent.ts` compara ambas revisiones con la misma anticipación de500ms; publica tanto clic-a-contenido como intención-a-contenido, para no esconder la espera previa. Registra recursos, CPU, memoria aproximada, señales nativas y segunda apertura. Incluye casos sin intención, ahorro de datos y capacidades desconocidas, además de390/CPU4×/1,6Mbps y un suplemento móvil rápido de5Mbps. Las mediciones finales siguen pendientes; no se presupone que las señales del runner equivalgan a las de un teléfono real.

## Checkpoint 4 — Regresión móvil y evidencias

44/44 resultados Chromium específicos del listado, sin fallos/omisiones/cancelaciones. Se amplía el checkpoint2 con un cobro histórico vinculado entre5.001 registros (enlace desde Deudas, página101, foco en la identidad correcta, sin editor ni escrituras) y cambios sucesivos de los cinco idiomas con la misma página y nodos. Se imprime realmente a PDF con Chromium: los eventos nativos observan1.000 filas antes de imprimir y50 después; se preserva el foco del selector. No se equipara este resultado a impresión nativa de una futura WebView.

La matriz completa incluye español/inglés/italiano/francés/portugués de Portugal ×390/768/1280×claro/oscuro. En30 superficies se comprobaron búsqueda global fuera de página, límites, teclado, Tab/Shift+Tab, atributos lang/ARIA, texto125%, ausencia de desbordamiento, datos literales intactos y axe WCAG2A/AA/2.1AA sin desactivar reglas. Cero violaciones automatizadas; no certifica lector de pantalla, gestos de dispositivos físicos ni todos los estados de contraste manual. La auditoría general preexistente y sus módulos permanecen en la batería completa pendiente.

Capturas actuales de la aplicación de producción,5.000 datos ficticios, no maquetas:

| Idioma,390px | Claro | Oscuro |
| --- | --- | --- |
| es-ES | [PNG](phase-5f-screenshots/es-390-light-ledger.png) | [PNG](phase-5f-screenshots/es-390-dark-ledger.png) |
| en-GB | [PNG](phase-5f-screenshots/en-390-light-ledger.png) | [PNG](phase-5f-screenshots/en-390-dark-ledger.png) |
| it-IT | [PNG](phase-5f-screenshots/it-390-light-ledger.png) | [PNG](phase-5f-screenshots/it-390-dark-ledger.png) |
| fr-FR | [PNG](phase-5f-screenshots/fr-390-light-ledger.png) | [PNG](phase-5f-screenshots/fr-390-dark-ledger.png) |
| pt-PT | [PNG](phase-5f-screenshots/pt-390-light-ledger.png) | [PNG](phase-5f-screenshots/pt-390-dark-ledger.png) |

Las capturas de la tabla se regeneraron con el cierre visual. El [manifiesto de fuentes/capturas](phase-5f-capture-manifest.json) conserva sus hashes; la imagen anterior del paginador corresponde a14c93b6. Los46 archivos protegidos, incluyendo configuración, lockfile y workflow, conservan sus hashes de540cfcf. No se alteran límites de CI, reglas de fallos ni axe.

## Cierre de defectos reproducidos

| ID | Caso reproducido | Corrección | Regresión |
| --- | --- | --- | --- |
| 5F-01 | Volver de una búsqueda recuperaba la página antigua | Sincronizar cursor y filtro | Matriz44/44 |
| 5F-02 | Paginador superior demasiado alto en390px | Controles superiores compactos, etiquetas accesibles completas,44px táctiles; ayuda completa en pie | Matriz44/44,axe0; [antes](phase-5f-screenshots/before-compact-fr-390-light-ledger.png)/[después](phase-5f-screenshots/fr-390-light-ledger.png) |
| 5F-03 | Getter de NetworkInformation restringido lanzaba dos errores al interactuar | Adaptador captura la excepción y mantiene navegación bajo demanda | Caso throwingNetwork, sin errores/escrituras |
| 5F-04 | Precarga competía con descarga explícita de un diccionario | Guardar también pendingLanguage desde el proveedor existente | Diccionario francés retenido:0peticiones Planning antes de liberarlo |
| Herramienta | clock.setFixedTime de Playwright devuelve deadline idle0ms | Mediciones nuevas con idle/rAF/timers nativos, fechas financieras fijas y reloj real registrado | Sonda:49,9ms nativo frente a0ms con clock; muestras anteriores excluidas |

El cierre pasa628/628 unitarias, lint/build,44/44 de listado y15/15 de precarga (dos casos nuevos). Los intentos que reproducen5F-03/04 se conservan en el [registro de intentos](phase-5f-validation-attempts.json), sin contarlos como aprobación. Las mediciones exploratorias concurrentes se usan solo para depurar las herramientas y no entran en las tablas comparativas finales.

## Foco en los extremos e impresión verificada

La prueba adicional de Tab/Enter en los extremos reprodujo5F-05: un botón enfocado que pasaba a disabled al llegar a la primera página enviaba el foco al body. Antes de cambiar a la primera/última página, se enfoca el selector nativo del mismo paginador con preventScroll. Se mantienen los botones realmente deshabilitados y la navegación Tab existente. La matriz se reejecuta con esta comprobación, sin reducir las aserciones previas.

El PDF ficticio de1.000 movimientos conserva85 páginas. Extracción local con pdftotext (herramienta ya instalada, no dependencia nueva):994 identificadores de conceptos sintéticos únicos de6 a999, sin omisiones ni extras; los seis registros originales de la fixture se comprueban aparte. Los eventos nativos observan1.000 filas antes y50 después, con foco y página restaurados. El PDF se conserva en los artefactos de navegador cuando CI_ARTIFACT_DIR está definido. No se certifica una impresora física ni la impresión de una WebView.

Una primera ejecución del recorrido adicional de rendimiento quedó incompleta en la consulta global del control de tema tras desplazar5.000 filas. Se acota la consulta automatizada a la cabecera; buscar nombres accesibles en15.000 botones no debe contabilizarse como latencia del producto. Se repite el recorrido completo con el mismo arnés antes/después. No se amplían límites ni se acepta aquella muestra parcial. Los informes comparativos finales se regeneran para el código con la corrección de foco.
