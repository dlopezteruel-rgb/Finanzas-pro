# Reconstrucción del catálogo personalizable

Repositorio `dlopezteruel-rgb/Finanzas-pro`. Base obligatoria: `main` en `565c0b1dc006ec15bb205dda4ceb3c9e3d6e6cc8` (PR #21 integrada). Rama `feature/custom-budget-catalog-rebuild`. El directorio reconstruido es independiente de `/workspace/work/Finanzas-custom-catalog`, cuyo almacenamiento no está disponible en esta sesión. Su ausencia no prueba su eliminación. Si reaparece, comparar antes de incorporar cambios.

## Checkpoint A: interfaz y navegación

- Contactos comparte el relleno interior semántico del Catálogo: superficie al 96 % mezclada con el color de texto. Las tarjetas de historial usan la superficie normal, y las acciones de liquidación pueden pasar a otra línea sin partir palabras.
- Las casillas de series miden 19 × 19 px dentro de etiquetas de al menos 44 px de alto. Las leyendas separan muestra de color y nombre; las tablas conservan desplazamiento horizontal propio. En gráficos de más de cuatro series se activan inicialmente las tres primeras; el resto se puede activar individualmente.
- Planificación conserva el encabezado, mes, ahorro, balance, totales, guardado y aprobación arriba. Desde 768 px, Multiperiodo aparece antes de las pestañas Gastos/Ingresos; en móvil es una tercera pestaña. El bloque multiperiodo se puede plegar.
- Existe un único estado de borrador. Los paneles permanecen montados al cambiar de área o tamaño de ventana; todas las partidas, incluidas las ocultas, participan en validación y aprobación. Una pestaña con errores muestra «Revisar importes». Flechas, Inicio y Fin mueven el foco; Enter/Espacio activan la pestaña.
- El catálogo, detalle, selector y comparación muestran nombres en lugar de códigos. Los códigos técnicos siguen siendo las identidades y valores internos de los controles. No se añade un modo profesional ni una preferencia de presentación al respaldo.
- Esta etapa no modifica tipos financieros, FinanceStore, reglas contables ni versiones JSON. La gestión del catálogo y JSON 3.4 corresponde a B; arrastre a C; clasificación del catálogo personalizado y cierre completo a D.

## Validación y reproducción

La base se comprobó con árbol limpio antes de crear la rama. `npm ci --cache /workspace/work/npm-cache` instaló 187 paquetes sin cambiar el lockfile. La primera instalación falló porque la caché predeterminada no era escribible; se solucionó usando una caché dentro del workspace.

Referencia ejecutada de nuevo en la base: 335 unitarias y 234 resultados Chromium, sin fallos ni omisiones; lint, build y diff-check correctos. Las cifras de la ejecución perdida no se usan como evidencia.

La suite `scripts/catalogPresentation.browser.ts` prueba 390/768/1280 px y ambos temas con fixtures, reloj fijo y solicitudes externas bloqueadas. Comprueba pestañas, foco, errores en el panel oculto, borrador tras redimensionar, dimensiones táctiles/casillas, selección de series, contraste, superficies de Contactos y ausencia de escrituras por consultar. Se conserva y adapta la batería anterior a las nuevas pestañas y etiquetas, manteniendo las comprobaciones financieras.

Comando focalizado: `npm run test:ui:catalog-presentation`. `CATALOG_PRESENTATION_ARTIFACT_DIR` permite capturas reales con los datos ficticios de la suite. La batería completa sigue siendo `CHROMIUM_PATH=/usr/bin/chromium npm run test:ui`.

Los recuentos del checkpoint se registran en `custom-budget-catalog-rebuild-validation.json`. Las capturas definitivas del conjunto, documentación de JSON 3.4 y PR Draft se preparan al cerrar D.

Límites: pruebas automatizadas en Chromium; dispositivos físicos, Safari/Firefox y lectores de pantalla requieren revisión manual. No hay fusión, despliegue ni sincronización de Google AI Studio.

## Checkpoint B: modelo y gestión del catálogo

A quedó publicado en `6125ef4fa9d9f95f61fd10d5af5797f052bd9447` antes de comenzar B.

### Identidades y estados

Se conserva `BudgetGroup.code` como identidad del contenedor y `BudgetPartida.type + code` como identidad de partida. No se interpreta `groupCode` como identidad del contenedor: los catálogos heredados pueden usar allí un subgrupo, por ejemplo `F.003` dentro de `F_EXP`. Renombrar una familia no normaliza esos campos históricos; mover una partida cambia únicamente su organización en el catálogo. Las etiquetas guardadas en movimientos, los importes y las fotografías aprobadas permanecen intactos.

Familias y partidas admiten `archived?: boolean` y `deleted?: true`. Ausencia equivale al comportamiento anterior. Retirar crea un tombstone archivado, conservado en JSON, y nunca libera su código. Una familia solo se retira sin partidas vivas; una partida solo sin referencias de movimientos, préstamos, subítems (también retirados), planes, aprobaciones vigentes o históricas, arrastres, reglas y procedencias. El tipo principal es inmutable. El archivo del contenedor excluye todas sus partidas de nuevas opciones, sin cambiar el estado individual de cada hija.

Las identidades nuevas se generan en la interfaz con `crypto.randomUUID()`, usando los espacios `family-…` y `partida-…`. Las colisiones y códigos usados por históricos también se rechazan en el dominio. La duplicación conserva el mecanismo previo de códigos únicos y da IDs nuevos a los subítems activos; no copia operaciones, cantidades mensuales ni aprobaciones. Las ordenaciones omiten tombstones.

### Interfaz y límites del guardado

En Catálogo, «Gestionar familias y partidas» permite crear, editar metadatos, archivar/reactivar, ordenar familias y confirmar eliminaciones. Los controles de traslado, duplicación y orden de partidas del catálogo siguen disponibles. Los diálogos conservan los campos ante un fallo y solo se cierran tras persistir. Una eliminación muestra sus bloqueos y se comprueba otra vez bajo el lock al confirmar.

`FinanceStore.mutate` verifica identidades, estados, dependencias y nuevas asignaciones, también si una mutación elude el formulario. Los movimientos existentes pueden conservar su partida archivada al editarse; no se pueden asignar nuevos movimientos o previsiones a una partida o familia archivada. Las previsiones archivadas del periodo continúan consultables y sus cantidades se muestran de solo lectura. La integración completa de la interpretación de texto con el catálogo activo corresponde a D.

### JSON 3.4 y recuperación

Solo se exporta 3.4 cuando existen los nuevos campos de estado. Abrir, navegar o consultar formatos 2.5–3.3 no añade esos campos ni escribe datos. Al introducirlos por primera vez, el cambio de versión activa el procedimiento existente: escribir la copia completa anterior, releerla y verificarla antes de escribir el estado nuevo. Se conservan la clave de datos, Web Locks, detección de revisión obsoleta y el guardado atómico. Un fallo de copia, verificación o escritura activa conserva el estado financiero anterior y permite reintentar.

Las validaciones de 3.4 incluyen las capacidades de 3.3 y anteriores (subítems, cartera predeterminada, reglas, préstamos, compartidos, arrastres y fotografías); los estados nuevos se rechazan bajo etiquetas de versión antiguas. Para volver a una aplicación anterior se restaura la copia completa anterior; no se rebaja manualmente la etiqueta ni se mezclan colecciones.

Pruebas nuevas: `src/utils/budgetCatalog.test.ts` y `scripts/customCatalog.browser.ts`. Comando focalizado: `npm run test:ui:custom-catalog`. El informe de B se conserva separado del informe publicado en A.

## Checkpoint C: arrastrar y soltar

B quedó publicado en `d472a9b7808152022ed7a5bdd206ffdbd21991bc` antes de comenzar C. Se mantiene JSON 3.4 sin añadir entidades financieras.

Las asas `GripVertical` aparecen junto a familias, partidas y subítems. Solo las asas interceptan el puntero y desactivan el gesto de desplazamiento; el resto de la pantalla conserva el scroll táctil normal. Se usan eventos de puntero y captura, con un umbral de 6 px antes de iniciar, cursor grab/grabbing, previsualización flotante y destinos con línea de inserción. Los finales de lista tienen destino propio. El desplazamiento automático funciona en la ventana y en contenedores con scroll, incluidos los diálogos de subítems.

Con teclado: enfocar un asa, Espacio/Enter para iniciar, flechas o Inicio/Fin para recorrer los destinos válidos, Enter para confirmar y Escape para cancelar. Se anuncian el elemento, destino y resultado; el foco vuelve al asa tras el guardado. Se conservan los botones anteriores de subir/bajar y el formulario de traslado como alternativa.

`applyCatalogReorder` valida tipo, origen, destino, estado y una fotografía del catálogo capturada al iniciar. Las familias se ordenan únicamente en su tipo; las partidas solo se trasladan a familias activas del mismo tipo; los subítems nunca cambian de padre. Una vista obsoleta se rechaza. El orden se escribe una sola vez con `FinanceStore.mutate`; no hay orden optimista ni pasos parciales. Cancelación, pérdida del puntero, destino inválido o fallo de guardado conservan el orden persistido. Las identidades, subítems mensuales, fotografías, importes y movimientos no se reescriben.

Pruebas: `src/utils/catalogReorder.test.ts` y `scripts/catalogReorder.browser.ts`. Se usan eventos reales de ratón, CDP touchStart/touchMove/touchEnd en Chromium, teclado, recarga, cuota, reintento, conflicto entre pestañas, archivo del destino y desplazamiento automático. Las pruebas táctiles automatizadas no equivalen a una revisión de dispositivos físicos. Comando focalizado: `npm run test:ui:catalog-reorder`.


## Checkpoint D: integración y cierre

C quedó publicado en `1f0e32ef5dba12ff8208ca8c480831670bf493d2` antes de comenzar D. Los commits de A, B y C se conservan sin reescribirlos.

### Clasificación con el catálogo real

`classificationCatalog` deriva las opciones activas de las familias y partidas actuales. Conserva la distinción entre contenedor y subgrupo heredado; solo utiliza el nombre actual de la familia como contexto cuando ambos representan el mismo nivel. `parser.ts` recibe esas opciones: normaliza acentos, busca nombres y palabras clave completas y deja la clasificación vacía cuando falta evidencia o hay empate. No utiliza el listado estático ni elige la primera partida como reserva. El parser monetario y de fechas mantiene sus limitaciones anteriores; se debe revisar la propuesta.

El registro rápido permite corregir tipo y partida antes de confirmar. Una selección manual pertenece al texto actual y se invalida al cambiarlo. Chat conserva la intención, negaciones y confirmación explícita, pero abre la propuesta sin partida cuando no hay coincidencia fiable. El formulario manual nuevo comienza sin partida, salvo que se abra desde un contexto de partida activo. En todos los casos, guardar requiere una opción válida. No se asigna automáticamente un subítem.

`PartidaSelector` y las búsquedas resuelven las opciones desde el catálogo real. Los nombres visibles sustituyen códigos también en préstamos, periódicos, arrastres, listas de movimientos y resúmenes. Los valores internos y referencias permanecen intactos. Un movimiento existente con partida archivada o ausente conserva su código y etiquetas históricas al editar otros campos; no se reclasifica al abrirlo. Las nuevas opciones excluyen la partida y también sus hijas si se archiva la familia.

El endpoint `/api/parse-movement` acepta `budgetGroups` y aplica el mismo parser local sobre el catálogo validado; no envía la clasificación a Gemini. Sin catálogo devuelve el fallback existente, y un catálogo o fecha inválidos se rechazan. `/api/assistant-chat` conserva su flujo de asesoramiento.

### Integración y protecciones económicas

Se comprueban nuevas asignaciones bajo `FinanceStore.mutate`, además de los formularios. Préstamos y sus nuevas cuotas requieren una partida activa; las cuotas nuevas resuelven nombres actuales sin reescribir las antiguas. Periódicos y automatizaciones no generan registros o previsiones sobre partidas archivadas; sus reglas y resultados anteriores siguen consultables. Los periódicos nuevos guardan las etiquetas actuales. El archivo impide crear subítems y previsiones nuevas desde el detalle sin retirar históricos, cantidades mensuales, aprobaciones ni arrastres anteriores.

Las transferencias, reintegros y liquidaciones mantienen sus relaciones y reglas específicas. Las regresiones conservan los oráculos económicos de saldos, patrimonio, compartidos, préstamos, subítems, fotografías, importaciones, copia verificada, cuota, conflictos, dependencias y eliminación. Los fixtures antiguos de navegador ahora eligen su partida explícitamente para comprobar esas mismas operaciones sin depender de una categoría inicial implícita. En el primer intento completo de D fallaron dos casos de subítems (móvil/escritorio) que todavía esperaban la atribución automática del registro rápido; se corrigió su preparación para elegir partida antes de subítem, conservando sus comprobaciones de persistencia e identidades. Las suites posteriores a ese fallo no se contaron como ejecutadas hasta la repetición completa.

D también completa la cancelación de arrastre con Escape aunque el foco haya salido del asa, el cursor global durante el gesto, la etiqueta de destino y la distribución móvil de nombres y totales. Se prueban estas mejoras junto con las garantías de C; no cambian su esquema ni sus identidades.

### Reproducción y evidencia

```sh
npm ci
npm test
npm run lint
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:ui
git diff origin/main...HEAD --check
CHROMIUM_PATH=/usr/bin/chromium npm run capture:custom-catalog
```

En este entorno se utiliza `npm ci --cache /workspace/work/npm-cache` porque la caché de HOME no es escribible. La instalación reproducible conserva `package-lock.json`. Las pruebas Chromium usan perfiles aislados, fixtures y bloqueos de servicios externos; las respuestas de asesoramiento se simulan, sin consumir Gemini. Las pruebas de rutas verifican Express real, modo desarrollo/producción y base raíz/prefijo.

Resultado al cerrar el checkpoint D, ejecutado el 12 de noviembre de 2026: **389 unitarias y 262 resultados Chromium** (245 casos y 17 contenedores), sin fallos, omisiones ni cancelaciones. `npm ci` instaló 187 paquetes; lint, build y diff-check finalizaron correctamente. Node 24.22.1, npm 11.9.0, Chromium 156.0.8078.79 y Playwright Core 1.64.1.

El [informe final](custom-budget-catalog-rebuild-final-validation.json) registra comandos, resultados actuales, recuentos por suite, hashes de fuentes, inventario de archivos modificados y limitaciones. Los informes A/B/C permanecen separados como evidencia de cada checkpoint. Las pruebas nuevas de D están en `src/utils/catalogClassification.test.ts` y `scripts/catalogClassification.browser.ts`; la prueba focalizada es `npm run test:ui:catalog-classification`.

### Capturas reales con datos ficticios

Son 60 imágenes: diez superficies en 390 × 844, 768 × 1000 y 1280 × 1000, en claro y oscuro. Cubren planificación general, Gastos, Ingresos, Multiperiodo, gráficos, catálogo, editor, arrastre y Contactos saldados/pendientes. Se fijan reloj, idioma y zona horaria; no se utilizan datos personales ni el almacenamiento del navegador del usuario. Se verifica que consultar y cancelar no modifica el snapshot financiero, sin errores de consola ni solicitudes externas. El [manifiesto](assets/custom-budget-catalog/manifest.json) incluye dimensiones, tema, tamaño y SHA-256 de cada imagen.

| Superficie | Móvil claro / oscuro | Tablet claro / oscuro | Escritorio claro / oscuro |
| --- | --- | --- | --- |
| Planificación | [claro](assets/custom-budget-catalog/390-light-planificacion.jpg) · [oscuro](assets/custom-budget-catalog/390-dark-planificacion.jpg) | [claro](assets/custom-budget-catalog/768-light-planificacion.jpg) · [oscuro](assets/custom-budget-catalog/768-dark-planificacion.jpg) | [claro](assets/custom-budget-catalog/1280-light-planificacion.jpg) · [oscuro](assets/custom-budget-catalog/1280-dark-planificacion.jpg) |
| Gráficos | [claro](assets/custom-budget-catalog/390-light-graficos.jpg) · [oscuro](assets/custom-budget-catalog/390-dark-graficos.jpg) | [claro](assets/custom-budget-catalog/768-light-graficos.jpg) · [oscuro](assets/custom-budget-catalog/768-dark-graficos.jpg) | [claro](assets/custom-budget-catalog/1280-light-graficos.jpg) · [oscuro](assets/custom-budget-catalog/1280-dark-graficos.jpg) |
| Catálogo editable | [claro](assets/custom-budget-catalog/390-light-catalogo-editor.jpg) · [oscuro](assets/custom-budget-catalog/390-dark-catalogo-editor.jpg) | [claro](assets/custom-budget-catalog/768-light-catalogo-editor.jpg) · [oscuro](assets/custom-budget-catalog/768-dark-catalogo-editor.jpg) | [claro](assets/custom-budget-catalog/1280-light-catalogo-editor.jpg) · [oscuro](assets/custom-budget-catalog/1280-dark-catalogo-editor.jpg) |
| Arrastre | [claro](assets/custom-budget-catalog/390-light-arrastre.jpg) · [oscuro](assets/custom-budget-catalog/390-dark-arrastre.jpg) | [claro](assets/custom-budget-catalog/768-light-arrastre.jpg) · [oscuro](assets/custom-budget-catalog/768-dark-arrastre.jpg) | [claro](assets/custom-budget-catalog/1280-light-arrastre.jpg) · [oscuro](assets/custom-budget-catalog/1280-dark-arrastre.jpg) |
| Contactos pendientes | [claro](assets/custom-budget-catalog/390-light-contactos-pendiente.jpg) · [oscuro](assets/custom-budget-catalog/390-dark-contactos-pendiente.jpg) | [claro](assets/custom-budget-catalog/768-light-contactos-pendiente.jpg) · [oscuro](assets/custom-budget-catalog/768-dark-contactos-pendiente.jpg) | [claro](assets/custom-budget-catalog/1280-light-contactos-pendiente.jpg) · [oscuro](assets/custom-budget-catalog/1280-dark-contactos-pendiente.jpg) |

### Límites y trabajo pendiente

Las pruebas automatizadas certifican los casos ejecutados en Chromium, incluido táctil emulado, no dispositivos físicos. Queda revisión manual en Safari/Firefox, Android/iOS físicos y lectores de pantalla. El almacenamiento y sus copias son locales y sin cifrado; se deben exportar respaldos fuera del navegador. Persiste el aviso previo de Vite sobre `__dirname` en su configuración, sin impedir el build. No se cambian los límites conocidos de interpretación monetaria/fechas ni los cálculos financieros fuera del alcance de esta fase.

No se ha recuperado ni sobrescrito el almacenamiento de la ejecución anterior. Si reaparece se comparará antes de incorporar nada. `main`, Google AI Studio y los despliegues se mantienen intactos. La entrega termina con una PR Draft, sin fusionar.


## Revisión de PR #22: archivo y reglas activas

Esta revisión parte de `e4e0a8158deedf0f40c550e8179b34ec89942c4c`, mantiene `feature/custom-budget-catalog-rebuild` y la PR Draft #22. Los informes A/B/C/D anteriores siguen siendo evidencia de sus respectivos commits; los resultados de esta revisión se registran por separado en [custom-budget-catalog-review-validation.json](custom-budget-catalog-review-validation.json).

### Inmutabilidad económica bajo FinanceStore

`assertCatalogTransition` compara las previsiones por mes, tipo y código y los desgloses mensuales por padre, mes, identidad de subítem y céntimos. Si la partida **o su familia** está archivada en el estado anterior **o** en el nuevo, rechaza cambiar importes, redistribuir un desglose aunque conserve el total, crear o retirar esas previsiones/desgloses. Reordenar las mismas líneas sin alterar identidades ni importes sigue siendo válido. La comprobación se realiza bajo Web Locks y revisión antes de persistir; también afecta a mutaciones directas que eludan los formularios.

Archivar o reactivar conserva las previsiones y desgloses íntegros. La reactivación y una edición económica deben realizarse en **dos operaciones separadas**: no se puede combinar la reactivación con un cambio de importe en una única mutación. Los históricos permanecen consultables y se puede gestionar el estado de sus identidades sin modificar cantidades. Los borrados de previsiones archivadas también se rechazan; para editar o retirar importes se debe reactivar primero. La restauración explícita de una copia completa mantiene su procedimiento independiente de revisión y recuperación.

### Confirmación de reglas afectadas

Antes de archivar, `catalogArchiveImpact` identifica las reglas de movimientos periódicos activas y no retiradas y las automatizaciones de planificación activas que apuntan a la partida. Para una familia incluye sus partidas, sin confundir contenedor y subgrupo heredado. Las reglas inactivas, retiradas o de ahorro independiente no se presentan como reglas activas afectadas.

Si hay reglas activas, el gestor abre «Confirmar archivo con reglas activas», enumera su tipo, nombre y partida y explica las consecuencias: las reglas **se conservan activas**, sin borrarlas, desactivarlas ni reasignarlas; sus nuevos registros o previsiones quedan bloqueados mientras su padre permanezca archivado; los importes y desgloses históricos pasan a solo lectura. Reactivar no ejecuta operaciones automáticamente. Cancelar o Escape no escribe; únicamente «Confirmar archivo» solicita el guardado. Sin reglas activas se mantiene el archivo directo, pero su alcance también se captura y revalida.

La solicitud usa `FinanceStore.mutate({catalog: edit})`, no un cambio directo de flags desde el formulario. Incluye una instantánea transitoria de la identidad, pertenencia y reglas afectadas (también las inactivas para detectar que se activen). Bajo el lock, `FinanceStore` prepara el catálogo y `assertCatalogTransition` vuelve a calcular ese alcance sobre el estado vigente. Si ha cambiado una regla, su importe, activación, destino o pertenencia, se rechaza el archivo y se pide cancelar y revisar de nuevo. También se rechaza introducir reglas nuevas entre la revisión sin dependencias y el guardado. Una mutación directa sin la confirmación requerida no puede archivar identidades con reglas activas; el propio archivo tampoco puede cambiar las reglas afectadas.

Dos operaciones en cola del mismo store conservan esta comprobación del alcance. Una escritura de otra pestaña conserva además la protección habitual por revisión: muestra conflicto y deja el diálogo abierto sin sobrescribir datos. El diálogo mantiene el error, bloquea envíos repetidos y espera el resultado real del almacenamiento. Las instantáneas de revisión no se guardan en JSON; no hay nueva versión, migración ni copia incompatible añadida.

### Pruebas y reproducción de la revisión

Las pruebas unitarias añadidas en `src/utils/budgetCatalog.test.ts` cubren previsiones existentes, cambios de total, redistribución, eliminación, archivo/reactivación, confirmación obligatoria y alcance obsoleto por cambios en reglas. La suite `scripts/catalogArchive.browser.ts` comprueba 390/1280 px, familia/partida y con/sin desglose, cancelación, Escape, confirmación y conservación de reglas e históricos. Un bundle exclusivo de pruebas ejecuta el `FinanceStore` real dentro de Chromium para intentar mutaciones directas y dos escrituras en cola bajo Web Locks. Otro caso modifica una regla desde otra pestaña durante la revisión y comprueba el rechazo sin escrituras adicionales. No se añaden hooks de prueba a la aplicación de producción.

```sh
npm test
npm run lint
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:ui
git diff origin/main...HEAD --check
# Solo los casos nuevos:
CHROMIUM_PATH=/usr/bin/chromium npm run test:ui:catalog-archive
```

Los fixtures contienen únicamente datos ficticios; los perfiles son aislados y bloquean solicitudes externas. El primer intento de la suite nueva usó un código de fixture incorrecto en la sonda del store; se sustituyó por `demoParent` compartido y se repitieron los casos. No se considera ese intento una validación superada. Se mantienen las limitaciones de dispositivos físicos, otros navegadores y lectores de pantalla documentadas arriba, y el aviso previo de Vite sobre `__dirname`.

`main`, Google AI Studio y los despliegues permanecen intactos. No se fusiona la PR ni se modifica el almacenamiento original de la ejecución anterior.

Resultado de la revisión: **402 unitarias y 273 resultados Chromium** (255 casos y 18 contenedores), sin fallos, omisiones ni cancelaciones. Son 13 unitarias y 11 resultados Chromium nuevos respecto al cierre de D. Lint, build y diff-check correctos. El [informe de revisión](custom-budget-catalog-review-validation.json) contiene el inventario, hashes de fuentes y recuentos por suite.
