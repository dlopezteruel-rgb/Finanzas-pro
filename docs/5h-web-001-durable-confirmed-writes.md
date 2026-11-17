# 5H-WEB-001 — Escrituras web confirmadas y recuperables

**Estado actual:** infraestructura implementada en [PR Draft33](https://github.com/dlopezteruel-rgb/Finanzas-pro/pull/33). La regresión completa y CI del SHA final siguen pendientes; los resultados por checkpoint se conservan como historial verificable, sin presentarlos como aprobación global.

## Checkpoint 1: reproducción y decisión previa a implementar

Estado: investigación completada; **la corrección aún no está implementada ni se declara resuelta** en este checkpoint. Rama `fix/5h-web-001-durable-confirmed-writes`, base `ce1ec8398fed0eb6a39f0c362567b8a6613eaf81`. PR31 fusionada; PR32 abierta/Draft, SHA `ceb08c7fa3d05ea8c448855bf46fdec03e8af947`, sin cambios. Se conservan los ocho worktrees anteriores. No hay commits posteriores en origin/main al iniciar.

Se revisan FinanceStore, backup, useFinanceData, financeBinding, storageSupport, App y las garantías documentadas en fases1,2A/2B,3A/3B,4A y5A–5G. Los parsers, cálculos, reglas financieras y proyectos nativos no necesitan cambios para esta corrección. La frontera síncrona se conserva para el motor de propuesta y el prototipo móvil5G; nunca devolverá una Promise desde setItem.

### Reproducción real de la base

npm ci correcto; **654/654 unitarias**, **22/22 infraestructura**, lint/build correctos. Chromium **156.0.8078.79**, Node24.22.1, Linux. Perfiles persistentes privados, sintéticos, orígenes loopback y procesos Chromium propios. La prueba original de PR32 se copia sin dependencias móviles; sus imports ya existen en main. SHA256 original `b03faa31180540b664250b816f60de31f154c737c81562d986166fbb77c8a224`.

| Escenario | Base, prueba original |
| --- | --- |
| Cierre normal tras confirmar | Aprobado: documento nuevo íntegro |
| SIGKILL inmediatamente tras confirmar | **Fallido**: documento anterior íntegro, cuenta nueva ausente |
| SIGKILL antes del callback Web Lock | Aprobado: documento anterior íntegro |

[Resultado original 2/3](web-001-evidence/baseline-crash.json). El fallo devuelve1. Se añade después únicamente instrumentación de tiempos, revisiones e IDs: [instrumentación inicial](web-001-evidence/reference-harness-instrumentation.patch.json) y [adaptación completa frente a PR32](web-001-evidence/reference-harness-complete-diff.json). No se cambia la igualdad exacta del snapshot ni se introduce espera antes de SIGKILL. La repetición instrumentada se conserva separada. La preparación cierra normalmente y verifica el checkpoint antes de inyectar el fallo; no se confunde una fixture nunca consolidada con pérdida del cambio nuevo.

### Contrato anterior y causa demostrada

Dentro de Web Locks, FinanceStore valida una propuesta separada, ejecuta setItem(DATA_KEY, snapshot), actualiza su revisión y this.data y resuelve la mutación. useFinanceData publica React y devuelve `{ok:true}`; los formularios entonces pueden cerrarse. La restauración escribe una copia, la relee y después sustituye la clave activa. Ninguna de esas etapas proporciona un evento de consolidación física de localStorage; getItem solo verifica el valor visible para la API.

La observación demuestra que el valor nuevo era visible y confirmado en la interfaz pero no recuperable tras el SIGKILL probado. El dominio no calcula mal ni deja un documento parcial: reaparece exactamente el anterior. No se atribuye sin una traza del navegador a un syscall concreto ni se generaliza a todos los navegadores. El defecto es usar el éxito síncrono de esa API como frontera de confirmación recuperable.

### Investigación anterior a la solución

Se ejecuta [webDurabilityEngines.ts](../scripts/research/webDurabilityEngines.ts), independiente de React/FinanceStore y sin escribir datos del usuario. Misma propiedad comprobada: el documento completo confirmado debe sobrevivir al SIGKILL inmediato del grupo de procesos propio. Tres perfiles nuevos por alternativa, sin reintentos.

| API | Resultado real | Señal observada |
| --- | --- | --- |
| localStorage.setItem | **0/3** tras SIGKILL | Valor visible, sin evento de commit duradero |
| IndexedDB readwrite strict | **3/3** | durability='strict', complete posterior a request.success |
| IndexedDB readwrite relaxed | **3/3** | durability='relaxed'; este resultado limitado no eleva su contrato |
| navigator.storage.persist | Denegado en las nueve observaciones | persisted=false y persistGranted=false; strict sobrevive también sin ese permiso |

[Resultados de motores](web-001-evidence/engine-research.json). En strict, request.success tarda0,4–1,1ms y complete2–5,2ms en esta pequeña muestra. No son tiempos financieros ni una comparación estadística general. No se acepta relaxed solo porque estas tres muestras pasen.

[Fuentes oficiales, URLs y hashes consultados](web-001-evidence/research-sources.json): [IndexedDB](https://w3c.github.io/IndexedDB/#durability-hint), [Web Storage](https://html.spec.whatwg.org/multipage/webstorage.html), [Storage](https://storage.spec.whatwg.org/) y datos MDN de compatibilidad. IndexedDB define strict como indicación de priorizar consolidación antes de complete, con mayor confianza y coste potencial; sigue siendo un **hint**, no una certificación ante cortes eléctricos. persist reduce riesgo de eliminación por presión de espacio; no confirma transacciones ni sustituye backups. OPFS/flush requeriría otro protocolo de atomicidad y workers, con superficie mayor: no se elige sin necesidad. No hay backend ni nube.

## Decisión arquitectónica

Se selecciona **IndexedDB nativo del navegador, transacciones readwrite con durability:'strict'**, sin dependencias nuevas. Se comprueba el atributo efectivo; ausencia, rechazo o degradación a default/relaxed bloquea escrituras, manteniendo lectura/exportación cuando sea segura. Se espera complete, nunca únicamente request.success. abort/cuota/errores no publican estado.

React → controlador web asíncrono → Web Lock original → propuesta mediante el mismo FinanceStore sobre Map síncrono aislado → CAS y escritura IndexedDB → complete estricto → verificación/recibo → estado confirmado. FinanceStore, sus validadores y redondeos permanecen como motor compartido; el staging nunca es persistencia ni caché con éxito anticipado. No se importa código SQLCipher ni el controlador móvil de PR32.

### Documento, revisiones y atomicidad

La clave lógica continúa siendo `finanzas_pro_data_v1`; las copias conservan `finanzas_pro_recovery_`. Documento financiero JSON2.5–3.5 y esquema del contenedor IndexedDB son independientes. Se guarda el snapshot completo, sin normalizar movimientos ni recalcular contabilidad en el driver.

La transacción abarca documento activo, revisión/hash, copias requeridas y recibo de operación. Compara dentro de ella el snapshot/revisión esperado. Las copias se añaden sin sobrescribir identidades anteriores. Los hashes identifican bytes y detectan incoherencia; no son cifrado ni autentican un navegador comprometido. El lock se adquiere antes de la transacción y se conserva hasta terminar; no se toma después desde callbacks IDB.

UUID y fingerprint de petición inmutable permiten reconciliar respuesta perdida sin volver a ejecutar la transformación económica. Si no hay recibo, una resolución transaccional registra cancelación antes de permitir reintentar. Si no puede reconciliarse, se bloquean nuevas escrituras y se conserva el formulario. Un recibo confirmado sustituido por otra revisión exige recarga, nunca informa de que la operación no se guardó.

### Migración y transición de clientes antiguos

Inventariar y archivar **todos** los bytes financieros `finanzas_pro_`, incluido documento activo, claves heredadas y copias; preferencias `finanzas.ui.*` independientes. Validar con los parsers originales. Si ya hay un documento válido, conservarlo exactamente, incluida su revisión o ausencia de ella. Las claves por colección se leen mediante loadFinanceData original; consolidarlas exige crear un documento, conservando además cada valor fuente bruto. Datos inválidos no se sobrescriben.

Bajo el Web Lock original: releer fuente, transacción strict de preparación con documento/copias/archivo fuente, confirmar; instalar una **señal de propiedad** en DATA_KEY; transacción strict de activación; verificar y solo entonces publicar la nueva fuente autoritativa. No se llama removeItem/clear. El valor original de DATA_KEY queda preservado byte a byte en el archivo fuente transaccional; el cambio de su valor a señal, explícito y documentado, es necesario para que una pestaña5G que ya conoce la revisión antigua rechace escribir. Las demás claves originales/copia no se eliminan. No se mantiene un espejo financiero editable en localStorage.

La señal no es un JSON financiero ni se etiqueta3.5: el parser antiguo la rechaza y muestra recuperación, evitando tratarla como una cartera vigente. Si falla instalarla o activar, no se comunica migración ni guardado; el destino preparado y el origen se conservan. Reanudar reconoce etapas y UUID, sin duplicar ni importar de nuevo una fuente alterada. Nunca se elimina/recrea una base por fallo de apertura o versión desconocida.

La señal de localStorage **no tiene por sí misma durabilidad fuerte**. Al reabrir la versión nueva, si reaparece exactamente la fuente archivada, se repone la señal bajo lock y se conserva IndexedDB como autoridad; jamás se importa sobre un documento nuevo confirmado. Cualquier diferencia inesperada de claves/revisión del origen bloquea escrituras y permite exportar ambas ramas para revisión; no se fusiona ni elige silenciosamente.

**Límite de reversión:** una versión antigua que nunca aprendió a consultar IndexedDB no puede recibir retroactivamente ese contrato. La señal bloquea los clientes5G comprobados mientras está presente; si se pierde y se sirve código anterior antes de abrir el nuevo, este podría mostrar la fuente antigua. La nueva versión debe detectar sus escrituras divergentes y bloquear, sin sobrescribir su documento confirmado. No se promete downgrade transparente ni convivencia universal. Se probará y documentará ese límite; no se resolverá con temporizadores, broadcasts o una supuesta confirmación física de setItem. Un rollback operativo exige una decisión y restauración explícitas, no servir binarios antiguos sobre datos migrados.

### Consulta, errores y recuperación

Carga/migración asíncronas explícitas. Capacidad insuficiente permite consulta/exportación del último documento validado, con guardado rechazado y formulario conservado. Bloqueo de apertura y versionchange cierran/rechazan la conexión de manera segura; no se ocultan aborts ni cuota. Broadcast/foco/storage solo notifican: la autoridad y CAS están en las transacciones y Web Locks.

Copias anteriores disponibles desde la UI mediante lectura asíncrona. Importación conserva validación, preview, confirmación y copia previa con sustitución en la misma transacción. Exportación usa un documento confirmado íntegro. Recuperación forense obtiene registros brutos y metadatos de ambas fuentes; identifica errores parciales y nunca presenta una descarga vacía como correcta. No se exporta nada automáticamente.

### Navegadores y alcance

Solo Chromium disponible en este host. Los datos MDN indican soporte de durability desde Chrome83, Firefox126 y Safari15, pero eso no aprueba sus runtimes ni sus garantías físicas. Firefox/WebKit no ejecutados. Se requiere Web Locks y el valor strict efectivo; no habrá fallback financiero a localStorage. No se invoca persist automáticamente ni se añade un control nuevo: solicitarlo de forma explícita informada queda como propuesta posterior, separada de guardado y backup.

### Integración futura con PR32

Las dos ramas mantienen el mismo motor financiero y contratos asíncronos conceptualmente compatibles: datos confirmados, mutate/restore con Promise real, copias y errores. La sesión móvil5G conserva su adaptador síncrono existente. No se toca SQLCipher, Keystore, Keychain, proyectos/IDs nativos ni el estado de PR32. Integrar ambas después requerirá actualizar PR32 sobre el main corregido y revalidar, con autorización posterior.

## Plan obligatorio de validación

Antes/después con el mismo criterio de igualdad íntegra, perfiles independientes, **al menos20 SIGKILL posteriores a confirmación**, sin espera ni reintento. Añadir controles antes/durante/después de commit, migración/restauración interrumpidas, cuota, corrupción, respuestas perdidas, CAS entre pestañas, clientes antiguos, JSON2.5–3.5 y nombres/IDs/relaciones. Mantener las654 unitarias,22 de infraestructura y885 resultados/44 suites de main. Adaptar lecturas y fallos de las fixtures al motor real sin reducir sus aserciones; no falsificar localStorage con una caché de prueba.

La sonda corregida formará una puerta explícita obligatoria de CI; la reproducción fallida de base es evidencia histórica, nunca un caso esperado verde. Conservar los tres checks, reglas axe y el presupuesto50min. Si es necesario ajustar ejecución de suites aisladas, medirlo y mantener todas las órdenes/límites; no se ampliarán para ocultar fallos.

Medir build de producción: carga inicial/documento, movimiento/cuenta/transferencia, restauración/migración,1000/5000 movimientos, filtro/periodo/idioma; separar preparación, commit y render. Comparar muestras/medianas/rangos, sin extrapolar este Linux/Chromium a dispositivos físicos o fallos eléctricos.

## Resultados finales y aceptación

La infraestructura está implementada y publicada en la PR Draft33. Los apartados posteriores contienen resultados intermedios reales. Todavía faltan batería completa, repetición del SHA final y CI final; los parciales no se presentan como aprobación global. No se fusiona, despliega ni sincroniza Google AI Studio.

## Checkpoint 2: contrato implementado y verificación parcial

Se implementan controlador web asíncrono y driver IndexedDB independientes del código móvil. La propuesta usa FinanceStore y un Map realmente síncrono; la confirmación espera complete estricto, comprobación de documento/copia dentro de la transacción y lectura posterior del head/recibo. Cada copia tiene identidad y hash, sin sobrescribir anteriores. Un aborto conocido permite un nuevo intento explícito; una respuesta incierta requiere reconciliación y no repite la transformación. Un commit adelantado por otro escritor exige recarga y nunca dice que no se guardó.

La sesión móvil5G sigue en memoria. FinanceStore, backup, storageSupport, los44 archivos protegidos de5G y el workflow permanecen byte a byte intactos. La frontera de presentación useFinanceData se adapta explícitamente. La UI añade estados de carga/migración/guardado/recuperación, copias asíncronas y exportación forense;24 textos se traducen a los cinco idiomas. La recuperación no se oculta detrás del formulario pendiente. Una descarga parcial se identifica y una señal sin datos no se ofrece como copia recuperable.

Se añaden27 pruebas del controlador (incluidos11 formatos2.5–3.5) con fallos controlados y equivalencia con el motor original. La primera ejecución detectó cuatro errores del arnés: una simulación usaba parseBackup sobre un snapshot con revisión, dos esperados recreaban fotografías con otra hora y una fixture3.5 declaraba nombres iniciales incompatibles. Se corrigen las fixtures, conservando las comparaciones exactas de fotografías y dominio;Las26 pruebas iniciales pasan y se añade otra que rechaza la exportación de una consulta antigua cuando detecta cambios;27/27 pasan. Las pruebas de motor en Chromium real añaden11 resultados (10 casos y contenedor): migración/copias/bytes, strict degradado, cuota inyectada y reintento, restauración abortada, respuesta perdida, lectura de comprobación alterada, recibo ausente, divergencia antigua y esquema desconocido con exportación forense.11/11 pasan. La cuota está inyectada en la API real, no se ha llenado el disco del usuario.

El [primer piloto de producción](web-001-evidence/first-pilot.json) pasa3/3 con la nueva fuente. Es exploratorio, del árbol de trabajo identificado por huellas; no equivale a20 repeticiones ni a CI final. El arnés conserva igualdad completa de bytes y cambia únicamente su lector a IndexedDB confirmado, sin caché ni espera de consolidación. Los perfiles sintéticos se acotarán por caso antes de la batería20x para no acumular almacenamiento temporal.

Apertura IndexedDB bloqueada y espera de Web Lock tienen cancelación de10s, distinta de una confirmación financiera. La cancelación de Web Locks solo retira una petición que aún no fue concedida; una vez adquirido, el lock se mantiene hasta terminar la transacción, sin deadline que invente un aborto o éxito. Una apertura tardía se cierra y no inicia migración. Estas cotas evitan carga indefinida y no se usan para demorar SIGKILL o simular durabilidad.

Pendientes: ampliar interrupciones de migración/restauración, concurrencia real entre pestañas y pruebas de20x; adaptar las lecturas/fallos de las fixtures885 al nuevo motor manteniendo todas las aserciones; cinco idiomas/axe, rendimiento, batería completa y CI obligatoria. **No se declara aún resuelto el P0 ni preparada para integración.**

## Repetibilidad real intermedia — fuente01e6492

Con el controlador publicado en01e6492, se recompila además una base main limpia en un worktree independiente. El mismo arnés declara explícitamente el lector: legacy para la base, IndexedDB autoritativo sin fallback para la corrección. Main repite2/3. La corrección pasa**20/20 SIGKILL posteriores a confirmación en20 perfiles independientes**, más cierre normal y SIGKILL antes de iniciar: **22/22**. Se compara el documento completo y sus hashes/revisiones/IDs; no hay duplicados. No se añade sleep, reintento ni bucle que espere consolidación. Se elimina únicamente el perfil propio al terminar cada caso para acotar espacio temporal.

[Base equivalente](web-001-evidence/matched-baseline.json), [22 observaciones completas](web-001-evidence/corrected-20.json), [resumen y tiempos reales](web-001-evidence/corrected-20-summary.json), [fuente final del checkpoint2](web-001-evidence/checkpoint2-final-source.json). Son resultados de Chromium156.0.8078.79 en Linux, no garantías universales. Quedan por ejecutar las interrupciones ampliadas, clientes simultáneos, regresión885, matrices UI/axe, rendimiento y CI obligatoria antes de cerrar la incidencia.

## Adaptación de regresión y puerta P0 (checkpoint de trabajo)

Las fixtures existentes leían DATA_KEY y simulaban fallos de Storage.prototype. Se conservan sus aserciones, operaciones y límites, adaptando únicamente la lectura a transacciones readonly reales y los fallos al IDBObjectStore real. La utilidad exclusiva de pruebas no ofrece una caché financiera ni altera la aplicación: devuelve el request nativo y puede inyectar fallo o discrepancia de lectura dentro de la transacción. Registra por separado copia inicial de migración, señal de cercado y peticiones económicas posteriores. Las preferencias continúan probándose sobre localStorage. El arnés SIGKILL y los casos independientes del motor no utilizan esta utilidad.

La primera pasada encontró incompatibilidades de presentación de errores y espera de conflictos: se conserva la envoltura histórica traducible, la semántica de espera bajo Web Locks y el formato forense compatible, sin cambiar datos ni reglas económicas. Planificación pasa13/13 y fase1 pasa57/57 después de estas correcciones. Un diagnóstico de cobertura detectó un literal de prefijo aislado; se mantiene el reconocimiento de la frase completa y su traducción. Última unitaria681/681. Las ejecuciones anteriores fallidas se conservan en los logs de trabajo; estos resultados parciales no sustituyen la batería final.

Se añade test:durability y una suite obligatoria al final de test:ui: motor IndexedDB real más veinte perfiles independientes y dos controles. El ejecutor de CI exige su presencia y comprueba el reporte, backend, SHA, número de perfiles, hashes, revisiones, IDs y ausencia de duplicados; un reporte ausente o fallido rechaza el check Chromium/axe. No se modifica el workflow ni su presupuesto50min. La prueba histórica fallida de main continúa siendo evidencia, nunca un test esperado verde.

## Checkpoint 3: interrupciones y coordinación reales

El driver real pasa25/25 resultados: los10 casos iniciales, colección heredada, origen inválido preservado,11 formatos2.5–3.5, dos pestañas reales y contenedor. Los dos controladores usan Web Locks; solo uno confirma. Dos conexiones que deliberadamente evitan el controlador demuestran también CAS dentro de IndexedDB: un commit y un rechazo por revisión. Una instancia antigua de FinanceStore creada antes de migrar rechaza su mutación tras instalar el cercado. La prueba nueva se corrigió para comprobar la clase original de StorageConflictError (su nombre estándar es Error), sin cambiar la clase financiera.

Ocho controles con SIGKILL real pasan8/8: durante prepare/activate de migración, después de sus commits y antes de entregar respuesta, durante escritura/restauración y después de commit antes de respuesta. Las señales proceden de request.success y del evento nativo complete. Para detener una transacción en curso, la inyección exclusiva del arnés mantiene solicitudes pendientes hasta la terminación; **no es una espera de consolidación ni un mecanismo de producción**. La llamada no resuelve antes del kill. Tras reiniciar se valida documento íntegro, identidades, recibos y todas las copias: estado anterior durante transacción; estado nuevo tras commit; migración preparada conserva su UUID al reanudarse. Evidencia intermedia en boundary-controls-intermediate.json, con fuente del driver81bd52f; la pasada final repetirá el arnés publicado.

El primer CI real de PR33 inicia los tres checks: unitarias aprobadas; diff rechazado por un espacio de contexto dentro del archivo de evidencia .patch y Chromium rechazado por la fixture antigua de firma Web Locks. Se corrigen ambas causas: el diff original se conserva íntegro como cadena JSON (sin alterar su contenido), y la fixture usa el último argumento callback. No se relaja diff-check ni se ocultan ejecuciones fallidas. Los contextos persistentes de las pruebas de zoom reciben también el lector real, igual que los contextos normales. Presupuesto y aserciones sin cambios.

## Checkpoint 4: presentación y fixtures de corrupción

La matriz de capacidad insuficiente usa el build real, treinta combinaciones (5idiomas×3anchos×2temas):31/31 resultados, cero violaciones axe automatizadas. Comprueba formulario conservado tras rechazo, Tab/Shift+Tab, Escape/foco, ausencia de desbordamiento, exportación íntegra y ausencia de registros financieros nuevos. Las observaciones incompletas se conservan aparte y no son una aprobación manual.

La denegación de lectura forense sin contenido recuperable conserva el mensaje histórico traducido de permisos; no crea descargas vacías. Se añade una prueba específica:682/682 unitarias. La fixture de rutas que corrompía localStorage después del arranque se adapta para corromper deliberadamente el registro autoritativo real en una transacción estricta; mantiene todas las comprobaciones de corrupción preservada y salida de recuperación. Escribir en la fuente antigua corresponde ahora a un conflicto preservado, no a una sustitución financiera legítima.

Una ejecución diagnóstica local concurrente con la suite de rutas (que reconstruye dist) produjo404 por recursos sustituidos. Es un error del procedimiento de validación: se conservan sus logs y se repite en secuencia; no se cambia ninguna aserción ni timeout. La suite visual posterior pasa12/12. Los checkpoints y la PR siguen pendientes de regresión completa/CI final y mediciones.

## Exactitud de las esperas de regresión

Durante la adaptación apareció un problema del arnés: Playwright1.64 evalúa la verdad del retorno de waitForFunction antes de esperar su Promise; una condición async podía finalizar devolviendo false. Las aserciones económicas posteriores detectaron el problema (archivo/duplicación de subítems), no se eliminan ni se relajan. Se añade waitForStoredCondition: evalúa reiteradamente la condición asíncrona real hasta verdad, conserva el timeout original y elimina su token de cancelación al terminar. Solo conserva un token, nunca un snapshot ni un valor financiero. El polling se usa para condiciones de prueba, no como prueba de consolidación física; el arnés SIGKILL sigue independiente y sin demora. Subítems pasa19/19 tras la corrección. Se añade una prueba específica de condición falsa, resultado verdadero, timeout y limpieza.

## Rendimiento medido, sin ocultar el coste de seguridad

Builds de producción antesce1ec839/después6e8ae31, Chromium156, Linux, móvil390×900, CPU4×, red1,6Mbit/s y80ms; tres muestras independientes por escenario, mismo host y herramientas. Datos completos de100/1000/5000 movimientos y paginación50filas. Los reportes performance-/writes-/journeys-before/after.json incluyen configuración, heap, red, hashes y trazas; performance-summary.json contiene medianas y rangos. No son teléfonos físicos ni INP de campo.

| Métrica (ms) | Antes mediana [mín–máx] | Después mediana [mín–máx] |
| --- | --- | --- |
| Landing es fría | 1515 [1503–1669] | 1561 [1540–1652] |
| Aplicación100 fría | 2821 [2688–2848] | 2882 [2824–2981] |
| Aplicación100 recarga caliente | 800 [777–1242] | 1281 [1193–1441] |
| Carga inicial/migración1000 | 2757 [2731–2825] | 2994 [2839–2997] |
| Lectura confirmada1000 (incluye puente Playwright) | 20 [19–23] | 66 [58–77] |
| Guardar cuenta1000 | 342 [333–409] | 740 [619–919] |
| Guardar movimiento1000 | 523 [411–528] | 816 [747–890] |
| Guardar transferencia1000 | 436 [381–564] | 814 [693–860] |
| Restauración verificada100 | 221 [216–221] | 450 [380–464] |
| Abrir1000 completo /50filas | 561 [559–672] | 601 [537–667] |
| Abrir5000 completo /50filas | 1073 [866–1181] | 967 [848–1041] |
| Filtrar5000 completo | 531 [489–563] | 602 [547–614] |
| Cambiar periodo | 196 [192–260] | 230 [219–284] |
| Cambiar idioma frío | 710 [658–737] | 683 [667–742] |

Las diferencias pequeñas y los rangos solapados no confirman una mejora. **Hay coste real:** recarga caliente+481ms, cuenta+398ms, movimiento+292ms y transferencia+378ms en las medianas de esta máquina. No se presenta como rendimiento idéntico. El staging vuelve a validar usando el motor original, calcula hashes, coordina revisiones y lee comprobaciones; se prioriza aislar el dominio sin refactorizarlo. Las barreras estrictas medianas son12/33/17ms (cuenta/movimiento/transferencia); antes se medían2/3/3ms de retorno de API, que **no era commit duradero**. La preparación/dispatch mediana pasa192/247/224 a491/509/553ms; posbarrera/UI122/199/170 a187/197/175ms. Son etapas con coste de transporte, no un perfil exclusivo de CPU. No hay guardados por render ni reducción de datos.

El grafo inicial web pasa138072 a139971bytes gzip (+1899;1,38%). Tras abrir módulos se observan249065→262786bytes JS gzip en el recorrido español (+13721;5,51%); el motor se carga al entrar en la aplicación, no por visitar landing. No hay dependencia de base de datos nueva ni SQLite en web. Los bundles anteriores/posteriores están documentados. El incremento se justifica por validación, CAS, recuperación y confirmación de esteP0; optimizar después la carga caliente y staging requerirá nuevas mediciones y equivalencia, sin rebajar el contrato de guardado. Se conservan paginación y precarga.

Las capturas web001-readonly-390/768/1280.png proceden de la aplicación real, datos ficticios y matriz ejecutada. Documentan el nuevo estado de consulta segura, no un rediseño. La pasada final regenerará evidencias correspondientes al código probado.

## Recuperación degradada y respuesta perdida: regresiones verificadas

Se reproducen y corrigen tres casos de la nueva frontera antes de entregar:

- Tras versionchange, la conexión de sesión se cierra de forma segura, pero la exportación forense no podía leerla. Se abre una lectura bruta independiente, sin upgrade ni recreación, identificando SESSION_UNREADABLE y reporte parcial. El registro original sigue intacto.
- Si localStorage es denegado pero existe un documento confirmado legible en IndexedDB, la obtención anticipada de Storage impedía consultarlo. El acceso al origen antiguo se mantiene perezoso y se comprueba en cada operación: permite consulta/exportación confirmada, bloquea todas las escrituras y conserva el diagnóstico de origen inaccesible. No se sustituye por una caché.
- Una respuesta perdida después de commit mantiene el formulario y bloquea nuevos envíos; al reconciliar, el cambio de acción hacia recarga perdía el foco. La acción de recarga recupera foco cuando se monta. La recarga sigue exigiendo una acción explícita del usuario.

El motor real pasa30/30 resultados, incluyendo cuota de migración, cercado denegado y reanudación con mismo UUID. La UI de producción compilada en directorio aislado pasa36/36: matriz30 y respuesta de commit perdida en cinco idiomas más contenedor. La pérdida se inyecta después del evento nativo complete, rechazando las lecturas de respuesta; el documento/recibo existen realmente. Tras restablecer lectura y reconciliar no hay segundo put financiero, el formulario permanece, el foco continúa dentro del diálogo y la recarga recupera exactamente el snapshot con un solo recibo. Cero violaciones axe en40 superficies de estos casos; incompletos conservados sin aprobación manual. Unitarias682/682, infraestructura37/37 y lint aprobados en este checkpoint. La batería885 y la repetición final20 siguen ejecutándose/pendientes; no se declaran aprobadas por estos parciales.

CI exigirá al menos953 resultados (885 anteriores+68 nuevos),29 casos concretos de motor,40 superficies UI sin violaciones, veinte perfiles críticos y ocho controles reales; reportes ausentes o parciales fallan. No se modifican workflow, límites ni aserciones anteriores. Los comandos de medición usan IndexedDB por defecto para la aplicación actual; PERF_BACKEND=legacy solo se declara explícitamente al medir la base.


## Evidencia, recursos y CI verificable

[PR Draft33](https://github.com/dlopezteruel-rgb/Finanzas-pro/pull/33), [checks del HEAD vigente](https://github.com/dlopezteruel-rgb/Finanzas-pro/pull/33/checks). El reporte ci-checkpoints.json identifica las ejecuciones intermedias, sus SHAs y resultados por trabajo; canceladas/parciales no equivalen a éxito. Cada ejecución final genera browser/summary.json, battery logs, web-durability.json, web-crash-controls.json, web-storage-engine.json y web-storage-ui.json en los artefactos. La URL/SHA final se registrará en la descripción de la PR al terminar, sin confundirla con resultados anteriores.

El contenedor de medición tiene cuota de CPU200000/100000 (2vCPU) y8GiB de memoria, aunque os.cpus() muestra los192procesadores lógicos del host. Es una limitación del contenedor, no hardware móvil. Los cuatro perfiles CPU de1000/5000 antes/después se conservan comprimidos como cpuprofile.gz; deben descomprimirse para abrirlos en DevTools. Los44 archivos protegidos se comparan también directamente con main en protected-financial-source.json; proyectos/adaptadores nativos y lockfile sin cambios. Los hashes comprueban integridad, no cifran la web ni autentican frente a código malicioso del mismo origen.

La nueva matriz añade36 grupos incompletos de color-contrast en40 superficies (resultado intermedio); son observaciones pendientes de revisión contextual, no violaciones ni pruebas manuales. Se conservan además los947grupos/53conjuntos equivalentes documentados en5G. El agregado final de la batería se documentará separadamente sin sumar silenciosamente pasadas repetidas. No se han utilizado lectores de pantalla ni dispositivos físicos.


## Corrección del límite de respuesta posterior al commit

La inyección real descubre dos fallos en el adaptador provisional32d61ba: un aborto de la lectura posterior al commit y una cuota simulada al abrir esa lectura se propagaban como WebTransactionAborted. La operación ya existía; no era correcto comunicar WEB_NOT_COMMITTED. La protección CAS seguía impidiendo una segunda escritura obsoleta, pero la explicación del resultado era incorrecta. Esta incidencia pertenece al adaptador en desarrollo, no al P0 original ni a SQLCipher.

Se separa explícitamente la lectura de respuesta: después de complete de escritura, un fallo de inspección es WEB_UNCERTAIN, nunca prueba de aborto económico. La reconciliación consulta el recibo; mientras no pueda leerlo conserva formulario y bloquea nuevas escrituras. Al recuperar lectura identifica el commit y exige recarga sin segundo put ni transformación. Los casos nativos controlados reproducen el error antes y pasan después:32/32 resultados del motor,682/682 unitarias y lint. Evidencias postcommit-response-before-fix.json y postcommit-response-fixed-engine.json. La puerta final eleva el mínimo a955 resultados (885+70),31 casos de motor,40 superficies UI,20 perfiles críticos y8controles; los mínimos953/29 anteriores eran del checkpoint previo.

La matriz de landing se adapta por último al nombre de la operación observada: exige exactamente un idb:finance:put:DATA_KEY tras reordenar, en lugar de contar un set de localStorage que ya no es la persistencia financiera. Conserva las aserciones de foco antes/después de completar la UI y compara todas las colecciones. Pasa43/43; no se elimina ni relaja la comprobación de una sola escritura.


La CIc151597 termina roja correctamente en deudas:182/184 resultados tras nueve suites; las demás no ejecutadas se muestran como tales. La causa es un callback async multilínea que escapó al cambio inicial de las esperas. Se adapta al mismo helper sin modificar la aserción de tramitación vinculada ni sus límites. La repetición específica pasa25/25. Un nuevo test de infraestructura rechaza el patrón explícito inseguro incluso con saltos de línea (salvo el helper que implementa el polling correcto). Infraestructura38/38; lint aprobado. La CI fallida y sus cifras se conservan en ci-c151597-failure.json, sin presentarla como éxito.

## Reproducción y comprobación por el revisor

Desde esta rama, con Node24.22.1 y Chromium instalado, usando exclusivamente perfiles/fixtures sintéticos:

```bash
npm ci
npm test
node --test scripts/ci/*.test.mjs
npm run lint
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:durability
CHROMIUM_PATH=/usr/bin/chromium npm run test:ui
git diff origin/main...HEAD --check
git diff --check
```

`test:durability` utiliza el build existente de dist; incluye motor real, matriz UI,20 perfiles críticos y8controles. `test:ui` recompila y conserva las44 suites anteriores, además de esa puerta obligatoria. Un fallo no se reintenta automáticamente. CI usa Chromium de la dependencia Playwright instalada y resuelve su ruta; no presupone /usr/bin/chromium en GitHub.

Para reproducir la **evidencia histórica fallida**, compilar maince1ec839 en un worktree limpio independiente y llamar desde esta rama al mismo arnés, con su dist como argumento. El retorno1 en ese caso es el fallo documentado; nunca se incorpora como un test esperado verde:

```bash
DURABILITY_BACKEND=legacy DURABILITY_REPETITIONS=1 \
  DURABILITY_SOURCE_SHA=ce1ec8398fed0eb6a39f0c362567b8a6613eaf81 \
  CHROMIUM_PATH=/usr/bin/chromium \
  node --import tsx scripts/native/webCrashRecovery.ts /ruta/base/dist /ruta/baseline.json
```

Para medir la versión actual, usar PERF_BACKEND=indexeddb (predeterminado); legacy se utiliza solo con un build anterior. Los resultados distinguen barrera, preparación y render, y no consideran setItem un commit duradero:

```bash
PERF_BACKEND=indexeddb PERF_PROFILE=mobile PERF_SAMPLES=3 npm run measure:performance
PERF_BACKEND=indexeddb PERF_PROFILE=mobile PERF_SAMPLES=3 npm run measure:journeys
PERF_BACKEND=indexeddb PERF_PROFILE=mobile PERF_SAMPLES=3 \
  node --import tsx scripts/performance/webWriteJourneys.ts
npm run audit:bundles
```

No utilizar perfiles personales con el arnés. Sus únicos directorios de navegador se crean mediante mkdtemp y solo se termina el grupo de procesos obtenido de su propio spawn detached. Las solicitudes repetidas que mantienen una transacción en curso son inyección de fallo exclusiva de los controles; no son una técnica de durabilidad del producto. No se añade beforeunload, espera de varios segundos, doble escritura ni bucle de lectura para fingir consolidación.

## Límite de CI observado y ejecución acotada

La ejecución [44088142789](https://github.com/dlopezteruel-rgb/Finanzas-pro/actions/runs/44088142789) del SHA00b4acf alcanza50min y GitHub cancela Chromium/axe; unitarias y lint/build/diff sí aprueban. Solo41/45 suites completadas: **no es aprobación de la batería**. Los tiempos registrados suman48,72min en esas41 suites. No se amplía el presupuesto ni se oculta la cancelación. Se prepara ejecución de como máximo dos matrices multidioma independientes en paralelo; recompilaciones que sustituyen dist, volumen y pruebas de terminación real permanecen en serie. La lista y orden de resultados, aserciones, límites y reglas axe se mantienen; la nueva ejecución debe demostrar el resultado antes de considerarse válida.

## Cambios de comportamiento y límites operativos

| Situación | Contrato anterior | Nueva frontera web |
| --- | --- | --- |
| Guardado | Retorno síncrono de setItem y publicación | complete de transacción strict y comprobación de head/recibo antes de publicar |
| Cuota/aborto conocido | Error de almacenamiento | Sin propuesta ni copia parcial publicada; formulario conservado; nuevo intento explícito |
| Respuesta perdida | Sin recibo transaccional | Reconciliación por UUID/fingerprint; nunca repetir la transformación a ciegas |
| Restauración | Copia y sustitución en llamadas separadas | Copia, documento, revisión y recibo en una transacción |
| Capacidad insuficiente | Guardado dependiente de localStorage | Consulta/exportación segura y escrituras bloqueadas; sin fallback financiero |
| Migración | No aplicable | Archivo fuente íntegro, preparación y activación recuperables; sin borrar claves |
| Código antiguo | Fuente localStorage | Cercado y detección de divergencias; rollback transparente no garantizado |
| Recuperación forense | Claves locales | Lectura bruta de ambas fuentes con indicación explícita de errores parciales |

IndexedDB, localStorage y Web Locks comparten el origen, no una ruta. Cambiar APP_BASE_PATH dentro del mismo origen conserva esa autoridad; la suite de rutas reconstruye y comprueba las bases existentes. No se importa automáticamente información de otro dominio, protocolo o puerto. El navegador puede eliminar datos del origen y el usuario puede borrarlos: el nuevo commit no sustituye una copia independiente. No se promete resistencia universal ante fallo eléctrico, hardware, sistema operativo ni eliminación del perfil.

Antes de una reversión operativa hay que detener clientes, preservar/exportar las dos fuentes cuando exista divergencia, revisar sus revisiones y utilizar una restauración explícita aprobada. Nunca servir una versión antigua suponiendo que verá el último IndexedDB, borrar el destino, ni copiar automáticamente su snapshot de vuelta sobre localStorage.

## Validación completa del checkpoint00b4acf y endurecimiento de consulta

La batería local congelada en00b4acf termina **955/955 resultados,45 suites, cero fallos/omisiones/cancelaciones**. Incluye los885 originales,32 de motor,36 de UI y dos puertas reales. Las20 terminaciones después de confirmación pasan20/20, con dos controles; los8controles nativos de transacción/migración/restauración pasan8/8. Se conservan reportes checkpoint-00b4acf-*.json. Esto no convierte en verde su CI cancelada por presupuesto, ni sustituye la validación posterior del código final.

La revisión añade dos regresiones reales de la frontera nueva, reproducidas antes de corregirlas: sin autoridad activa en IndexedDB no se listaban las copias antiguas; y una migración preparada podía mostrar/exportar una vista antigua sin detectar un escritor5G posterior. Se conservan readonly-copy-before-fix.json y readonly-prepared-source-before-fix.json. La consulta distingue preparación de activación, mantiene el inventario de copias del origen legible y compara la fuente con el hash inmutable archivado, tanto antes como después de crear la vista. La etiqueta existente y traducida WEB_LEGACY_VIEW identifica una copia previa, no un estado vigente confirmado. No hay reparación de cercado, mutación o fusión dentro de una comprobación de consulta.

Las nuevas pruebas unitarias pasan684/684 y el motor real34/34. La matriz se refuerza para descargar byte a byte una copia antigua en cada una de30combinaciones. La puerta exige ahora al menos957 resultados:885 originales+34motor+36UI+2puertas,33casos de motor observados,40superficiesUI sin violaciones,20perfiles críticos y8controles. Los mínimos anteriores se mantienen como historial, no como la configuración final.

La matriz reforzada termina36/36, incluidas las30descargas de copia antigua con igualdad exacta y sin escrituras financieras;40superficies axe, cero violaciones y36grupos incompletos pendientes. Lint/build/diff y38pruebas del ejecutor pasan. La ejecución20+8 se repetirá sobre el commit publicado de este endurecimiento y después en la puerta final de CI.

El ejecutor conserva un manifiesto único de45suites: igualdad automática con las44de main y la nueva puerta. Solo12matrices de traducción aisladas pueden solaparse, de dos en dos; landing, catálogo integral, recompilaciones, volumen, prototipo y SIGKILL continúan en serie. Cada proceso usa origen/almacenamiento aislados y su log propio escrito durante la ejecución; los bloques y resúmenes se publican en orden del manifiesto. Un fallo, señal, omisión o resumen ausente sigue rechazando el check. Se añaden seis pruebas del ejecutor (44/44infraestructura en total); no se cambian el workflow, los50min, los límites individuales ni axe. FINANZAS_UI_WORKERS=1 permite reproducir toda la batería en serie. Falta demostrar su duración real y la batería completa de entrega.
