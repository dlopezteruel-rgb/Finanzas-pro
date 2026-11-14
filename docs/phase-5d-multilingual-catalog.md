# Fase 5D — Catálogo multidioma y personalización segura

## Preparación

Base exacta: `0a155a81ac31a96f28d515f64502507c91773f30`, merge de PR #27 confirmado en GitHub y origin/main. No hay commits posteriores a esa referencia. Rama creada desde origin/main con árbol limpio: `feature/phase-5d-multilingual-catalog`. Se revisan las fases 5A/5B/5C y el inventario de 5C contra las constantes reales: **12 familias, 77 partidas y 31 subgrupos por tipo/código**. Se conservan todos sus identificadores.

Línea base recién ejecutada: npm ci (188 paquetes, sin cambios de lockfile), **528 unitarias**, **22 de infraestructura**, lint y build correctos. Referencia de navegador de 5C: **698 resultados en 35 suites**; no se presenta esa referencia como una nueva ejecución de 5D. La validación final de 5D deberá ejecutar íntegramente la batería con sus casos añadidos.

## Decisión de arquitectura, previa a implementar el modelo

No hay actualmente una procedencia fiable en los datos guardados: código, prefijo, nombre e igualdad con el catálogo inicial no demuestran ausencia de personalización. Un mapa solo en memoria pierde esa información al guardar/recargar. Una clave visual separada podría sobrevivir a una restauración financiera y aplicarse al catálogo equivocado, o fallar después de un guardado correcto. Tampoco viaja con las exportaciones. Por tanto se justifica un metadato mínimo dentro de la misma operación atómica del catálogo.

Se propone un campo opcional `catalogNames` con versión propia 1 y selecciones por identidad estable para familias, partidas y subgrupos. No guarda traducciones ni sustituye nombres. Las familias usan su código existente; partidas y subgrupos usan tipo + código para evitar colisiones Ingresos/Gastos. Solo una selección explícita válida junto al nombre canónico y la identidad conocida autoriza la presentación traducida; el resto conserva literalmente el nombre guardado.

El formato nuevo será **JSON 3.5**, sin introducir campos incompatibles en 2.5–3.4. Se amplía la validación/importación/exportación existente. La subida de formato se guarda mediante la copia recuperable verificada que FinanceStore ya exige para actualizaciones de esquema; se conservan sus Web Locks, revisión entre pestañas y protocolo de escritura. En carga heredada se evita heredar la procedencia de los defaults nuevos. Abrir un archivo anterior no añade metadata ni escribe.

Los defaults construidos expresamente por la aplicación nueva tienen procedencia conocida y pueden contener esa selección. Los catálogos anteriores/importados sin declaración no reciben una automáticamente, aunque coincidan exactamente con las constantes. Podrán revisar identidades compatibles y optar explícitamente por los nombres del sistema. La operación revisa su alcance dentro de la mutación bajo el bloqueo existente. Volver al nombre guardado retira únicamente la selección y es reversible sin cambiar datos históricos.

Renombrar una identidad retira su selección de nombre predeterminado en la misma operación. Un nombre que el usuario personalice hasta coincidir con el español inicial sigue siendo personal hasta otra elección explícita. Crear o duplicar no atribuye procedencia de sistema a la identidad nueva. Archivo, reactivación y movimientos de organización conservan las referencias y las protecciones actuales. Los subítems siguen siendo nombres personales; los subgrupos heredados se distinguen de la familia contenedora.

## Presentación e integridad

Se reutilizan I18nProvider, useI18n, diccionarios tipados y la preferencia existente. Las claves se basan en las identidades del registro inicial. Una resolución central de nombres se aplica en las fronteras de presentación; nunca se entrega un catálogo con nombres traducidos a FinanceStore, cálculos o parsers. Los nombres y documentos históricos que representen un registro original se conservan literalmente. Los fallbacks propios sin catálogo no mostrarán códigos técnicos; las notas o nombres del usuario con apariencia de código se conservan.

El editor distinguirá el borrador visible del nombre guardado: abrir o guardar sin cambiar el nombre no persistirá una traducción. Cambiar de idioma conserva los formularios pendientes y no genera ninguna escritura financiera. La búsqueda visual podrá consultar etiquetas traducidas sin ampliar el reconocimiento natural del asistente ni sus prompts/API.

## Checkpoints y validación prevista

1. Metadatos de procedencia/presentación, compatibilidad JSON 3.5, transición segura y pruebas de recuperación, sin cambiar cálculos.
2. Diccionarios completos de los cinco idiomas y resolución central, integración en catálogo y controles de edición.
3. Integración en todas las superficies, ocultación de códigos propios, pruebas de personalización/históricos y Chromium multidioma con fixtures.
4. Regresión completa, documentación y capturas reales; publicación de una única PR Draft y verificación de los tres checks de su SHA final.

Los checkpoints se publican para conservar el trabajo. Esta versión inicial del documento justifica la decisión; no declara terminada la implementación ni pruebas pendientes como aprobadas.

## Límites preservados

EUR y Europe/Madrid, importes e identidades, saldos, transferencias, préstamos, compartidos, aprobaciones, arrastres, automatizaciones y referencias de subítems. No se traducen datos personales con IA ni se llama a servicios de traducción. No se fusiona, despliega, sincroniza Google AI Studio ni modifica main o sus protecciones.

Los grupos axe incompletos clasificados en 5C siguen separados de las violaciones automatizadas. Se mantienen todas las reglas y las pruebas existentes. No se afirma prueba con lector de pantalla o dispositivo físico.

## Checkpoint 1 — Procedencia y recuperación

Implementados metadatos opcionales validados y JSON 3.5, revisión explícita con alcance, retirada de selección al personalizar y protección de carga heredada. No hay todavía integración visual en este checkpoint. Se añaden **26 pruebas**: registro 12/77/31, colisiones por tipo, ambigüedad, reversión, renombrado, duplicación, orden/archivo/traslado, datos malformados, round-trip, ausencia de escrituras de lectura, recuperación verificada, fallos de copia/verificación/escritura y conflicto entre pestañas. Resultado local: **554/554 unitarias**, cero omitidas/canceladas; lint, build y diff-check correctos. Permanece el aviso de tamaño de bundle anterior. La batería Chromium completa sigue pendiente de la integración de interfaz.

## Checkpoint 2 — Traducción y presentación

Implementadas **120 claves estables** (12 familias, 77 partidas y 31 subgrupos) en es-ES, en-GB, it-IT, fr-FR y pt-PT. Las traducciones conservan el significado original: las categorías que agrupan ahorro, financiación recibida o devolución de deuda no se reclasifican económicamente. IBI y Hacienda mantienen su referencia española, explicada en las otras lenguas; no se sustituyen por impuestos extranjeros. Los homógrafos nativos se revisan por clave en el registro de excepciones existente.

La resolución central consume los datos originales y la selección explícita. Un contexto de catálogo aporta esos datos a los controles, reutilizando íntegramente el proveedor i18n y los formatters existentes. Se conectan catálogo, editores, detalle/subítems, selectores, registro rápido, préstamos, planificación, automatizaciones, reglas periódicas, avisos de inicio, gráficos y presentación local del asistente. Los movimientos/compartidos y los nombres capturados de subítems aprobados conservan sus etiquetas documentales; tesorería muestra conceptos personales, sin una etiqueta de catálogo que traducir. No se modifica el parser, contexto enviado al servicio ni prompts/API.

El editor muestra el nombre de presentación, pero guardar sin tocarlo conserva el nombre original y su selección. Personalizarlo retira la selección atómicamente, incluso con la misma ortografía. La búsqueda de listas consulta las etiquetas traducidas sin cambiar los objetos seleccionados ni el reconocimiento natural. El diálogo de revisión empieza sin selecciones para datos ambiguos; ofrece las identidades compatibles con su nombre guardado y una previsualización traducida. Cancelar no escribe; confirmar revisa alcance y versión bajo el bloqueo existente.

Se corrigen dos superficies reproducibles de presentación: los fallbacks de gráfico de una previsión/fotografía sin identidad disponible mostraban el código; ahora muestran una etiqueta histórica genérica. Un nombre personal como «Partida orphan» continúa literal. La lista de movimientos recortaba el texto antes de dos puntos; ahora conserva la etiqueta documental completa. Se mantiene la comparación de identidades y valores en sus pruebas.

Validación de este checkpoint: **575/575 unitarias** (21 nuevas de presentación, además de las 26 de procedencia), lint y build correctos; regresión Chromium existente `customCatalog.browser.ts`: **6/6**, sin omisiones/cancelaciones. La nueva matriz específica y la batería completa siguen en ejecución/preparación; no se declara aún validación integral ni preparación para integración.

## Checkpoint 3 — Matriz específica y revisión visual

La suite nueva `multilingualCatalog.browser.ts` conserva las 35 suites anteriores y se añade como número 36. Su ejecución específica obtiene **43/43 resultados**, sin omitidos, cancelados ni pendientes: 30 combinaciones idioma/390–768–1280/tema, personalización en los cinco idiomas, elección/reversión de catálogo ambiguo, idioma entre pestañas con borrador abierto, fallos de copia/verificación/escritura, pestaña obsoleta y exportación/restauración 3.4/3.5. Se comprueban las colecciones económicas y las fotografías originales, además de las etiquetas. El detector de códigos inspecciona texto visible, ARIA, títulos y ayudas; permite únicamente los nombres personales ficticios declarados que contienen esos mismos caracteres.

Se hacen **60 observaciones axe estrictas** en los diálogos nuevos y detalles de partidas, con cero violaciones en esta ejecución específica. Los resultados incompletos se conservan íntegros para revisión y no se presentan como aprobaciones manuales. No se cambian reglas, tiempos de espera ni el workflow.

La revisión real de la interfaz detectó que los estilos del editor estiraban la casilla del diálogo nuevo a **306 × 13 px**, con el texto en otra fila. Se limita el cambio a `.catalog-name-review`: casilla 18 × 18 px y etiqueta flexible con área mínima de 44 px. La matriz comprueba esas dimensiones, foco y Escape en las 30 combinaciones, además de axe y desbordamiento.

Se añade una guarda defensiva para identidades duplicadas: no se ofrecen como nombres de sistema y se mantiene el rechazo de importación existente, sin corregir ni consolidar automáticamente datos malformados. Resultado unitario actual: **576/576**; infraestructura **22/22**, lint y diff-check correctos. La regresión integral fresca de las 36 suites se ejecuta a continuación; su resultado se registrará separadamente.

## Inventario y cobertura

El [inventario de las 120 identidades](phase-5d-catalogue-inventory.json) contiene tipo, identidad, clave y texto en cada variante regional. No se emplean posiciones de array, prefijos aproximados ni sustituciones globales. Los cinco diccionarios siguen habilitados y completos; la referencia española y el resto suman 2034 claves cada uno tras esta fase.

| Superficie | Presentación actual | Datos conservados literalmente / cobertura |
| --- | --- | --- |
| Catálogo y familias | Resolver central de familia/partida | 30 combinaciones; gestión, ARIA, drag y destinos; IDs originales |
| Editor de familias/partidas | Nombre visible separado de intención de edición | Cinco idiomas; crear/renombrar; borradores entre pestañas; guardar sin edición no personaliza |
| Subítems y detalle | Padre y subgrupo localizados; subítems personales | Nombres de subítems originales y fotografías; detalle/teclado/axe en 30 combinaciones |
| Selectores de movimiento y préstamo | Familia, partida y subgrupo por identidad | El valor seleccionado conserva tipo/código; registros previos y parsers intactos |
| Registro rápido y propuestas | Opciones/etiqueta de categoría actuales | Texto libre, conceptos, reconocimiento en español, confirmación y payload originales |
| Movimientos | Etiquetas documentales completas | No se recortan por dos puntos; regresión específica en los cinco idiomas |
| Planificación y presupuestos | Familia y partida actuales; campos monetarios originales | Ninguna traducción vuelve a un parser; aprobaciones, revisiones y céntimos inalterados |
| Automatizaciones | Partida actual de selector/regla/previsualización | Nombre personal de regla y procedencia original; montos y peticiones sin traducir |
| Reglas periódicas | Partida actual, con fallback al nombre guardado si falta | Concepto, identidad de regla y ocurrencias sin cambios |
| Tesorería/calendario | Conservan su presentación i18n anterior | Muestran conceptos de eventos, no una etiqueta propia de catálogo que sustituir; cálculos sin cambios |
| Gráficos/leyendas | Familias y partidas actuales en sus adaptadores visuales | IDs y series exactos; fallbacks propios sin código; nombres personales parecidos a códigos intactos |
| Aprobaciones/fotografías | Encabezados por identidad actual cuando no existe nombre documental | Los nombres capturados de subítems y el contenido original de los registros se mantienen; no se reconstruyen fotografías |
| Asistente | Nombres actuales del catálogo en presentación local con procedencia explícita | Reconocimiento, prompts, contexto del servicio, API y respuestas externas sin sustituciones |
| Contactos/compartidos/liquidaciones | Mantienen etiquetas del movimiento original | Los agregados conservan la clasificación documental, relaciones, reintegros y reparto en céntimos |

| Idioma | Familias | Partidas | Subgrupos | Personalización literal | Navegador |
| --- | ---: | ---: | ---: | --- | --- |
| es-ES | 12/12 | 77/77 | 31/31 | Sí | 390, 768, 1280; claro/oscuro |
| en-GB | 12/12 | 77/77 | 31/31 | Sí | 390, 768, 1280; claro/oscuro |
| it-IT | 12/12 | 77/77 | 31/31 | Sí | 390, 768, 1280; claro/oscuro |
| fr-FR | 12/12 | 77/77 | 31/31 | Sí | 390, 768, 1280; claro/oscuro |
| pt-PT | 12/12 | 77/77 | 31/31 | Sí | 390, 768, 1280; claro/oscuro |

## Procedencia, personalización y límites deliberados

- Un perfil nuevo construido por la aplicación declara los nombres iniciales de sistema. Un perfil antiguo, una clave heredada, un archivo 2.5–3.4 o datos sin declaración válida conserva los nombres guardados. No se atribuye procedencia por coincidencia de nombre/código.
- JSON 3.5 transporta la declaración explícita y la valida contra identidades únicas y nombres canónicos. La versión 3.4 rechaza el campo nuevo. Los formatos anteriores mantienen sus validaciones; no se normalizan duplicados, referencias o nombres malformados para abrirlos.
- Crear y duplicar producen nombres personales. Renombrar retira solo la elección correspondiente. Una descripción o palabra clave editada sin cambiar el nombre conserva esa elección. Una modificación directa incompatible se rechaza antes de guardar.
- La revisión puede activar o retirar la presentación de identidades compatibles no retiradas, incluidas las archivadas. Las declaraciones de identidades retiradas se conservan; no se ofrecen como elementos reactivables ni se reutilizan sus códigos.
- No se ofrece un botón que sobrescriba un nombre personal distinto con el español inicial. Para identificarlo como nombre original se requiere una acción consciente de renombrado y posterior revisión. La elección de presentación no reescribe el texto guardado.
- Los subgrupos heredados son campos compartidos `groupCode/groupName`, no familias independientes ni subítems. Se traducen solo por su declaración específica, manteniendo la diferencia respecto a la familia contenedora actual.
- Los nombres guardados en el diálogo de revisión aparecen en su idioma original como evidencia de la elección. Los nombres de movimientos, conceptos, notas, contactos, cuentas, reglas personales y subítems históricos son datos documentales. Esa presencia deliberada de español no es una cadena de interfaz sin traducir.
- Los textos libres y palabras clave del catálogo mantienen su contenido; no se amplía el reconocimiento natural a otros idiomas. La clasificación sigue usando el catálogo original y los mismos IDs.

## Restricciones de edición investigadas

Se reproducen creación y renombrado de familias y partidas, con nombre predeterminado y personal, sin una prohibición especial por pertenecer al registro inicial. Los controles de gestión están dentro del desplegable «Gestionar familias y partidas» en la pestaña de Catálogo; se comprueba su acceso con nombres nativos y teclado.

La eliminación de una familia requiere que no tenga partidas ni históricos dependientes. Una partida con movimientos, previsiones, identidades de subítems, aprobaciones, préstamos, reglas, orígenes o arrastres debe archivarse. Estas dependencias incluyen registros pendientes/inactivos o retirados según las reglas existentes; no se borran para habilitar un botón. Crear una partida requiere una familia activa. Los cambios de catálogo siguen bloqueados si hay un borrador de planificación pendiente. Los errores y confirmaciones existentes continúan localizados en los cinco idiomas.

El archivo con reglas activas sigue exigiendo la revisión de consecuencias y confirmación explícita, con revalidación bajo FinanceStore. No se desactiva ni reasigna ninguna regla. Los traslados continúan restringidos al mismo tipo económico. No se ha reproducido un bloqueo adicional de renombrado/creación por ser una familia inicial. Sin una identidad y pasos concretos de un caso adicional, no se elimina ninguna protección financiera.

## Capturas comparativas

Las [18 capturas reales](phase-5d-capture-manifest.json) proceden de dos compilaciones separadas: base 5C y código de 5D, con fixtures sintéticos iguales. El manifiesto verifica hashes de las imágenes y de los datos de cada par, incluidos los timestamps de aprobación. Se añade únicamente la selección de nombres en el escenario posterior; las etiquetas e importes guardados coinciden. No son imágenes generadas ni datos de Google AI Studio.

| Vista | Antes | Después |
| --- | --- | --- |
| Inglés, móvil 390, claro | [5C](phase-5d-screenshots/catalog-en-390-light-before.png) | [5D](phase-5d-screenshots/catalog-en-390-light-after.png) |
| Francés, tablet 768, oscuro | [5C](phase-5d-screenshots/catalog-fr-768-dark-before.png) | [5D](phase-5d-screenshots/catalog-fr-768-dark-after.png) |
| Portugués, escritorio 1280, claro | [5C](phase-5d-screenshots/catalog-pt-1280-light-before.png) | [5D](phase-5d-screenshots/catalog-pt-1280-light-after.png) |

Se revisan visualmente el catálogo móvil en inglés y el diálogo portugués de escritorio oscuro, además de las comprobaciones geométricas/teclado automatizadas. La matriz automatizada cubre ambos temas y los tres anchos; no se presenta la inspección de unas capturas como revisión humana exhaustiva de todos los estados. No hay prueba con lector de pantalla ni dispositivo físico.

## Tamaño y entorno

Node 24.22.1, playwright-core 1.64.1, axe-core 4.14.0 y Chromium local 156.0.8078.79. La compilación de referencia y la actual usan el mismo lockfile. Se conservan los avisos de chunks superiores a 500 kB: entrada 1132,49 → 1181,07 kB minificados (310,02 → 323,98 kB gzip); App 514,93 → 532,66 kB (130,57 → 134,65 kB gzip). No se añade una dependencia ni una refactorización de carga diferida.

La primera reinstalación final falló porque npm intentó escribir en la caché inaccesible `/home/agent/.npm`. Se repitió `npm ci` con `NPM_CONFIG_CACHE=/workspace/work/npm-cache`: 188 paquetes instalados correctamente, sin modificar el lockfile. Se conserva la advertencia de deprecación de `node-domexception@1.0.0`; no se oculta ni actualiza una dependencia fuera del alcance.

## Corrección adicional — Recibo del registro rápido

Se detectó un aviso posterior al guardado que conservaba `matched.name` sin identidad, mostrando una categoría inicial en español dentro de una confirmación nativa. La prueba nueva `catalogQuickReceipt.browser.ts` reproduce el fallo antes de corregir: el caso español pasa y fallan los cuatro idiomas extranjeros (el contenedor también cuenta como resultado fallido). Se corrige exclusivamente el estado de presentación del recibo: retiene tipo/código y resuelve el nombre al renderizar. El movimiento conserva los campos originales, sin traducirlos.

Resultado específico posterior: **6/6**, sin omitidos/cancelados. Se añade como suite 37, manteniendo las 35 originales y la matriz 5D de 43 resultados. La ejecución integral anterior se interrumpió deliberadamente con **30 suites/524 resultados aprobados**, antes de su finalización; su salida 130 y los estados `not_executed` se conservan y no se consideran éxito global. Se reinicia la batería íntegra contra la corrección.

Las cuatro pruebas adicionales de JSON 3.5 cubren la subida respaldada y la restauración con transferencias/repartos/reintegros, arrastres/fotografías/préstamos, subítems/reglas activas y compromisos personales/cartera predeterminada. Junto a las cinco regresiones del nombre documental con dos puntos, el total unitario actual es **585/585**, con todas las pruebas originales conservadas. El script de capturas verifica también igualdad de los datos de cada par, incluidos los timestamps de aprobación.

## GitHub Actions: ejecución completa del código y las pruebas

[Ejecución 43621981501](https://github.com/dlopezteruel-rgb/Finanzas-pro/actions/runs/43621981501), evento `pull_request`, SHA **c4c98c152158f7e1406212e80bf084cebda9cc76**. Los tres trabajos han terminado con `success`. Los ZIP descargados de Unitarias, Código y Chromium coinciden con sus SHA-256 publicados por GitHub; sus identificadores/digests, comandos y estados por suite están en [resultados remotos](phase-5d-ci-results.json).

| Trabajo | Resultado remoto verificado |
| --- | --- |
| Unitarias | **585/585** y **22/22** de infraestructura; cero fallos, omisiones, cancelaciones o pendientes |
| Lint, build y diff | Correctos; diff real de la PR contra su base, sin rebajar comprobaciones |
| Chromium y axe | **747/747 resultados en 37 suites**; cero fallos, omisiones, cancelaciones o pendientes |

Se comparan las 35 suites anteriores una a una: conservan sus **698 resultados**. Se añaden **43** de catálogo y **6** de recibos, contando los contenedores node:test igual que la referencia. El comando completo de navegador dura **1974,583 s (32 min 54,583 s)**, incluido su build.

Entorno remoto real: ubuntu-24.04 (`ubuntu24`), imagen **20261111.127.1**, Node **24.22.1**, playwright-core **1.64.1**, Chrome for Testing **156.0.8078.4**, revisión **1248**. El ejecutable se resuelve mediante el script existente; no se presupone `/usr/bin/chromium` en Actions. No se modifica el workflow, sus permisos, tiempos, dependencias ni protecciones.

La ejecución previa [43619336978](https://github.com/dlopezteruel-rgb/Finanzas-pro/actions/runs/43619336978), SHA 1717416, fue cancelada por la concurrencia configurada al publicar la corrección del recibo. No se presenta como aprobación integral. El [registro de intentos](phase-5d-validation-attempts.json) diferencia esa cancelación, la interrupción local, los borradores de pruebas y la regresión real corregida.

El commit documental de entrega vuelve a activar los tres checks de la PR. La URL y el estado del SHA exacto final se registran en la descripción y checks de [PR Draft #28](https://github.com/dlopezteruel-rgb/Finanzas-pro/pull/28); esta tabla fija la ejecución completa del checkpoint de aplicación/pruebas, cuyo código queda congelado durante la documentación.

## Accesibilidad: violaciones y resultados incompletos

El [informe remoto agrupado](phase-5d-axe-ci.json) conserva **1462 observaciones registradas, cero violaciones y 944 grupos incompletos en 51 conjuntos equivalentes**. Las aserciones axe adicionales de las suites anteriores siguen ejecutándose; 1462 describe los registros JSON, no todas las llamadas al motor.

| Área | Observaciones | Violaciones | Grupos incompletos remotos |
| --- | ---: | ---: | ---: |
| Auditoría general | 128 | 0 | 40 |
| Matrices anteriores | 1217 | 0 | 885 |
| Landing | 57 | 0 | 7 |
| Catálogo 5D | 60 | 0 | 12 |

Los 944 grupos son **943 de contraste y uno `controlsWithinPopup`**, con **5763 ocurrencias de nodo/check**, no 944 defectos distintos. Se mantiene la clasificación de [5C](phase-5c-multilingual-stabilization.md) y sus referencias a los 136 + 1527 grupos históricos de 5B. No se cierra automáticamente un pendiente porque deje de aparecer en una ejecución o cambie su cardinalidad entre navegadores.

Los nuevos incompletos se concentran en un conjunto de contraste del detalle de partida, con mecanismo `elmPartiallyObscuring`: 12 grupos/28 nodos en CI. En la ejecución específica local se registraron 10 grupos/22 nodos; la tabla local definitiva se informa por separado. El motor no pudo determinar un fondo al considerar un solapamiento parcial; eso no es una infracción automática ni prueba de contraste correcto.

Se inspeccionó una [captura real adicional](phase-5d-screenshots/detail-es-390-light-review.png) y su [DOM/estilos nativos](phase-5d-detail-review.json), **español/390 px/claro**. El texto del paquete se ve completo en ese estado; la pila del punto central lleva al fondo blanco del panel. Su color calculado `rgb(90,100,114)`, tamaño 12 px y fondo blanco producen **5,999:1**. Esta comprobación representativa no da por revisados los demás estados, ni equivale a una prueba con lector de pantalla o dispositivo físico. Los conjuntos siguen etiquetados `manual-review-required`.

## Integridad y pendientes

Los [40 archivos protegidos](phase-5d-protected-files.json) son idénticos byte a byte a la base, incluidos cálculos, transferencias, compartidos, préstamos/compromisos, planificación/aprobaciones, parsers, API/prompt del asistente, catálogo original, lockfile, Vite y workflow. Se verifican además como idénticos los bloques existentes de mutación/Web Locks/revisión de FinanceStore y el protocolo de restauración. La única modificación de carga de FinanceStore evita heredar procedencia de defaults en perfiles antiguos; los cambios de formato y metadatos se justificaron antes del código.

Pendientes deliberados: revisión contextual de contraste y `controlsWithinPopup`; evaluación con lectores de pantalla/dispositivos físicos y otros motores; aviso de bundles grandes; catálogo antiguo de procedencia ambigua literal hasta elección explícita; reconocimiento natural existente en español. No se cambia el significado económico del catálogo ni se añaden capacidades de IA.

Sin fusión, despliegue, sincronización con Google AI Studio, cambios de main ni de sus protecciones.

## Validación local completa posterior a la corrección

[Resultados locales y recuentos por suite](phase-5d-local-results.json), código y pruebas **c4c98c152158f7e1406212e80bf084cebda9cc76**. No hay cambios de aplicación/pruebas durante el cierre documental.

| Comprobación | Resultado local real |
| --- | --- |
| npm ci | 188 paquetes; caché del workspace; lockfile intacto |
| npm test | **585/585**, 0 fallos/omisiones/cancelaciones/pendientes |
| Infraestructura CI | **22/22**, 0 fallos/omisiones/cancelaciones/pendientes |
| npm run lint | Correcto, 0 errores TypeScript |
| npm run build | Correcto; se conserva el aviso de chunks >500 kB |
| npm run test:ui | **747/747 resultados en 37 suites**, 0 fallos/omisiones/cancelaciones/pendientes |
| git diff --check y origin/main...HEAD --check | Correctos |

El comando de navegador completo dura **2309,668 s (38 min 29,668 s)**, incluido su build. Los 698 resultados de las 35 suites anteriores se comparan individualmente con la referencia real de 5C, sin sustituirla por cifras asumidas. Las pruebas nuevas suman **57 unitarias y 49 resultados Chromium**.

| Área axe local | Observaciones | Violaciones | Grupos incompletos |
| --- | ---: | ---: | ---: |
| General | 128 | 0 | 36 |
| Matrices anteriores | 1217 | 0 | 853 |
| Landing | 57 | 0 | 7 |
| Catálogo 5D | 60 | 0 | 10 |

El [agrupado local](phase-5d-axe-local.json) contiene **1462 observaciones, 0 violaciones y 906 grupos incompletos en 49 conjuntos equivalentes**, con 5517 ocurrencias de nodo/check. Son 905 grupos de contraste y uno `controlsWithinPopup`. CI conserva sus cifras diferentes (**944 grupos/51 conjuntos**); los dos entornos ejecutan las mismas 1462 observaciones y 37 suites completas. No se interpreta la diferencia de clasificación/renderizado como omisión de pruebas ni se presenta ningún incompleto como aprobado automáticamente.

Reproducción con el entorno utilizado:

```bash
NPM_CONFIG_CACHE=/workspace/work/npm-cache npm ci
npm test
npm run lint
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:ui
node scripts/ci/run-check.mjs tools
git diff --check
git diff origin/main...HEAD --check
```

La variable de caché es una adaptación del sandbox local, no un requisito del producto ni un cambio de dependencias. Actions instala su navegador fijado mediante playwright-core y establece su ruta real. La captura comparativa utiliza `scripts/multilingualCatalogCapture.ts <dist-base-5C>` contra una compilación separada del commit original; el manifiesto fija los hashes y el SHA del código posterior.

La [relación completa de los 78 archivos modificados](phase-5d-modified-files.txt) permite revisar código, pruebas, inventarios y las 19 imágenes (18 comparativas/de revisión reproducibles y una inspección adicional del detalle). Los informes originales de ejecución están en los artefactos de Actions con su retención existente de siete días; los agrupados con referencias, ejemplos, mecanismos y hashes se conservan en el repositorio.
