# Reconstrucción del catálogo personalizable

Repositorio `dlopezteruel-rgb/Finanzas-pro`. Base obligatoria: `main` en `565c0b1dc006ec15bb205dda4ceb3c9e3d6e6cc8` (PR #21 integrada). Rama `feature/custom-budget-catalog-rebuild`. El directorio reconstruido es independiente de `/workspace/work/Finanzas-custom-catalog`, cuyo almacenamiento no está disponible en esta sesión. Su ausencia no prueba su eliminación. Si reaparece, comparar antes de incorporar cambios.

## Checkpoint A: interfaz y navegación

- Contactos comparte el relleno interior semántico del Catálogo: superficie al 96 % mezclada con el color de texto. Las tarjetas de historial usan la superficie normal, y las acciones de liquidación pueden pasar a otra línea sin partir palabras.
- Las casillas de series miden 19 × 19 px dentro de etiquetas de al menos 44 px de alto. Las leyendas separan muestra de color y nombre; las tablas conservan desplazamiento horizontal propio. En gráficos de más de cuatro series se activan inicialmente las tres primeras; el resto se puede activar individualmente.
- Planificación conserva el encabezado, mes, ahorro, balance, totales, guardado y aprobación arriba. Desde 768 px, Multiperiodo aparece antes de las pestañas Gastos/Ingresos; en móvil es una tercera pestaña. El bloque multiperiodo se puede plegar.
- Existe un único estado de borrador. Los paneles permanecen montados al cambiar de área o tamaño de ventana; todas las partidas, incluidas las ocultas, participan en validación y aprobación. Una pestaña con errores muestra «Revisar importes». Flechas, Inicio y Fin mueven el foco; Enter/Espacio activan la pestaña.
- El catálogo, detalle, selector y comparación muestran nombres en lugar de códigos. Los códigos técnicos siguen siendo las identidades y valores internos de los controles. No se añade un modo profesional ni una preferencia de presentación al respaldo.
- Esta etapa no modifica tipos financieros, FinanceStore, reglas contables ni versiones JSON. La gestión del catálogo y JSON 3.4 corresponde a B; arrastre a C; clasificación del catálogo personalizado y cierre completo a D.

## Validación y reproducción

La base se comprobó con árbol limpio antes de crear la rama. `npm ci --cache /workspace/work/npm-cache` instaló 187 paquetes sin cambiar el lockfile. La primera instalación falló porque la caché predeterminada no era escribible; se solucionó usando una caché dentro del workspace.

Referencia ejecutada de nuevo en la base: 335 unitarias y 234 resultados Chromium, sin fallos ni omisiones; lint, build y diff-check correctos. Las cifras de la ejecución perdida no se usan como evidencia.

La suite `scripts/catalogPresentation.browser.ts` prueba 390/768/1280 px y ambos temas con fixtures, reloj fijo y solicitudes externas bloqueadas. Comprueba pestañas, foco, errores en el panel oculto, borrador tras redimensionar, dimensiones táctiles/casillas, selección de series, contraste, superficies de Contactos y ausencia de escrituras por consultar. Se conserva y adapta la batería anterior a las nuevas pestañas y etiquetas, manteniendo las comprobaciones financieras.

Comando focalizado: `npm run test:ui:catalog-presentation`. `CATALOG_PRESENTATION_ARTIFACT_DIR` permite capturas reales con los datos ficticios de la suite. La batería completa sigue siendo `CHROMIUM_PATH=/usr/bin/chromium npm run test:ui`.

Los recuentos del checkpoint se registran en `custom-budget-catalog-rebuild-validation.json`. Las capturas definitivas del conjunto, documentación de JSON 3.4 y PR Draft se preparan al cerrar D.

Límites: pruebas automatizadas en Chromium; dispositivos físicos, Safari/Firefox y lectores de pantalla requieren revisión manual. No hay fusión, despliegue ni sincronización de Google AI Studio.

## Checkpoint B: modelo y gestión del catálogo

A quedó publicado en `6125ef4fa9d9f95f61fd10d5af5797f052bd9447` antes de comenzar B.

### Identidades y estados

Se conserva `BudgetGroup.code` como identidad del contenedor y `BudgetPartida.type + code` como identidad de partida. No se interpreta `groupCode` como identidad del contenedor: los catálogos heredados pueden usar allí un subgrupo, por ejemplo `F.003` dentro de `F_EXP`. Renombrar una familia no normaliza esos campos históricos; mover una partida cambia únicamente su organización en el catálogo. Las etiquetas guardadas en movimientos, los importes y las fotografías aprobadas permanecen intactos.

Familias y partidas admiten `archived?: boolean` y `deleted?: true`. Ausencia equivale al comportamiento anterior. Retirar crea un tombstone archivado, conservado en JSON, y nunca libera su código. Una familia solo se retira sin partidas vivas; una partida solo sin referencias de movimientos, préstamos, subítems (también retirados), planes, aprobaciones vigentes o históricas, arrastres, reglas y procedencias. El tipo principal es inmutable. El archivo del contenedor excluye todas sus partidas de nuevas opciones, sin cambiar el estado individual de cada hija.

Las identidades nuevas se generan en la interfaz con `crypto.randomUUID()`, usando los espacios `family-…` y `partida-…`. Las colisiones y códigos usados por históricos también se rechazan en el dominio. La duplicación conserva el mecanismo previo de códigos únicos y da IDs nuevos a los subítems activos; no copia operaciones, cantidades mensuales ni aprobaciones. Las ordenaciones omiten tombstones.

### Interfaz y límites del guardado

En Catálogo, «Gestionar familias y partidas» permite crear, editar metadatos, archivar/reactivar, ordenar familias y confirmar eliminaciones. Los controles de traslado, duplicación y orden de partidas del catálogo siguen disponibles. Los diálogos conservan los campos ante un fallo y solo se cierran tras persistir. Una eliminación muestra sus bloqueos y se comprueba otra vez bajo el lock al confirmar.

`FinanceStore.mutate` verifica identidades, estados, dependencias y nuevas asignaciones, también si una mutación elude el formulario. Los movimientos existentes pueden conservar su partida archivada al editarse; no se pueden asignar nuevos movimientos o previsiones a una partida o familia archivada. Las previsiones archivadas del periodo continúan consultables y sus cantidades se muestran de solo lectura. La integración completa de la interpretación de texto con el catálogo activo corresponde a D.

### JSON 3.4 y recuperación

Solo se exporta 3.4 cuando existen los nuevos campos de estado. Abrir, navegar o consultar formatos 2.5–3.3 no añade esos campos ni escribe datos. Al introducirlos por primera vez, el cambio de versión activa el procedimiento existente: escribir la copia completa anterior, releerla y verificarla antes de escribir el estado nuevo. Se conservan la clave de datos, Web Locks, detección de revisión obsoleta y el guardado atómico. Un fallo de copia, verificación o escritura activa conserva el estado financiero anterior y permite reintentar.

Las validaciones de 3.4 incluyen las capacidades de 3.3 y anteriores (subítems, cartera predeterminada, reglas, préstamos, compartidos, arrastres y fotografías); los estados nuevos se rechazan bajo etiquetas de versión antiguas. Para volver a una aplicación anterior se restaura la copia completa anterior; no se rebaja manualmente la etiqueta ni se mezclan colecciones.

Pruebas nuevas: `src/utils/budgetCatalog.test.ts` y `scripts/customCatalog.browser.ts`. Comando focalizado: `npm run test:ui:custom-catalog`. El informe de B se conserva separado del informe publicado en A.
