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
