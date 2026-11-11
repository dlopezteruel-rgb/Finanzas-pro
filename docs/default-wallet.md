# Cartera predeterminada

Base: `main` remoto `9133bf34b8bdb56a874e77dffc1e7894111e3a5b`. Rama `feature/default-wallet`. Código de validación: `0d25149d497b90a02ec4312f1f0d5fcbb37dfb97`.

## Uso y alcance

En **Cuentas**, cada cartera puede marcarse con «Usar como predeterminada». Se muestran su nombre y la etiqueta **Predeterminada**. El cambio espera al resultado real de FinanceStore; ante un error conserva la selección anterior y muestra el fallo. «Quitar cartera predeterminada» permite volver a la elección explícita cuando hay varias.

El bloque de preferencia ocupa una fila completa de la cuadrícula existente para conservar el ancho de las tarjetas en escritorio. La etiqueta se muestra bajo el nombre para no comprimirlo en móvil. [Captura móvil](assets/default-wallet/390-carteras.jpg) · [Captura escritorio](assets/default-wallet/1280-carteras.jpg), ambas con datos ficticios.

| Situación | Comportamiento |
| --- | --- |
| Sin carteras | Los registros bancarios no se pueden guardar sin un origen válido. Las compensaciones sin banco siguen disponibles. |
| Una cartera | Se propone automáticamente; no es necesario persistir una preferencia ni escribir al abrir. |
| Varias con preferencia válida | Se propone la cartera referenciada por ID; se puede seleccionar otra para cada operación. |
| Varias sin preferencia | El formulario muestra «Selecciona una cartera». No se escoge la primera. |
| Editar un registro existente | Se conserva su cartera original; la predeterminada no la reemplaza. |
| Eliminar la predeterminada | Se limpia la referencia en la misma escritura. Si queda una sola, se utiliza automáticamente. Las restricciones de borrado de carteras vinculadas permanecen. |

La resolución está centralizada en `src/utils/defaultWallet.ts`. Se utiliza en movimientos manuales, registro rápido, propuestas del chat, préstamos, origen de traspasos, reintegros compartidos, liquidaciones personales y nuevas reglas periódicas.

Si una cartera era automática por ser la única y después se añade otra, no se inventa una preferencia explícita: se pide elección hasta configurarla. Una preferencia elegida previamente por ID sí se mantiene mientras su cartera exista.

- La preferencia es un **ID estable**, no un nombre ni una posición en la lista. Los formatos existentes de cada operación se conservan; no se migran las referencias históricas por nombre.
- Un traspaso propone su origen; el destino se elige explícitamente y no puede coincidir con él. Al editar conserva los dos extremos guardados.
- Una regla periódica existente sigue usando su propio `walletId`; cambiar la preferencia no redirige sus próximas ocurrencias. Lo mismo se aplica a la cartera habitual de un préstamo y a los reintegros registrados.
- El registro rápido dispone de un selector de cartera en su vista previa. La elección manual se mantiene al revisar el texto y se limpia al borrar o registrar la entrada. El chat mantiene su revisión y confirmación explícitas.
- Un nombre de cartera reconocido en el texto prevalece sobre la preferencia. Las referencias conocidas que no existen o las menciones ambiguas requieren revisar la selección; no se sustituyen silenciosamente por la primera cartera.
- Los filtros de consulta conservan su alcance actual, incluido «Todas las carteras». La preferencia propone orígenes de operaciones; no limita silenciosamente saldos, gráficos o presupuestos.

No cambian los cálculos financieros, el presupuesto, el catálogo, las rutas ni el diseño general. Se añaden únicamente los controles necesarios para elegir, identificar y revisar la preferencia. No se implementan subítems ni catálogo personalizable.

## Persistencia y JSON 3.2

Se amplía `FinanceData` con `defaultWalletId?: string | null`. Un ID debe existir en `wallets`; `null` indica que no hay elección explícita. Con una única cartera la resolución automática se aplica también si este campo es `null` o no existe.

Los formatos **2.5, 2.6, 2.7, 2.8, 2.9, 3.0 y 3.1** siguen admitidos con su validación anterior, sin inventar una preferencia y sin escrituras al cargarlos. No se cambia `DATA_KEY`, el origen del navegador ni la revisión interna.

Al configurar por primera vez una preferencia explícita, el formato pasa a **3.2**. FinanceStore guarda y verifica una copia recuperable completa antes de sustituir la clave activa. El fallo de copia, verificación o escritura activa conserva los datos anteriores. Quitar la preferencia guarda `null` y mantiene 3.2; evita una degradación de formato implícita.

3.2 admite las funciones previas —transferencias, repartos, reintegros, planificación, automatización, recurrencias y compromisos— y valida la referencia de la preferencia. Las copias con un ID inexistente, tipo incorrecto o campo ausente para 3.2 se rechazan antes de guardar. Una copia antigua no admite este campo nuevo bajo una cabecera de versión anterior.

La exportación incluye la preferencia. La vista previa de restauración indica cuál se resolverá tras importar. Restaurar una copia 2.5–3.1 sustituye el conjunto completo, incluida la ausencia de preferencia; restaurar 3.2 conserva su ID validado. Siempre se mantiene la copia recuperable del estado sustituido. **Las aplicaciones anteriores no leen 3.2**: para volver atrás se utiliza la copia previa compatible, sin afirmar que pueden abrir la exportación nueva.

## Protecciones

Las mutaciones de preferencia pasan por el mismo Web Lock y revisión de FinanceStore. No hay estado financiero optimista ni una clave de preferencias separada que pueda quedar desincronizada. Elegir la misma preferencia es un no-op sin nueva escritura ni revisión.

La eliminación individual, el borrado seleccionado y las mutaciones de carteras limpian la referencia al retirar su cartera. Una preferencia inválida nueva se rechaza; no se repara silenciosamente al cargar. Las carteras vinculadas siguen sujetas a las comprobaciones de dependencia existentes.

Los movimientos bancarios nuevos o editados y los préstamos nuevos o modificados necesitan un origen existente. Los registros históricos huérfanos permanecen legibles y restaurables, con los avisos previos, y no se reasignan por configurar una predeterminada. Para editar un movimiento cuyo origen ya no existe se requiere una selección válida explícita.

## Pruebas y evidencia

La suite unitaria incorpora **20 regresiones**: cero/una/varias carteras, ID frente a nombre/orden, texto y propuestas, cambio/quitar/no-op, JSON estricto, copia previa, cuota, conflictos, borrado, edición y ciclo completo 2.5–3.1 → 3.2 → restauración. Un conjunto generado con funciones de dominio comprueba que se conservan transferencias, repartos, reintegros, ocurrencias, principal, aprobaciones y saldos.

La nueva suite de navegador usa contextos aislados, datos ficticios y los tamaños **390 × 844** y **1280 × 1000**. Comprueba los formularios, selección explícita, recarga, exportación/restauración, ausencia de desbordamiento, borrado, edición y una espera real bajo Web Locks con doble envío, cuota y conflicto entre pestañas. Las pruebas anteriores que dependían de la primera cartera ahora la seleccionan expresamente, conservando sus aserciones económicas y de recuperación.

Resultados definitivos de la ejecución completa sobre el código fijo `0d25149…`. El commit posterior añade solo documentación y capturas. [Evidencia estructurada](default-wallet-validation.json).

| Comando | Resultado |
| --- | --- |
| `npm ci --cache /workspace/work/npm-cache-default-wallet` | Correcto, 187 paquetes; lockfile intacto |
| `npm test` | **291 superadas, 0 fallos, 0 omitidas**: 271 anteriores + 20 regresiones nuevas |
| `npm run lint` | Correcto (`tsc --noEmit`) |
| `npm run build` | Correcto; permanece el aviso existente de configuración futura de Vite por `__dirname` |
| `GEMINI_API_KEY='' GOOGLE_API_KEY='' CHROMIUM_PATH=/usr/bin/chromium DEFAULT_WALLET_ARTIFACT_DIR=docs/assets/default-wallet npm run test:ui` | **215 resultados correctos, 0 fallos, 0 omitidos**: 203 casos + 12 contenedores |
| `git diff origin/main...HEAD --check` | Correcto |

Desglose Chromium: phase1 **57**, sharedUx **12**, deletion **23**, planning **13**, budgetUx **15**, charts **8**, automation **15**, responsive **16**, intelligent **25**, visualUx **12**, routes **5**, defaultWallet **14**. Las ejecuciones exploratorias no se cuentan como aprobación; los resultados anteriores proceden de repetir la batería completa después de cerrar también la distribución de las tarjetas de escritorio.

Los módulos de cálculos, planificación y catálogo, sus constantes, estilos generales, rutas, servidor y lockfile se compararon con la base y permanecen intactos. La nueva validación de origen añade restricciones de escritura; no altera las fórmulas ni reasigna importes históricos.

## Reproducción

```sh
npm ci
npm test
npm run lint
npm run build
GEMINI_API_KEY='' GOOGLE_API_KEY='' CHROMIUM_PATH=/usr/bin/chromium npm run test:ui
git diff origin/main...HEAD --check
```

Para conservar las capturas ficticias de la nueva suite, añadir `DEFAULT_WALLET_ARTIFACT_DIR=docs/assets/default-wallet` al comando Chromium. El entorno de validación usa Node 24.22.1, Chromium `/usr/bin/chromium` y una caché npm escribible de tarea. No se necesitan claves API ni perfiles personales.

## Límites

- Chromium es la verificación de navegador; Firefox, Safari y dispositivos físicos no comprobados.
- No se añade sincronización, autenticación, publicación de la aplicación ni conexión con bancos o Google AI Studio.
- La preferencia usa ID; las referencias históricas por nombre de los formatos anteriores conservan sus limitaciones existentes.
- Las copias antiguas no contienen una preferencia explícita. Con varias carteras se pedirá selección hasta configurarla.
