# Fase 3B: gráficos interactivos y visualización financiera

Implementación del Issue #8 y su comentario de arquitectura, sobre `a75963228fc00d655c4444e401ed431c7db77c0e` (PR #9). Rama exclusiva `feature/phase-3b-interactive-charts`, PR Draft contra main, sin fusión. No se implementa automatización del Issue #6 ni se sincroniza Google AI Studio.

## Arquitectura y biblioteca

Se utiliza **d3-shape 3.2.0**, ESM con licencia **ISC**, junto con su dependencia geométrica `d3-path` (3.1.1 en esta instalación, ISC). `@types/d3-shape` 3.1.7 aporta los tipos de desarrollo. React crea el SVG, controles, leyendas y tablas; D3 solo calcula líneas (incluidos huecos) y arcos. Vite elimina exports no utilizados. No se incorpora un motor de dashboards, canvas, red de gráficos ni wrapper que replique estado de React.

La biblioteca reduce la complejidad de generar arcos y líneas con valores nulos, es compatible con TypeScript/Vite y no incluye telemetría ni peticiones. Los avisos de licencia de ambas bibliotecas se distribuyen en `public/chart-licenses.txt` y el build los copia a `dist/chart-licenses.txt`.

`ChartSlot` es un área plegable. El módulo gráfico se importa dinámicamente **al abrirlo**, y queda montado al plegarlo para conservar filtros. No se ocultan formularios ni tarjetas existentes. Presupuestos mantiene las dos subpestañas de PR #9: los gráficos solo están en Planificación. No se añade navegación principal.

### Tamaño medido

Comparación contra la base indicada, en la misma máquina, dependencias y Vite 8.3.6. Bytes de archivos reales y gzip nivel 9 de Python, no estimación del registro npm:

| Salida | Base bytes | Entrega bytes | Base gzip | Entrega gzip |
| --- | ---: | ---: | ---: | ---: |
| JS principal | 513.682 | 516.392 | 141.406 | 142.444 |
| JS diferido de gráficos | 0 | 33.570 | 0 | 11.213 |
| CSS | 63.862 | 66.475 | 10.436 | 10.925 |
| Incremento total | | **38.893** | | **12.740** |

La geometría `arc`/`line`/`pie`, aislada con esbuild ESM/minify, mide 8.790 bytes y 3.371 gzip. El bloque diferido incluye también controles, tablas y agregadores: no se atribuye todo su tamaño a D3. La carga inicial añade 2.710 bytes JS y 2.613 CSS; los 33.570 bytes del bloque gráfico se descargan al expandir. Los avisos anteriores de Vite sobre `__dirname` y bundle principal >500 kB permanecen sin impedir la compilación. Los resultados pueden variar con versiones de herramientas; el repositorio ya carecía de lockfile, y solo se fijan las dos dependencias directas nuevas.

## Fuentes contables y límites

Los nuevos agregadores puros viven en `src/utils/chartData.ts`. No se escribe almacenamiento desde ellos ni desde los componentes gráficos. Se usan los datos guardados de `FinanceData`, no un segundo conjunto editable.

- **Economía:** `economicTransactions` clasifica sobre el libro completo antes de aplicar rango, tipo, estado o familia. Excluye transferencias estructuradas, pares históricos reconocidos y reintegros vinculados; en compartidos estructurados utiliza la parte propia. Una compensación no genera ingreso ni transacción bancaria. Tramitados y pendientes se analizan por separado, con tramitados por defecto. Se mantienen las reglas vigentes de cuotas/préstamos.
- **Presupuesto:** `calculateMonthlyBudgetRows`/`calculateMonthlySummary`, `annualPlanning` y la última fotografía aprobada. Se incorpora al catálogo de cálculo la unión de claves históricas para no perder cifras huérfanas. El año muestra previstos de ingresos/gastos, ahorro objetivo, balance previsto y balance/ingresos/gastos realizados. El objetivo no suma gasto ni altera ejecución.
- **Plan inexistente:** se devuelve `null`, no cero, para previsiones y ahorro; la línea deja huecos y la tabla muestra «Sin plan». Sin fotografía se muestra «Sin fotografía aprobada». Los estados aprobados/modificados proceden de la revisión vigente. No se reconstruye un historial de aprobaciones: solo existe la última fotografía.
- **Carteras:** `calculateWalletBalances` calcula los saldos actuales y el flujo tramitado por periodo con saldos iniciales neutralizados para medir exclusivamente variación. Un gasto compartido de 60 € reduce 60 € la cartera, aunque solo 15 € sean gasto económico; un reintegro bancario cambia saldo sin generar ingreso económico. Cada contrapartida de transferencia afecta a su cartera y se cancela en el total.
- **Historia bancaria:** el modelo no tiene fecha de referencia del saldo inicial ni garantía de movimientos completos. Por tanto **no se dibujan saldos históricos absolutos ni fechas de apertura**. Se muestra la comparación actual y una curva titulada «Variación bancaria acumulada registrada (no saldo histórico)», que parte de cero al comienzo del rango y suma únicamente los movimientos disponibles. Es una variación, no un saldo pasado acreditado. Para ver cada cartera se utiliza el selector; Todas muestra la variación total.
- **Históricos inciertos:** compartidos sin migrar y traspasos ambiguos conservan las reglas existentes, con aviso visible. No se estima una parte propia ni se identifica un reintegro por parecido de nombre/importe. Los pares antiguos inequívocos siguen las reglas de exclusión existentes. No hay migración al visualizar.
- Un cero realizado significa que los datos disponibles no contienen importes económicos tramitados en ese periodo, sin certificar que la historia esté completa. Las carteras sin movimientos y los saldos negativos siguen siendo visibles.

## Interacción y presentación

| Módulo | Visualizaciones e interacción |
| --- | --- |
| Inicio | Comparación mensual ingreso/gasto, línea de balance y anillo/distribución por familia. Rango configurable, selección y desglose económico; «Ver este análisis en Movimientos» abre el análisis con el mismo rango y filtros. Las tarjetas originales siguen disponibles. |
| Movimientos | Mes/semana (lunes), rango, ingreso/gasto, familia, tramitados/pendientes separados; comparación, balance y distribución. El detalle muestra importe económico e importe bancario original sin editar registros. Los filtros del gráfico no alteran el listado general ni sus controles. |
| Presupuestos → Planificación | Comparación por familia/partida entre guardado, ejecución y última aprobación. Evolución anual de previstos, objetivo y realizados; seleccionar un mes cambia solo el gráfico. Se avisa que los borradores locales no guardados no forman parte de las cifras. |
| Cuentas | Comparación de saldos actuales con signo y cuentas sin movimientos. Selector de cartera, rango y mes/semana para variación bancaria registrada. El rango de la curva no cambia el saldo actual. Detalle bancario consultable por periodo. |

Se puede cambiar entre barras y líneas. El anillo solo está disponible para distribución no negativa y un universo de gasto consistente; no se ofrece para saldos ni negativos. Las leyendas permiten ocultar series. Las cantidades exactas se leen por foco, puntero, clic o tap; se mantienen en una zona textual y en tablas. Las líneas tienen distintos trazos además de color.

Los puntos son controles SVG accesibles. Enter/Espacio activan selección, flechas/Inicio/Fin recorren puntos. Cada gráfico ofrece además un selector HTML de dato de 44 px y botones en la tabla: el móvil no depende de hover o de acertar un punto pequeño. Las tablas tienen caption, encabezados y scroll local; el ancho gráfico se adapta con ResizeObserver. Estado vacío, filtros inválidos, rango excesivo y series desactivadas se muestran con mensajes. Todos los controles y estilos son locales, con temas oscuro/claro y foco visible.

El estado de filtros, tipos, leyendas y selección reside exclusivamente en memoria React. No cambia FinanceData, FinanceStore, esquema JSON, revisiones, backups, aprobación o guardado. Los filtros tampoco generan planes o movimientos al navegar a años futuros.

## Rendimiento

Agregación memoizada por datos y filtros; economía y variaciones agrupan por periodo mediante mapas. Se limita el rango a 120 meses o 520 semanas y se pide acotarlo si se supera, sin truncar silenciosamente los datos. El detalle consultable se pagina de 100 en 100; las tablas agregadas mantienen sus filas. Se renderizan pocos gráficos reutilizados, no un componente por transacción. El catálogo real y los históricos no se recortan a un top que cambie los porcentajes del anillo.

Hay una prueba con 10.000 movimientos de 0,01 € que verifica el total exacto de 100 € y concordancia con el resumen contable. Las curvas se agregan con funciones existentes y conservan su redondeo; no se introduce otro motor contable.

## Archivos y validación

- `src/utils/chartData.ts` y `chartData.test.ts`: agregadores y regresiones contables.
- `src/components/charts/ChartSlot.tsx`, `FinancialCharts.tsx`, `InteractiveChart.tsx`: carga diferida, paneles, SVG y tablas.
- `src/App.tsx`, `PlanningView.tsx`, `index.css`: integración visual de los cuatro módulos, conservando PR #9.
- `scripts/chartFixture.ts`, `charts.browser.ts`, `src/tests.ts`, `package.json`: fixtures ficticios, cobertura unitaria/Chromium y dependencias gráficas.
- `public/chart-licenses.txt`: licencias distribuidas.

Comandos desde `/workspace/Finanzas-pro`:

```sh
npm test
npm run lint
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:ui
git diff --check
```

Chromium usa contextos nuevos, fixtures ficticios y bloqueo de destinos externos. Compara **todas** las claves de localStorage antes/después de interacciones y vigila que abrir/filtrar no introduzca peticiones externas. Prueba los cuatro módulos en escritorio y 390 px, ambos temas, clic/tap, teclado, detalle, tipos, leyendas, rango inválido/vacío, aprobados/modificados, huecos, borrador sin guardar y preservación de la guardia/subpestañas. Las suites anteriores mantienen regresiones 2A/2B/3A/UX.

Para capturas opcionales, crear un directorio fuera del checkout y ejecutar con `CHART_ARTIFACT_DIR=/tmp/finanzas-charts-artifacts`. Se usan exclusivamente fixtures. Las capturas no contienen datos reales. Emulación móvil no equivale a validación en dispositivos físicos; no se han usado credenciales Gemini ni AI Studio.

## Guion manual de QA — solo datos ficticios

1. Abrir un perfil aislado vacío e importar un fixture de prueba, sin tocar el navegador personal. Crear carteras ficticias BANCO (base 1.000), OTRA (100), NEGATIVA (−50) y una sin movimientos (0). Ingreso tramitado de 3.000 en BANCO. Gasto compartido de 60 con tres contactos, reparto igual: parte propia 15, deuda inicial 45. Cobrar 10 en BANCO y compensar 5. Traspasar 25 de BANCO a OTRA. Añadir gasto pendiente de 999.
2. **Inicio:** abrir Gráficos. Octubre debe mostrar ingreso 3.000, gasto 15 y balance 2.985. Distribución: 15 en la familia correspondiente, 100 %. Clic o tap sobre el sector muestra cifra y detalle: 15 económico frente a 60 bancario. Seleccionar octubre y abrir el análisis en Movimientos.
3. **Movimientos:** verificar el mismo rango. Pendientes muestra 999 separado; volver a tramitados recupera 15. Filtrar ingreso, gasto y familia, cambiar mes/semana, barras/líneas/anillo permitido y leyendas. Los porcentajes corresponden solo al gasto filtrado. Consultar el detalle con su tabla. No guardar ni cambiar registros para seleccionar filtros.
4. **Cuentas:** saldos del fixture: BANCO 3.925; OTRA 125; NEGATIVA −50; sin movimientos 0; total 4.000. Variación del mes: total +2.950 (BANCO +2.925, OTRA +25). Comprobar que el traspaso no cambia el total. La compensación no añade saldo. No debe haber una curva etiquetada como saldo histórico acreditado; debe explicar la falta de fecha del saldo inicial.
5. Cambiar cartera, fechas y granularidad. Los saldos actuales permanecen actuales, independientes del rango. El periodo sin movimientos informa ausencia de datos; no inventa apertura ni snapshots. No debe ofrecerse anillo de saldos negativos.
6. **Planificación:** en fixture separado, ingreso 3.000 y gasto procesado 1.900; plan 2.200, ahorro 600. Aprobar y abrir gráficos: guardado=2.200, ejecutado=1.900, fotografía=2.200. Cambiar guardado a 2.300 sin reaprobación: fotografía sigue 2.200 y estado modificado. Confirmar que saldos y ejecutado no cambian por aprobar.
7. Editar un borrador local sin guardarlo; los gráficos deben seguir mostrando las cifras guardadas. Cambiar mes/agrupación del gráfico no guarda el borrador. Ir a Catálogo debe mantener la guardia de 3A y la separación de PR #9. «Seguir editando» conserva los campos.
8. Elegir año 2030 sin planes: doce meses con huecos/nulos de previsión, «Sin plan», sin fotografías aprobadas de cero. El balance realizado cero describe únicamente los movimientos disponibles. Una categoría histórica o fotografía huérfana debe permanecer representada y etiquetada.
9. Probar rango invertido, vacío y superior al límite: mensaje comprensible, sin datos financieros nuevos. Ocultar todas las series: invitación a activar alguna. Seleccionar un periodo con más de 100 movimientos: paginar el detalle sin perder registros.
10. Recorrer controles con Tab/Shift+Tab. En un punto usar flechas, Inicio/Fin y Enter/Espacio; leer la cifra exacta en el estado textual y la tabla. Probar el selector HTML de dato y botones de tabla. Tocar un sector en móvil. Verificar temas claro/oscuro, leyendas legibles, signos negativos, foco visible y ausencia de scroll horizontal global a 390 px.
11. Comparar localStorage y backups antes/después de navegar/filtrar: idénticos. Inspeccionar red al abrir gráficos: solo recursos de código locales, sin API gráfica/telemetría. Usar exportación solo en el perfil ficticio; el formato JSON y las fotografías deben conservarse sin preferencias de gráficos.

## Límites de la entrega

Solo se conoce la última aprobación; no se fabrican aprobaciones históricas. La falta de fecha del saldo inicial impide acreditar saldos absolutos del pasado. Los históricos ambiguos requieren la revisión/migración existente, fuera de esta funcionalidad de lectura. Los filtros del análisis de Movimientos son independientes del listado general editable, para conservar sus rutas y reglas. No hay cambios en permisos de red ni configuración de seguridad para publicar la PR; si el proxy bloquea GitHub API, se informa para crear el Draft mediante la conexión de GitHub de ChatGPT.

## Resultados de esta entrega

- `npm test`: **192/192** pruebas, sin fallos, cancelados ni omitidos (10 nuevas de agregación).
- `npm run lint`, `npm run build`, `git diff --check`: correctos.
- `CHROMIUM_PATH=/usr/bin/chromium npm run test:ui`: **124/124** resultados de los runners (**118 casos y 6 pruebas contenedoras**): 57 Fase 1/2A/2B, 12 UX compartidos, 23 eliminaciones, 13 planificación 3A, 11 UX Presupuestos y 8 gráficos. Cero fallos y omitidos.
- Capturas ficticias revisadas de escritorio/móvil, oscuro/claro, en `/tmp/finanzas-charts-artifacts` (fuera del checkout).
- Medición orientativa en esta máquina, mediana de cinco agregaciones con 10.000 movimientos ficticios: economía 4,5 ms, planificación anual 24,6 ms, carteras 18,5 ms. No es una garantía de latencia para otros equipos o datos.
- Sin cambios en FinanceData, FinanceStore, validadores, esquema JSON, mecanismos de respaldo ni configuración de seguridad/red. PR Draft solicitada contra main, sin fusión; su creación mediante API queda sujeta al acceso existente del proxy.
