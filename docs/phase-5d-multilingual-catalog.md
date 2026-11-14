# Fase 5D — Catálogo multidioma y personalización segura

## Preparación

Base exacta: `0a155a81ac31a96f28d515f64502507c91773f30`, merge de PR #27 confirmado en GitHub y origin/main. No hay commits posteriores a esa referencia. Rama creada desde origin/main con árbol limpio: `feature/phase-5d-multilingual-catalog`. Se revisan las fases 5A/5B/5C y el inventario de 5C contra las constantes reales: **12 familias, 77 partidas y 31 subgrupos por tipo/código**. Se conservan todos sus identificadores.

Línea base recién ejecutada: npm ci (188 paquetes, sin cambios de lockfile), **528 unitarias**, **22 de infraestructura**, lint y build correctos. Referencia de navegador de 5C: **698 resultados en 35 suites**; no se presenta esa referencia como una nueva ejecución de 5D. La validación final de 5D deberá ejecutar íntegramente la batería con sus casos añadidos.

## Decisión de arquitectura, previa a implementar el modelo

No hay actualmente una procedencia fiable en los datos guardados: código, prefijo, nombre e igualdad con el catálogo inicial no demuestran ausencia de personalización. Un mapa solo en memoria pierde esa información al guardar/recargar. Una clave visual separada podría sobrevivir a una restauración financiera y aplicarse al catálogo equivocado, o fallar después de un guardado correcto. Tampoco viaja con las exportaciones. Por tanto se justifica un metadato mínimo dentro de la misma operación atómica del catálogo.

Se propone un campo opcional `catalogNames` con versión propia 1 y selecciones por identidad estable para familias, partidas y subgrupos. No guarda traducciones ni sustituye nombres. Las familias usan su código existente; partidas y subgrupos usan tipo + código para evitar colisiones Ingresos/Gastos. Solo una selección explícita válida junto al nombre canónico y la identidad conocida autoriza la presentación traducida; el resto conserva literalmente el nombre guardado.

El formato nuevo será **JSON 3.5**, sin introducir campos incompatibles en 2.5–3.4. Se amplía la validación/importación/exportación existente. La subida de formato se guarda mediante la copia recuperable verificada que FinanceStore ya exige para actualizaciones de esquema; se conservan sus Web Locks, revisión entre pestañas y protocolo de escritura. En carga heredada se evita heredar la procedencia de los defaults nuevos. Abrir un archivo anterior no añade metadata ni escribe.

Los defaults construidos expresamente por la aplicación nueva tienen procedencia conocida y pueden contener esa selección. Los catálogos anteriores/importados sin declaración no reciben una automáticamente, aunque coincidan exactamente con las constantes. Podrán revisar identidades compatibles y optar explícitamente por los nombres del sistema. La operación revisa su alcance dentro de la mutación bajo el bloqueo existente. Volver al nombre guardado retira únicamente la selección y es reversible sin cambiar datos históricos.

Renombrar una identidad retira su selección de nombre predeterminado en la misma operación. Un nombre que el usuario personalice hasta coincidir con el español inicial sigue siendo personal hasta otra elección explícita. Crear o duplicar no atribuye procedencia de sistema a la identidad nueva. Archivo, reactivación y movimientos de organización conservan las referencias y las protecciones actuales. Los subítems siguen siendo nombres personales; los subgrupos heredados se distinguen de la familia contenedora.

## Presentación e integridad

Se reutilizan I18nProvider, useI18n, diccionarios tipados y la preferencia existente. Las claves se basan en las identidades del registro inicial. Una resolución central de nombres se aplica en las fronteras de presentación; nunca se entrega un catálogo con nombres traducidos a FinanceStore, cálculos o parsers. Los nombres y documentos históricos que representen un registro original se conservan literalmente. Los fallbacks propios sin catálogo no mostrarán códigos técnicos; las notas o nombres del usuario con apariencia de código se conservan.

El editor distinguirá el borrador visible del nombre guardado: abrir o guardar sin cambiar el nombre no persistirá una traducción. Cambiar de idioma conserva los formularios pendientes y no genera ninguna escritura financiera. La búsqueda visual podrá consultar etiquetas traducidas sin ampliar el reconocimiento natural del asistente ni sus prompts/API.

## Checkpoints y validación prevista

1. Metadatos de procedencia/presentación, compatibilidad JSON 3.5, transición segura y pruebas de recuperación, sin cambiar cálculos.
2. Diccionarios completos de los cinco idiomas y resolución central, integración en catálogo y controles de edición.
3. Integración en todas las superficies, ocultación de códigos propios, pruebas de personalización/históricos y Chromium multidioma con fixtures.
4. Regresión completa, documentación y capturas reales; publicación de una única PR Draft y verificación de los tres checks de su SHA final.

Los checkpoints se publican para conservar el trabajo. Esta versión inicial del documento justifica la decisión; no declara terminada la implementación ni pruebas pendientes como aprobadas.

## Límites preservados

EUR y Europe/Madrid, importes e identidades, saldos, transferencias, préstamos, compartidos, aprobaciones, arrastres, automatizaciones y referencias de subítems. No se traducen datos personales con IA ni se llama a servicios de traducción. No se fusiona, despliega, sincroniza Google AI Studio ni modifica main o sus protecciones.

Los grupos axe incompletos clasificados en 5C siguen separados de las violaciones automatizadas. Se mantienen todas las reglas y las pruebas existentes. No se afirma prueba con lector de pantalla o dispositivo físico.

## Checkpoint 1 — Procedencia y recuperación

Implementados metadatos opcionales validados y JSON 3.5, revisión explícita con alcance, retirada de selección al personalizar y protección de carga heredada. No hay todavía integración visual en este checkpoint. Se añaden **26 pruebas**: registro 12/77/31, colisiones por tipo, ambigüedad, reversión, renombrado, duplicación, orden/archivo/traslado, datos malformados, round-trip, ausencia de escrituras de lectura, recuperación verificada, fallos de copia/verificación/escritura y conflicto entre pestañas. Resultado local: **554/554 unitarias**, cero omitidas/canceladas; lint, build y diff-check correctos. Permanece el aviso de tamaño de bundle anterior. La batería Chromium completa sigue pendiente de la integración de interfaz.
