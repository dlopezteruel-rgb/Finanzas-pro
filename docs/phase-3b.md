# Fase 3B — Automatización de la planificación financiera

Implementación del [Issue #6 y sus comentarios](https://github.com/dlopezteruel-rgb/Finanzas-pro/issues/6), sobre `bf31b795a4be85e46e6af6d86e0184902e9de2a1`, exclusivamente en `feature/phase-3b-planning-automation`. Antes de editar se comprobaron rama, SHA, estado limpio y ejecución de comandos. Se conservan las pestañas de la PR #9 y los gráficos de la PR #10. El rediseño de ancho del Issue #11 queda para otra entrega.

## Comportamiento entregado

En **Presupuestos → Planificación financiera → Planificación multiperiodo**:

| Acción | Qué guarda | Protecciones específicas |
| --- | --- | --- |
| Copiar planificación | Partidas base seleccionadas y, opcionalmente, ahorro objetivo guardado | Vista previa; máximo 12 destinos consecutivos; mes actual/futuro posterior al origen; omisión de destinos existentes; mezcla de un borrador solo con elección individual |
| Reglas recurrentes | Reglas de ingreso, gasto o ahorro, mensuales/trimestrales/anuales | Crear/editar/pausar/eliminar no genera previsiones ni movimientos; aplicación manual; conflictos por partida/mes omitidos; elección individual de una propuesta |
| Arrastrar remanentes | Ajuste separado de gasto, origen/destino e información observada del origen | Origen temporalmente transcurrido; destino consecutivo; importe positivo elegido; sin duplicados ni cascadas; revisión/eliminación expresas |
| Historial de aprobaciones | Cada fotografía real anterior al reaprobar | Historial inmutable en mutaciones ordinarias; comparación por partida y ahorro; importaciones antiguas conservan únicamente la última foto que realmente contienen |

Todas las operaciones muestran antes/después, diferencias, omisiones y resumen mensual antes de la confirmación. Cancelar, navegar por meses, consultar historial o abrir gráficos no escribe. Si existe un borrador local, hay que guardarlo o descartarlo antes de automatizar. La confirmación espera el resultado real y conserva propuesta/error si se rechaza; un doble clic solo inicia una operación.

Copias y recurrencias jamás alteran meses que tengan aprobación, aunque estén modificados desde ella. El usuario sigue pudiendo editarlos y reaprobárselos manualmente mediante el flujo de Fase 3A. Copiar un mes aprobado no copia su aprobación, revisión ni historial: los destinos nuevos son borradores.

## Modelo de datos

`budgetPlans` sigue siendo la única fuente editable de **previsión base**, en euros con representación exacta en céntimos. `planningMonths` mantiene objetivo, revisión y última aprobación. Se añade un único contenedor opcional:

```ts
planningAutomation?: {
  rules: PlanningRule[];
  carryovers: PlanningCarryover[];
  origins: PlanningOrigin[];
  history: { monthYear: string; approvals: PlanningApproval[] }[];
}
```

Los nuevos importes se almacenan como enteros seguros de céntimos. El adaptador a los importes base exige que la conversión a euros sea exacta. Se mantienen el parser estricto de 3A, la detección de fracciones indebidas y las sumas dentro de `Number.MAX_SAFE_INTEGER`. No hay redondeo silencioso de previsiones.

### Copia y procedencia

- Se seleccionan claves `type + code`, incluidos códigos históricos fuera del catálogo. Copiar solo el ahorro también es posible.
- La casilla de ahorro está activada por defecto. Cuando un origen antiguo no tiene objetivo, la propuesta muestra expresamente cero; no inventa aprobación.
- Un destino con cualquier planificación se omite completo por defecto. La autorización individual permite mezclar exclusivamente lo seleccionado, conservando las otras partidas y, si no se seleccionó, el ahorro existente.
- La procedencia por `monthYear + target + code` contiene `kind: copy/rule/manual`, instante y mes origen o nombre histórico de la regla. No duplica importes base. Cambiar manualmente una previsión generada convierte su procedencia en manual.
- El mes origen y el nombre de la regla son trazas históricas, no referencias que obliguen a conservar una regla eliminada. Eliminar/renombrar reglas no borra ni cambia esas previsiones. Una excepción manual a cero también queda protegida al volver a aplicar reglas.

### Recurrencias

Cada regla tiene ID, nombre, destino `INGRESO/GASTO/SAVINGS`, código solo para partidas, importe, frecuencia, inicio, fin opcional y estado activo. El calendario aplica intervalos de 1, 3 o 12 meses desde el inicio, con extremos inclusivos y sin depender del número de días del mes. El paso diciembre/enero es determinista.

La aplicación manual admite como máximo 12 meses por lote, del mes actual en adelante. Las reglas activas proponen valores; una fila ya existente o una excepción manual se omite por defecto. La sobrescritura explícita afecta solo a esa propuesta de partida/mes. Si coinciden varias reglas, se requiere elegir una única propuesta; seleccionar varias no crea duplicados. Repetir una operación que no cambia valores no escribe otra revisión activa. Las previsiones generadas no quedan vinculadas a una actualización automática de la regla.

### Semántica del arrastre y contabilidad

```text
remanente = max(0, base del gasto de origen − ejecutado propio procesado)
presupuesto efectivo de gasto destino = base destino + ajuste de arrastre
margen previsto = ingresos previstos − ahorro objetivo − gastos efectivos previstos
```

El cierre temporal significa que el mes origen es anterior al mes actual en **Europe/Madrid**, la zona utilizada por la aplicación; no se añade un cierre contable persistido. El ajuste solo puede ir al mes inmediatamente siguiente. Se puede elegir un importe menor al remanente; existe un único ajuste por origen/tipo/código. Para cambiar el importe hay que eliminarlo y revisar otro, nunca sumarlo dos veces. Una partida que recibe arrastre no puede originar otro arrastre, ni se puede crear retroactivamente una cadena. Así no se recircula disponibilidad anterior como remanente nuevo.

`PlanningCarryover` conserva ID, origen, destino, `GASTO`, código, importe, instante, base/ejecutado observados y firma del libro de origen. Los históricos ambiguos de gastos compartidos/traspasos requieren revisión antes de generar un ajuste. No se migra un histórico por consultarlo.

La ejecución se obtiene de `calculateMonthlyBudgetRows` y las funciones contables existentes: parte propia de un gasto compartido, solo movimientos procesados, reintegros/compensaciones y transferencias conforme a 2A/2B. No se introduce un motor alternativo. Que no haya movimientos no demuestra que exista dinero disponible: se explica en el diálogo.

Los ajustes se suman únicamente a una **proyección derivada** de las previsiones. Inicio, catálogo/detalle, resumen anual y gráficos de Planificación consumen esa proyección y distinguen base/arrastre/efectivo. Los editores siguen recibiendo y guardando la base. Un destino con base 200 y arrastre 50 muestra 250 efectivos; editar la base a 210 produce 260, sin incorporar el ajuste a `budgetPlans`. No se modifica ningún movimiento, préstamo, liquidación, contacto, cartera, saldo ni ahorro realizado. Las agregaciones económicas y bancarias de los gráficos conservan sus reglas. Las series de previsión, base y arrastre conservan huecos (`null`) en meses sin planificación, sin tratarlos como presupuestos aprobados de cero.

La firma es un marcador FNV de 64 bits del presupuesto de la partida y del libro completo del mes de origen; no sustituye controles de seguridad ni Web Locks/revisión. Cambios del libro, presupuesto o cierre temporal muestran **potencialmente desactualizado** sin recalcular el importe. Se permite revisar expresamente la observación manteniendo el ajuste; si el remanente ya no basta, se exige eliminarlo y revisar otro importe. Se permite eliminar individualmente un ajuste incluso si el destino se aprobó: conserva la foto y marca su contenido modificado. Una revisión que solo actualiza la observación no cambia la previsión aprobada.

### Fotografías reales de aprobación

La última foto continúa en `planningMonths[].approval`. Al reaprobárselo se archiva la anterior íntegra en `history` y se crea la siguiente. Una foto aprobada con arrastre conserva además `baseLines` y `carryLines`; su suma debe coincidir con las líneas efectivas y totales aprobados. Eliminar el ajuste vivo no altera ese desglose histórico.

Un JSON 2.9 con aprobación n.º 2 solo conoce esa foto: consultarlo no escribe ni crea una n.º 1. La siguiente aprobación archiva la n.º 2 y crea la n.º 3. El historial se ordena por número/fecha/revisión; las mutaciones genéricas no pueden sustituir ni retirar fotos anteriores. La restauración explícita puede sustituir todo el conjunto después de validar y respaldar el anterior, como en fases previas.

## Formatos, validación y recuperación

Se exporta/escribe **JSON 3.0 solo si existen metadatos nuevos**: alguna regla, procedencia, arrastre, historial o desglose base/arrastre en una foto actual. Un estado sin esos campos continúa exportándose coherentemente como 2.5–2.9 según sus datos. Un contenedor vacío se omite. Un fichero etiquetado 3.0 sin ningún campo nuevo se rechaza; no se permite ocultar esos campos bajo 2.x.

Se mantienen lectura, importación, restauración y round-trip de 2.5, 2.6, 2.7, 2.8 y 2.9. **No hay migración ni guardado al leer**, por abrir planificación, por recargar o porque existan reglas. La primera aprobación sin metadatos nuevos puede seguir en 2.9; reaprobárselo conservando historia requiere 3.0.

La validación 3.0 comprueba campos estrictos, tipos, fechas/meses reales, enteros y conversiones exactas, unicidad, coherencia de objetivos/totales/fotos, orden de versiones, destino consecutivo, positividad, límite al remanente observado, ausencia de cascadas y existencia de metadatos del mes destino. Se acepta una observación histórica cuyo origen haya cambiado para conservar el ajuste y poder avisar; si su firma coincide con el origen actual, base y ejecutado registrados deben coincidir también. Al crear/revisar un ajuste se vuelve a comprobar la observación actual dentro del almacenamiento protegido.

Límites explícitos: 200 reglas, 1.200 arrastres, 20.000 procedencias, 1.200 meses con historial, 100 fotos anteriores por mes y 2.000 anteriores en total; importación máxima de 10 MB. Alcanzarlos rechaza el guardado, sin truncar historial ni eliminar registros. Los meses válidos siguen siendo 0001-01 a 9999-12; no se genera un destino fuera del rango.

La operación completa pasa por `FinanceStore.mutate`:

1. Adquirir Web Lock y comprobar la revisión activa.
2. Revalidar el alcance completo de la vista previa y el mes temporal; recalcular propuestas sobre el estado guardado. Rechazar vistas previas obsoletas.
3. Construir todo el candidato sin mutar el estado anterior; invalidar revisiones mensuales si cambia base/objetivo/ajuste, proteger fotos e invariantes y validar el JSON completo.
4. Antes del primer cambio a 3.0, guardar y releer una **copia recuperable completa del formato anterior** mediante el mecanismo existente.
5. Escribir el estado activo una sola vez y actualizar React después del éxito.

Cuota, bloqueo denegado, copia fallida/no verificable, validación y conflicto no sustituyen el registro activo ni el estado visible. Los formularios conservan los valores para reintentar. La vista previa tiene alcance del libro, planes, catálogo y metadatos; el marcador de arrastre no se utiliza para autorizar una escritura. El cambio entre pestañas sigue mostrando el aviso y exige recargar, sin fusión silenciosa.

**Una aplicación anterior no entiende 3.0.** Para volver atrás hay que descargar e importar la copia previa completa desde **Opciones y datos → Copias de recuperación**, sin eliminar campos o bajar la etiqueta manualmente. Las copias siguen siendo locales, completas y sin cifrado; borrarlas del navegador impide recuperarlas si no se descargaron.

El borrado selectivo de planes incluye planes, objetivos, fotos actuales, historial, reglas, procedencias y arrastres en su alcance y conteos. Mantiene la doble confirmación, copia previa verificada y escritura única. No borra los movimientos, contactos ni carteras al seleccionar únicamente planes. Cambiar el tipo de una partida con arrastre está bloqueado para evitar reclasificar un ajuste de gasto.

## Archivos y alcance técnico

| Área | Archivos principales |
| --- | --- |
| Modelo y esquema | `src/types/finance.ts`, `src/utils/backup.ts`, `planningAutomationValidation.ts` |
| Propuestas y protección | `planningAutomation.ts`, `planningCalendar.ts`, `planningCarry.ts`, `financeStore.ts` |
| Base/efectivo y fotos | `planningBasis.ts`, `planningMoney.ts`, `planning.ts`, `budgetChanges.ts` |
| Interfaz y gráficos | `PlanningAutomationPanel.tsx`, `PlanningView.tsx`, `BudgetsView.tsx`, `PartidaDetailModal.tsx`, `App.tsx`, `chartData.ts`, `FinancialCharts.tsx`, estilos acotados |
| Recuperación/borrado | `clearData.ts`, `ConfirmClearModal.tsx`, `RestorationModal.tsx` |
| Pruebas | `planningAutomation.test.ts`, `scripts/automation.browser.ts`, registro en `src/tests.ts` y `package.json` |

No se añade ninguna dependencia, servicio, telemetría o tarea en segundo plano. Se mantiene el motor SVG local de la PR #10. No se modifica el ancho global de la aplicación ni se sincroniza Google AI Studio.

## Validación automatizada

Entorno: Node 24.22.1, npm 11.9, Chromium local con contextos nuevos, escritorio 1280 px y móvil táctil 390 px, temas claro/oscuro. Los navegadores de prueba bloquean las solicitudes a orígenes externos y usan únicamente fixtures ficticias; no se abre el perfil del usuario.

| Comprobación | Resultado |
| --- | --- |
| `npm test` | 219 pruebas, 219 correctas, 0 fallos; 27 pruebas nuevas de automatización |
| `npm run lint` | TypeScript `tsc --noEmit`, correcto |
| `npm run build` | Vite, correcto |
| `CHROMIUM_PATH=/usr/bin/chromium npm run test:ui` | 139 resultados correctos, 0 fallos: Fase 1 57, UX compartidos 12, borrados 23, planificación 13, pestañas/plegados 11, gráficos 8, automatización 15 |
| `git diff --check` | Correcto |

Los 139 resultados Chromium incluyen 132 casos hijos y 7 pruebas contenedoras. La suite nueva tiene 14 casos hijos y su contenedor. Incluye interacción real, teclado/foco/Escape/scroll, copia cancelada, escritura única bajo bloqueo retenido, edición/pausa/eliminación de reglas, arrastre separado y desactualizado, historia real importada, cuota/recovery/verificación/Web Locks con reintento, dos páginas con conflicto, exportación/importación 3.0 y recuperación completa 2.9. Las regresiones anteriores cubren compartidos, compensaciones/reintegros, transferencias, préstamos, saldos, aprobaciones, borrado y gráficos de los cuatro módulos.

Después de la revisión visual se repitieron las suites de planificación, pestañas, gráficos y automatización: otros 47 resultados correctos, 0 fallos. Incluyen el error visible al exceder el rango seguro sumando base y arrastre, sin caída de la vista ni cambios de almacenamiento. Las pruebas unitarias también comprueban procedencias mixtas manual/copia, huecos en las nuevas series y rechazo de firmas de origen de tipo incorrecto.

La compilación mantiene los avisos de configuración Vite sobre `__dirname` y tamaño del bloque principal superior a 500 kB. Resultado orientativo: principal 556 kB / 155 kB gzip; gráficos diferidos 34 kB / 12 kB gzip. No se cambian ajustes de seguridad ni se ocultan estos avisos.

## Guion manual reproducible

### Preparación aislada

1. Abrir un perfil de prueba nuevo, sin datos del usuario, en localhost/HTTPS con Web Locks. No abrir ni importar respaldos reales. Ejecutar `npm run dev` y usar solo los JSON ficticios siguientes.
2. Generar la fixture desde la raíz del repositorio (todos los nombres y movimientos son sintéticos):

   ```sh
   node --import tsx --input-type=module <<'JS'
   import { writeFileSync } from 'node:fs';
   import { chartFixture } from './scripts/chartFixture.ts';
   import { makeBackup } from './src/utils/backup.ts';
   import { savePlanning, planningScope } from './src/utils/planning.ts';
   const lines = [
     { type: 'INGRESO', code: 'i', amountCents: 300000 },
     { type: 'GASTO', code: 'g', amountCents: 220000 },
   ];
   let data = chartFixture();
   data = savePlanning(data, '2028-02', lines, 60000, planningScope(data, '2028-02'), true);
   // Simula una copia 2.9 que solo conoce su última aprobación n.º 2.
   data.planningMonths[0].approval.number = 2;
   writeFileSync('/tmp/finanzas-qa-2.9.json', JSON.stringify(makeBackup(data), null, 2));
   let carry = chartFixture();
   const shared = carry.transactions.find(t => t.id === 'shared');
   carry.transactions = [{ ...shared, amount: 600, date: '2026-09-01', splitInfo: {
     ...shared.splitInfo, myShare: 150, totalOwedToMe: 450,
     participants: carry.contacts.map(c => ({ contactId: c.id, contactName: c.name, amount: 150, isPaid: false })),
     settlements: [], distribution: { method: 'equal' },
   }}];
   carry.budgetPlans = ['2026-09', '2026-10'].map(monthYear => ({ monthYear, type: 'GASTO', code: 'g', plannedAmount: 200 }));
   writeFileSync('/tmp/finanzas-qa-arrastre.json', JSON.stringify(makeBackup(carry), null, 2));
   JS
   ```

3. Importar `finanzas-qa-2.9.json`, revisar cantidades y confirmar. Comprobar que sigue siendo 2.9 al exportarlo. Revisar Historial de febrero: solo debe existir la n.º 2. Cerrar, navegar, recargar y volver a exportar: ninguna regla, arrastre ni historia nueva.
4. Las fechas anteriores son reproducibles con el calendario de noviembre de 2026. Si se ejecuta este guion después de 2028, desplazar los meses futuros de copia/reglas hacia un año posterior; mantener un origen de arrastre anterior al mes actual.

### Copia y guardia de borrador

1. En febrero de 2028, cambiar temporalmente un importe sin guardarlo. Verificar que la automatización queda deshabilitada y que cambiar mes/pestaña solicita guardar/descartar según la guardia existente. Descartar.
2. Abrir **Copiar planificación**: origen febrero, destinos marzo–abril, ambas partidas y ahorro marcado. Esperar 3.000 ingresos, 2.200 gastos, 600 ahorro, margen 200 en cada destino. Cancelar con botón y repetir con Escape: no aparece ningún plan nuevo.
3. Confirmar la misma vista previa. Esperar dos borradores, ahorro 600 y procedencia copiada; ninguna aprobación en destinos. La fuente conserva su foto n.º 2 y sus valores. Movimientos/saldos no cambian.
4. Repetir: omisión sin duplicados. Autorizar individualmente la mezcla de marzo, cambiar antes su base a 2.100 mediante edición manual y verificar antes/después 2.100→2.200. Abril permanece omitido si no se autorizó.
5. Aprobar abril, modificarlo manualmente y guardar. Repetir copia: abril sigue bloqueado por aprobación previa, sin casilla de autorización. La foto sigue intacta.
6. Repetir con origen diciembre 2028 y destino enero 2029; desmarcar ahorro para conservar el destino. Probar rango de 13 meses y destino anterior/igual al origen: rechazo sin escritura. Copiar una partida fuera del catálogo creada solo en una fixture: se conserva y se identifica como histórica.

### Recurrencias y excepciones

1. Crear reglas ficticias: ingreso mensual 3.000, gasto trimestral 360 y ahorro anual 600, inicio diciembre 2028 y fin diciembre 2029. Revisar y confirmar cada regla. No deben aparecer planes nuevos aún.
2. Aplicar diciembre 2028–enero 2029: diciembre propone las tres; enero solo el ingreso mensual. Revisar importes y confirmar. Todos los destinos son borradores.
3. Repetir: no duplica. Editar la regla de ingreso a 3.100 y verificar que los meses creados siguen a 3.000 hasta una nueva aplicación expresamente autorizada. Pausar y eliminar reglas: sus planes existentes permanecen.
4. Modificar manualmente un destino a 3.050 y su ahorro a cero. Previsualizar: conflictos omitidos. Autorizar solo ingreso para ese mes y confirmar; no sustituir ahorro ni otros meses.
5. Crear dos reglas activas del mismo destino con distintos importes. Verificar conflicto visible, seleccionar solo una propuesta y comprobar una única partida mensual. Un mes aprobado/modificado no admite aplicación masiva.

### Arrastre, ejecución y aprobación

1. Importar `finanzas-qa-arrastre.json` y seleccionar octubre 2026. En **Arrastrar remanentes**, origen septiembre: base 200, gasto propio procesado 150 de un pago compartido 600, remanente 50. Seleccionar e introducir 50. Cancelar primero: ninguna modificación.
2. Confirmar la propuesta: octubre muestra **base 200 + arrastre 50 = efectivo 250**. El editor de base conserva 200, el margen previsto refleja el gasto efectivo y los gráficos/tabla muestran los tres valores. Saldos, movimientos y ahorro realizado no cambian.
3. Repetir el origen, elegir más de 50, escoger el mes actual/futuro o intentar arrastrar desde el mes receptor: bloqueo visible. No se crean duplicados ni cadenas. Crear adicionalmente reintegro, compensación, pendiente y traspaso ficticios usando sus formularios: verificar la parte propia y la exclusión contable correspondiente; no tratarlos como ingresos o gastos nuevos para el remanente.
4. Guardar septiembre con base 220. Esperar aviso de arrastre desactualizado; octubre continúa con 50, sin recalcularlo a 70. Revisar expresamente y confirmar: se retira el aviso sin cambiar el importe. Si se reduce el remanente por debajo de 50, revisar queda bloqueado y hay que eliminar/replantear.
5. Aprobar octubre aceptando explícitamente el déficit si corresponde. Revisar el desglose efectivo. Eliminar individualmente el ajuste: la previsión pasa a modificada y la fotografía conserva 250 y el arrastre aprobado de 50. Reaprobar y comparar ambas versiones.

### Historia, 3.0 y recuperación

1. Restaurar la fixture 2.9 inicial. Editar el gasto de febrero a 2.300 y reaprobárselo: historial real n.º 2 y n.º 3, ninguna n.º 1 inventada, diferencia +100 en gasto; ahorro permanece 600. Editar después sin aprobar: estado modificado y ambas fotos intactas.
2. Exportar tras la primera automatización/reaprobación: versión 3.0. Descargar también la copia recuperable previa 2.9 completa. En un segundo contexto aislado, importar la exportación 3.0, revisar y cancelar primero; después confirmar y comparar todos los metadatos y colecciones.
3. Intentar importar copias ficticias con campos desconocidos, etiqueta 2.9 con automatización, arrastre duplicado/en cadena/fuera de remanente, historial desordenado o totales corruptos: rechazo sin sustituir datos.
4. Borrar solo planes: revisar conteos de reglas, procedencias, arrastres, fotos e historial, confirmar escribiendo BORRAR. Desaparecen todos los metadatos presupuestarios, permanecen banco/contactos/carteras. Importar la copia 3.0 recupera íntegramente la planificación.
5. Para comprobar reversión, importar la copia completa previa 2.9. Recupera exactamente sus datos y única foto conocida; no degradar una exportación 3.0 eliminando campos a mano.

### Errores, concurrencia y accesibilidad

1. Abrir dos pestañas del mismo perfil ficticio. Preparar una copia en A y guardar un cambio de origen en B. Confirmar A: conflicto y propuesta conservada, sin crear destinos ni sobrescribir B. Recargar explícitamente y volver a revisar.
2. Ejecutar la suite Chromium para fallos inducidos de cuota, copia/verificación y Web Locks. Comprobar modal con error, estado activo anterior íntegro y reintento exitoso. Durante un bloqueo retenido, pulsar dos veces confirmar/Escape: una única escritura activa y ningún cierre prematuro.
3. Repetir consultas y confirmaciones en 1280 px y 390 px, ambos temas. Navegar con Tab/Shift+Tab; Escape cierra primero la ventana superior y devuelve foco. La tabla de diferencias tiene región enfocable: flechas y gesto táctil permiten desplazamiento horizontal sin cortar importes ni ensanchar la página. Comprobar botones deshabilitados durante guardado y errores legibles.
4. Plegar Ingresos/Gastos/familias, cambiar entre Planificación/Catálogo y abrir los gráficos de los cuatro módulos: conservar borradores/protecciones y comportamiento de solo lectura. La emulación no sustituye la comprobación final en un móvil físico.

## Límites de esta entrega

No hay ejecución programada, notificaciones, reglas de importes variables, arrastres encadenados, reconstrucción de fotos inexistentes ni cierre contable nuevo. La revisión de un ajuste no cambia su importe. No se compacta/elimina historia automáticamente al alcanzar límites. La compatibilidad con aplicaciones antiguas se consigue mediante recuperación completa, nunca degradando 3.0. No se ha accedido a datos financieros reales ni se ha modificado `main` o Google AI Studio.
