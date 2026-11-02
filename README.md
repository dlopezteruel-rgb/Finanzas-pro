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

Registros incompletos, editados, sin carteras o sin correspondencia inequívoca se conservan y se avisan; no se emparejan solo por importe, fecha o palabras en el concepto. Los ambiguos mantienen su clasificación anterior: **sus indicadores podrían seguir incluyendo flujos internos hasta una revisión manual**. Se bloquea su edición individual y el renombrado/borrado de las carteras referidas para evitar nuevas pérdidas de relación. No hay una reparación automática destructiva. Conserva una exportación íntegra y revisa esos casos en una tarea específica; este cambio no inventa contrapartidas ni borra originales.

### Respaldos 2.5 y 2.6

Se sigue leyendo, validando, previsualizando y restaurando el JSON completo **2.5**, sin conversiones silenciosas. Cuando hay transferencias estructuradas se escribe/exporta **2.6**, con las mismas colecciones y el campo opcional `transfer` en los movimientos. Sin transferencias estructuradas la exportación sigue siendo 2.5. No se permite introducir esos metadatos bajo una etiqueta 2.5.

La primera escritura con transferencias estructuradas guarda y verifica una copia recuperable del estado anterior antes de activar 2.6; si falla la copia o la escritura activa, no cambia el estado. Toda importación, migración confirmada y borrado conserva también las garantías de Fase 1. Las versiones anteriores de la aplicación no entienden 2.6 y deben rechazarlo: utiliza la copia 2.5 previa para volver atrás, nunca suprimas los vínculos a mano. No ejecutes versiones antiguas simultáneamente sobre el mismo almacenamiento.

Las pruebas de traspasos se incluyen en `npm test` y `CHROMIUM_PATH=/usr/bin/chromium npm run test:ui`. El alcance sigue excluyendo cambios contables generales en préstamos, gastos compartidos, reintegros o el parser monetario habitual; el parser estricto nuevo solo se usa en el formulario de traspasos.
