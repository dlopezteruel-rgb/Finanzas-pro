# Fase 4A: auditoría funcional y estabilización

Repositorio `dlopezteruel-rgb/Finanzas-pro`. Base verificada: **`cfe4ccd20e5dca2e7fd653a2a65d56a6fb24537e`**, merge de PR #22, vigente en `origin/main` al iniciar. Rama `fix/phase-4a-stabilization`, creada con árbol limpio. Se conservaron la rama de catálogo y sus commits; no se recreó el almacenamiento original inaccesible.

## Alcance y método

Se ejecutó primero la batería sobre la base, sin cambiar fuentes de producción. Después se añadieron pruebas que fallan con los casos reproducibles, se aplicaron correcciones y se ejecutaron comprobaciones focalizadas. La entrega termina con una repetición completa y una única PR Draft. No se desarrollan funcionalidades, modelos financieros, autenticación, nube ni GitHub Actions.

Todas las pruebas usan datos ficticios y perfiles aislados. No se abrió almacenamiento personal ni se accedió a Google AI Studio. Los servicios del asistente se simulan en Chromium; no se consume Gemini real. El navegador de pruebas es Chromium, con Madrid como zona horaria; las emulaciones no equivalen a dispositivos físicos.

## Verificación inicial

`git fetch origin` confirmó el merge indicado y la ascendencia de PR #22. `npm ci --cache /workspace/work/npm-cache` instaló **187 paquetes**. La caché explícita evita escribir en HOME; equivale a la instalación reproducible del lockfile.

Resultado realmente ejecutado en la base: **402 unitarias y 273 resultados Chromium** (255 casos y 18 contenedores), cero fallos, omisiones o cancelaciones. Lint y build correctos. Avisos: dependencia transitiva `node-domexception` obsoleta, aviso previo de Vite sobre `__dirname` y notificación de versión nueva de npm; ninguno impidió validar.

Una auditoría adicional de accesibilidad sobre el build original examinó **128 superficies**: 16 por cada combinación de 390/768/1280/1920 px y claro/oscuro. Se registraron **48 incidencias de reglas axe por superficie** (repeticiones incluidas), correspondientes a cinco reglas: `button-name`, `label`, `select-name`, `color-contrast`, `scrollable-region-focusable`. No son 48 defectos independientes. La pasada de inventario permite recopilarlas; la suite estricta sí falla mientras existan violaciones.

## Inventario de módulos y recorridos auditados

| Área | Comprobaciones y evidencia automatizada |
| --- | --- |
| Inicio | Totales, saldos, patrimonio líquido, pendientes, gráficos, registro rápido, selección de cartera/partida, errores y recarga. `finance`, `chartData`, `financialAssistant`, `defaultWallet`, `phase1`, `phase4aSafety`. |
| Movimientos | Alta, edición, borrado con dependencias, tramitado/pendiente, filtros, fechas, CSV, referencias, dobles envíos. `asyncFormCases`, `deletion`, `intelligent`, `phase4aAudit`. |
| Presupuestos | Borrador compartido, ingresos/gastos, ahorro, aprobación y fotografías, multiperiodo, arrastres, reglas, subítems y archivo económico. `planning`, `automation`, `budgetSubitems`, `catalogArchive`. |
| Catálogo dentro de Presupuestos | Identidades, altas, edición, archivo/reactivación, eliminación, ratón/táctil/teclado, destinos incompatibles, cuotas, alcance de reglas activas y conflictos. `customCatalog`, `catalogReorder`, `catalogClassification`, `catalogArchive`. |
| Cuentas | Saldos iniciales y actuales, carteras predeterminadas, duplicados, eliminación segura, traspasos enlazados, edición/borrado conjunto y conservación del total entre carteras. `transfers`, `defaultWallet`, `deletion`, `phase1`. |
| Contactos | Reparto en céntimos, parte propia, deuda, reintegros parciales/completos, compensaciones sin banco, edición/borrado atómico e históricos. `sharedExpenses`, `sharedUx`, `sharedExpenseCases`, `phase4aAudit`. |
| Deudas | Préstamos, cuotas, compromisos personales, liquidaciones, referencias y cálculos vigentes. `finance`, `intelligentFinance`, `intelligent`, **`phase4aLoans`** para repetición, bloqueo real y cuota/reintento. |
| Asistente | Preguntas/negaciones sin movimientos, confirmación expresa, corrección antes de guardar, catálogo real, archivo y no duplicación. `phase1`, `catalogClassification`, `phase4aSafety`; límites del lenguaje indicados más abajo. |
| Almacenamiento transversal | Web Locks reales, revisión obsoleta, cuota, copia previa verificada, importación/exportación, restauración, malformados, referencias e identidades. Suites `phase1`, `backup`, `asyncForms`, `catalogArchive`, `stabilization` y sonda real de FinanceStore en Chromium. |

Los resúmenes de aplicación conservan su catálogo histórico mediante `planningCatalog`; no se cambió el contrato de funciones contables que reciben un catálogo explícito. Se preservan las exclusiones de transferencias y reintegros, la parte propia de compartidos y el modelo vigente de préstamos. No se reinterpretan ni reescriben operaciones guardadas.

## Incidencias reproducibles

“Actual en base” describe el resultado antes de corregir, no un fallo pendiente en la entrega.

| ID | Módulo | Problema y reproducción | Actual en base | Esperado | Gravedad | Estado | Prueba |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 4A-001 | FinanceStore | En `mutate`, modificar `d.wallets[0].initialBalance` en sitio y lanzar; repetir con NaN, cuota y previsión archivada. Probar también callback de `restore`. | Memoria alterada aunque falle; devolver el mismo objeto puede omitir validación/persistencia. | Memoria y disco anteriores intactos si falla; cambios válidos persistidos una vez. | **P1** | Corregido: draft separado para callbacks. | `stabilization.test.ts`, `phase4aSafety.browser.ts`. |
| 4A-002 | Registro natural | Introducir `Gasté -15 en senderismo`, `Nómina 2.650 €`, dos importes, una pregunta o `No registres 15…` en entrada rápida. | Propone 15 positivo, 2,65 o el primer número; preguntas/negaciones pueden mostrar Registrar. | Rechazar la propuesta dudosa y pedir corregir/formulario; consultas y negaciones no registran. | **P1** | Corregido con validación conservadora, compartida con chat y API local. | `stabilization.test.ts`, `phase4aSafety.browser.ts`. |
| 4A-003 | Fechas | `El 31/02 gasté 15…`; `El 12/11 gasté 15…`; “hoy” a las 00:30 de Madrid. | Desborda a marzo; toma el día como importe; puede usar el día UTC anterior. | Fechas reales, excluir fecha del importe y calendario Madrid. | **P1** | Corregido para entradas soportadas; formatos no soportados requieren formulario. Defaults nuevos de préstamos/cuotas usan Madrid. | `stabilization.test.ts`, `phase4aSafety.browser.ts`, `phase4aLoans.browser.ts`. |
| 4A-004 | Movimientos, Cuenta, Préstamo | Móvil: botón Nuevo solo con icono. Abrir Cuenta/Préstamo y revisar campos, cierre y colores con axe. | Faltan nombres accesibles en botón/campos/selector/colores/cierre. | Etiquetas comprensibles y estado del color seleccionado. | **P2** | Corregido con nombres accesibles y `aria-pressed`, sin rediseño. | `phase4aAudit.browser.ts`, reglas `button-name`, `label`, `select-name`. |
| 4A-005 | Contactos | Claro → expandir contacto con historial saldado ficticio. | La opacidad de todo el historial reduce el contraste a **3,87:1** en tres textos pequeños. | Al menos 4,5:1 en el texto auditado. | **P2** | Corregido retirando la opacidad del contenedor; conserva colores y superficies semánticas. | `phase4aAudit.browser.ts`, `color-contrast`; capturas comparativas. |
| 4A-006 | Asistente | Recorrer con Tab el historial desplazable de mensajes. | Región no enfocable; axe `scrollable-region-focusable`. | Región identificada y accesible al teclado. | **P2** | Corregido: región con nombre y `tabIndex=0`. | `phase4aAudit.browser.ts`. |
| 4A-007 | Préstamos/cuotas | Retener Web Lock, pulsar Pagar Cuota dos veces con instantes distintos, liberar. Después provocar cuota y reintentar. | Dos movimientos por acciones pendientes; el botón no espera ni ofrece error local. | Una cuota pendiente, guardado real, error junto al préstamo y reintento explícito. | **P1** | Corregido: `SaveResult`, guardia asíncrona, bloqueo de repetición y propagación; UUID nuevo solo en cuotas nuevas. | `phase4aLoans.browser.ts`: 390/1280, dos escrituras antes y una tras corregir. |
| 4A-008 | Herramientas | `npm run build` con Vite actual. | Aviso de uso de `__dirname` en su configuración. | Configuración compatible con futuros cargadores nativos. | **P3** | Pendiente: no bloquea el build actual; revisar junto al entorno de fase 4B. | Log de build e informe de validación. |
| 4A-009 | Préstamos | Crear Casa y Casa familiar; registrar una cuota con `loanId` de Casa familiar. | La coincidencia de texto cuenta también el pago en Casa aunque tenga otro vínculo explícito. | Contar solo en el préstamo enlazado; conservar el fallback anterior exclusivamente sin ID. | **P1** | Corregido: prioridad de `loanId`, sin reescribir ni migrar movimientos. | `stabilization.test.ts`, `phase4aLoans.browser.ts` con nombres coincidentes. |
| 4A-010 | Accesibilidad táctil | Medir botones visibles en móvil: cierre de Movimiento, lápiz de previsión y algunos controles de orden. | Anchuras compactas de 14–28 px, con altura mínima de 44 px y alternativas de teclado/arrastre. | Revisar comodidad táctil y espaciado antes de ampliar controles sin provocar overflow. | **P3** | Pendiente de validación física/priorización; dimensiones registradas por superficie, sin afirmar que todos midan 44 × 44. | `phase4aAudit.browser.ts`, campo `smallButtons`. |
| 4A-011 | Encabezados | Inspeccionar el esquema DOM de cada módulo con los paneles visibles. | Cuentas empieza en h3, Contactos no expone un encabezado nativo y Asistente contiene un salto h2→h4. | Jerarquía semántica consistente entre módulos, revisada con tecnología asistiva. | **P3** | Pendiente: mejora semántica, sin fallo WCAG A/AA detectado por axe ni bloqueo de navegación; no se rediseña el módulo. | `phase4aAudit.browser.ts`, campo `headings`. |

No se han encontrado P0 en los recorridos ejecutados. Esto no certifica la ausencia de defectos en recorridos no probados. Los P1/P2 reproducidos en esta tabla se resuelven sin alterar modelos económicos o registros existentes.

## Correcciones y garantías

**Callbacks de almacenamiento.** `FinanceStore` pasa una copia estructurada al callback de mutación/restauración. El estado vigente se conserva como base para validaciones, comparación y copia recuperable. Un callback que modifica en sitio ya no puede saltarse la validación por identidad de referencia ni contaminar memoria tras una excepción. Un retorno realmente idéntico sigue siendo no-op; un cambio válido conserva la escritura atómica. No se cambia clave, esquema, formatos 2.5–3.4, revisión ni migración. Abrir datos sigue sin escribir; las sustituciones destructivas mantienen confirmación y copia verificada.

**Registro natural.** No se amplía IA: se rechaza incertidumbre antes de preparar movimientos. Solo un importe positivo, representable en céntimos y sin miles; admite `2650`, `15,50` o `15.50`. Negativos, múltiples importes, precisión excesiva, notación científica, monedas diferentes y números inseguros piden corrección o formulario manual. Se conservan hoy/ayer/anteayer y los patrones existentes `el día DD`/`el DD/MM`, validando existencia y evitando que la fecha sea el importe. Años explícitos, días de semana, meses escritos y fechas no soportadas se dirigen al formulario. La propuesta válida sigue siendo editable y requiere confirmación. El chip de nómina usa `2650` en su texto; la etiqueta continúa mostrando `2.650 €`.

**Cuotas.** Esperan el resultado del almacenamiento con la guardia compartida; el botón no encola dos pagos mientras el primero esté pendiente. Un doble clic del ratón se considera una sola acción aunque la escritura sea rápida. La zona de pago impide abrir por propagación el editor del préstamo al estar deshabilitada. Tras un fallo se conserva el préstamo y aparece el error para reintentar. No se limita artificialmente a una cuota por mes: un pago posterior explícito sigue permitido. No se modifica amortización, tipos de interés, importes ni vínculos históricos. La partida archivada sigue bloqueando cuotas nuevas.

**Accesibilidad/visual.** Se conservan estética y geometría. La pasada estricta no utiliza excepciones ni una lista de violaciones ignoradas. Comprueba Tab/Shift+Tab dentro de diálogos, Escape, retorno del foco, persistencia del borrador al redimensionar, overflow y ausencia de escrituras. Axe revisa WCAG 2 A/AA y 2.1 AA. Sus resultados incompletos requieren revisión manual; cero violaciones automáticas no equivale a certificación completa ni a pruebas con lector de pantalla.

## Capturas comparativas

Datos ficticios, build original y corregido, mismo reloj/tema/viewport. El cambio visual objetivo es la legibilidad del historial saldado de Contactos; los nombres accesibles no precisan rediseñar los formularios.

| Tamaño | Antes | Después |
| --- | --- | --- |
| 390 px claro | [Original](assets/phase-4a/390-light-contactos-before.jpg) | [Corregido](assets/phase-4a/390-light-contactos-after.jpg) |
| 1280 px claro | [Original](assets/phase-4a/1280-light-contactos-before.jpg) | [Corregido](assets/phase-4a/1280-light-contactos-after.jpg) |

[Manifiesto y hashes](assets/phase-4a/manifest.json). La auditoría adicional captura los demás módulos/diálogos bajo `PHASE4A_CAPTURE_DIR`; no utiliza imágenes de datos personales.

## Reproducción y resultados

```sh
npm ci
npm test
npm run lint
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:ui
git diff origin/main...HEAD --check
# Casos adicionales de esta fase:
CHROMIUM_PATH=/usr/bin/chromium npm run test:ui:phase4a
```

Única dependencia añadida: **axe-core 4.14.0**, fijada en desarrollo con lockfile para reproducir la auditoría; no forma parte del bundle de la aplicación. `PHASE4A_AUDIT_REPORT=/ruta/informe.json` guarda resultados axe por superficie. `PHASE4A_CAPTURE_DIR=/ruta/capturas` conserva capturas. `PHASE4A_DIST` permite auditar un build anterior aislado. `PHASE4A_AUDIT_ONLY=1` recopila hallazgos sin fallar por axe y sirve exclusivamente para inventario: no es una aceptación de accesibilidad. La batería normal ejecuta la variante estricta.

Resultado final: **435 unitarias y 291 resultados Chromium** (270 casos y 21 contenedores), cero fallos, omisiones o cancelaciones. Son 33 unitarias y 18 resultados Chromium nuevos respecto a la base. `npm ci` final instaló 188 paquetes; lint, build y diff-check correctos.

Axe final: **0 violaciones** en 128 superficies. Quedan **132 grupos de comprobaciones incompletas** para revisión manual: 88 de `aria-prohibited-attr`, 8 de `aria-valid-attr-value` y 36 de `color-contrast`; no se presentan como aprobados ni se silencian reglas. Se registran también esquemas de encabezados y geometría de controles compactos. Cinco P1 y tres P2 corregidos; tres P3 pendientes de priorización.

[Validación, versiones, hashes, inventario y recuentos por suite](phase-4a-validation.json) · [Resultados axe completos, encabezados y medidas](phase-4a-accessibility.json).

Primer checkpoint de correcciones: 427 unitarias, lint/build y suites focalizadas correctas (9 auditoría visual, 6 seguridad y 3 cuotas). Segundo checkpoint: 433 unitarias y seguridad focalizada; cierre del vínculo de préstamos: 435 unitarias y 3 resultados focalizados de cuotas. Los checkpoints se publicaron antes de continuar. La validación completa final se registra por separado; estas cifras focalizadas no la sustituyen.

El cierre amplía los casos a negaciones simples de gasto y signos negativos separados/Unicode. Se interrumpieron dos pasadas finales para incorporar esos casos y el fallo reproducido de préstamo con vínculo ajeno; ninguna se contabiliza como batería completa.

Los intentos previos de reproducción constan como fallos esperados, no como pruebas superadas. Se corrigieron también dos errores de preparación de pruebas nuevas (nombre accesible del campo Importe y uso del mapa de saldos como lista); la prueba de duplicación de cuotas se repitió con instantes distintos para no confundir rechazo por ID repetido con prevención de doble guardado. No se cambian oráculos económicos anteriores para ocultar fallos.

## Límites y pendientes

- **Navegadores:** se intentó iniciar Firefox y WebKit de Playwright; faltan sus ejecutables en el entorno. No se declaran pruebas de esos motores, Safari real ni dispositivos Android/iOS físicos. Pendientes lector de pantalla y revisión manual de los resultados axe incompletos, orden semántico de encabezados y tacto físico.
- **Lenguaje, fase 6:** no se garantiza comprensión semántica general de negaciones complejas, cantidades escritas con letras, fechas coloquiales ni múltiples operaciones. Los formatos dudosos conocidos se bloquean; se debe revisar toda propuesta. No se amplía Gemini ni se añade inferencia de importes/fechas.
- **Préstamos:** el modelo existente estima saldo restando cuotas completas y conserva coincidencias históricas por descripción cuando no hay `loanId`; no es un cuadro de amortización bancario ni una migración de enlaces. Cambiar ese significado requiere propuesta y recuperación explícitas fuera de esta estabilización; se conserva el contrato y sus pruebas.
- **Almacenamiento:** local, sin cifrado y sujeto a cuota. Exportar copias fuera del navegador. La corrección aísla callbacks, no convierte el código de aplicación en un sandbox contra modificaciones arbitrarias de objetos públicos.
- **Herramientas:** aviso de Vite y dependencia transitiva obsoleta documentados; no se actualiza el árbol de herramientas general en esta fase.

## Recomendaciones para fase 4B

Configurar GitHub Actions únicamente en 4B: instalación con `npm ci`, Node fijado, Chromium reproducible, unitarias/lint/build/browser y diff-check; conservar artefactos de fallos y recuentos sin tratar omitidos como aprobados. Mantener la auditoría axe estricta y perfiles ficticios, sin secretos ni datos de AI Studio. Separar la futura matriz Firefox/WebKit de la validación física, fijar reloj/zona Madrid y controlar tiempos de espera sin reducir aserciones. Revisar entonces el aviso de configuración Vite y cachés/dependencias.

No se ha modificado `main`, fusionado, desplegado ni sincronizado Google AI Studio. La entrega se limita a la rama de estabilización y una PR Draft.
