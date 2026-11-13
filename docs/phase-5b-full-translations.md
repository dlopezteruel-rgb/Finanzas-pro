# Fase 5B — Traducción integral (en curso)

Base limpia: `95d08a2dd7c2d9752b8865fc8aa4a32263b5eb96`, merge PR #25. Rama `feature/phase-5b-full-translations`. No se modifica main ni se fusiona/despliega/sincroniza Google AI Studio. Se mantienen dependencias, workflow y protecciones.

## Checkpoints y estado real

1. Inventario y extracción de P1 bancario/común: validado en español, traducciones pendientes. Reutiliza I18nProvider/useI18n, es.ts, messages.ts y preference.ts; añade mensajes canónicos en es.p1.ts y parámetros React al mismo sistema.
2. P1 de almacenamiento, inicio, histórico, planificación, catálogo y automatizaciones: pendiente.
3. P2/P3, diccionarios completos en-GB, it-IT, fr-FR, pt-PT y adaptadores de presentación: pendiente.
4. Matriz completa multidioma, accesibilidad, activación por idioma validado y entrega: pendiente.

**Ningún idioma nuevo está habilitado.** No se declara una traducción completa mientras haya superficies o pruebas pendientes.

| Idioma | Locale | Estado del selector | Cobertura actual | Flujos integrales traducidos |
| --- | --- | --- | --- | --- |
| Español | es-ES | Disponible | Referencia canónica, UI previa en español | Regresión española inicial correcta |
| English | en-GB | Próximamente, deshabilitado | 955/955 claves registradas; UI incompleta | No verificados |
| Italiano | it-IT | Próximamente, deshabilitado | 955/955 claves registradas; UI incompleta | No verificados |
| Français | fr-FR | Próximamente, deshabilitado | 955/955 claves registradas; UI incompleta | No verificados |
| Português | pt-PT | Próximamente, deshabilitado | 955/955 claves registradas; UI incompleta | No verificados |

## Diccionarios y guarda de disponibilidad

Los archivos independientes en.ts, it.ts, fr.ts y pt.ts contienen 955 claves cada uno: controles y mensajes canónicos P1, contadores plurales y metadatos. Esto es cobertura completa del **catálogo registrado actual**, no de toda la interfaz. Las superficies sin extraer siguen pendientes; por eso los cuatro idiomas siguen inactivos.

`isLanguageAvailable` exige status ready, diccionario completo/compatible y las dos condiciones de languageReadiness: uiComplete y flowsVerified. Un diccionario completo por sí solo no permite activarlo ni persistirlo. Provider, validación de preferencias y selector comparten esa guarda. No hay detección automática del navegador ni un segundo sistema de idiomas.

Los plurales usan las reglas Intl existentes, claves one/other y familias tipadas; hay casos de cero, uno, varios y cantidades grandes en los cinco locales. Las cantidades se formatean solo para mostrar; no vuelven a ningún parser. La primera aplicación es el contador «y N más» en eliminación, sin cambiar su significado.

Las coincidencias de ortografía nativa (por ejemplo «Guardar» en pt-PT o «disponible» en fr-FR) no se contabilizan como texto español residual. El listado revisado de claves coincidentes está en phase-5b-lexical-exceptions.json, restringido a las claves actuales, sin eximir superficies pendientes. IBAN y nombres propios de ejemplos siguen intactos. Se conservan TIN/TAE como siglas del modelo existente, sin reinterpretarlas como otros indicadores regulatorios.

## Inventario reproducible

`scripts/i18n/inventory.mjs` usa el parser AST que ya incluye Rolldown/Vite; no se añade ninguna dependencia. Ejecutar `node scripts/i18n/inventory.mjs /tmp/finanzas-i18n.json` desde el repositorio. Registra archivo, línea, posición, tipo, atributo/propiedad, texto, expresiones dinámicas y clasificación. Incluye los literales no JSX que requieren revisión; no presupone que todo string de código sea texto traducible.

Inventario inicial: 790 fragmentos JSX y 300 atributos visibles, además de 3.618 literales para revisión semántica. Otros 768 son de importación/tipo y 2.057 son atributos internos. Esas categorías automáticas son candidatos, no una certificación de cobertura. Las claves ya localizadas se distinguen de textos pendientes; el informe resumido permite reproducir el análisis por archivo.

Superficies: Root/carga/error y landing; navegación, cabecera, opciones, PeriodSelector y Overlay; DashboardView/TreasuryView; TransactionsView y registro rápido; WalletsView, transferencias, préstamos y liquidaciones; BudgetWorkspace/PlanningView/BudgetsView, catálogo/subítems y automatizaciones; ContactsView y gastos compartidos; AssistantChatView y propuestas; ChartSlot/FinancialCharts/InteractiveChart; validaciones y mensajes producidos por utilidades.

### Política de excepciones

- Nombres, notas, conceptos, carteras, contactos, familias y partidas son datos, incluidos los ficticios del catálogo y los históricos: se conservan literalmente. No se traducen valores por coincidencia de texto.
- Identificadores, enumeraciones, claves de almacenamiento, códigos, versiones JSON, rutas de validación, clases CSS y atributos técnicos permanecen invariantes.
- Parser, prompts, intención y API del asistente quedan intactos. Los ejemplos que se envían al parser deben conservar su payload español y anunciarse como ejemplos en español; localizar sus etiquetas no debe cambiar las consultas enviadas.
- Los errores de dominio se mantienen dentro de las utilidades financieras; su presentación requiere un adaptador explícito, sin traducir por defecto textos desconocidos ni campos del usuario.
- FinanZas, EUR, IBAN y nombres propios de ejemplos son invariantes deliberados. Un literal pendiente de revisar no se considera una excepción justificada ni cobertura completa.

## Arquitectura y seguridad de datos

Las claves siguen derivando del español y son tipadas. Las frases con formato usan `I18nText`, conectado al mismo useI18n y diccionario: los slots tienen nombre y conservan React nodes, sin HTML crudo, sin evaluación de parámetros ni concatenaciones traducidas por partes. Los datos del usuario se insertan como valores escapados. Las traducciones siguen siendo objetos por clave; no tablas de índices.

No cambian FinanceStore, sus revisiones/Web Locks, lógica financiera, cálculos, parsers, migraciones, modelos, API o JSON 2.5–3.4. La preferencia continúa independiente en `finanzas.ui.language`. EUR y Europe/Madrid se mantienen para presentación Intl; ninguna cadena localizada vuelve a un parser.

## Glosario de revisión

| Concepto | en-GB | it-IT | fr-FR | pt-PT |
| --- | --- | --- | --- | --- |
| Movimiento | Transaction | Movimento | Opération | Movimento |
| Cartera/cuenta | Account | Conto | Compte | Conta |
| Familia presupuestaria | Budget family | Famiglia di budget | Famille budgétaire | Família orçamental |
| Partida | Budget item | Voce di budget | Poste budgétaire | Rubrica orçamental |
| Traspaso | Transfer | Trasferimento | Virement | Transferência |
| Tramitado/pendiente | Processed/Pending | Contabilizzato/In sospeso | Comptabilisé/En attente | Processado/Pendente |
| Reintegro compartido | Reimbursement | Rimborso | Remboursement | Reembolso |

## Validación registrada

Base recién ejecutada: 440 unitarias; lint/build y 301 resultados Chromium de las 22 suites anteriores correctos. No se usan referencias históricas como sustituto de pruebas.

Primera extracción: 443 unitarias correctas (incluye tres pruebas nuevas de slots, escape de datos y claves de módulos); lint y build correctos. Chromium focalizado: carteras 14/14 y eliminación segura 23/23; batería financiera ampliada 57/57. Total focalizado: 94 resultados, cero fallos, omisiones o cancelaciones. La batería anterior se conserva íntegra.

Los 136 grupos incompletos axe de referencia se mantienen como **pendientes de revisión manual**, separados de violaciones y de resultados verificados. Sus cifras se volverán a medir. No se afirma uso de lector de pantalla ni dispositivos físicos.

### Checkpoint de diccionarios validado localmente

La [primera ejecución de Actions](https://github.com/dlopezteruel-rgb/Finanzas-pro/actions/runs/43409428078), SHA 4109a04f273117fc3c53f28e2b19d2e96107cde0, terminó con los tres checks verdes. Los 136 grupos incompletos axe siguen siendo revisión manual pendiente, no violaciones ni accesibilidad certificada.

Durante el desarrollo una prueba nueva construyó mal su resultado esperado usando String.replace con `$&`; se corrigió el oráculo para comparar literalmente. La interpolación de producción ya preservaba esos caracteres y no cambió para ocultar un fallo.

Checkpoint de diccionarios: **454 unitarias**, lint/build y **10 resultados Chromium** del selector/preferencias correctos, sin omisiones ni cancelaciones. Son pruebas de las claves, variantes, plurales, slots, seguridad y bloqueo de idiomas no verificados. **No son pruebas de la interfaz completa en los otros cuatro idiomas**. Sus flujos siguen pendientes y bloqueados.

Los tres checks de cada checkpoint se conservan como evidencia de regresión del código publicado; un check verde no certifica por sí solo cobertura lingüística integral.

### Checkpoint de inicio, histórico, cuentas, recuperación y periodos

Se extraen 149 mensajes adicionales de App, DashboardView, TransactionsView, WalletsView, ConfirmClearModal y PeriodSelector; se añaden diez variantes plurales y dos metadatos. Total registrado: 425 claves por diccionario, todavía sin cobertura integral de UI. Las cabeceras y marcadores CSV permanecen como formato de intercambio fijo; el idioma no reescribe sus datos.

El título del documento y las descripciones HTML/Open Graph se actualizan mediante el proveedor existente, junto con lang. El HTML inicial sigue en español como idioma predeterminado; la preferencia local se aplica en el cliente.

Incidencia **5B-001 — Overlay**: el cambio de idioma cross-tab con un borrador de cuenta abierto conservaba el valor pero reinicializaba el foco porque title formaba parte del efecto de apertura. Reproducida en los cinco idiomas en un build de prueba: cinco casos fallidos, sin pérdida de datos. Se separa la actualización aria-label del ciclo de apertura; pasan los cinco casos, la devolución del foco y el guardado posterior con importe 1234.56. No se cambia el guardado ni los validadores.

Pruebas nuevas: scripts/translatedBanking.browser.ts, añadido al final de test:ui, conserva las 22 suites anteriores. Para verificar idiomas previstos sin habilitarlos se compila una **vista previa exclusivamente de prueba** en un directorio temporal: mismo proveedor, diccionarios y aplicación, con guardas de disponibilidad sustituidas solo en memoria por un plugin de test. No se reescriben registros ni archivos de disponibilidad de producción. Cuando todos los idiomas estén activos se utilizará directamente el build de producción. Estos resultados focalizados **no autorizan a marcar completos los flujos ni a activar idiomas**.

Verificado localmente: 457 unitarias, lint/build; 92 resultados Chromium de regresión española (sharedUx 12, deletion 23, phase1 57) y seis resultados de la nueva suite en los cinco idiomas, 1280 px/tema oscuro. Diez superficies axe del formulario de cuenta sin violaciones y sin grupos incompletos nuevos en esa prueba. El informe distingue esos datos de los **136 grupos incompletos de referencia** de la auditoría general, que siguen pendientes de revisión manual. La regresión completa y el check de GitHub de este checkpoint se registrarán al cerrar la ejecución.

Pendiente: resto de planificación/catálogo/automatizaciones, contactos/compartidos/asistente/gráficos y utilidades que producen UI; fechas/importes de todos los módulos mediante Intl preservando exactamente céntimos; matriz completa 390/768/1280 claro/oscuro, ausencia de residuales, restauración por idioma e imágenes de landing. Por eso uiComplete y flowsVerified siguen en false para en/it/fr/pt.

El inventario v2 incorpora fronteras server/config y distingue errores dentro de callbacks de atributos puramente técnicos. El análisis completo detectó y corrigió un error del propio recorrido: Array.flatMap pasaba su índice como segundo argumento del analizador. Dos pruebas nuevas cubren la clasificación de callbacks y el recorrido completo; no se ha traducido código interno para resolverlo. El informe señala también metadatos HTML, estilos e imágenes, y localiza llamadas de presentación por archivo. Todavía quedan candidatos visibles pendientes; no se deduce una cobertura integral de los recuentos automáticos.


### Checkpoint de planificación y aprobación

Se registran 114 mensajes adicionales de PlanningView, PlanningSection, PlanningLiveSummary y BudgetWorkspace y cuatro variantes plurales de errores visibles/ocultos. Total: **543 claves** completas por diccionario. Las pestañas conservan sus identificadores internos; solo sus etiquetas y los estados presentados se localizan. Los avisos locales guardan claves de presentación para actualizar su idioma sin reescribir datos. El estado devuelto por planificación se adapta al presentar, sin modificar utilidades, snapshots ni cálculos. Los textos de aprobación mantienen la confirmación explícita de déficit.

Resultado local: **459 unitarias**, lint/build y diff-check correctos; **13 resultados Chromium** de la regresión española de planificación; **31 resultados** de la nueva suite, que comprueba 30 combinaciones (cinco idiomas × tres anchos × dos temas) y su contenedor. Verifica entradas canónicas, borrador sin escrituras, aceptación explícita de déficit, Escape, devolución de foco, Tab/Shift+Tab dentro del diálogo, aprobación única y persistencia exacta de 300001, 100000 y 250000 céntimos. Conserva nombres ficticios personales y todos los movimientos/cuentas originales.

La suite añade 60 observaciones axe: cero violaciones, **86 grupos incompletos pendientes de revisión manual en esas observaciones**. Son mediciones de esta matriz parcial, separadas de los 136 grupos de referencia; no son nuevos defectos únicos ni certificación de lector de pantalla. Genera diez capturas ficticias de vista previa (390 claro / 1280 oscuro por idioma) como artefactos; contienen otras superficies aún pendientes de traducir. No se presentan como capturas de idiomas habilitados.

El primer intento de la nueva prueba seleccionaba Ingresos solo en móvil y fallaba en escritorio por intentar editar un panel oculto. Se corrigió el recorrido para seleccionar la pestaña en todos los anchos. No se cambió la aplicación ni se ampliaron tiempos para ocultarlo. Una interrupción de esa ejecución dejó logs superpuestos; la ejecución de evidencia se repitió con archivo independiente. Quedan pendientes los errores provenientes de utilidades, nombres históricos generados, Intl general, subítems, automatizaciones y Catálogo, además del resto de P2/P3. Por tanto, los cuatro idiomas siguen bloqueados.

Regresión completa publicada del checkpoint anterior: [Actions 43423672139](https://github.com/dlopezteruel-rgb/Finanzas-pro/actions/runs/43423672139), SHA `541deb8fec51041aba024892343d7f7e3094724e`: Unitarias, Lint/build/diff y Chromium/axe en verde; artefacto del navegador verificado, **307 resultados / 23 suites**, cero fallos, omisiones o cancelaciones. No sustituye la validación final de la fase.


Incidencia **5B-002 — Etiqueta de ahorro en móvil**: la revisión de la captura francesa a 390 px confirmó separación de 0 px entre texto y campo, por lo que el contorno de foco ocultaba el final de la etiqueta. Se añade flex-wrap con espacio de 8 px solo a esa etiqueta. La nueva suite exige separación geométrica suficiente en las 30 combinaciones, sin cambiar valores, restricciones ni parsers. Capturas ficticias de la vista previa (otros módulos siguen pendientes):

| Antes | Después |
| --- | --- |
| ![Etiqueta francesa antes](screenshots/phase-5b/planning-fr-390-light-before.png) | ![Etiqueta francesa después](screenshots/phase-5b/planning-fr-390-light-after.png) |

Tras el ajuste visual pasan también los **16 resultados Chromium** de la batería responsive española: siete módulos, 390–1920 px, ambos temas, zoom 125 %/200 %, foco y redimensionado. La matriz multidioma se repite con la comprobación geométrica y pasa 31/31, sin omisiones ni cancelaciones.


### Checkpoint de Catálogo, detalle, subítems y arrastre

Se añaden **206 mensajes canónicos y dos variantes plurales**, 751 claves completas por diccionario. Se localizan la gestión de familias y partidas, confirmación de archivo con reglas activas, traslado, detalle, selectores, desglose mensual y anuncios de arrastre. El mensaje conserva explícitamente que las reglas seguirán activas y no se borran, desactivan ni reasignan; que no se ejecutan automáticamente; y que históricos/importes/desgloses quedan en lectura. Los nombres personales se conservan incluso si coinciden con términos de interfaz.

Las diez etiquetas propias de catalogDependencies se adaptan exclusivamente al presentar mediante claves explícitas en i18n/presenters.ts. Las utilidades permanecen intactas. Un resultado desconocido se conserva y se señala como pendiente de cobertura; no se interpreta como clave ni se aplica este adaptador a nombres o campos del usuario. La fila sintética «Sin subítem» se distingue por la ausencia de ID; un subítem personal con ese nombre conserva su texto literal.

Los anuncios de arrastre guardan claves y referencias de presentación, no frases ya traducidas. El hook construye las descripciones a partir de kind y del nombre literal. Los callbacks conservan los mismos tipos/códigos/IDs/scope y las utilidades de ordenación no cambian. Así, cambiar de idioma con un arrastre por teclado activo actualiza los anuncios y conserva la sesión y el foco.

Verificado localmente: **461 unitarias**, lint/build y diff-check; **40 resultados Chromium españoles** de catalogArchive (11), catalogReorder (10) y budgetSubitems (19). Nuevas suites: translatedCatalog (31 resultados, 30 combinaciones de idiomas/anchos/temas + contenedor) y translatedCatalogDrag (11 resultados, cinco idiomas × ratón/tacto emulado + contenedor). En todos los casos, cero fallos, omisiones o cancelaciones en las ejecuciones de evidencia. El tacto se emula mediante CDP, no se afirma haber probado dispositivos físicos.

La matriz comprueba eliminación bloqueada, archivo explícito, cambio cross-tab en el diálogo, Escape/Tab/Shift+Tab/foco, reactivación, lectura de subítems y recarga; conserva reglas, previsiones, movimientos e históricos. La prueba de arrastre comprueba anuncios nativos durante un cambio cross-tab, cancelación sin escrituras, ordenación confirmada con teclado y con puntero, nombres/identidades y cantidades intactos. Los 60 controles axe del diálogo de archivo dan cero violaciones y **60 grupos incompletos pendientes de revisión manual**, separados de las observaciones de Planificación y de los 136 grupos de referencia.

Se corrigieron dos errores de recorrido en la prueba nueva: el foco inicial pertenece al propio diálogo, y los nombres de subítems debían buscarse en el desglose visible, no en su gestor plegado. También se devuelve expresamente el primer plano a la pestaña revisada tras escribir la preferencia desde la segunda, como haría el usuario. Las ejecuciones de evidencia completan la matriz de Catálogo en 104,53 s y la de arrastre en 25,77 s; los límites finales siguen siendo 300 s y 180 s, sin ampliar los tiempos por control ni relajar aserciones.

Aviso nuevo de build: algunos chunks superan 500 kB minificados al incorporar los diccionarios. No se oculta el aviso ni se cambian dependencias, configuración o workflow para suprimirlo. Se documenta como coste pendiente de revisar antes de la habilitación global.

CI publicado del checkpoint de Planificación: [Actions 43426545828](https://github.com/dlopezteruel-rgb/Finanzas-pro/actions/runs/43426545828), SHA `e8ac869677a0bace1ca7c579f8dc0654cd257f25`, tres trabajos verdes. Artefacto verificado: **338 resultados / 24 suites**, cero fallos, omisiones o cancelaciones; auditoría general 128 superficies, cero violaciones, **136 grupos incompletos**. La matriz adicional de Planificación registra 88 grupos incompletos en CI frente a 86 locales; son observaciones que requieren revisión manual, no violaciones ni resultados verificados.

Las capturas PNG de las suites se generan en ci-artifacts/browser localmente. El workflow existente conserva logs/JSON siempre y capturas solo si falla; no se modifica esa política. Las dos imágenes comparativas francesas de esta documentación sí están versionadas y son íntegramente ficticias. Continúan pendientes automatizaciones, otros módulos P1/P2/P3, errores de dominio, presentación Intl global y validación integral sin residuales. Los cuatro idiomas siguen deshabilitados.


### Checkpoint de automatizaciones y errores de planificación

Se añaden **204 claves**, total **955 claves completas por diccionario**. PlanningAutomationPanel localiza copias, reglas, recurrencias, arrastres, revisión, eliminación e historial, incluidos sus controles, ayudas, confirmaciones y diferencias antes/después. Las etiquetas de operaciones y los estados presentados son claves; los valores internos y las solicitudes originales no cambian. A/B siguen siendo marcadores invariantes de comparación.

planningMessages.ts adapta al presentar 80 entradas estáticas propias de planificación y del aviso de traslado, además de sus motivos parametrizados. Incluye errores de importes/rangos y variantes completas de motivos de copia con o sin desglose. Los motivos de reglas utilizan su nombre literal y una frecuencia separada de presentación; los de arrastre leen céntimos con la función de dominio existente, sin interpretar cadenas monetarias. Los mensajes, filas, ámbitos y solicitudes originales se conservan para la revalidación de FinanceStore. Los campos técnicos de mensajes «falta/campo no reconocido» permanecen literales. Los diagnósticos desconocidos conservan su texto, lo que sigue siendo cobertura pendiente.

Los errores se traducen al mostrarlos; no se modifica el parser, ni el texto que recibe, ni sus reglas. Los campos editables y las sumas de subítems mantienen entradas canónicas. La advertencia textual de un total inválido se localiza únicamente en el campo de solo lectura; el centinela interno y el borrador original permanecen intactos. No se cambian planningPreview, FinanceStore ni ninguna utilidad financiera.

Pruebas nuevas: **464 unitarias** correctas. Tres casos comprueban que 3.000, -1 y 1.001 siguen rechazándose; 15,50/15.50 siguen siendo 1550 céntimos; MAX_SAFE_INTEGER conserva el último céntimo; el texto no se interpreta como HTML o como parámetros nuevos; y adaptar motivos no cambia la propuesta ni su aplicación posterior. Lint/build y diff-check correctos. Se mantiene visible el aviso de chunks superiores a 500 kB.

Chromium de este checkpoint: **49 resultados españoles** (automation 15, budgetSubitems 19, budgetUx 15), **31 resultados** de Planificación en los cinco idiomas con errores de entrada, y **41 resultados** de automatizaciones. Estos últimos son 30 combinaciones de copia (cinco idiomas × tres anchos × dos temas), cinco recorridos de subítems/cross-tab y cinco de reglas/recurrencias/arrastre/historial, más su contenedor. Cero fallos, omisiones o cancelaciones en las ejecuciones de evidencia. Todos los datos son ficticios.

La batería comprueba confirmación única ante doble envío; cancelación sin escrituras; conflicto omitido por defecto; guardado, pausa y retirada de reglas sin borrar las previsiones generadas; arrastre separado sin movimientos bancarios; revisión y retirada conservando las fotografías; y conservación de 6001/4000 céntimos al corregir un subítem. El cambio cross-tab mantiene el mismo campo y su valor 3.000 mientras cambia el idioma del error. La primera prueba conservaba el nombre anterior de la región en su localizador: fallaron cinco casos y su contenedor, sin fallo de datos; se corrige el recorrido y pasan los 41 resultados completos.

Axe adicional: **85 observaciones de automatización, cero violaciones y 95 grupos incompletos** pendientes de revisión manual. La matriz repetida de Planificación tiene 60 observaciones, cero violaciones y 86 grupos incompletos locales. Se mantienen separados de los **136 grupos de referencia**, sin sumarlos como defectos únicos ni declararlos verificados.

Incidencia **5B-003 — Contorno de foco en reglas**: la etiqueta francesa de importe tenía 0 px de separación en 390 px. Se reutiliza el ajuste flex-wrap/8 px de ahorro en las etiquetas de los campos de regla, sin cambiar controles, validación o cantidades. La nueva prueba exige separación geométrica suficiente en los cinco idiomas. Capturas ficticias comparables:

| Antes | Después |
| --- | --- |
| ![Regla francesa antes](screenshots/phase-5b/rule-fr-390-dark-before.png) | ![Regla francesa después](screenshots/phase-5b/rule-fr-390-dark-after.png) |

CI publicado del checkpoint de Catálogo: [Actions 43443220414](https://github.com/dlopezteruel-rgb/Finanzas-pro/actions/runs/43443220414), SHA `d34c085eef4529e3734c3ca8d8ac205c1beb3541`: tres trabajos verdes; artefacto comprobado con **380 resultados / 26 suites**, sin fallos, omisiones o cancelaciones; axe general 128 superficies, cero violaciones, 136 grupos incompletos. El nuevo SHA requiere sus propios checks.

Continúan pendientes otros módulos P1/P2/P3, los demás errores de dominio, presentación Intl global, inventario semántico final y matriz integral sin residuales. Los cuatro idiomas siguen bloqueados y no se presenta este checkpoint como traducción integral terminada.
