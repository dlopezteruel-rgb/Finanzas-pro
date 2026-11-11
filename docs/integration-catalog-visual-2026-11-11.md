# Validación conjunta del catálogo y la experiencia visual

Fecha: 11/11/2026 (Europe/Madrid). Rama temporal: `test/integration-catalog-visual`. No es una propuesta de integración definitiva ni autoriza una fusión.

## Bases comprobadas e integración

Los HEAD remotos coincidían con las referencias solicitadas:

| Referencia | SHA |
| --- | --- |
| `main` | `66a045e17e310527c790a15ff2fe5dceaaba48a3` |
| PR #17, `fix/catalog-financial-safety` | `b1225c78a11c18cf73f0f26335cfbcad6d262627` |
| PR #18, `feature/visual-ux-granate-marino` | `e1f6e729fabab7b772c0464f007b86dc5422e070` |

Se creó un worktree separado desde `origin/main` y se integraron primero #17 y después #18 mediante merges locales, conservando los dos HEAD originales como ancestros. **No hubo conflictos textuales**: Git combinó automáticamente `src/App.tsx`, `scripts/budgetUx.browser.ts` y `src/tests.ts`. Se revisó la combinación semántica: las mutaciones seguras y guardias del catálogo siguen presentes, la URL de pruebas pasa a `/app`, los recuentos móviles son cinco destinos y el ejecutor unitario importa tanto las regresiones del catálogo como las de idiomas.

La primera combinación, antes de las correcciones de esta validación, quedó en `0bb052628b235a065fbbda5fe09e4ba7e19c6ac8`: **268 unitarias correctas** y **14 resultados correctos** de la suite focalizada `budgetUx`. Esos resultados iniciales no sustituyen la batería final completa.

El código corregido para la validación final está en `245abc462a3dad575918f664704d029fa8cf37fa`. El commit posterior de entrega incorpora solo este informe y evidencias. Las PR originales y `main` no se han modificado; no se ha creado una tercera PR ni sincronizado Google AI Studio.

## Hallazgos y correcciones conservadas solo en la rama temporal

### Montajes con prefijo

La combinación original reconoce únicamente el pathname `/app` o `/app/`. Los enlaces de entrada y recuperación, logo, captura de landing, favicon y endpoint del asistente parten de `/`. Una previsualización en `/preview/finanzas/` puede escapar a la raíz o mostrar la landing al intentar abrir la aplicación. Las nuevas pruebas reprodujeron el error en desarrollo y producción: el enlace devolvía `/app` cuando debía conservar `/preview/finanzas/app`.

Se añadió un prefijo explícito `APP_BASE_PATH`, compartido por Vite y Express y expuesto al navegador a través de `import.meta.env.BASE_URL`. Se normaliza y valida como ruta local, sin origen externo, parámetros ni segmentos relativos. No se adivina el prefijo desde un pathname arbitrario.

- `config/appPaths.ts`: contrato común para raíz, aplicación, recursos y API; reconocimiento exacto de la aplicación.
- `vite.config.ts` e `index.html`: base de recursos y favicon. Se conservan las opciones existentes de HMR y vigilancia de archivos.
- `server.ts`: montaje de archivos estáticos, fallback y endpoints dentro del prefijo. La ruta base sin barra final redirige con 308, conservando parámetros. La comprobación exacta evita redirigir de nuevo la ruta que ya tiene barra.
- `src/app/paths.ts`, `Root.tsx`, `App.tsx`, `Brand`, `LandingPage` y `AssistantChatView`: enlaces y solicitudes coherentes con el montaje.

El prefijo no cambia el origen ni `DATA_KEY`, no transforma JSON y no añade una migración o escritura al abrir. `/` y `/app` siguen funcionando por defecto. La API mantiene el comportamiento previo y las pruebas desactivan Gemini explícitamente.

### Cobertura de duplicación móvil y accesibilidad

La PR #17 incluía duplicación con cuota, espera y doble envío en escritorio; faltaba ejecutar ese mismo recorrido en móvil. Ahora `budgetUx.browser.ts` lo ejecuta en ambos tamaños. Comprueba una copia con identidad propia, original intacta, colecciones financieras conservadas, dos intentos exactos tras cuota/reintento y presencia de la copia en el catálogo después de recargar.

Se comprueba además contraste de al menos 4,5:1 para el rechazo del traslado y el error de cuota, y contención del foco en el diálogo. No se ha cambiado el diseño ni la lógica financiera para adaptar estas aserciones.

## Cobertura funcional conjunta

| Comprobación solicitada | Evidencia automatizada |
| --- | --- |
| Duplicación móvil y escritorio; contenedor distinto de `groupCode`; errores y doble envío | `budgetUx.browser.ts`, `budgetChanges.test.ts` |
| Traslado del mismo tipo; rechazo GASTO↔INGRESO en interfaz y dominio | `budgetUx.browser.ts`, `transferCases.ts`, `budgetChanges.test.ts` |
| Saldos, clasificaciones, históricos, planes, aprobaciones y copias conservados | Regresiones de catálogo, transferencias, planificación y backup; comparación del dominio con #17 |
| Guardar, descartar y seguir editando; guardar/descartar antes de abrir registros vinculados | `budgetUx`, `planning`, `intelligent`, `visualUx` |
| Siete módulos, cinco destinos móviles y menú Más | `responsive`, `intelligent`, `visualUx`, `routes` |
| Deudas y Tesorería abren movimientos/ocurrencias correctos, con filtros, foco y selección | `intelligent.browser.ts` |
| Landing, app, barra final, query/hash, recarga y conservación por origen | `visualUx.browser.ts`, `routes.browser.ts` |
| Prefijo en desarrollo/producción, recursos y API sin llamadas externas | `routes.browser.ts`: cuatro montajes reales con Express/Vite y red externa bloqueada |
| Recuperación, datos inválidos, importación/exportación y copias previas | `phase1`, `planning`, `intelligent`, `visualUx`; recuperación también bajo prefijo en `routes` |
| Web Locks, cuota y conflictos reales entre pestañas | `phase1`, `asyncFormCases`, `planning`, `intelligent`, `budgetUx` |
| Contraste, foco, Escape, reducción de movimiento, 320 px y zoom 125/200 % | `visualUx`, `responsive`, aserciones adicionales del catálogo |

Todas las sesiones usan fixtures y perfiles/contextos temporales. La prueba de recuperación invalida deliberadamente solo una fixture dentro de su contexto nuevo. No se abre el almacenamiento de una sesión personal ni se importan copias reales.

## Resultados definitivos

Ejecución completa sobre `245abc462a3dad575918f664704d029fa8cf37fa`, con el código fijo durante toda la batería. [Evidencia estructurada](integration/evidence-catalog-visual-2026-11-11.json).

| Comando | Resultado definitivo |
| --- | --- |
| `npm ci --cache /workspace/work/npm-cache-integration` | Correcto, 187 paquetes; lockfile intacto |
| `npm test` | **271 superadas, 0 fallos, 0 omitidas** |
| `npm run lint` | Correcto (`tsc --noEmit`) |
| `npm run build` | Correcto; aviso existente de configuración futura de Vite por `__dirname` |
| `GEMINI_API_KEY='' GOOGLE_API_KEY='' CHROMIUM_PATH=/usr/bin/chromium npm run test:ui` | **201 resultados superados, 0 fallos, 0 omitidos**: 190 casos + 11 contenedores |
| `git diff origin/main...HEAD --check` | Correcto |

El acumulado original de **268 unitarias / 195 resultados Chromium** crece por tres unitarias de rutas, un caso de duplicación móvil y cuatro casos de montaje con su contenedor. No se han eliminado pruebas para obtener el resultado. Desglose Chromium: phase1 **57**, sharedUx **12**, deletion **23**, planning **13**, budgetUx **15**, charts **8**, automation **15**, responsive **16**, intelligent **25**, visualUx **12**, routes **5**.

Se comprobaron ambos HEAD originales como ancestros. `src/utils/`, `src/types/`, `BudgetsView.tsx`, `transferCases.ts` y el lockfile permanecen idénticos a #17: las correcciones adicionales no cambian el dominio ni el esquema financiero. Las comprobaciones de contraste incluyen la acción principal con **6,18:1** en ambos temas y los errores del catálogo con un mínimo de **4,5:1**. Ninguna ejecución exploratoria fallida se contabiliza como una prueba aprobada.

## Repetición y contrato de despliegue

```sh
npm ci
npm test
npm run lint
npm run build
GEMINI_API_KEY='' GOOGLE_API_KEY='' CHROMIUM_PATH=/usr/bin/chromium npm run test:ui
git diff origin/main...HEAD --check
```

La caché de npm del sistema no es escribible en este entorno; se utilizó `npm ci --cache /workspace/work/npm-cache-integration`, sin cambiar el lockfile. Node 24.22.1 y Chromium 156.0.8078.79, instalado en `/usr/bin/chromium`.

`test:ui` añade `scripts/routes.browser.ts` al final. Este script compila y prueba primero la raíz y después `/preview/finanzas/`, arrancando el servidor real en modo producción y desarrollo, con `DISABLE_HMR=true`, y restaura el build raíz al terminar. Los puertos son temporales y las solicitudes del navegador quedan limitadas al servidor local. No requiere credenciales.

El montaje puede configurarse así, manteniendo el mismo prefijo al compilar y servir:

```sh
# Desarrollo con el patrón de HMR desactivado de previsualización.
APP_BASE_PATH=/preview/finanzas/ DISABLE_HMR=true npm run dev

# Producción local bajo el mismo prefijo.
APP_BASE_PATH=/preview/finanzas/ npm run build
APP_BASE_PATH=/preview/finanzas/ NODE_ENV=production npm start
```

El proxy debe conservar ese prefijo al reenviar solicitudes o reescribirlas para que coincidan con el montaje. Un build compilado para raíz no adquiere un prefijo arbitrario solo por abrirlo en otra URL. Si cambia el prefijo, se debe reconstruir; si cambia el **origen**, el navegador mantiene otro almacenamiento y no se trasladan datos automáticamente.

**Compatibilidad verificada:** servidor de desarrollo real y build de producción, tanto en raíz como en el prefijo local indicado, con imágenes, módulos diferidos, API local, recargas y salida de recuperación. **No comprobado:** un host real de Google AI Studio, sus reescrituras concretas, CSP/iframe, Web Locks y política de origen. No se ha abierto ni sincronizado ese servicio. La simulación local no implica una garantía universal para todos los hosts de previsualización.

## Riesgos pendientes y recomendación

- Las ramas originales siguen sin incluir la corrección de prefijos de este checkpoint. Debe promoverse mediante el procedimiento que autorice el propietario antes de desplegar bajo prefijos.
- Un proxy que elimine prefijos requiere adaptar el reenvío; no se ha verificado ese tipo de host. Los despliegues reales deben comprobar HTTPS, origen, CSP y Web Locks.
- Se mantienen los límites de las PR: Firefox/Safari y dispositivos físicos sin verificar; comprobaciones de contraste de controles críticos, sin certificación WCAG integral; marca provisional, español disponible y otros idiomas pendientes; splash nativo aún no implementado; aproximación histórica de préstamos y aviso de configuración futura de Vite.
- Orden recomendado: **#17 primero**, por proteger el catálogo financiero; después **#18**, conservando ambos conjuntos de pruebas e incorporando la corrección de rutas revisada. Repetir los checks sobre el candidato final autorizado. No utilizar la rama temporal como integración definitiva ni fusionar automáticamente ninguna PR.
