# Fase 3A: planificación financiera

Implementación del Issue #4 sobre `098c70201fa3d925824423aee6120678d672dca6`, rama `feature/phase-3a-financial-planning`. La entrega es una PR Draft contra main, sin fusión.

## Comportamiento y datos

En **Presupuestos** aparece el editor de **Planificación financiera**, manteniendo debajo el catálogo y las fichas anteriores. Se editan directamente ingresos y gastos, por familia, y un ahorro objetivo independiente. Los nombres son visibles; los códigos solo identifican las partidas. Los planes históricos sin partida en catálogo aparecen explícitamente y no se pierden.

Los campos son borradores locales. Escribir, navegar por meses/años o cancelar no modifica el almacenamiento. Guardar escribe todos los importes y el objetivo en una sola mutación. La navegación a otro mes/sección o a una ficha con cambios locales pide descartar o seguir editando; cerrar/recargar la página utiliza el aviso nativo del navegador. Durante el guardado no se permite abandonar la planificación.

Los importes usan céntimos enteros seguros: `3000`, `3000,00`, `3000.00`, `3.000,00`. Se rechazan negativos, vacío, notación exponencial, texto sobrante y más de dos decimales. `3.000` se rechaza por ambiguo: escribe `3000` o `3.000,00`. Los importes que no pueden representarse exactamente en el campo numérico histórico de `budgetPlans` también se rechazan, sin redondear. Un total fuera del rango seguro impide guardar. Un dato antiguo con más de dos decimales permanece intacto al leer; exige corrección explícita antes de planificar ese mes.

I = ingresos; G = gastos; S = ahorro objetivo. Disponible = I − S; margen = I − S − G; balance previsto = I − G. El objetivo no es gasto ni movimiento ni transferencia. Se muestra separado del balance real. El cálculo ejecutado reutiliza las reglas existentes: solo procesados, parte propia de gastos compartidos estructurados y exclusión de transferencias/reintegros identificados. No cambia el motor contable.

La aprobación requiere revisar un modal con totales y desglose. Si el margen es negativo o S > I, una casilla exige aceptación expresa del déficit. Se esperan cuota, Web Locks y revisión; los errores conservan el modal y los valores. El bloqueo del formulario evita el doble envío.

La vista anual muestra los 12 meses, estado y totales guardados, cobertura y suma parcial. Los cambios locales aún no guardados no aparecen como datos anuales persistidos. Seleccionar un mes no crea datos. Se admiten periodos 0001-01 a 9999-12.

## Modelo, formato y migración

`budgetPlans` sigue siendo el único origen editable de previsiones monetarias. `FinanceData.planningMonths` es opcional: su ausencia en defaults/datos antiguos es intencionada para no migrar al leer.

Cada metadato mensual contiene `monthYear`, `savingsCents`, `revision` y, opcionalmente, la última `approval`. La aprobación contiene número correlativo, revisión del contenido, fecha ISO UTC, líneas positivas en céntimos identificadas por `type+code` y totales. Omitir una partida de la fotografía equivale a cero. No contiene una segunda fuente editable del plan. La comparación muestra la última fotografía y las previsiones guardadas actuales.

La revisión de contenido se incrementa cuando cambian importes u objetivo. `FinanceStore` detecta las ediciones de cualquier pantalla y conserva la última fotografía. Una edición que luego vuelve al importe anterior sigue marcada como modificada hasta una reaprobación explícita. La reaprobación sustituye únicamente la última fotografía y aumenta el número; el historial completo queda para 3B. Las mutaciones genéricas no pueden eliminar la aprobación ni sobrescribirla sin una nueva aprobación válida. La restauración explícita sí sustituye el conjunto completo.

Solo se exporta **JSON 2.9** cuando hay metadatos mensuales no vacíos. Se siguen validando/restaurando 2.5, 2.6, 2.7 y 2.8 sin inyectar esos campos. 2.9 requiere metadatos válidos, meses únicos, revisiones/fecha/líneas/totales coherentes y concordancia entre fotografía vigente y `budgetPlans`. Una fotografía modificada conserva sus importes históricos; no se exige que siga coincidiendo con el borrador.

La primera escritura 2.9 utiliza la transición de versión existente: bajo Web Locks y revisión, guarda y relee una copia recuperable anterior **antes** de escribir el único snapshot activo. Si falla respaldo, verificación o escritura, no se aplica el nuevo estado. Las restauraciones y el borrado masivo mantienen copia previa. Borrar presupuestos incluye objetivos y aprobaciones y los incorpora a las cantidades/alcance revisados. Las demás colecciones se conservan.

**Una versión anterior de la app rechaza JSON 2.9.** Para volver atrás utiliza la copia completa anterior desde Opciones y datos → Copias de recuperación → descargar → Importar JSON. No cambies la etiqueta de versión ni borres campos a mano. No hay migración automática al cargar ni acceso a Google AI Studio.

## Archivos principales

- `src/utils/planning.ts`: parser, cálculos, estado/revisión, guardado mensual y resumen anual.
- `src/types/finance.ts`, `src/utils/backup.ts`: tipos y validación estricta/selección de 2.9.
- `src/utils/financeStore.ts`, `src/utils/clearData.ts`: invalidación central, atomicidad y borrado con alcance/recovery.
- `src/components/PlanningView.tsx`, `src/App.tsx`, `src/index.css`: editor, resumen, aprobación, guardia de salida y estilos locales de ambos temas.
- `BudgetsView`, `PartidaDetailModal`, `RestorationModal`, `ConfirmClearModal`: compatibilidad con las pantallas anteriores, entrada estricta y recuentos de metadatos.
- `src/utils/planning.test.ts`, `scripts/planning.browser.ts`, `src/tests.ts`, `package.json`: regresiones unitarias y Chromium.
- `scripts/asyncFormCases.ts`: corrige una sincronización previa: espera el error real de cuota al crear un contacto, en vez de confundirlo con el aviso de reparto ya visible. No elimina aserciones ni desactiva casos.

## QA manual: exclusivamente datos ficticios y navegador aislado

1. Abre un perfil/contexto de prueba vacío, sin almacenamiento financiero real. En Presupuestos elige febrero de 2028. Navega a enero de 2030 y vuelve: no deben crearse planes ni movimientos por navegar.
2. En febrero de 2028 introduce sueldo 3.000,00; gasto alimentación 200,00; alquiler 2.000,00; objetivo 600,00. Comprueba I=3.000, G=2.200, S=600, disponible=2.400, margen=200 y balance=800. Modifica varios inputs y observa totales por familia. Prueba `-1`, `1,234`, `NaN` y vacío: error inline, sin guardar.
3. Intenta ir a Cuentas o cambiar de mes: debe avisar. Seguir editando conserva campos; descartar continúa sin guardar. Recarga con cambios locales e interactúa antes de cerrar: debe aparecer el aviso nativo.
4. Guarda borrador. Comprueba las filas y el ahorro tras recargar. Exporta: 2.9, fotografía aún ausente, movimientos/carteras idénticos. En recuperación debe existir una copia del formato anterior, que debe poder importarse tras vista previa y confirmación.
5. Revisa y cancela: no escribe. Revisa otra vez y aprueba; comprueba número 1 y fotografía. Haz doble clic: solo una aprobación. Cambia ahorro a 900: margen −100. El modal debe avisar y deshabilitar confirmar hasta marcar el consentimiento.
6. Edita el previsto desde la ficha antigua de una partida: estado «Modificada desde la última aprobación», fotografía intacta. Volver al importe original no debe reaprobárselo automáticamente. Reaprobar aumenta el número.
7. Abre el resumen anual 2028: doce filas y cobertura 1/12. El total suma el mes guardado; no el borrador local. Selecciona 2030-01: sin plan, sin registros nuevos.
8. En dos pestañas del mismo contexto ficticio, guarda desde una y confirma un borrador obsoleto desde la otra: rechazo de concurrencia, conserva campos y modal. Usa la recarga ofrecida antes de volver a editar. Las pruebas automatizadas simulan además cuota, copia fallida/no verificable y Web Locks denegado.
9. Repite editor/aprobación con Tab, Shift+Tab y Escape, tema claro y oscuro, escritorio y móvil. El foco queda en la ventana superior; Escape cancela salvo mientras guarda. Comprueba legibilidad, scroll local del resumen anual y ausencia de desbordamiento horizontal de la página.
10. Importa/exporta fixtures 2.5–2.8 sin metadatos y 2.9; rechaza duplicados, fecha imposible y totales manipulados. En el perfil ficticio, borrar solo presupuestos debe incluir metas y aprobaciones, conservar movimientos y dejar copia recuperable.

## Validación y límites

Comandos de referencia desde el checkout:

```sh
npm test
npm run lint
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:ui
git diff --check
```

Las pruebas se ejecutan en contextos de navegador aislados con datos ficticios y Gemini simulado; no utilizan datos del navegador del usuario ni credenciales reales. El resultado exacto de esta entrega se registra en la descripción de la PR/informe final. Chromium móvil es emulación, no una certificación en dispositivos físicos. No se valida una llamada Gemini real. Vite mantiene su aviso previo de compatibilidad de `__dirname`; el bundle genera también aviso de tamaño, sin impedir compilar.

Fuera de alcance: duplicación/propagación de meses, arrastres, múltiples escenarios, historial completo, limpieza transversal de códigos y rediseño global. Se conserva el catálogo anterior para no romper sus acciones y enlaces. Solo se guarda la última aprobación.

Resultado de esta implementación: `npm test` 182/182; TypeScript, build y `git diff --check` correctos. `npm run test:ui` pasó las cuatro baterías: 57 + 12 + 23 + 13 = 105 resultados (101 casos y cuatro pruebas contenedoras), sin fallos ni omitidos. Tras los últimos ajustes se repitieron las suites afectadas de planificación y eliminación. La descripción de entrega preparada amplía los detalles y límites.
