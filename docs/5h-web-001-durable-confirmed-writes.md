# 5H-WEB-001 — Escrituras web confirmadas y recuperables

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

[Resultado original 2/3](web-001-evidence/baseline-crash.json). El fallo devuelve1. Se añade después únicamente instrumentación de tiempos, revisiones e IDs: [diff completo frente a PR32](web-001-evidence/reference-harness-instrumentation.patch). No se cambia la igualdad exacta del snapshot ni se introduce espera antes de SIGKILL. La repetición instrumentada se conserva separada. La preparación cierra normalmente y verifica el checkpoint antes de inyectar el fallo; no se confunde una fixture nunca consolidada con pérdida del cambio nuevo.

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

React → controlador web asíncrono → propuesta mediante el mismo FinanceStore sobre Map síncrono aislado → Web Lock original → CAS y escritura IndexedDB → complete estricto → verificación/recibo → estado confirmado. FinanceStore, sus validadores y redondeos permanecen como motor compartido; el staging nunca es persistencia ni caché con éxito anticipado. No se importa código SQLCipher ni el controlador móvil de PR32.

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

**Pendiente de implementación y ejecución.** Este checkpoint no aprueba aún migración, solución financiera,20 repeticiones, regresión final, CI ni PR. Los checkpoints siguientes añadirán resultados reales, tabla antes/después, compatibilidad, incidencias, límites y enlaces. No se fusiona, despliega ni sincroniza Google AI Studio.

## Checkpoint 2: contrato implementado y verificación parcial

Se implementan controlador web asíncrono y driver IndexedDB independientes del código móvil. La propuesta usa FinanceStore y un Map realmente síncrono; la confirmación espera complete estricto, comprobación de documento/copia dentro de la transacción y lectura posterior del head/recibo. Cada copia tiene identidad y hash, sin sobrescribir anteriores. Un aborto conocido permite un nuevo intento explícito; una respuesta incierta requiere reconciliación y no repite la transformación. Un commit adelantado por otro escritor exige recarga y nunca dice que no se guardó.

La sesión móvil5G sigue en memoria. FinanceStore, backup, storageSupport, los44 archivos protegidos de5G y el workflow permanecen byte a byte intactos. La frontera de presentación useFinanceData se adapta explícitamente. La UI añade estados de carga/migración/guardado/recuperación, copias asíncronas y exportación forense;24 textos se traducen a los cinco idiomas. La recuperación no se oculta detrás del formulario pendiente. Una descarga parcial se identifica y una señal sin datos no se ofrece como copia recuperable.

Se añaden27 pruebas del controlador (incluidos11 formatos2.5–3.5) con fallos controlados y equivalencia con el motor original. La primera ejecución detectó cuatro errores del arnés: una simulación usaba parseBackup sobre un snapshot con revisión, dos esperados recreaban fotografías con otra hora y una fixture3.5 declaraba nombres iniciales incompatibles. Se corrigen las fixtures, conservando las comparaciones exactas de fotografías y dominio;Las26 pruebas iniciales pasan y se añade otra que rechaza la exportación de una consulta antigua cuando detecta cambios;27/27 pasan. Las pruebas de motor en Chromium real añaden11 resultados (10 casos y contenedor): migración/copias/bytes, strict degradado, cuota inyectada y reintento, restauración abortada, respuesta perdida, lectura de comprobación alterada, recibo ausente, divergencia antigua y esquema desconocido con exportación forense.11/11 pasan. La cuota está inyectada en la API real, no se ha llenado el disco del usuario.

El [primer piloto de producción](web-001-evidence/first-pilot.json) pasa3/3 con la nueva fuente. Es exploratorio, del árbol de trabajo identificado por huellas; no equivale a20 repeticiones ni a CI final. El arnés conserva igualdad completa de bytes y cambia únicamente su lector a IndexedDB confirmado, sin caché ni espera de consolidación. Los perfiles sintéticos se acotarán por caso antes de la batería20x para no acumular almacenamiento temporal.

Apertura IndexedDB bloqueada y espera de Web Lock tienen cancelación de10s, distinta de una confirmación financiera. La cancelación de Web Locks solo retira una petición que aún no fue concedida; una vez adquirido, el lock se mantiene hasta terminar la transacción, sin deadline que invente un aborto o éxito. Una apertura tardía se cierra y no inicia migración. Estas cotas evitan carga indefinida y no se usan para demorar SIGKILL o simular durabilidad.

Pendientes: ampliar interrupciones de migración/restauración, concurrencia real entre pestañas y pruebas de20x; adaptar las lecturas/fallos de las fixtures885 al nuevo motor manteniendo todas las aserciones; cinco idiomas/axe, rendimiento, batería completa y CI obligatoria. **No se declara aún resuelto el P0 ni preparada para integración.**
