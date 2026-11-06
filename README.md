# Finanzas Pro

Aplicación React/Vite con servidor Express. Los datos financieros se guardan en el navegador; no hay base de datos ni sincronización entre dispositivos.

## Desarrollo y comprobaciones

Entorno verificado: Node 24.19 y npm 11.9.

```sh
# El manifiesto original tiene un conflicto de peer dependencies Vite/esbuild.
npm install --legacy-peer-deps --package-lock=false
npm run dev
npm test
npm run lint
npm run build
```

`npm test` ejecuta las pruebas originales y las regresiones de la Fase 1 con `node:test`. `lint` es la comprobación TypeScript.

Para las pruebas completas de interfaz se necesita Chromium instalado:

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:ui
```

Este comando compila, inicia un servidor de prueba en un puerto libre y abre un navegador aislado. Comprueba consultas, negaciones, propuesta editable, doble confirmación, importación inválida, cancelación, fallo de almacenamiento, recuperación, restablecimiento demo, carteras duplicadas tras recarga, conflictos entre dos pestañas y borrado con copia previa. En movimientos, carteras, contactos, préstamos y liquidaciones comprueba espera real del almacenamiento, fallo de cuota, conflicto y conservación de campos; los casos de cuota incluyen reintento exitoso. También verifica el registro rápido y el alta de contactos dentro de un movimiento. No utiliza datos del navegador del usuario. Las consultas Gemini se simulan en estas pruebas; no consumen una API real.

## Fase 1: registro revisado

Las consultas, preguntas con números y negaciones no registran movimientos. Una orden como «Registra un gasto de 15 euros con Openbank» o una descripción como «Ayer cené fuera por 15,50 € con Openbank» abre una propuesta. Se pueden cambiar tipo, importe, fecha, cartera, categoría, concepto y estado. Solo «Confirmar y registrar» guarda; cancelar o cerrar con Escape descarta la propuesta. La confirmación admite una sola ejecución, incluso con clics repetidos.

La clasificación es conservadora y se basa en reglas, no en Gemini. «No registres 100 euros» impide el registro; «No me cuadran los gastos, ¿por qué?» sí llega al asesor. El parser original sigue teniendo limitaciones con cantidades ambiguas, separadores de miles y fechas: es necesario revisar la propuesta. Las consultas financieras mantienen su recorrido por `/api/assistant-chat`. La confirmación espera al resultado del guardado; si se rechaza, conserva la propuesta y muestra el error.

## Importaciones y recuperación

El formato admitido es el JSON completo exportado por la aplicación, versión `2.5`. Debe incluir `exportedAt`, `theme` y las seis colecciones: `transactions`, `budgetPlans`, `budgetGroups`, `contacts`, `loans`, `wallets`. Se comprueban todos los elementos, tipos, campos obligatorios y opcionales, fechas reales, números finitos, enumeraciones e identificadores duplicados. Se rechazan campos desconocidos y archivos mayores de 10 MB. No se aceptan restauraciones parciales ni se convierten versiones automáticamente.

Los enlaces huérfanos que versiones anteriores podían exportar se avisan en la vista previa; se conservan, sin reparar ni recalcular préstamos, transferencias o gastos compartidos. Esto permite revisar una copia existente sin introducir cambios contables en esta fase.

La importación muestra cantidades, fecha, tema y advertencias antes de pedir confirmación. Restablecer la demostración requiere el mismo proceso. «Limpiar todo (Borrar datos)» también genera una copia previa de todo el estado antes de aplicar las opciones seleccionadas. Cancelar no escribe nada. Tras confirmar:

1. Se guarda y verifica una copia del estado anterior.
2. Se sustituye el estado activo mediante una única escritura local.
3. Se actualiza la interfaz solo si ambas operaciones han tenido éxito.

Si falla la copia o la escritura del nuevo estado, no se aplica la sustitución. Las copias anteriores se conservan con claves distintas y se pueden descargar desde **Opciones y datos → Copias de recuperación**. Para recuperarlas, utiliza **Importar JSON** y confirma tras revisar la vista previa.

El conjunto activo usa `finanzas_pro_data_v1`, con una revisión interna distinta para cada escritura. Las descargas mantienen el formato portable 2.5, sin ese campo interno. Se aceptan snapshots anteriores que no tengan revisión. Las claves anteriores `finanzas_pro_*_v2` y `finanzas_pro_theme` se leen si todavía no hay un conjunto activo; no se borran ni se reescriben. Una versión antigua del código puede no interpretar el snapshot actual: exporta siempre una copia antes de volver a una versión anterior.

Si los datos locales no superan la validación, se bloquea su edición y se permite descargar los valores originales para recuperarlos, sin sustituirlos por datos de demostración.

## Guardado y varias pestañas

Todas las modificaciones se validan y guardan antes de actualizar el estado visible. La interfaz impide crear o renombrar una cartera con el nombre de otra; el dominio vuelve a comprobar la unicidad antes de persistir. Las carteras duplicadas de datos antiguos conservan la descarga de sus valores originales para recuperación manual, sin deduplicación ni borrado automático.

Los formularios esperan un resultado explícito del almacenamiento, incluido el motivo de rechazo. Solo se cierran después del éxito. Si falla la cuota, la validación, Web Locks o la revisión, permanecen abiertos y conservan los valores introducidos; el error aparece dentro del formulario. Durante la espera se deshabilitan campos, confirmación y cierre, con protección adicional contra envíos repetidos antes del siguiente render. Las liquidaciones actualizan la deuda y su reintegro en una sola escritura, manteniendo los cálculos existentes. El registro rápido solo limpia su texto después del éxito.

Las escrituras se coordinan mediante Web Locks y una comparación de revisiones dentro del bloqueo. Los eventos `storage` y de foco notifican cambios externos. Si otra pestaña modifica, importa o limpia datos, una pestaña obsoleta bloquea sus escrituras y ofrece **Recargar datos actualizados**. No hay fusión automática: revisa o copia los campos de un formulario pendiente antes de recargar.

Es necesario un navegador actualizado con Web Locks y un contexto seguro (HTTPS o localhost). Al iniciar se comprueban el contexto seguro, la presencia de la API y una adquisición real del bloqueo sin modificar los datos. Si la coordinación no está disponible o el contenedor deniega el permiso, se muestra **Guardado no disponible** desde el inicio; se permite consultar/exportar y se bloquean las escrituras, conservando los formularios y el estado anterior. No se utiliza un guardado alternativo que elimine la protección entre pestañas. La coordinación presupone pestañas que ejecutan esta versión; no utilices versiones antiguas simultáneamente sobre el mismo almacenamiento.

La batería ha comprobado adquisiciones reales de Web Locks en Chromium de escritorio, emulación Pixel 7/Android y un iframe del mismo origen en localhost. La emulación no certifica un Android físico, una versión concreta de WebView ni el contenedor real de AI Studio. En AI Studio/Android debe abrirse la aplicación por HTTPS en un navegador/contenedor compatible; la comprobación al iniciar se ejecuta en ese documento y avisa de sus restricciones reales. El modo sin Web Locks también tiene una regresión de navegador que comprueba el aviso inicial y la conservación del formulario tras intentar guardar.

## Límites pendientes

El almacenamiento y las copias siguen siendo locales y sin cifrado. Borrar los datos del navegador también elimina las copias: descarga respaldos fuera del navegador. Si se llena la cuota, se rechaza el guardado; las sustituciones y los borrados no se aplican si no se puede conservar la copia previa. Los errores de cálculos de préstamos, transferencias, gastos compartidos y las respuestas fallback de Gemini identificados en la auditoría quedan fuera de esta fase.

## Fase 2A: traspasos internos

Un traspaso es una operación lógica con dos extremos, guardados en la misma escritura. Ambos llevan `transfer: { id, fromWalletId, toWalletId, leg, concept }`; las carteras se enlazan por ID estable. Las etiquetas `wallet` se conservan como texto histórico, pero el saldo y la visualización de un traspaso resuelven la cartera actual por ID. Renombrarla no rompe el enlace. No puede eliminarse una cartera con traspasos vinculados sin eliminar también las operaciones completas.

La validación de lectura, escritura e importación exige exactamente un extremo de salida y otro de entrada por operación, con los mismos IDs de carteras, importe, fecha, concepto y estado. No admite carteras inexistentes o iguales, importes no finitos, no positivos o con fracciones de céntimo, ni enlaces a préstamos o gastos compartidos en un traspaso. Crear, editar, tramitar y eliminar afectan siempre a ambos extremos. Desde cualquiera de sus movimientos se abre el mismo formulario de traspaso; la eliminación pide confirmación del conjunto. Los formularios esperan el resultado real del almacenamiento y conservan sus campos ante cuota, conflicto o validación fallida.

Los saldos de las carteras incluyen ambos flujos de efectivo. Los ingresos y gastos económicos, presupuestos, balance mensual y tasa de ahorro excluyen las transferencias identificadas. **No se excluye el código `F.003.001` por sí solo**: el catálogo también lo usa para seguros médicos y créditos recibidos, que mantienen su comportamiento anterior. Los listados de cuentas y movimientos distinguen sus flujos de los totales económicos.

### Históricos y migración segura

No hay reescrituras al leer datos antiguos. Se reconocen como pares inequívocos únicamente los registros del generador anterior: IDs `tx-traspaso-out-N` / `tx-traspaso-in-(N+1)`, mismo importe/fecha/estado, carteras distintas, categoría/subcategoría de traspaso y descripciones/notas recíprocas exactas. Su clasificación contable se corrige en memoria sin escribir los originales. La vinculación persistente también requiere que existan ambas carteras.

El aviso de históricos permite **Revisar vinculación de traspasos históricos**. La vista previa y la confirmación usan el mecanismo de restauración de Fase 1: copia anterior verificada, bloqueo Web Locks, comprobación de revisión y una sola escritura activa. La migración solo añade `transfer`; conserva IDs, importes, fechas, conceptos, notas y todos los demás campos originales. El ID de la operación migrada deriva del ID de salida, de modo que repetirla es idempotente. Cancelar no escribe nada.

Los pares inequívocos siguen siendo traspasos internos aunque ya no exista una de sus carteras: el informe y los avisos los identifican como excluidos de ingresos y gastos, pero sin posibilidad de vinculación persistente. No se crean carteras ni contrapartidas para migrarlos.

Registros incompletos, editados o sin correspondencia inequívoca se conservan y se avisan; no se emparejan solo por importe, fecha o palabras en el concepto. Los ambiguos mantienen su clasificación anterior: **sus indicadores podrían seguir incluyendo flujos internos hasta una revisión manual**. Se bloquea su edición individual y el renombrado/borrado de las carteras referidas para evitar nuevas pérdidas de relación. No hay una reparación automática destructiva. Conserva una exportación íntegra y revisa esos casos en una tarea específica; este cambio no inventa contrapartidas ni borra originales.

### Respaldos 2.5 y 2.6

Se sigue leyendo, validando, previsualizando y restaurando el JSON completo **2.5**, sin conversiones silenciosas. Cuando hay transferencias estructuradas se escribe/exporta **2.6**, con las mismas colecciones y el campo opcional `transfer` en los movimientos. Sin transferencias estructuradas la exportación sigue siendo 2.5. No se permite introducir esos metadatos bajo una etiqueta 2.5.

La primera escritura con transferencias estructuradas guarda y verifica una copia recuperable del estado anterior antes de activar 2.6; si falla la copia o la escritura activa, no cambia el estado. Toda importación, migración confirmada y borrado conserva también las garantías de Fase 1. Las versiones anteriores de la aplicación no entienden 2.6 y deben rechazarlo: utiliza la copia 2.5 previa para volver atrás, nunca suprimas los vínculos a mano. No ejecutes versiones antiguas simultáneamente sobre el mismo almacenamiento.

Las pruebas de traspasos se incluyen en `npm test` y `CHROMIUM_PATH=/usr/bin/chromium npm run test:ui`. El alcance sigue excluyendo cambios contables generales en préstamos, gastos compartidos, reintegros o el parser monetario habitual; el parser estricto nuevo solo se usa en el formulario de traspasos.

### Cambios de grupo presupuestario

El traslado de una partida prepara catálogo, planes y movimientos normales sobre el estado vigente bajo Web Locks y confirma todo en una única escritura activa. Los extremos de transferencias estructuradas y los registros históricos de traspasos permanecen intactos, aunque compartan `F.003.001`. Si el nuevo tipo provoca una colisión con otra partida del catálogo (por ejemplo, seguros y créditos con ese mismo código), se rechaza la operación completa sin fusionar ni renumerar datos. La validación final, la cuota y los conflictos de pestañas tampoco pueden dejar colecciones parcialmente actualizadas. El diálogo espera al resultado, bloquea dobles envíos y conserva el destino seleccionado y el error si falla.

## Fase 2B: gastos compartidos, deudas y reintegros

### Contabilidad y céntimos

Un gasto compartido nuevo guarda el importe bancario completo en `Transaction.amount` y un reparto con `splitInfo.accountingVersion: "2.7"`. `myShare` representa el gasto económico y presupuestario propio. Los participantes se identifican por `contactId`, nunca por coincidencia de nombres. Es obligatorio seleccionar o crear un contacto para cada participante; no se crean deudores anónimos implícitos.

El reparto utiliza céntimos enteros, distribuye el resto empezando por la parte propia y conserva siempre `total = parte propia + partes de los demás`. Por ejemplo, 100 € entre tres se reparte como 33,34 € + 33,33 € + 33,33 €. No se cambia el parser general de lenguaje natural; los formularios de liquidación y corrección de deuda admiten importes decimales estrictos.

En una cena de 60 € entre tres, la cartera baja 60 €, el gasto propio es 20 € y quedan 40 € por cobrar. Dos reintegros de 20 € elevan la cartera receptora 40 € y dejan la deuda a cero, manteniendo el gasto propio en 20 €. Un reintegro no aumenta ingresos económicos, presupuesto, balance ni tasa de ahorro. El gasto propio se imputa a la fecha del gasto original: cobrar en noviembre un gasto de octubre no crea ingresos o gastos económicos en noviembre.

Los movimientos no tramitados no cambian caja ni ejecutado presupuestario. No se admiten liquidaciones de un gasto original todavía no tramitado. Una liquidación no tramitada no reduce la deuda ni cambia caja; su importe queda reservado para impedir registrar el mismo cobro otra vez. Puede tramitarse, editarse o eliminarse desde su liquidación.

### Registro vinculado de cobros y compensaciones

Cada gasto estructurado contiene `splitInfo.walletId` y un registro `splitInfo.settlements`. Cada liquidación tiene `id`, `contactId`, `amount`, `date`, `processed` y `kind` (`cash` u `offset`). Las liquidaciones con dinero llevan también `walletId` y `transactionId`, y su movimiento bancario incluye `reimbursement: { expenseId, settlementId, contactId, walletId }`. La validación exige coincidencia de importe, fecha, estado y referencias, sin movimientos huérfanos, identificadores duplicados ni cobros superiores a la deuda.

Las compensaciones sin dinero se guardan solo como `offset`: reducen la deuda, sin generar una transacción de ingreso ni modificar ninguna cartera. Cobros completos y parciales se reconstruyen desde el registro persistido. Los antiguos `isPaid`, `paidDate`, `reimbursementTxId` y `totalOwedToMe` se conservan para no reescribir campos históricos, pero no son la fuente de verdad del modelo 2.7. La interfaz calcula los importes pendientes y las fechas saldadas desde las liquidaciones tramitadas.

Cada formulario de cobro conserva un identificador de operación; repetirlo no puede crear un segundo cobro parcial. Las operaciones relacionadas utilizan `FinanceStore.mutate`, Web Locks, revisión y validación completa antes de una escritura activa. Editar o eliminar un cobro modifica conjuntamente el registro y el movimiento bancario; la deuda se recalcula. La cancelación no escribe. Los formularios esperan el resultado real, bloquean dobles envíos y cierre durante el guardado, y conservan valores y errores ante cuota, conflicto o validación fallida.

### Edición y protección de relaciones

El concepto y las notas de un gasto pueden editarse sin recalcular el reparto manual ni perder cobros. Si ya existen liquidaciones, se rechazan cambios del importe total, fecha, categoría, estado, cartera o participantes, así como el borrado del gasto. Primero debe corregirse o eliminarse explícitamente la liquidación afectada desde su editor. El editor normal de movimientos dirige los reintegros al editor de liquidaciones.

La corrección manual de una deuda cambia la obligación total de ese participante y ajusta la parte propia para conservar el total pagado. Nunca modifica liquidaciones ya registradas: rechaza reducir la obligación por debajo de lo cobrado o reservado, o producir una parte propia negativa. Los contactos con gastos vinculados no pueden eliminarse. Las carteras de gastos o cobros estructurados se resuelven por ID y no se pueden borrar dejando referencias. Los históricos deben revisarse/migrarse antes de editar sus registros, cobros vinculados o renombrar sus carteras.

«Borrar deudas» no salda silenciosamente gastos 2.7: para eso se registra una compensación explícita. El borrado completo mediante las herramientas de datos sigue exigiendo confirmación y copia recuperable; debe incluir los movimientos para retirar sus relaciones de forma coherente.

### Históricos, vista previa y JSON 2.7

Se mantienen lectura, validación y restauración de JSON 2.5/2.6. **La carga no convierte ni escribe históricos.** Hasta una migración confirmada, los gastos compartidos anteriores conservan el cálculo anterior por importe total y sus ingresos reciben el tratamiento anterior de las partidas. Por ello, sus indicadores pueden no reflejar la parte propia; el aviso lo explica y ofrece revisar la migración.

La migración es explícita, aditiva e idempotente. Comprueba reparto exacto, tipo de gasto, contactos y cartera existentes. Para un participante ya pagado solo admite un movimiento inequívoco enlazado por `reimbursementTxId`, con importe, fecha, tipo, descripción y cartera verificables; un mismo cobro no puede pertenecer a dos deudas. Se añaden metadatos a los movimientos originales, conservando sus IDs y campos y sin crear un segundo cobro. Los identificadores de liquidaciones migradas son deterministas.

Una marca de pagado sin movimiento vinculado **no demuestra si hubo dinero o compensación**: se señala para revisión manual, sin inventar ninguno de ellos. Tampoco se convierten ingresos por compartir una categoría o nombre. Repartos históricos con diferencias de céntimos, contactos anónimos/ausentes, referencias duplicadas, cobros modificados o carteras inexistentes se conservan sin migrar y se detallan en el aviso. Cada gasto ambiguo permanece íntegro: no se migra solo una parte de sus participantes.

La vista previa muestra importe bancario, parte propia y cobros vinculados; informa de los casos no migrados. Confirmar guarda y verifica una copia recuperable del estado anterior antes de activar el modelo nuevo, bajo la misma protección de revisión y Web Locks. Cancelar o fallar al guardar la copia o el estado activo conserva el estado anterior. Para casos ambiguos, exporta los originales y solicita revisión específica; no borres referencias ni añadas contrapartidas para forzar la migración.

Se escribe/exporta **2.7** cuando existen gastos estructurados o reintegros vinculados; se siguen exportando 2.5/2.6 cuando no son necesarios esos metadatos. Una copia 2.7 puede contener históricos sin migrar. No se permiten campos nuevos bajo etiquetas 2.5/2.6. La primera escritura que incorpora 2.7 guarda también una copia recuperable del formato previo. Las versiones anteriores no entienden 2.7: para volver atrás utiliza esa copia, sin retirar metadatos a mano ni abrir versiones antiguas sobre el mismo almacenamiento.

Las pruebas nuevas de `npm test` y `CHROMIUM_PATH=/usr/bin/chromium npm run test:ui` utilizan exclusivamente datos ficticios y cubren los casos A–J, más los fallos de la copia previa y las ambigüedades históricas. Se mantienen los límites anteriores del almacenamiento local y sin cifrado. No se corrigen intereses de préstamos, parser natural general ni estética global.

### Selector de partidas y modalidades de reparto

El formulario busca en el catálogo vigente por código, denominación, categoría, familia y grupo, sin distinguir acentos o mayúsculas. Permite explorar familias/grupos y elegir con ratón o flechas/Enter. Escape cierra primero el buscador. Las cinco partidas recientes proceden de movimientos reales del tipo elegido, por fecha; se excluyen transferencias y reintegros identificados, incluidas referencias históricas explícitas.

Los participantes son siempre el usuario y los contactos seleccionados por ID. Seleccionar, quitar o crear un contacto actualiza el desglose. Hay tres modalidades: equitativa, proporcional y por importes. La proporcional admite pesos entre cero y 1.000.000 con hasta seis decimales, con suma positiva. Opera con enteros y reparte los céntimos sobrantes según los mayores restos; los empates se resuelven por el usuario y luego por el orden persistido de contactos. En la modalidad por importes, el último contacto recibe el resto automático; las otras asignaciones se conservan al variar el total. Si sobrepasan el total o son negativas, se bloquea el guardado.

El desglose muestra cada parte, gasto propio, deuda y total repartido. Al editar, se mantienen modalidad, pesos, importes y liquidaciones. Las copias anteriores sin modalidad se abren por importes: cambiar únicamente concepto o notas conserva su reparto original sin añadir metadatos. Una reasignación incompatible con liquidaciones se rechaza, con el formulario intacto. La corrección explícita de una deuda mantiene las liquidaciones y, si había modalidad guardada, pasa a reparto por importes.

### Consulta y jerarquía de ventanas

El detalle de partida es un panel a la derecha en escritorio y ocupa el ancho disponible en móvil. Los gastos compartidos distinguen **Total pagado** y **Tu gasto** presupuestario. «Ver reparto» abre una consulta sin edición que resuelve contactos, carteras y liquidaciones por sus IDs; separa reintegros, compensaciones, pendientes de cobro y liquidaciones sin tramitar. Los históricos sin convertir muestran sus valores declarados y referencias guardadas con aviso de revisión: no se inventan cobros ni se cambia su presupuesto por consultar el detalle.

Todos los formularios y `SafeDialog` utilizan el mismo gestor de portales, con paneles debajo de diálogos centrales independientemente del orden de renderizado. Solo la ventana superior permite interacción y recibe foco; Escape, Tab, retorno al desencadenante y bloqueo/restauración del scroll se coordinan en ese gestor. Las superposiciones son suaves y sin desenfoque. Los formularios siguen esperando la escritura real, bloquean dobles envíos y conservan campos y errores tras un rechazo. También la confirmación de borrado completo permanece abierta si falla su copia recuperable o la escritura.

### JSON 2.8 y compatibilidad

`splitInfo.distribution` es opcional: `{ method: "equal" }`, `{ method: "amounts" }` o `{ method: "weighted", ownWeight, contactWeights: [{ contactId, weight }] }`. Los importes persistidos siguen siendo la fuente contable; la validación estricta comprueba forma, referencias, orden, pesos y su concordancia exacta con el reparto. `accountingVersion: "2.7"` identifica las reglas contables, que no cambian.

Se escribe/exporta **JSON 2.8 solo cuando existe esa modalidad persistida**. Se siguen leyendo, validando y restaurando 2.5, 2.6 y 2.7; los nuevos campos no se admiten bajo etiquetas antiguas. No se convierte ni escribe ningún histórico durante la carga. La primera escritura 2.8 conserva y verifica la copia recuperable del formato previo bajo Web Locks y revisión, antes de una única escritura activa. Si falla, los datos activos permanecen intactos. Las versiones anteriores de la aplicación rechazan 2.8; para volver atrás debe utilizarse la copia previa completa, sin quitar vínculos ni metadatos a mano.

Las regresiones incluyen búsqueda y navegación por teclado, reparto exacto y persistencia, consulta histórica sin escrituras, edición con reintegros, errores de cuota/conflicto y doble confirmación. En Chromium de escritorio y móvil se comprueba que el editor recibe realmente los clics por delante del panel de partida, además de alta, borrado, foco, Escape, Tab y scroll. La emulación móvil no sustituye una validación en dispositivos físicos.

### Confirmaciones de eliminación y alcance del borrado

Las eliminaciones de contactos, cuentas, préstamos y movimientos utilizan `ConfirmDeleteDialog`, sobre el mismo sistema `Overlay`. Pulsar la papelera abre la consulta de impacto: identifica el elemento, cuenta sus relaciones y muestra ejemplos con referencias. La ventana ofrece **Cancelar** y **Confirmar eliminación**; el foco inicial está en Cancelar. Cancelar o Escape conserva también el borrador del formulario subyacente. La confirmación espera la escritura real, bloquea dobles envíos y cierre durante la espera y muestra los errores sin perder el contexto. Al eliminar la fila o el formulario que abrió la ventana, el foco vuelve a una capa válida o a la navegación activa.

Una cuenta no puede eliminarse mientras tenga movimientos normales o pendientes, transferencias, gastos compartidos, reintegros, liquidaciones o préstamos asociados. Un préstamo con cuotas y un contacto con obligaciones compartidas, incluso saldadas o históricas, permanecen protegidos. Se resuelven IDs cuando existen; se conservan las referencias antiguas por nombre de cartera. El cálculo previo de préstamos también utiliza coincidencias de nombre: esos posibles pagos se señalan y bloquean preventivamente para revisión, sin crear vínculos ni alterar ese cálculo. Corregir una cuota elimina explícitamente ese movimiento hijo y recalcula el seguimiento del préstamo; eliminar un gasto sin liquidaciones retira el reparto que forma parte de esa operación, sin borrar contactos. Si hay cobros, se exige revisar primero las liquidaciones. Los traspasos y reintegros conservan sus ventanas específicas y su eliminación conjunta de registros de la misma operación.

El análisis se repite al confirmar dentro de `FinanceStore.mutate`, bajo Web Locks y revisión. Además, las mutaciones directas no pueden retirar contactos, cuentas o préstamos dejando referencias supervivientes. Las lecturas y restauraciones históricas conservan las validaciones de JSON 2.5/2.6/2.7/2.8: no se reparan ni reescriben datos al cargarlos.

El borrado masivo existente muestra cantidades de todas las fechas, incluidas operaciones vinculadas, cuotas y registros históricos. Distingue movimientos, transferencias completas, liquidaciones, obligaciones, cuentas, saldos base, planes y préstamos; las categorías pueden solaparse. No elimina contactos, familias ni partidas del catálogo. Exige una segunda ventana y escribir **BORRAR**. Una combinación que conservaría referencias huérfanas se rechaza sin ampliar las opciones seleccionadas. Tampoco se marcan deudas históricas como pagadas al borrar préstamos: para saldar una deuda se utiliza una liquidación explícita.

La confirmación masiva lleva una instantánea del alcance revisado. Si una escritura en cola cambia los registros antes de obtener el bloqueo, se exige volver a revisar las cantidades; otra pestaña sigue provocando el conflicto de revisión habitual. Esta ruta de `FinanceStore.mutate` guarda y verifica la copia recuperable completa antes de una única escritura activa, con las garantías anteriores de restauración. La copia conserva íntegramente los registros y su formato original. No se añade ningún metadato persistido ni versión de JSON.

Las pruebas unitarias y Chromium incluyen elementos con y sin dependencias, cuota/conflicto, cancelación, doble envío, espera real, retorno de foco, paneles superpuestos en escritorio/móvil, alcance modificado en cola, copia obligatoria, históricos e importación de la copia recuperable. No se incorpora archivado general ni gestión/eliminación de familias o partidas: quedan para Fase 3.

## Fase 3A: planificación y ahorro objetivo

En **Presupuestos → Planificación financiera** puedes editar el mes completo, guardar un borrador o revisar/aprobar la previsión; el ahorro objetivo no modifica los saldos. El selector permite meses futuros y el resumen anual indica la cobertura real. Si editas después de aprobar, la última fotografía se conserva y el estado pasa a modificado.

Los metadatos se guardan en JSON **2.9** solo al utilizarlos. Se mantienen lectura/restauración de 2.5–2.8 y copia recuperable verificada antes de la primera escritura 2.9. Una app antigua no puede leer 2.9: utiliza la copia completa previa para volver atrás.

Consulta [modelo, migración, archivos y QA manual con datos ficticios](docs/phase-3a.md).

## Fase 3B: interfaz de Presupuestos

Presupuestos separa **Planificación** y **Catálogo y partidas** en dos pestañas internas. Ingresos, Gastos y cada familia se pueden plegar; los encabezados conservan totales y avisos sin perder el borrador. Cambiar de pestaña respeta la protección de cambios sin guardar de Fase 3A. Estas preferencias son transitorias y no añaden metadatos ni otra versión JSON.

Consulta el [informe técnico y guion de QA con datos ficticios](docs/phase-3b-budget-ux.md). Los gráficos (#8) y la automatización avanzada (#6) permanecen fuera de esta entrega.
