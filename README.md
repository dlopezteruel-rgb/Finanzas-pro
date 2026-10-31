# Finanzas Pro

Aplicación React/Vite con servidor Express. Los datos financieros se guardan en el navegador; no hay base de datos ni sincronización entre dispositivos.

## Desarrollo y comprobaciones

Entorno verificado: Node 24.19 y npm 11.9.

```sh
# El manifiesto original tiene un conflicto de peer dependencies Vite/esbuild.
npm install --legacy-peer-deps --package-lock=false
npm run dev
npm test
npm run lint
npm run build
```

`npm test` ejecuta las pruebas originales y las regresiones de la Fase 1 con `node:test`. `lint` es la comprobación TypeScript.

Para las pruebas completas de interfaz se necesita Chromium instalado:

```sh
CHROMIUM_PATH=/usr/bin/chromium npm run test:ui
```

Este comando compila, inicia un servidor de prueba en un puerto libre y abre un navegador aislado. Comprueba consultas, negaciones, propuesta editable, doble confirmación, importación inválida, cancelación, fallo de almacenamiento, recuperación y restablecimiento demo. No utiliza datos del navegador del usuario. Las consultas Gemini se simulan en estas pruebas; no consumen una API real.

## Fase 1: registro revisado

Las consultas, preguntas con números y negaciones no registran movimientos. Una orden como «Registra un gasto de 15 euros con Openbank» o una descripción como «Ayer cené fuera por 15,50 € con Openbank» abre una propuesta. Se pueden cambiar tipo, importe, fecha, cartera, categoría, concepto y estado. Solo «Confirmar y registrar» guarda; cancelar o cerrar con Escape descarta la propuesta. La confirmación admite una sola ejecución, incluso con clics repetidos.

La clasificación es conservadora y se basa en reglas, no en Gemini. El parser original sigue teniendo limitaciones con cantidades ambiguas, separadores de miles y fechas: es necesario revisar la propuesta. Las consultas financieras mantienen su recorrido por `/api/assistant-chat`.

## Importaciones y recuperación

El formato admitido es el JSON completo exportado por la aplicación, versión `2.5`. Debe incluir `exportedAt`, `theme` y las seis colecciones: `transactions`, `budgetPlans`, `budgetGroups`, `contacts`, `loans`, `wallets`. Se comprueban todos los elementos, tipos, campos obligatorios y opcionales, fechas reales, números finitos, enumeraciones e identificadores duplicados. Se rechazan campos desconocidos y archivos mayores de 10 MB. No se aceptan restauraciones parciales ni se convierten versiones automáticamente.

Los enlaces huérfanos que versiones anteriores podían exportar se avisan en la vista previa; se conservan, sin reparar ni recalcular préstamos, transferencias o gastos compartidos. Esto permite revisar una copia existente sin introducir cambios contables en esta fase.

La importación muestra cantidades, fecha, tema y advertencias antes de pedir confirmación. Restablecer la demostración requiere el mismo proceso. Cancelar no escribe nada. Tras confirmar:

1. Se guarda y verifica una copia del estado anterior.
2. Se sustituye el estado activo mediante una única escritura local.
3. Se actualiza la interfaz solo si ambas operaciones han tenido éxito.

Si falla la copia o la escritura del nuevo estado, no se aplica la sustitución. Las copias anteriores se conservan con claves distintas y se pueden descargar desde **Opciones y datos → Copias de recuperación**. Para recuperarlas, utiliza **Importar JSON** y confirma tras revisar la vista previa.

El conjunto activo usa `finanzas_pro_data_v1`. Las claves anteriores `finanzas_pro_*_v2` y `finanzas_pro_theme` se leen si todavía no hay un conjunto activo; no se borran ni se reescriben. Una versión antigua del código no conoce la nueva clave y podría mostrar datos desactualizados: exporta siempre una copia antes de volver a una versión anterior.

Si los datos locales no superan la validación, se bloquea su edición y se permite descargar los valores originales para recuperarlos, sin sustituirlos por datos de demostración.

## Límites pendientes

El almacenamiento y las copias siguen siendo locales, sin cifrado ni coordinación entre pestañas. Borrar los datos del navegador también elimina las copias: descarga respaldos fuera del navegador. Si se llena la cuota, las sustituciones se bloquearán. Los errores de cálculos de préstamos, transferencias, gastos compartidos y las respuestas fallback de Gemini identificados en la auditoría quedan fuera de esta fase.
