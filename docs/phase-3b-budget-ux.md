# Fase 3B: UX de Presupuestos — informe técnico y QA

Issue #7. Rama exclusiva `feature/phase-3b-budget-ux`, desde `main` en `f5c22cc65415b4a6766b337197b3be72d226b7f1`. Entrega Draft contra main, sin fusión. El alcance es únicamente interfaz: no incluye gráficos del Issue #8 ni automatización del Issue #6.

## Navegación y ciclo de vida

Presupuestos contiene dos pestañas secundarias:

- **Planificación**, etiquetada accesiblemente como «Planificación financiera».
- **Catálogo y partidas**, con encabezado y etiqueta accesible «Catálogo y detalle de partidas».

Al entrar en el módulo se selecciona Planificación. Ambos paneles permanecen montados y el inactivo utiliza `hidden`: no se duplica el editor y se conserva el estado del catálogo (ingreso/gasto, familias y edición). La selección solo vive en memoria; al abandonar el módulo se inicia de nuevo en Planificación. La navegación principal permanece intacta, con sus siete botones móviles.

El cambio de subpestaña pasa por la misma `guardPlanning` de Fase 3A. «Seguir editando» y Escape conservan el borrador; «Descartar y continuar» lo descarta explícitamente, sin escribir. Mientras se guarda un borrador o aprobación, las pestañas están deshabilitadas y la guardia rechaza la navegación. La notificación del estado del editor se realiza antes de pintar para que el bloqueo visual y la guardia estén sincronizados.

Cada panel recuerda su posición vertical durante la estancia en Presupuestos. Al cambiar se restaura ese scroll y el foco queda en la pestaña seleccionada, sin desplazamiento inducido por el foco. No se introduce URL nueva. Los detalles abiertos desde Planificación mantienen el panel seleccionado y usan la jerarquía Overlay existente.

Los controles usan `tablist`, `tab`, `tabpanel`, `aria-selected` y `aria-controls`. Flechas izquierda/derecha, Inicio y Fin mueven el foco; Enter o Espacio activan la pestaña mediante la guardia. Tab entra en el panel seleccionado y Shift+Tab permite volver. El panel oculto queda fuera del árbol accesible y de la navegación por teclado.

## Plegados

Ingresos y Gastos se pueden plegar independientemente. Cada familia dentro de ambos bloques tiene su propio control. «Expandir todo»/«Contraer todo» actúan únicamente sobre el bloque elegido y sus familias. Un plegado de bloque individual conserva las preferencias de sus familias al reabrirlo.

El resumen global I/G/S sigue presente. Cada encabezado de bloque/familia conserva nombre, número de partidas, previsto, ejecutado y diferencia. Incluye avisos textuales para gastos ejecutados por encima del previsto, ingresos pendientes respecto a la previsión y, en los bloques relevantes, ahorro superior a ingresos o margen negativo. No depende del color.

Las filas se ocultan con `hidden`, sin desmontar inputs ni reconstruir valores. El estado sigue en el único formulario de `PlanningView`; guardar o aprobar incluye también las filas ocultas. Los importes inválidos permanecen inválidos: se avisa en el encabezado plegado, se muestra «Pendiente de corregir» en lugar de un total engañoso y se bloquean guardado/aprobación. El resumen global conserva sus etiquetas y muestra «—» cuando no puede calcularse. Al abrir se conservan el texto y el error inline.

Las partidas históricas «Fuera del catálogo» reciben el mismo tratamiento. El estado de expansión es local/transitorio y no se guarda en FinanceData, localStorage ni backups. No se añaden migraciones, metadatos ni versiones JSON. Navegar o plegar no guarda ni aprueba nada; tampoco altera revisiones o fotografías.

Cada control de plegado es un botón real con `aria-expanded` y `aria-controls` apuntando a un ID único de React. Los controles que ocultan contenido permanecen visibles y conservan el foco. Los estilos están limitados a Presupuestos/Planificación, con selección y foco visibles en ambos temas y controles de al menos 44 px. La tabla anual conserva su scroll local; la nueva navegación no añade scroll horizontal global a 390 px.

## Archivos

| Archivo | Cambio |
| --- | --- |
| `src/components/BudgetWorkspace.tsx` | Pestañas secundarias, paneles montados, teclado, foco y scroll por panel. |
| `src/App.tsx` | Integra el contenedor y reutiliza la guardia; comunica el guardado pendiente. |
| `src/components/PlanningSection.tsx` | Control accesible de plegado y resumen siempre visible. |
| `src/components/PlanningView.tsx` | Estado local de expansión, atajos por bloque, resúmenes/avisos y preservación de campos. |
| `src/index.css` | Estilos locales de pestañas, familias, avisos y contraste. |
| `scripts/budgetUx.browser.ts` | Regresiones de Fase 3B con fixtures ficticios y contextos aislados. |
| `scripts/sharedUx.browser.ts`, `scripts/deletion.browser.ts`, `scripts/transferCases.ts` | Los recorridos de catálogo seleccionan la nueva subpestaña; se mantienen sus aserciones. |
| `package.json` | Añade la nueva suite a `test:ui`, sin cambiar dependencias. |
| `README.md`, este informe | Entrada de documentación, decisiones y guion de QA. |

No se modifica `Navigation.tsx`, el modelo financiero, validadores JSON, el motor contable, FinanceStore ni los mecanismos de respaldo/restauración. No se modifican dependencias o lockfiles.

## Pruebas automatizadas

Desde `/workspace/Finanzas-pro`:

```sh
npm test
npm run lint
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:ui
git diff --check
```

La nueva batería prueba cuatro combinaciones (escritorio/390 px × oscuro/claro), errores ocultos, importes y totales, independencia de plegados, déficit textual, guardia/cancelación/descarte, teclado, foco, scroll, siete botones principales y ausencia de preferencias en snapshots 2.5–2.9. También edita desde Catálogo y comprueba la fotografía aprobada intacta y el estado modificado al volver; verifica bloqueos durante guardado y aprobación pendientes, cuota y reintento, y el guardado de una partida histórica oculta.

Las suites anteriores conservan la cobertura de 2A/2B/3A: transferencias, reintegros, compartidos, préstamos, eliminación, copias/versiones JSON, aprobaciones, concurrencia entre pestañas, cuota y Web Locks. Los datos son ficticios y las pruebas crean contextos Chromium nuevos, sin usar el navegador personal ni Google AI Studio.

Para capturas opcionales de los fixtures, crea un directorio fuera del checkout y establece `BUDGET_UX_ARTIFACT_DIR` antes de `npm run test:ui`. Esta opción no cambia datos financieros.

## Guion de pruebas manuales

Usar exclusivamente un perfil de navegador de pruebas sin datos personales. Se pueden cargar familias ficticias Trabajo/Ingresos puntuales/Vida diaria/Vivienda y partidas Salario/Extra/Comida/Alquiler. No usar la sesión personal de AI Studio.

1. **Entrada y pestañas:** entrar en Presupuestos. Debe verse solo Planificación; Catálogo debe mostrar sus encabezados, acciones y pestañas ingreso/gasto al seleccionarlo. En móvil la navegación principal sigue teniendo siete botones.
2. **Borrador y plegados:** introducir salario 3.000,00, comida 200,00, alquiler 2.000,00 y ahorro 600,00. Comprobar I=3.000, G=2.200, S=600, disponible=2.400, margen=200, balance=800. Plegar una familia, Gastos e Ingresos; reabrir y comprobar que todos los textos se conservan y que los totales estaban visibles al plegar.
3. **Independencia:** plegar Trabajo y comprobar que Ingresos puntuales sigue abierto; hacer lo mismo con las dos familias de gastos. Plegar un bloque y reabrirlo: sus familias mantienen sus estados. Probar Expandir todo/Contraer todo en un bloque sin alterar el otro.
4. **Errores ocultos:** introducir `1,234` o un negativo en Comida; plegar la familia y Gastos. Los encabezados deben avisar del importe inválido y guardar/aprobar debe seguir bloqueado. Abrir: texto y error intactos. Corregir a 200,00 y comprobar que vuelve el total válido.
5. **Déficit/desviación:** cambiar ahorro a 900; con I=3.000 y G=2.200 debe mostrarse margen −100, también con Gastos plegado. Si hay gasto procesado 250 frente a previsto 200, el encabezado familiar avisa del exceso de 50; un movimiento pendiente no suma ejecutado.
6. **Cambios sin guardar:** intentar Catálogo desde Planificación sucia. Seguir editando y Escape conservan campos. Descartar y continuar abre Catálogo sin escribir. Volver a Planificación muestra solo lo guardado. Cambiar de mes o apartado principal mantiene la protección de 3A.
7. **Aprobación y catálogo:** guardar/aprobar el ejemplo ficticio sin déficit. Desde Catálogo abrir una partida y cambiar su previsto. Volver a Planificación: valor actualizado, estado «Modificada desde la última aprobación» y fotografía anterior intacta. Abrir Detalle desde Planificación no debe cambiar la subpestaña. Navegar o plegar sin editar no cambia estado/revisión.
8. **Guardado pendiente:** con las simulaciones de la suite, mantener Web Locks ocupado y guardar/aprobar. La navegación secundaria no debe activarse, tampoco por teclado. Ante cuota el error conserva los datos y permite reintentar; no aparece un guardado parcial.
9. **Históricos y formatos:** cargar un fixture con un plan cuyo código no esté en el catálogo. Plegar/reabrir «Fuera del catálogo», editar y guardar estando oculto. Exportar/restaurar conserva la fila. Navegar por backups 2.5–2.9 no incorpora preferencias de UI ni provoca migración automática.
10. **Teclado, foco y scroll:** recorrer las pestañas con flechas/Inicio/Fin y activar con Enter/Espacio. Usar Tab/Shift+Tab. Plegar con Enter/Espacio. Escape cierra la confirmación de salida sin descartar. Cambiar de panel después de desplazarse y volver: se conserva su posición. Ningún elemento oculto recibe foco.
11. **Móvil y temas:** repetir a 390 px y escritorio, en claro y oscuro. Comprobar contraste, avisos escritos, foco visible, botones y ausencia de scroll horizontal global. Los modales siguen por encima de sus paneles; no se validan dispositivos físicos solo por emularlos.

## Límites

La selección de pestaña y los plegados no sobreviven a una recarga o a abandonar el módulo. No se añade enlace profundo, gráficos, automatización, duplicación/propagación de meses ni nueva persistencia. El build conserva los avisos ya existentes sobre `__dirname` en Vite y tamaño del bundle; no impiden compilar. Gemini real y dispositivos físicos quedan fuera de esta validación.

## Resultados de esta entrega

- `npm test`: **182/182**, sin fallos ni omitidos.
- `npm run lint`, `npm run build` y `git diff --check`: correctos.
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:ui`: **116/116** resultados informados por los cinco runners (**111 casos y 5 pruebas contenedoras**): 57 Fase 1/2A/2B + 12 UX compartidos + 23 eliminaciones + 13 planificación 3A + 11 UX 3B. Sin fallos, cancelados u omitidos.
- Tras revisar las capturas se ajustó el texto singular/plural y el contraste del selector de mes; se repitieron TypeScript, build y la suite afectada UX 3B.
- Inspección visual de fixtures de escritorio y móvil, temas claro/oscuro; capturas en `/tmp/finanzas-3b-artifacts`, fuera del checkout. Sin validación en dispositivos físicos ni llamada Gemini real.
