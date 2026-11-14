# Fase 5C — Estabilización multidioma

## Estado de partida y límites

Base exacta: `7611ab8ed09589ec87c0544ef2c4b7affcf1302c`, merge de PR #26. Referencias remotas actualizadas; no había commits posteriores a esa referencia. Árbol limpio antes de crear `fix/phase-5c-multilingual-stabilization`. Se conservan la infraestructura y los cinco idiomas habilitados de 5A/5B. No se modifica main, se fusiona, despliega ni sincroniza Google AI Studio.

Las comprobaciones usan datos ficticios, almacenamiento aislado y bloqueo de solicitudes externas. No se utilizan cuentas ni información financiera personal. La representación interna sigue en EUR, fechas ISO y Europe/Madrid; la localización solo afecta a presentación. FinanceStore, modelos, cálculos, reglas, parsers, Web Locks, migraciones, esquemas y API/prompts del asistente quedan fuera de las correcciones.

Se comparan directamente **116 archivos protegidos, idénticos byte a byte a la base**, incluidos utils, types, constants, services, i18n, servidor, workflow, lockfile y configuración Vite. [Manifiesto y SHA-256](phase-5c-protected-files.json). Los cambios de App, formularios y confirmaciones se limitan a roles/relaciones ARIA; sus callbacks y condiciones financieras se conservan. La apariencia de landing reutiliza el selector existente y no carga FinanceStore.

Este documento es un registro en curso. Los apartados sin resultado final explícito permanecen pendientes y no constituyen una aprobación.

## Línea base

`npm ci`: 188 paquetes, sin cambios de dependencias ni lockfile. `npm test`: **515/515**, cero fallos/omisiones/cancelaciones/pendientes. Infraestructura CI: **22/22**. Lint y build correctos; aviso de chunks >500 kB presente. Chromium inicial: **655/655, 34 suites**, cero fallos/omisiones/cancelaciones/pendientes. Axe general: **128 superficies, 0 violaciones, 132 grupos incompletos locales**. [Resultados de línea base](phase-5c-baseline-results.json).

Referencia remota 5B, distinta de esta nueva validación: [ejecución 43539598118](https://github.com/dlopezteruel-rgb/Finanzas-pro/actions/runs/43539598118), SHA `d12fadb7084cda7579bd74e4684acbdba68f8351`. Sus artefactos se conservan y el ZIP de navegador tiene SHA-256 `780ea2053559e4c6f1fd51d078c47d5852b4d25c1dd1814ad4ce6363a3935fb7`. Contenía 655 resultados en 34 suites, axe general 128 superficies/136 grupos incompletos y matrices 1217 observaciones/1527 grupos incompletos; cero violaciones automáticas.

## Superficies y matriz

| Superficie | Cobertura prevista en 5C | Evidencia |
| --- | --- | --- |
| Landing y entrada/salida | Cinco idiomas × 390/768/1280 px; navegación a app, vuelta y recarga; etiquetas nativas, teclado, lang, metadatos y layout | Nueva suite landingLanguage y capturas reales |
| Preferencia y pestañas | Cambio repetido sin recargar, dos pestañas landing/app, borrador y foco, cuota/lectura/acceso denegados, valor inválido | Nueva suite y regresión i18n existente |
| Inicio, movimientos y cuentas | Resumen/tesorería, importes, identificadores, estados, formularios, transferencias, histórico | Batería conservada y matrices bancarias/presentación |
| Planificación y catálogo | Previsiones, aprobación, snapshots, subítems, archivo, dependencias, arrastre y automatización | Matrices conservadas sin modificar reglas |
| Deudas y contactos | Préstamos, compartidos, reintegros y compensaciones | Matrices obligations/shared y suites económicas conservadas |
| Asistente y registro rápido | Propuestas corregibles y confirmación, ambigüedad/negación, doble envío, texto externo literal | Matriz assistant conservada; parser y servicio intactos |
| Recuperación y destrucción | Importar/exportar/restaurar, copia verificable y confirmaciones | Matrices storage/completion y suites de seguridad conservadas |
| Gráficos | Cuatro módulos, leyendas, filtros, tablas y enlaces | Matriz charts y detalles axe enriquecidos |

Las matrices existentes recorren los cinco idiomas y ambos temas de la aplicación a 390/768/1280 px. La landing mantiene su paleta clara propia; regresar desde una app oscura no implica que disponga de un modo oscuro independiente. El alcance final ejecutado, con cifras y resultados, se registra al cerrar la validación.

Matriz nueva de landing, aprobada en la suite focalizada de 42 resultados (la regresión completa se registra aparte):

| Idioma | 390 px | 768 px | 1280 px | Tema previo de app | Teclado, lang, persistencia y datos |
| --- | --- | --- | --- | --- | --- |
| Español · es-ES | Correcto | Correcto | Correcto | Claro y oscuro | Correctos |
| English · en-GB | Correcto | Correcto | Correcto | Claro y oscuro | Correctos |
| Italiano · it-IT | Correcto | Correcto | Correcto | Claro y oscuro | Correctos |
| Français · fr-FR | Correcto | Correcto | Correcto | Claro y oscuro | Correctos |
| Português · pt-PT | Correcto | Correcto | Correcto | Claro y oscuro | Correctos |

Son 30 recorridos, con los cinco cambios de idioma repetidos en cada uno. La prueba conserva un sentinel de documento para excluir una recarga por seleccionar idioma, verifica los nombres nativos y la descripción accesible, Home/ArrowDown/Enter/Tab/Shift+Tab, el foco del mismo elemento, la vuelta por historial y la recarga posterior. El importe pendiente 1234.56 y el concepto literal se conservan durante siete cambios entre pestañas. Se observan todas las escrituras/remociones de localStorage ajenas a la preferencia y clear, además de comparar el JSON financiero literal. Las comprobaciones de Escape se realizan en menús, diálogos y el listbox de la aplicación; el selector de landing utiliza el control nativo del navegador.

## Capturas comparativas

Capturas de la aplicación real, con el mismo fixture ficticio y sin retoque. [Manifiesto con procedencia y SHA-256](phase-5c-screenshots.json). Los contornos visibles muestran el foco de teclado conservado en el selector. Las capturas posteriores corresponden al código publicado `791410fdb68be69330d46b344d9e29e60f13a5e4`, usado en la validación completa.

| Resolución | Antes, base 7611ab8 | Después, selector compartido |
| --- | --- | --- |
| 390 px, francés | [Antes](screenshots/phase-5c/landing-fr-390-before.png) | [Después](screenshots/phase-5c/landing-fr-390-after.png) |
| 768 px, francés | [Antes](screenshots/phase-5c/landing-fr-768-before.png) | [Después](screenshots/phase-5c/landing-fr-768-after.png) |
| 1280 px, francés | [Antes](screenshots/phase-5c/landing-fr-1280-before.png) | [Después](screenshots/phase-5c/landing-fr-1280-after.png) |

Otros ejemplos: português [390](screenshots/phase-5c/landing-pt-390-after.png), [768](screenshots/phase-5c/landing-pt-768-after.png) y [1280 px](screenshots/phase-5c/landing-pt-1280-after.png). Se inspeccionan capturas y geometría DOM; no se afirma haber usado pantallas o dispositivos físicos.

## Incidencias reproducidas

| ID | Gravedad | Reproducción y resultado previo | Resultado esperado / corrección | Estado y prueba |
| --- | --- | --- | --- | --- |
| 5C-01 | P2 | Abrir landing: no hay control de idioma; requiere entrar en app para elegirlo | Reutilizar LanguageSelector, proveedor y preferencia; cambio inmediato y cabecera adaptable | Implementado; cinco regresiones unitarias por idioma y matriz Chromium nueva |
| 5C-02 | P2 | Brand tiene aria-label sobre span sin rol; axe no puede establecer su soporte | Conservar texto visible y descripción, eliminar nombre ARIA redundante | Reproducido en DOM/axe y unitaria previa |
| 5C-03 | P2 | Contenedores con nombre sin rol: Inicio, Movimientos, Deudas, recientes, reparto, liquidaciones y alcance del borrado | Dar rol group a los grupos ya etiquetados, sin cambiar contenido ni acciones | Reproducido en axe; regresiones Chromium en cinco idiomas |
| 5C-04 | P2 | Selector de partida cerrado anuncia aria-controls a un listbox aún no montado | Referenciar la lista solo cuando existe; mantener apertura, Escape y foco | Reproducido en axe y unitaria previa |
| 5C-05 | Pendiente manual | Contraste no determinable sobre glifos, SVG y capas/scroll | Conservar evidencia detallada, distinguir mecanismos y revisar ejemplos | No equivale a infracción ni a revisión manual aprobada |
| 5C-06 | P2 | Abrir selector de partida en Movimiento: listbox contiene li implícitos y opciones con padre incompatible; tres reglas axe fallan | Marcar los li como presentación; las opciones conservan sus roles y teclado | Reproducción real en nueva auditoría abierta; corrección semántica localizada |

No se incorporan correcciones financieras ni refactorizaciones especulativas. Los siete fallos unitarios nuevos sobre la base son reproducciones intencionadas, separados de los resultados finales. La primera pasada nueva de Chromium terminó 40/42 por una etiqueta mal escrita en el propio test (faltaban mayúscula y EUR); se corrigió usando la clave canónica. La siguiente terminó 40/42 y reveló el defecto real 5C-06: aria-required-children, aria-required-parent y listitem. No se relajan esas reglas. La distribución inicial de los controles nuevos se ajusta tras observar que se apilaban innecesariamente en escritorio; una aserción exige compartir fila a partir de 768 px.

La auditoría general focalizada posterior a los primeros cambios completó **9/9 resultados y 128 superficies**, cero violaciones y **36 grupos incompletos solo de contraste**. La regresión de infraestructura i18n conservada completó **10/10**. Estos resultados focalizados no sustituyen la batería final completa.

Checkpoint de implementación: **528/528 unitarias**, lint/build/diff-check correctos; nueva suite **42/42** tras la corrección del listbox y de la fila de controles en escritorio. Incluye 30 combinaciones de idioma/resolución/tema de origen, dos pestañas reales con borrador y foco conservados, cinco recorridos de grupos accesibles y cinco escenarios de almacenamiento. El selector conserva IDs y ayudas del menú anterior y añade una apariencia de landing con los nombres nativos. Reutiliza exclusivamente useI18n/setLanguage: no hay nueva clave, proveedor, traducción, parser ni escritura financiera. El select nativo expone su valor y lang cambia con el proveedor; los fallos de persistencia siguen anunciándose mediante role=status.

## Axe: clasificación del legado de 5B

Los **1663 grupos** de 5B son observaciones repetidas, no 1663 defectos independientes. Al agrupar por informe, superficie y regla resultan **83 conjuntos equivalentes**, conservando referencias a cada registro original.

| Regla | General | Matrices | Investigación |
| --- | ---: | ---: | --- |
| aria-prohibited-attr | 88 | 582 | Reproducidos nombres ARIA en span/div sin rol: marca, controles de inicio y recientes. Corrección localizada; el legado no guardaba targets y no permite atribuir cada nodo retrospectivamente. |
| aria-valid-attr-value | 8 | 60 | Reproducida referencia al popup de partidas no montado. Verificación del estado cerrado y abierto, Escape y foco. |
| color-contrast | 40 | 885 | Reproducidos nonBmp (símbolos), imgNode (texto SVG), elmPartiallyObscured y elmPartiallyObscuring (capas y scroll). Requieren revisión contextual, no una exención global. |

Los informes históricos solo conservan regla y número de nodos. No se inventa una causa específica para un registro sin target. Las reproducciones actuales retienen target, HTML, check, mensaje y datos del motor. La nueva herramienta `scripts/i18n/axe-review.mjs` agrupa dimensiones equivalentes sin descartar observaciones, y falla ante evidencia ausente o inconsistente. Las reglas axe WCAG 2 A/AA y 2.1 AA se mantienen íntegras. La revisión se completa con los resultados actuales y los pendientes manuales al final de la fase.

El [índice del legado](phase-5c-axe-5b-reference.json) conserva los 1663 registros: 33 conjuntos aria-prohibited-attr, 3 aria-valid-attr-value y 47 color-contrast. La [investigación reproducida](phase-5c-axe-investigation.json) distingue seis mecanismos y retiene ejemplos de los 26 estados inspeccionados en la base. Los nuevos informes de las 12 auditorías conservadas añaden targets, HTML y datos de checks sin alterar sus aserciones, superficies ni reglas.

Revisión suplementaria de estilos en gráficos/opciones/recuperación a 390 px, claro y oscuro: texto principal/SVG calculado sobre su ancestro opaco da 14.102:1 en claro y 12.636:1 en oscuro; ayuda de opciones/recuperación 5.999:1 y 8.321:1. Es una comprobación de colores calculados, no prueba de la composición real de todas las capas, recortes o etiquetas. El contraste de SVG, los elementos bajo scroll y las superposiciones continúan necesitando revisión visual contextual. Los glifos decorativos observados (flechas con aria-hidden y texto adyacente) se distinguen del texto informativo. No se eximen reglas ni se convierten automáticamente estos grupos en aprobaciones.

No se han realizado pruebas con lector de pantalla ni dispositivos físicos. Inspección de DOM, teclado automatizado, estilos y capturas no se presentan como tales.

## Fase 5D — Catálogo multidioma: análisis, sin implementación

Incidencia comunicada: «Las familias y partidas predeterminadas siguen en español y determinadas entradas no permiten editar su nombre, crear nuevas o eliminarlas». La primera parte responde al diseño de 5B: los nombres persistidos se tratan literalmente, incluso los procedentes del catálogo inicial. No hay traducción destructiva ni migración automática.

El registro inicial `src/constants/categories.ts` contiene **12 familias y 77 partidas**, enumeradas con sus identidades en [el inventario de catálogo](phase-5c-catalogue-inventory.json):

| Tipo | Familia / identidad | Partidas |
| --- | --- | ---: |
| INGRESO | LABORALES / L | 9 |
| INGRESO | FINANCIEROS / F_INC | 3 |
| INGRESO | PATRIMONIALES / P_INC | 4 |
| INGRESO | EXTRAORDINARIOS / X_INC | 3 |
| INGRESO | EMPRESARIALES / E_INC | 3 |
| INGRESO | AYUDAS Y TRANSFERENCIAS / A_INC | 4 |
| INGRESO | OTROS INGRESOS / O_INC | 3 |
| GASTO | FIJOS / F_EXP | 15 |
| GASTO | VARIABLES / V_EXP | 9 |
| GASTO | PERSONALES / P_EXP | 12 |
| GASTO | ECONÓMICOS Y CRÉDITOS / E_EXP | 8 |
| GASTO | DIDÁCTICO / D_EXP | 4 |

Las familias usan code; las partidas se identifican por **type + code**, pues un código puede existir en ambos tipos. Los subítems tienen id propio y padre type/code. Los subgrupos heredados (por ejemplo F.001 y «FIJOS - Vivienda») son campos groupCode/groupName de la partida, no familias BudgetGroup independientes. No existe operación para renombrar esos subgrupos como entidad autónoma.

Las familias creadas por el editor reciben family-<id> y las partidas partida-<id>. Esto identifica las creaciones de ese editor, pero no demuestra la procedencia de todos los datos importados o duplicados: duplicar una partida puede generar un nuevo código del patrón antiguo. Tampoco hasCustomCatalog es una marca de procedencia: detecta metadatos de archivo/retirada. No se debe inferir «predeterminado sin personalizar» solo por nombre o prefijo.

Reproducción de restricciones con copias ficticias en memoria del catálogo inicial: renombrar familia L y su primera partida, crear una partida en L y retirar una partida predeterminada sin uso funcionan. El original permanece intacto. Eliminar L mientras contiene partidas falla; eliminar una partida referenciada por un movimiento falla. El editor no contiene una prohibición por ser predeterminada. La gestión se abre desde el details «Gestionar familias y partidas», separado del detalle presupuestario. Un borrador de planificación pendiente bloquea cambios hasta guardarlo o descartarlo; una familia archivada no admite nuevas partidas; una identidad retirada no se edita ni reutiliza. Estas restricciones corresponden al diseño actual, no prueban una regresión. El bloqueo adicional descrito sin identidad/datos/pasos concretos queda pendiente de reproducción; no se descarta por no aparecer en el fixture.

`catalogDependencies` comprueba movimientos también pendientes, previsiones, préstamos, identidades/desgloses de subítems, líneas base/arrastres/desgloses de aprobaciones e históricos, reglas y procedencia de planificación, arrastres y reglas periódicas incluso retiradas. El borrado deja tombstones y exige ausencia de dependencias; una familia debe estar vacía de partidas activas y referencias. El archivo exige confirmar reglas activas y revalidar el alcance en FinanceStore. Los importes archivados y snapshots aprobados siguen protegidos.

Propuesta para 5D, sujeta a su encargo y validación:

1. Registro de presentación por identidad estable de familia y por pareja type/code para partida; claves traducibles separadas del nombre persistido. Incluir explícitamente la distinción entre familia contenedora y subgrupo heredado.
2. Conservar todos los nombres personales y las etiquetas históricas literalmente. Una igualdad con el español original no demuestra consentimiento para traducir. Definir procedencia/override u opción explícita antes de aplicar etiquetas traducidas a un catálogo ya guardado.
3. Resolver cómo conservar esa preferencia/procedencia en exportaciones y restauraciones, revisando compatibilidad/versionado por separado. No alterar automáticamente JSON 2.5–3.4 ni migrar en apertura.
4. Un presentador compartido para catálogo, selectores, planificación, movimientos nuevos y gráficos; las búsquedas/palabras clave y el parser son una decisión independiente, no una consecuencia automática de traducir UI.
5. Mantener invariantes de archivo, reactivación, eliminación y barrera Ingresos/Gastos. Probar catálogo inicial, renombrado, duplicado, importado, histórico ausente/retirado, ambos tipos con igual código y aprobación inmutable, con preferencias entre pestañas.

En 5C no se traduce el catálogo ni se cambian sus reglas de edición.

## Rendimiento: medición y propuesta

Medición reproducible mediante `node scripts/i18n/bundle-audit.mjs <salida.json>`. Genera un build de producción en memoria con salida temporal propia; no reemplaza dist mientras se ejecutan pruebas. Registra bytes minificados y gzip por chunk, importaciones y módulos i18n. renderedLength es metadato anterior a la minificación final y no una atribución exacta de bytes comprimidos.

Base: index **1 131 460 bytes**, App **515 671**, FinancialCharts **40 423**. El chunk inicial contiene los cinco diccionarios mediante importaciones estáticas de messages.ts; la landing también los descarga. Español está repartido entre es.ts y es.p*.ts/es.plurals.ts: medir solo es.ts subestimaría su tamaño. El aviso Vite >500 kB permanece documentado.

[Medición estabilizada](phase-5c-bundle-results.json), mismos hashes de archivos que el build probado:

| Chunk | Bytes minificados | gzip nivel 6 | Cambio bruto frente a base | Carga |
| --- | ---: | ---: | ---: | --- |
| index-BnuTBXQs.js | 1 132 495 | 307 368 | +1035 | Inicial, incluye landing y cinco diccionarios |
| App-B8ii7PJF.js | 514 936 | 129 827 | −735 | Diferida al entrar en app |
| FinancialCharts-BI4HpfTi.js | 40 428 | 12 476 | +5 | Diferida al abrir gráficos |

El movimiento del selector compartido al chunk inicial explica la redistribución entre index y App; el total JavaScript aumenta 305 bytes. Los diccionarios suman 885 708 bytes de fuentes (incluidos los fragmentos españoles). Los módulos i18n en index tienen renderedLength acumulado 878 583; los adaptadores diferidos de App 77 919 y gráficos 4442. No se compara ese metadato con bytes minificados como si fuera un porcentaje exacto. Vite informa CSS 94.12 kB y gzip 17.03 kB. Su estimación gzip del JavaScript y la medición explícita nivel 6 son métodos distintos y se registran como tales. No se modifican las importaciones ni la estrategia de carga de los diccionarios.

Propuesta posterior: carga diferida de diccionarios no seleccionados dentro del proveedor existente, manteniendo fallback, validación, estados de error, secuencia de solicitudes y cambios simultáneos entre pestañas. Medir arranque y cambio de idioma antes/después. No se implementa ese cambio de arquitectura en 5C.

## Validación final y entrega

Pendientes: batería completa del código final, clasificación de los informes finales enriquecidos, capturas comparativas, commit publicado y PR Draft nueva con los tres checks del SHA final. Se registrarán separadamente resultados locales y GitHub Actions; ningún resultado de 5B sustituye esta validación.

La entrada libre del asistente conserva el reconocimiento existente en español. Cambiar idioma no amplía sus intenciones ni garantiza reconocimiento en inglés/italiano/francés/portugués. Los ejemplos y ayudas mantienen ese límite explícito; los prompts y la API no cambian.
