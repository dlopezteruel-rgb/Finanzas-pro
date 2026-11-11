# Subítems presupuestarios opcionales

Base remota: `main` `4e4334519240e0f82d7e38a9588d6b2171f3540e` (PR #20 integrada). Rama: `feature/budget-subitems`. La PR se mantiene en borrador, sin fusión ni despliegue.

## Uso

1. En **Presupuestos → Catálogo**, abre el detalle de una partida; también se accede desde **Planificación → Detalle**.
2. En **Gestionar subítems**, crea nombres propios, renómbralos, cambia su orden o archívalos. Eliminar pide confirmación y solo está disponible sin dependencias. Los archivados siguen visibles y se pueden reactivar.
3. En **Planificación**, despliega **Subítems** y pulsa **Distribuir … este mes**. Introduce cada importe, incluido 0 donde corresponda. No se propone un reparto de la cantidad anterior. La base pasa a calcularse como suma de ese desglose.
4. Guarda el borrador o revisa y aprueba. El diálogo muestra también los importes de los subítems. Las confirmaciones de déficit y de navegación siguen vigentes.
5. El detalle muestra previsto, ejecutado, resto y desviación de cada subítem y **Sin subítem**. Permite filtrar sus movimientos y abrir un registro con la atribución preseleccionada. Consultar no escribe datos.

Se puede seguir editando directamente la previsión de una partida sin desglose mensual activo, aunque ya existan nombres de subítems. En ese caso se indica **Pendiente de desglose**; el importe global anterior permanece sin distribuir. Añadir nombres no toca ningún mes ni movimiento. Una base con desglose activo se edita desde los hijos, no desde el editor global del catálogo.

El ejecutado incluye solo tramitados. Resto = previsto − ejecutado; desviación = ejecutado − previsto. El signo no cambia según el idioma ni altera las advertencias existentes de ingresos y gastos. Los movimientos pendientes se pueden consultar, pero todavía no suman al ejecutado.

## Decisiones de modelo

Se conserva la identidad existente de partida (`type + code`) y la estructura Ingresos/Gastos, familias y partidas. No se añade personalización general del catálogo.

- `FinanceData.budgetSubitems.items`: registros con `id`, `type`, `code`, `name`, `order`, `archived` y, al retirar uno sin dependencias, `deleted: true`.
- Los IDs se generan con `crypto.randomUUID()`. El padre y el tipo de una identidad son permanentes. Renombrar, ordenar o mover la partida entre familias del mismo tipo no cambia ningún vínculo histórico. No se permite reasignar un ID a otro padre ni tipo.
- Las identidades retiradas permanecen como tombstones dentro del respaldo y no pueden reutilizarse o reactivarse desde los editores. Archivar conserva las previsiones e imputaciones existentes; no permite nuevas imputaciones ni nuevas previsiones a ese archivado.
- `budgetSubitems.months`: un desglose por `monthYear + type + code`, con líneas `{subitemId, amountCents}`. Su presencia activa el desglose de ese mes. No hay importe global en el catálogo de subítems.
- La suma se calcula con enteros seguros de céntimos y se proyecta una sola vez a `budgetPlans`. Se validan importes, representabilidad exacta, IDs repetidos, padre/tipo y coincidencia exacta con la base. Los totales de familia, ingresos, gastos, ahorro y gráficos siguen usando la partida; no suman hijos por segunda vez.
- `Transaction.subitemId` es opcional. Ausencia significa **Sin subítem**, una fila de consulta sin ID ni entidad ficticia. Los registros antiguos conservan su ausencia de atribución.
- Una partida duplicada recibe otro código y copias de los subítems activos con IDs nuevos. No copia movimientos, importes mensuales ni aprobaciones. Los archivados quedan vinculados exclusivamente a la original.

En un mes con desglose, los subítems archivados que ya tenían previsión conservan sus importes. Los nombres añadidos después no se introducen en ese desglose automáticamente: **Añadir subítems disponibles a este mes** solicita sus cantidades explícitas. No se desactiva un desglose guardado desde un editor de importe global.

## Movimientos y contabilidad

El formulario manual ofrece **Subítem (opcional)** después de la partida, con **Sin subítem** como opción expresa. No escoge el primero. Cambiar de partida o tipo limpia una atribución incompatible; editar conserva la original, también si se archivó. El selector del registro rápido y el de revisión del chat siguen el mismo criterio. Sus interpretaciones de categorías e importes conservan el comportamiento anterior.

Las reglas periódicas siguen generando ocurrencias sin subítem. Después de registrarlas se puede atribuir explícitamente el movimiento desde su editor, conservando su vínculo persistente con la ocurrencia y su estado pendiente. No se infieren hijos por concepto, nombre o posición.

El cálculo del desglose reutiliza `economicTransactions`: parte propia de gastos compartidos estructurados, exclusión de traspasos, reintegros vinculados y liquidaciones de principal. No se altera la salida bancaria total del compartido ni se contabiliza el reintegro como ingreso presupuestario. Los movimientos protegidos de principal continúan gestionándose desde Deudas y no admiten atribución presupuestaria.

Los formatos históricos que ya admitían decimales adicionales en registros sin subítem conservan la lectura y el redondeo de presentación anterior. Las nuevas previsiones de subítems y los movimientos que se les atribuyen exigen céntimos válidos; no se redondean silenciosamente al validar.

## Aprobaciones, copias y automatización

`planningContent` incluye el desglose mensual canónico. Cambiar dos hijos manteniendo el total padre incrementa la revisión e invalida el estado aprobado. `planningScope` y `automationScope` incluyen también la información necesaria para rechazar vistas previas obsoletas.

Las aprobaciones nuevas contienen `subitemBreakdowns`, con IDs, nombres e importes fotografiados. La última aprobación y el historial anterior son inmutables. El detalle de comparación y el historial muestran esos nombres e importes guardados. Una aprobación antigua sin desglose se presenta como **Sin desglose histórico** y no se reconstruye con el catálogo actual. Renombrar el catálogo no reescribe una fotografía ni crea una revisión económica.

| Operación | Tratamiento del desglose |
| --- | --- |
| Copiar entre meses | Copia la distribución por ID de las partidas seleccionadas. La revisión muestra antes/después de cada hijo. Detecta cambios incluso con idéntico total. Respeta omisión por defecto, sobrescritura explícita y meses previamente aprobados. |
| Repetir una copia idéntica | Se omite sin nueva escritura. El orden de las líneas no crea una diferencia económica. |
| Copiar un importe global sobre un mes distribuido | Bloqueado; no sustituye ni inventa el reparto. |
| Copiar a un mes nuevo una distribución con archivados | Bloqueado; se revisa manualmente con subítems activos. |
| Regla global sobre mes sin desglose | Guarda el total con aviso explícito de desglose pendiente. |
| Regla global sobre mes con desglose | Bloqueada; requiere edición manual de los hijos. |
| Arrastre con desglose en origen o destino | Bloqueado. El ajuste global anterior debe retirarse expresamente antes de activar el desglose de cualquiera de sus extremos. No se asigna a un hijo ficticio. |

`planningCarry.ts` conserva sus fórmulas de remanente y observación. Las barreras de compatibilidad se aplican en `planningAutomation.ts` y en la validación del estado, antes de aceptar una escritura.

## JSON 3.3 y almacenamiento

Se mantienen lectura e importación estrictas de **2.5, 2.6, 2.7, 2.8, 2.9, 3.0, 3.1 y 3.2**. Abrirlas no crea subítems ni escribe una migración. Las nuevas propiedades no se admiten bajo cabeceras antiguas. JSON **3.3** exige el registro `budgetSubitems` y admite los metadatos previos, incluida la cartera predeterminada opcional por ID.

La primera escritura que requiere 3.3 utiliza la protección existente de FinanceStore: Web Lock, revisión, validación integral y copia completa recuperable verificada antes de cambiar la clave activa. Se conserva `DATA_KEY`, el origen y la infraestructura de conflictos. Un fallo de copia, verificación o escritura conserva los datos activos y la edición local. No se guarda una preferencia de subítems en otra clave independiente.

La exportación conserva catálogo, tombstones, desgloses e imputaciones. La vista previa de restauración indica su alcance. Restaurar sustituye el conjunto completo bajo confirmación y copia previa; no fusiona datos. Para volver a una aplicación anterior se restaura la copia compatible previa, porque las versiones antiguas no leen JSON 3.3.

El respaldo conserva el límite existente de 10 MB. El registro valida un máximo de 10.000 identidades (incluidas las retiradas), 20.000 desgloses mensuales y 1.000 líneas por desglose; superar esos límites se rechaza antes de escribir.

El borrado seleccionado de presupuestos incluye los desgloses mensuales, objetivos e historial aprobados en su alcance y confirmación. Conserva el catálogo de subítems y las atribuciones de los movimientos que no se hayan elegido para borrar. Las eliminaciones de identidades con movimientos, previsiones o fotografías dependientes se rechazan también en el dominio.

## Evidencia y reproducción

Resultados finales: **335 pruebas unitarias** (291 anteriores + 44 nuevas), **234 resultados Chromium** (221 casos + 13 contenedores; 18 casos nuevos), **0 fallos y 0 omisiones**. `npm ci`, lint, build y diff-check correctos. El build emite el aviso previo de Vite sobre `__dirname`; el mayor chunk es 428,21 kB (112,53 kB gzip), sin aviso de tamaño en esta ejecución.

Código de validación: `5773181e9abac87a0963cff914008dc264b6307d`. La batería completa de Chromium compiló la aplicación de `66b9da3`; el commit siguiente cambia únicamente el reloj de las pruebas unitarias. El build final reproduce el mismo bundle de aplicación. Los commits posteriores incorporan solo documentación y capturas.

Resultados finales y SHA del código comprobado: véase [budget-subitems-validation.json](budget-subitems-validation.json). La primera batería unitaria añadida y la de navegador se ejecutan junto con todas las anteriores; las ejecuciones exploratorias fallidas no se cuentan como resultados aprobados.

```sh
npm ci
npm test
npm run lint
npm run build
GEMINI_API_KEY='' GOOGLE_API_KEY='' CHROMIUM_PATH=/usr/bin/chromium npm run test:ui
git diff origin/main...HEAD --check
```

La nueva batería puede repetirse por separado después del build:

```sh
CHROMIUM_PATH=/usr/bin/chromium BUDGET_SUBITEM_ARTIFACT_DIR=docs/assets/budget-subitems \
  node --import tsx scripts/budgetSubitems.browser.ts
```

Usa un servidor local en `127.0.0.1`, contextos nuevos con datos ficticios, reloj fijo, zona Europe/Madrid, integración externa desactivada y bloqueo de solicitudes ajenas al origen local. Comprueba creación/orden/archivo, nombres largos, atribución y consulta, céntimos, borradores, fotografías, copia/reglas/arrastres, almacenamiento, dos pestañas, doble envío bajo Web Lock, exportación y restauración. Registra errores de consola y excepciones de página como fallos.

| Tamaño y tema | Planificación (página completa) | Detalle |
| --- | --- | --- |
| 390, claro | [Captura](assets/budget-subitems/390-light-planificacion.jpg) | [Captura](assets/budget-subitems/390-light-detalle.jpg) |
| 390, oscuro | [Captura](assets/budget-subitems/390-dark-planificacion.jpg) | [Captura](assets/budget-subitems/390-dark-detalle.jpg) |
| 1280, claro | [Captura](assets/budget-subitems/1280-light-planificacion.jpg) | [Captura](assets/budget-subitems/1280-light-detalle.jpg) |
| 1280, oscuro | [Captura](assets/budget-subitems/1280-dark-planificacion.jpg) | [Captura](assets/budget-subitems/1280-dark-detalle.jpg) |

Las capturas proceden de React renderizado con datos ficticios y no contienen datos personales. Los controles nuevos usan los tokens visuales existentes; se comprueban contraste normal ≥ 4,5:1 en los campos, foco visible y ausencia de desbordamiento horizontal en los tamaños indicados.

## Regresiones cubiertas

La duplicación serializa únicamente el tipo y código del padre en cada identidad nueva, y su resultado debe superar la validación completa del respaldo. El filtro de movimientos del detalle se conserva al guardar o archivar; se restablece al cambiar de partida o periodo. Las comparaciones canónicas ignoran nombres, orden de filas y orden de claves JSON para evitar cambios económicos falsos. Las nuevas regresiones de automatización fijan explícitamente el reloj, sin modificar el reloj de las suites anteriores.

No se han observado regresiones en la batería ejecutada; el alcance y los límites de la verificación se detallan a continuación.

## Límites y revisión manual

- No se distribuyen automáticamente copias globales, reglas ni arrastres entre hijos. Los bloqueos anteriores son decisiones explícitas de alcance, no un supuesto soporte de automatización por subítem.
- No hay editor de asignación de subítem en la regla periódica; la atribución se realiza manualmente sobre el movimiento registrado. No se personalizan familias o partidas generales ni se permite reparentar identidades.
- Firefox, Safari, VoiceOver/TalkBack y dispositivos físicos requieren revisión manual. La comprobación automática de contraste no acredita por sí sola toda la accesibilidad de la aplicación.
- Revisar con el propietario la comodidad de introducir muchos subítems, los textos de distribución pendiente y la comparación de fotografías. Las pruebas usan fixtures; no se ha abierto ningún respaldo real.
- Se mantienen las limitaciones previas: aproximación histórica de préstamos y avisos existentes de configuración/tamaño de build cuando correspondan. Esta ampliación no los resuelve.
- No se modifica `main`, no se fusiona la PR y no se despliega ni sincroniza Google AI Studio. No se añaden autenticación, nube ni dependencias de producción.
