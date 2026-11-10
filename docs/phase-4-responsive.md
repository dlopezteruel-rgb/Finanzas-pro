# Fase 4 — Rediseño visual responsive

Implementación del [Issue #11](https://github.com/dlopezteruel-rgb/Finanzas-pro/issues/11), leído íntegramente, incluidas sus ampliaciones de planificación; no tenía comentarios adicionales. Base verificada: `a892bfc1689f5598f3c527cd22da09398a502c5e` (PR #12 integrada). Trabajo exclusivo en `feature/phase-4-responsive-layout`. Se comprobaron comandos, rama y estado limpio antes de editar. No se modifica `main`, no se sincroniza Google AI Studio y todas las fixtures/capturas son ficticias.

## Diseño y distribución

El encabezado, navegación, avisos y contenido comparten un ancho fluido y márgenes laterales de `clamp(.875rem, 2vw, 2.5rem)`. Se elimina el límite global de 576/672 px; se conserva un ancho legible para conversaciones, notas y formularios. Se mantienen las siete entradas de navegación y las dos subpestañas de Presupuestos.

| Módulo | Organización |
| --- | --- |
| Inicio | Patrimonio y acciones contiguos; tres KPI; registro rápido de ancho legible; gráficos y últimos movimientos en proporción 8/4 en escritorio |
| Movimientos | Filtros de listado en columna lateral desde 1100 px; búsqueda y acciones compartidas; concepto, fecha completa y acciones/importes distribuidos en columnas; filas apiladas en móvil |
| Planificación | Controles/guardado separados; editor amplio y resumen lateral de 21 rem desde 1280 px; familias en dos columnas, con filas adaptadas al ancho real de la familia |
| Catálogo | Familias en cuadrícula de dos columnas desde 1100 px; mismos editores, detalle y protección de borrador; encabezados accesibles con Enter/Espacio |
| Cuentas | Tarjetas en dos/tres columnas; operaciones recientes contiguas en escritorio; gráficos con controles y paneles distribuidos |
| Contactos | Tarjetas en dos/tres columnas; nombres y cantidades legibles; detalle accesible con teclado y estado expandido; contraste corregido en el encabezado claro |
| Deudas | Préstamos en dos/tres columnas, resumen y acciones separados; formularios conservan su flujo y validaciones |
| Asistente | Contexto mensual guardado en una columna y conversación en otra; mensajes con máximo de 70 caracteres tipográficos de ancho; chips envolventes y entrada sin desbordamiento |

Los gráficos conservan el `viewBox`, su observador de tamaño, leyendas, selección por teclado/tap, tablas y estados. Los paneles se distribuyen en dos columnas cuando su contenedor supera 58 rem; no dependen solo del ancho de la ventana. Cambiar el tamaño no remonta el módulo ni reinicia filtros o borradores. Las tablas anchas tienen desplazamiento local; no se ocultan columnas financieras para hacerlas caber. La tabla anual aprovecha el ancho completo fuera del editor lateral.

Los diálogos con planificación o formularios en cuadrícula pueden utilizar hasta 52 rem en tablet/escritorio; las confirmaciones breves mantienen su límite anterior. El gestor de superposiciones y sus reglas de foco, Escape, scroll y espera de guardado permanecen intactos. Se añade un enlace «Ir al contenido», foco visible y objetivos de interacción de al menos 44 px en los controles principales. La paleta clara oscurece textos semánticos azules, verdes, rojos, ámbar e índigo para facilitar su lectura.

## Asignación local en directo

El resumen **Asignación del mes** muestra siete magnitudes distintas:

| Etiqueta | Origen |
| --- | --- |
| Ingresos previstos | Ingresos del borrador local |
| Ahorro objetivo | Objetivo del editor local |
| Gastos base asignados | Gastos base del borrador local |
| Pendiente de asignar del mes | Margen de `planningTotals` sobre las líneas base: ingresos − objetivo − base |
| Arrastres presupuestarios recibidos | Ajustes ya guardados del mes, separados de las entradas locales |
| Gasto efectivo previsto | Gasto de `planningTotals(combineLines(base, arrastres), objetivo)` |
| Margen previsto efectivo | Margen del mismo total efectivo; descuenta también los arrastres |

Ejemplo de la fixture: **3.000 ingresos − 600 objetivo − 1.800 base = 600 pendientes**. Con **100 de arrastres**, el gasto efectivo es **1.900** y el margen efectivo **500**. Los negativos se muestran como sobredistribución/déficit sin corregir cantidades automáticamente.

`planningPreview.ts` es un adaptador de presentación del editor: extrae las validaciones locales que ya tenía `PlanningView` y llama a `parsePlanningMoney`, `safeCents`, `combineLines` y `planningTotals`. No contiene otro motor contable, acceso a almacenamiento o datos bancarios. Los errores por campo, las sumas seguras y las comprobaciones de base más arrastre se mantienen. Si un importe es parcial, inválido o excede el rango, ambos totales locales dejan de estar disponibles; el panel muestra «—» y un aviso, sin presentar valores anteriores como actuales. El importe de arrastre guardado sigue identificado como tal.

En escritorio, el resumen permanece lateral y visible al desplazar el editor, con scroll interno si fuera necesario. En móvil/tablet se muestran inicialmente los dos márgenes; el resto se abre con **Ver desglose de asignación**. Al expandirlo pasa al flujo normal para no cubrir las partidas. En ventanas de menos de 650 px de alto el panel vuelve al flujo normal, favoreciendo el acceso a los formularios y al teclado. El panel comunica «Vista previa local · sin guardar» y sus cifras son una región de actualización accesible.

## Arrastres junto a las partidas

Cada gasto con ajuste conserva su **Presupuesto base (€)** editable y muestra, en la misma fila:

- Importe guardado y mes/año de origen, tomado de `carryovers[].fromMonth`, con la referencia `AAAA-MM` visible.
- Presupuesto efectivo calculado con la entrada local actual: base 200 + arrastre 50 = 250; al teclear 210 se ven 260 antes de guardar.
- Aviso potencialmente desactualizado mediante `carryIsStale`, sin recalcular el ajuste.
- Acción **Revisar arrastre de…**, que abre la vista previa existente de automatización. Exige guardar/descartar el borrador local antes de revisar; consultar o cancelar no escribe.

Las partidas sin arrastre omiten esas anotaciones. Los bloques/familias muestran el subtotal recibido cuando existe. No se crean ni duplican metadatos, movimientos, ingresos, saldos o ahorro realizado. Los gráficos, resumen anual e informes guardados continúan usando exclusivamente el estado persistido.

## Seguridad y compatibilidad

No hay cambios en `src/types` ni en `src/utils`: `FinanceData`, `FinanceStore`, JSON 2.5–3.0, cálculos bancarios, Web Locks, revisiones, respaldos, restauraciones, reglas de automatización y aprobaciones se mantienen byte a byte respecto a la base. El adaptador de presentación no recibe un almacén y no escribe.

Los handlers de guardado/aprobación y el gestor de borradores siguen siendo los anteriores. Las vistas previas solo modifican estado React. Revisar un arrastre utiliza el mismo diálogo/confirmación de 3B, con sus comprobaciones y guardado existentes. No se incorpora una nueva ruta de persistencia, preferencia guardada, dependencia, telemetría ni llamada financiera a un servicio externo.

Se puede verificar el límite de la entrega con:

```sh
git diff --exit-code a892bfc1689f5598f3c527cd22da09398a502c5e -- src/types src/utils
```

## Validación automatizada

Entorno: Node 24.22.1, npm 11.9 y Chromium local. Cada prueba crea un contexto/perfil aislado y siembra datos sintéticos. Se bloquean peticiones externas en la suite responsive; el Asistente se prueba sin enviar consultas y las suites anteriores simulan su API. No se abre ningún perfil ni respaldo del usuario.

```sh
npm test
npm run lint
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:ui
git diff --check
```

| Comprobación | Resultado final |
| --- | --- |
| Unitarias | 230 correctas, 0 fallos; 219 anteriores + 11 de presentación del borrador |
| TypeScript | `tsc --noEmit`, correcto |
| Compilación | Vite, correcta; sin dependencias nuevas |
| Chromium completo | 155 resultados correctos, 0 fallos: 147 casos hijos y 8 contenedores |
| Diff | `git diff --check`, correcto; `src/types` y `src/utils` intactos |

Desglose Chromium: Fase 1 **57**, UX compartidos **12**, borrados **23**, planificación 3A **13**, pestañas/plegados **11**, gráficos **8**, automatización **15**, responsive **16**. La nueva suite comprende diez combinaciones de anchura/tema, cuatro de zoom nativo/tema y un caso de revisión/foco/redimensionado, más su prueba contenedora.

La suite responsive prueba los siete módulos, Catálogo, tabla anual, actualización de ingresos/gastos/objetivo, márgenes distintos, negativos, parcial inválido, arrastres 0/+50, origen, aviso desactualizado, revisión cancelada, cambios de tamaño, navegación protegida, teclado/táctil y ausencia de desbordamiento global. Cuenta todas las llamadas a `Storage.setItem` y compara el conjunto completo de `localStorage`: **cero escrituras al consultar o editar sin guardar**. También comprueba que la tabla de gráficos guardados no cambia durante la edición local.

El zoom es el **zoom real de Chromium**, establecido con su control nativo en un perfil temporal; se comprueban `devicePixelRatio` y el ancho CSS efectivo (1440/1,25 y 1440/2). No se sustituye por CSS `zoom` ni por una simple escala de captura. Estos ajustes solo afectan al navegador descartable de la prueba.

Se mantienen los avisos anteriores de Vite sobre `__dirname` y el bloque principal superior a 500 kB. El cambio añade aproximadamente 5 kB de JS minificado y 9–10 kB de CSS antes de gzip; el bloque gráfico sigue siendo diferido. No se cambian configuraciones de seguridad para las pruebas o la publicación.

## Capturas comparativas

Se utiliza la misma fixture en un snapshot aislado de la base y en la implementación. Las siguientes capturas muestran Planificación junto a la edición de una partida, con 3.000/600/1.800 y 100 de arrastres. Las imágenes base conservan la disposición estrecha original; las nuevas muestran la asignación local y el origen del arrastre.

| Anchura | Oscuro: antes / después | Claro: antes / después |
| --- | --- | --- |
| 390 | [Antes](assets/phase-4/390-dark-before.jpg) · [Después](assets/phase-4/390-dark-after.jpg) | [Antes](assets/phase-4/390-light-before.jpg) · [Después](assets/phase-4/390-light-after.jpg) |
| 768 | [Antes](assets/phase-4/768-dark-before.jpg) · [Después](assets/phase-4/768-dark-after.jpg) | [Antes](assets/phase-4/768-light-before.jpg) · [Después](assets/phase-4/768-light-after.jpg) |
| 1280 | [Antes](assets/phase-4/1280-dark-before.jpg) · [Después](assets/phase-4/1280-dark-after.jpg) | [Antes](assets/phase-4/1280-light-before.jpg) · [Después](assets/phase-4/1280-light-after.jpg) |
| 1440 | [Antes](assets/phase-4/1440-dark-before.jpg) · [Después](assets/phase-4/1440-dark-after.jpg) | [Antes](assets/phase-4/1440-light-before.jpg) · [Después](assets/phase-4/1440-light-after.jpg) |
| 1920 | [Antes](assets/phase-4/1920-dark-before.jpg) · [Después](assets/phase-4/1920-dark-after.jpg) | [Antes](assets/phase-4/1920-light-before.jpg) · [Después](assets/phase-4/1920-light-after.jpg) |

Para regenerar capturas de todos los módulos y zoom, usar `RESPONSIVE_ARTIFACT_DIR=/tmp/finanzas-phase4-after` con la suite responsive. `RESPONSIVE_BASE_DIR` permite ejecutar solo capturas comparativas sobre un snapshot compilado de la base; nunca cambia la rama o el estado guardado del usuario.

## Guion manual con datos ficticios

1. Ejecutar `npm run dev` en un perfil de prueba nuevo de localhost/HTTPS con Web Locks. Generar el archivo sintético desde la raíz:

   ```sh
   node --import tsx --input-type=module <<'JS'
   import { writeFileSync } from 'node:fs';
   import { responsiveFixture } from './scripts/responsiveFixture.ts';
   import { makeBackup, parseBackup } from './src/utils/backup.ts';
   const content = JSON.stringify(makeBackup(responsiveFixture()), null, 2);
   parseBackup(content);
   writeFileSync('/tmp/finanzas-phase4-ficticio.json', content);
   JS
   ```

2. Importar solo ese archivo, revisar y confirmar. Seleccionar octubre 2026. No utilizar información real. La fixture contiene familias de prueba, cuentas ficticias, contactos, préstamos y una aprobación real sintética con arrastres de septiembre; el ajuste de Comida está marcado desactualizado intencionadamente.
3. Revisar Inicio, Movimientos, Presupuestos, Cuentas, Contactos, Deudas y Asistente a 390, 768, 1280, 1440 y 1920 px, con ambos temas. Comprobar columnas, espaciado, cantidades completas, navegación, tablas y ausencia de scroll horizontal de toda la página. En escritorio, comparar el uso de ancho con las capturas base.
4. En Planificación, comprobar los siete valores del ejemplo: ingresos 3.000, objetivo 600, base 1.800, pendiente 600, arrastres 100, efectivo 1.900 y margen efectivo 500. En móvil, abrir/cerrar el desglose; en escritorio, desplazarse hasta las últimas familias y comprobar el resumen lateral. En ventanas bajas, comprobar que el resumen vuelve al flujo normal y no tapa campos.
5. Sin guardar, escribir Comida **210**: base 1.810, pendiente 590, efectivo 1.910 y margen 490; la partida muestra +50 de septiembre y efectivo 260. Cambiar ingresos a **3.100** y objetivo a **650**: pendiente 640, margen efectivo 540. Verificar «Vista previa local · sin guardar».
6. Introducir un valor parcial **2,**, negativo, más de dos decimales o un importe fuera del rango seguro. Comprobar error inline, totales no disponibles y guardado deshabilitado. Corregir. Probar objetivo **4.000** con los valores anteriores: pendiente −2.710 y margen efectivo −2.810, sin ajuste automático.
7. Abrir los gráficos antes de editar; comprobar que sus cifras guardadas no cambian al teclear. Cambiar agrupación, leyenda y tipo de gráfico, redimensionar la ventana y verificar conservación de filtros y borrador. La tabla anual continúa mostrando solo planes guardados y meses sin plan diferenciados.
8. Comprobar que Alquiler y otras partidas sin arrastre omiten las anotaciones. En Comida, leer origen **2026-09**, importe +50 y aviso desactualizado. Con borrador local la revisión está deshabilitada y explica guardar/descartar. Descartar, abrir **Revisar arrastre de Comida ficticia**, comprobar la vista previa existente y cancelar; el ajuste y la foto no cambian.
9. Cambiar de módulo, periodo o subpestaña con cambios locales: comprobar el aviso y **Seguir editando**. Descartar solo cuando se elija explícitamente. Guardar un borrador ficticio y reaprobárselo mediante la confirmación existente: se mantienen estados/fotografías y respaldo según las reglas de 3A/3B.
10. Repetir Tab/Shift+Tab, Enter/Espacio en familias y contactos, enlace «Ir al contenido», Escape y retorno de foco de diálogos. Usar tap en controles y gráficos. Probar zoom real de navegador al 125 % y 200 %, tanto en claro como en oscuro; confirmar que no se pierden campos ni acciones de diálogo.
11. Revisar en un móvil físico con teclado virtual abierto, orientación vertical/horizontal y desplazamiento. Confirmar que inputs, botones de guardado y navegación siguen accesibles. La emulación de Chromium no certifica Safari/iOS, un WebView concreto ni el contenedor de AI Studio.
12. Para auditar escrituras, registrar el estado completo y las llamadas a `localStorage.setItem` después de importar. Navegar, plegar, editar, cancelar y redimensionar sin guardar: debe permanecer idéntico. La nueva suite lo comprueba automáticamente; cambiar el tema mediante su botón sí es una preferencia guardada del flujo anterior, por eso las pruebas siembran cada tema en un contexto distinto.

## Archivos y revisión

- Estructura de página: `src/App.tsx`, `Header.tsx`, `Navigation.tsx`, `src/main.tsx`, `src/responsive.css`.
- Módulos: `DashboardView.tsx`, `TransactionsView.tsx`, `BudgetsView.tsx`, `WalletsView.tsx`, `ContactsView.tsx`, `LoansView.tsx`, `AssistantChatView.tsx`, `charts/FinancialCharts.tsx`.
- Planificación: `PlanningView.tsx`, `PlanningSection.tsx`, `PlanningAutomationPanel.tsx`, nuevos `PlanningLiveSummary.tsx` y `planningPreview.ts`.
- Pruebas: nuevo `planningPreview.test.ts`, `scripts/responsive.browser.ts`, `scripts/responsiveFixture.ts`, registro en `src/tests.ts` y `package.json`. Dos aserciones anteriores de planificación/automatización se adaptan a las nuevas etiquetas, conservando las comprobaciones de datos y persistencia.
- Documentación: este informe, enlace en README y 20 capturas comparativas en `docs/assets/phase-4/`.

Pendiente de revisión humana antes de fusionar: densidad de las familias en monitores grandes, comodidad del resumen compacto con teclado virtual, lectura de tablas anuales con catálogos extensos y contraste en pantallas físicas. Los datos de etiquetas/nombres extremadamente largos pueden envolver y las tablas pueden requerir scroll local. No se certifica accesibilidad con lectores de pantalla reales; sí se verifican nombres/estados accesibles, teclado, foco y zoom en Chromium. No hay cambios financieros, nuevas migraciones ni rediseño de las reglas de aprobación.
