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
