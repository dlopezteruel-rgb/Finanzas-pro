# Seguridad del catálogo — traslados y duplicación

Base: `main` remoto `66a045e17e310527c790a15ff2fe5dceaaba48a3`. Rama: `fix/catalog-financial-safety`.
Referencia: auditoría del 11/11/2026, commit `51346494805e8cc4bc609da38326a31c7b7c010f`.

## Comportamiento

- El editor de traslado solo ofrece familias del mismo tipo y rechaza también un destino manipulado. El dominio comprueba el tipo con los datos actuales dentro de la mutación, bajo Web Locks y revisión.
- `changePartidaGroup` modifica únicamente `budgetGroups`. Conserva los movimientos byte a byte a nivel de datos, incluidos tipo y etiquetas históricas, y no modifica planes, aprobaciones, préstamos, reglas, saldos ni liquidaciones. Un traslado al mismo contenedor devuelve la misma instancia y no escribe.
- No hay migración al cargar. Las clasificaciones creadas con versiones anteriores siguen siendo válidas y se conservan al cargar/exportar/restaurar. Reclasificar entre Ingresos y Gastos queda para una función financiera independiente.
- Duplicar localiza la partida por `type + code` dentro de su contenedor real; no confunde `F_EXP` con `F.001`. Crea una partida nueva junto a la original, con código libre y keywords independientes, sin copiar previsiones ni movimientos. La identidad continúa siendo `type + code`, conforme al esquema vigente; no se añade un campo ID ni nueva versión JSON.
- La asignación de códigos considera todo el catálogo y las referencias financieras, reglas y fotografías históricas. No reutiliza un código ausente del catálogo que pudiera asociar importes anteriores a la copia nueva. Admite códigos personalizados no numéricos.
- Duplicar/reordenar esperan el resultado real, bloquean envíos repetidos y muestran errores. Un fallo de cuota, validación o conflicto conserva las colecciones y las copias previas. Los límites de orden son no-op sin escritura.
- Con un borrador de planificación pendiente, las acciones del catálogo devuelven el mismo rechazo de guardar/descartar que ya empleaba el traslado; cambiar a la pestaña del catálogo sigue utilizando la guardia existente.

## Validación ejecutada

| Comando | Resultado |
| --- | --- |
| `npm ci --cache /workspace/work/npm-cache` | Correcto, 187 paquetes; caché local escribible del entorno |
| `npm test` | **265 pruebas, 265 superadas, 0 fallos** |
| `npm run lint` | Correcto (`tsc --noEmit`) |
| `npm run build` | Correcto; avisos existentes de bundle y configuración nativa futura de Vite |
| `GEMINI_API_KEY='' GOOGLE_API_KEY='' CHROMIUM_PATH=/usr/bin/chromium npm run test:ui` | **183 resultados, 183 superados, 0 fallos**: 174 casos + 9 contenedores |
| `git diff --check` | Correcto |

Las regresiones nuevas incluyen ambos sentidos del bloqueo, traslado permitido, saldos y etiquetas históricas intactos, aprobación/copia previa, duplicación con contenedor distinto, colisiones globales y códigos de históricos, códigos personalizados, validación, cuota/reintento, doble clic, espera de guardado y carga de clasificaciones anteriores sin escritura. Se mantienen pruebas de transferencias 2.6 e históricas, restauraciones y JSON 3.1.

Se adaptaron los casos antiguos que esperaban reclasificar a INGRESO: ahora prueban traslado dentro de GASTO o rechazo explícito, conservando sus escenarios de almacenamiento y conflicto. La primera ejecución completa señaló esos casos obsoletos; los resultados de la tabla corresponden a la ejecución completa posterior, sin omisiones. Un primer `npm ci` falló por la caché no escribible del sistema; se repitió correctamente con caché de tarea, sin cambiar el lockfile.

## Límites y alcance

No se implementan subítems, un nuevo esquema, reclasificación financiera, ni CRUD adicional. Los gráficos pueden presentar la organización actual del catálogo; los registros y sus nombres históricos almacenados se conservan. La copia no duplica dinero ni presupuesto.

No hay rediseño, autenticación, nube o cambios de servidor. Los tests usan fixtures y contextos aislados; no acceden a datos del propietario ni a servicios financieros/IA reales. Firefox, Safari y dispositivos físicos no verificados en esta entrega.
