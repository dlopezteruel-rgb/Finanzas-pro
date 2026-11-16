# Fase 5H — Persistencia financiera nativa segura

## Checkpoint 1: base y decisión arquitectónica previa

Base verificada: `ce1ec8398fed0eb6a39f0c362567b8a6613eaf81`, merge de PR #31 confirmado en GitHub. No hay commits posteriores en origin/main al empezar. Rama nueva `feature/phase-5h-secure-native-storage`, árbol inicialmente limpio, worktree independiente. Se conservan todos los entornos anteriores. La referencia 5G se vuelve a ejecutar: su árbol 4796e3f es idéntico al merge ce1ec83; no se heredan aprobaciones por sus cifras anteriores. Los resultados nuevos se documentarán al terminar.

5G permite únicamente una sesión financiera en memoria, importación externa bloqueada y exportación ficticia. No hay persistencia móvil certificada ni backend autorizado. Android compiló sin ejecutar; iOS requiere macOS/Xcode. Este host Linux conserva JDK21/SDK36, pero no /dev/kvm, emulador, dispositivo ni macOS/Xcode. Quedan aproximadamente 1,2 GB libres; no se eliminarán worktrees ni snapshots para instalar una imagen. Las ejecuciones Android/iOS y el uso de datos reales siguen **bloqueados** hasta obtener evidencia suficiente.

## Comparativa y selección

| Opción | Evidencia / ventajas | Límites y decisión |
| --- | --- | --- |
| SQLite del sistema sin cifrado | Motor transaccional, APIs oficiales | No protege el documento en reposo: descartado como almacén móvil financiero |
| @capacitor-community/sqlite 8.1.1 | npm confirma MIT y peer Capacitor ≥8; mantenimiento reciente; SQLCipher Android/iOS | API genérica SQL y secretos accesibles desde JS; para CAS, recuperación y claves exclusivamente nativas se necesita una frontera nativa adicional. No se instala para evitar duplicación y superficie innecesaria |
| Plugins comerciales / Secure Preferences | Pueden aportar soporte y almacenamiento de valores pequeños | Contratos, costes y protección deben verificarse por producto; no equivalen a base transaccional. Preferences no será almacén financiero ni depósito de claves |
| Puente local Capacitor limitado + SQLCipher Community oficial | Permite una única operación nativa CAS transaccional; no expone SQL arbitrario ni claves a JS; reutiliza motor criptográfico mantenido | Mayor responsabilidad de mantenimiento del puente. Se entrega como infraestructura de prototipo, sin habilitar datos reales y con pruebas de motor diferenciadas |

**Elección:** puente local `@finanzas/native-vault`, SQLCipher Community **4.20.0** exacto para Android e iOS. Maven Central marca 4.20.0 como latest/release; SQLCipher.swift 4.20.0 publica un xcframework con checksum `1505174fe7f8a0fe81d6ebf87a64b17701b500c12a445ef6b68b9159f012d747`. Se evita 5.0 beta. No se implementa criptografía propia ni se presenta Community Edition como FIPS. Licencia BSD con atribución y avisos de componentes; no se adquiere una licencia comercial ni se presupone soporte de pago.

Referencias verificadas: [Android Community](https://www.zetetic.net/sqlcipher/sqlcipher-for-android-community/), [documentación](https://www.zetetic.net/sqlcipher/documentation/), [licencia](https://www.zetetic.net/sqlcipher/license/), [SQLCipher.swift](https://github.com/sqlcipher/SQLCipher.swift), [community sqlite](https://github.com/capacitor-community/sqlite). Las bibliotecas criptográficas/plataforma se usan directamente; ningún algoritmo de cifrado casero. Las dependencias y licencias se inventariarán con sus versiones efectivas al compilar.

## Contrato asíncrono y único motor financiero

FinanceStore, cálculos, modelos, validadores, parsers y esquemas permanecen intactos. La web conserva su StorageAccess síncrono, Web Locks, revisión original y copias. SyncFinanceStorage.setItem sigue devolviendo **undefined**, nunca una Promise.

Se añade un controlador nativo asíncrono que emplea el mismo FinanceStore para **preparar una propuesta** sobre almacenamiento temporal realmente síncrono y separado del estado confirmado. Ese staging no se presenta como persistencia, no publica estado React y no devuelve éxito al usuario. La propuesta resultante ya ha pasado los mismos validadores, reconciliaciones y protecciones de históricos que la web. No se duplica lógica financiera en Kotlin o Swift.

Después se envía un payload inmutable con operationId único, revisión esperada, snapshot propuesto y necesidad de copia recuperable. El puente calcula SHA256 sobre los bytes UTF-8 exactos del payload; no se reconstruye un JSON canónico ambiguo entre lenguajes. El SHA es identidad de petición, no sustituto del cifrado/autenticación de SQLCipher.

Una operación nativa BEGIN IMMEDIATE / transacción de escritura lee revisión y recibo, verifica CAS, guarda y comprueba la copia anterior cuando corresponde, sustituye el documento y registra el recibo **en la misma transacción**. COMMIT usa synchronous=FULL. Solo tras commit y lectura de comprobación se publica el nuevo estado. El bloqueo JS serializa la UI, pero la seguridad de concurrencia está en SQLite y funciona entre conexiones/procesos.

No se cambia el significado económico ni el formato JSON financiero: snapshot versionado y JSON 2.5–3.5 continúan bajo los validadores originales. La versión SQL del contenedor es independiente (v1). No se normalizan movimientos, cuotas, relaciones o aprobaciones en tablas separadas.

## Resultado incierto y recuperación

La tabla de recibos conserva operationId, fingerprint y revisión confirmada, sin duplicar un documento entero por cada recibo. Repetir el mismo id/payload devuelve el resultado confirmado; reutilizar un id con otro payload se rechaza. Un fallo de transporte después del commit nunca provoca repetir ciegamente la transformación financiera.

Ante respuesta perdida se bloquean nuevas escrituras y se reconcilia mediante una transacción nativa. Si existe recibo y el head coincide se confirma el resultado. Si una revisión posterior lo ha sustituido se informa de conflicto y se exige recarga. Si no existe recibo, la reconciliación registra un tombstone de cancelación: una petición antigua que llegue más tarde no podrá ejecutarse. Si no se puede resolver el resultado, el bloqueo permanece y los formularios se conservan.

Tras reinicio solo se carga y valida el head confirmado. No se reenvían formularios ni propuestas pendientes automáticamente. El estado válido será el anterior o el nuevo completo, nunca una mezcla. Se probarán cierre antes/durante/después del commit, respuesta perdida, copia fallida, conflictos, corrupción y falta de espacio. Las pruebas con SQLite/SQLCipher de escritorio se distinguirán de las de Android/WKWebView.

Se mantiene una copia operativa del último estado y copias recuperables inmutables para restauración, borrados masivos y evolución de documento. La copia se toma del head real dentro de la transacción, no de una caché JS. El rollback de una restauración también revierte su copia nueva, conservando intactos el head anterior y sus copias previas. No se podan automáticamente copias destructivas; el crecimiento/espacio insuficiente se trata como error recuperable.

## Claves y cifrado

Android: SQLCipher cifra la base completa. Una clave aleatoria de 256 bits se genera exclusivamente en nativo y se envuelve con AES-GCM mediante una clave no exportable de Android Keystore. El sobre cifrado se escribe atómicamente en almacenamiento privado sin backup, nunca en Preferences ni JS. No se asume StrongBox/TEE: se informa de capacidades y se mantiene bloqueo de producto. Se exige dispositivo desbloqueado; API28+ emplea unlockedDeviceRequired. Clave ausente, invalidada o inaccesible con base existente bloquea la apertura y conserva archivos. Se proporciona un manejador de corrupción que **no borra** la base; no se utilizará el borrado automático por defecto de bibliotecas SQLite.

iOS: clave aleatoria nativa en Keychain con WhenUnlockedThisDeviceOnly, sin sincronización iCloud ni grupo compartido. Archivos propios con NSFileProtectionComplete y excluidos de backup. El acceso bloqueado/denegado/ausente produce estado recuperable, nunca generación de otra clave para una base existente. Una reinstalación puede conservar un item de Keychain mientras elimina el contenedor: se distingue clave huérfana de base existente sin clave.

Las claves no atraviesan el puente JS, no se exportan ni aparecen en logs/configuración. Se minimiza su residencia y se cierra la conexión al pasar a segundo plano o perder protección, respetando la operación ya en curso; no hay guardados por pausa. No se promete borrado perfecto de todas las copias internas de memoria administrada. Rotación no se hará automáticamente: requiere copia independiente verificada, transacción/rekey validada y recuperación, pendiente de habilitación posterior.

SQLCipher protege confidencialidad e integridad de páginas; no impide por sí solo que un atacante con control del dispositivo restaure una copia cifrada antigua completa. Tampoco protege datos que la aplicación ya necesita mostrar tras desbloqueo frente a un sistema comprometido. Se documentan esos límites, sin afirmar seguridad absoluta.

## Activación y producto

Instalar el plugin no habilita datos reales. Ambas plataformas siguen sin aprobación de runtime ni decisión de producto. El camino persistente será **sandbox de desarrollo con consentimiento explícito y datos ficticios**, separado del modo temporal 5G; los builds de distribución rechazan su uso. El identificador sigue siendo `invalid.finanzas.prototype`. No se convierte automáticamente la sesión 5G ni un perfil encontrado en localStorage.

La apertura inicial persistente requiere una acción explícita y parte de un perfil financiero vacío con catálogo de sistema; no copia movimientos/carteras/préstamos de demostración. Las preferencias de idioma/tema siguen independientes. La importación externa real y el backend móvil permanecen bloqueados. Se implementan fronteras de archivo y restauración que solo podrán activarse tras verificación suficiente; no se fuerza su activación para que una prueba web parezca una prueba nativa.

## Copias y archivos

Se distinguen copia interna cifrada (misma clave/dispositivo), exportación portable, restauración explícita y backup del SO. Las copias internas no recuperan una clave perdida. La recuperación en otro teléfono requiere una copia independiente verificada. Se evaluará un contenedor cifrado por contraseña, pero no se enviará uno sin KDF/cifrado autenticado/pruebas suficientes ni se etiquetará como JSON 3.5.

La alternativa existente es JSON financiero completo, compatible y sensible en claro, solo tras consentimiento informado de exportación. Los temporales privados se verifican antes de Share y se limpian controladamente; compartir permite a la app receptora conservar una copia, límite que no puede garantizarse desde Finanzas Pro. Ninguna exportación cambia datos/revisión ni depende de la página de movimientos visible.

Selección nativa: ACTION_OPEN_DOCUMENT / UIDocumentPicker, sin permisos generales, tamaño/UTF-8 acotados y sin restauración automática por URLs. La secuencia compartida conserva validación histórica, preview, consecuencias, confirmación, copia, CAS/commit y verificación. Cancelar antes del commit conserva el estado. Se mantienen bloqueados los caminos de producto no verificados.

## Plan de validación y bloqueos

Se conservan las 654 unitarias, 22 de infraestructura y 885 resultados/44 suites anteriores. Se añaden pruebas de controlador, motor SQL real, inyección de fallos, equivalencia económica, cifrado, recibos/reconciliación, archivos y estados multidioma. Se medirán los bundles y se verificará ausencia de SQLCipher/SDK nativos en la web. CI conservará sus tres checks y sus límites; ninguna ejecución cancelada se presenta como aprobada.

Android: intentar compilación y runtime si aparecen herramientas/capacidad; compilación no equivale a ejecución. iOS: fuentes/preparación posibles, compilación/Keychain/WKWebView bloqueados sin macOS/Xcode. Se documentarán por separado simulación del adaptador, SQLite/SQLCipher real de escritorio, compilación nativa y ejecución en SO/dispositivo. Los 947 grupos axe incompletos/53 conjuntos continúan pendientes de revisión contextual.

Esta decisión precede a la implementación. Los checkpoints siguientes registrarán código, pruebas, resultados reales, matriz por plataforma, fallos y límites. No se fusiona, despliega, distribuye beta, publica en tiendas ni sincroniza Google AI Studio. Main y sus protecciones permanecen intactos.

## Checkpoint 2 — Controlador y transacciones reproducibles

668/668 unitarias y lint aprobados (654 anteriores +14 nuevas), sin omisiones. Las nuevas pruebas usan SQLite real de node:sqlite y las mismas sentencias/esquema que consumirá el puente: apertura sin guardado implícito, inicialización explícita, equivalencia con FinanceStore web, estado no publicado durante commit pendiente, cuatro puntos de rollback, respuesta perdida, bloqueo/reconciliación tardía, CAS entre conexiones, recibos idempotentes, tombstones, copia completa y rechazo de integridad/esquema desconocido. Este motor de escritorio no certifica cifrado ni Keystore/Keychain y no se presenta como ejecución Android/iOS.

La primera versión de dos pruebas suponía que un turno de event loop bastaba para alcanzar el commit y sustituía incorrectamente una cadena dentro de JSON escapado. Se corrige el arnés con una señal explícita del driver y serialización del payload modificado; no se reduce ninguna aserción anterior. FinanceStore y sus validadores siguen byte a byte intactos. Las pruebas criptográficas y de caída de procesos se añaden en el checkpoint 3.

## Checkpoint 3 — Puente, cifrado y claves

Se incorpora el plugin local con versiones nativas fijadas, claves exclusivamente nativas y las mismas sentencias del checkpoint 2. Android `assembleDebug` ha terminado correctamente (APK de desarrollo **sin firma**, no distribuido); no se ha instalado ni ejecutado. La primera compilación detectó la dependencia explícita de ActivityResult y la firma de dos parámetros del manejador de corrupción de SQLCipher 4.20; ambas se corrigen. iOS se sincroniza como fuentes SPM, pero compilación, Keychain y ejecución siguen bloqueadas sin macOS/Xcode.

Se compila también SQLCipher Community 4.20.0 de fuentes oficiales, commit `355d4db92d3404e71faa8088d071a71d767807f4`, archivo descargado SHA256 `fc5394c916beeabb1f43e2ac97d0827f36e8917f6675a00cca54537c32cb36a2`. Las **10/10 pruebas del motor real en Linux** pasan: cabecera cifrada/ausencia del marcador ficticio en claro, clave equivocada sin borrado, integridad, manipulación detectada, copia y rollback, proceso terminado antes y después del commit, recibo tras respuesta perdida, CAS entre dos procesos, SQLite FULL y conservación de esquema futuro. El uso de SQLite en escritorio no demuestra Keystore/Keychain ni durabilidad ante corte eléctrico de un teléfono.

La compilación desde fuentes requiere generar primero la amalgama (`make sqlite3.c`) y definir `SQLITE_EXTRA_INIT=sqlcipher_extra_init` y `SQLITE_EXTRA_SHUTDOWN=sqlcipher_extra_shutdown`, además de SQLITE_HAS_CODEC y el proveedor OpenSSL. Los primeros intentos de compilación detectaron estos requisitos; no se ocultan ni se sustituyen por pruebas simuladas. El comando reproducible y el script están separados de la batería web: si falta SQLCIPHER_LIBRARY, la prueba termina con error y declara que no se ejecutó.

La revisión de la implementación Android comprobó que SQLCipher conserva el byte[] de contraseña para su pool de conexiones. El puente mantiene esa referencia únicamente mientras la base está abierta y la borra después de cerrar; borrarla inmediatamente después de open rompería futuras conexiones internas. No se promete borrado perfecto de copias internas de memoria. Un bloqueo de inicialización a nivel de archivo evita que dos procesos creen sobres/claves diferentes; después SQLite protege CAS y commit.

El bloqueo de producto se aplica también en nativo: builds release rechazan almacenamiento e importación; debug exige consentimiento ficticio explícito. No hay API de SQL arbitrario, extracción de clave, reset o borrado de base. Las clases de fallo conservan los archivos. Las herramientas de inyección de fallos solo existen detrás de ese permiso debug. No se habilitan datos reales.

## Checkpoints 4 y 5 — Archivos, recuperación e integración

La frontera asíncrona se conecta explícitamente a useFinanceData. El modo web conserva FinanceStore y su Storage síncrono; el modo nativo preparado recibe un controlador duradero, sin caché síncrona fingida ni publicación antes del commit. El selector inicial conserva la sesión desechable 5G y añade un sandbox persistente **debug, ficticio y opt-in**. Ambas opciones siguen prohibiendo datos reales. La apertura prepara y valida almacenamiento antes de montar App; un error conserva base/clave y muestra el motivo, sin reset automático.

Las copias recuperables se leen asíncronamente. La exportación toma el documento completo confirmado, comprueba la revisión y pide consentimiento antes de crear/compartir el archivo en claro. Cancelar con Escape o Atrás no crea ni comparte archivos. Se conserva la verificación por relectura del temporal privado. La app destinataria puede conservar una copia; el prototipo mantiene el temporal verificado para receptores asíncronos y caduca únicamente sus propios temporales de más de 24h en la siguiente exportación explícita. No se hace limpieza ni guardado financiero al reanudar.

El selector nativo ACTION_OPEN_DOCUMENT/UIDocumentPicker está conectado a una frontera tipada que limita tamaño y formato y devuelve una propuesta para la **misma** preview, confirmación y restauración originales. No restaura al seleccionar ni recibir una URL. Sin embargo, `externalImport=false` impide llamar al selector desde la interfaz en ambas plataformas hasta su validación nativa y autorización de producto. El modo temporal tampoco importa perfiles. No hay contenedor cifrado portable implementado: permanece bloqueado; JSON sin cifrar requiere consentimiento y un medio de custodia adecuado. Una copia interna ligada a la clave del teléfono no recupera una clave perdida.

693/693 unitarias pasan (654 originales +39 nuevas), sin omisiones/cancelaciones. Incluyen SQLite real, publicación tardía, fallos de commit, recibos, tombstones, competencia de revisiones, restauración completa, propuestas financieras inválidas, acciones rápidas y recuperación de lecturas bloqueadas. Once casos abren snapshots 2.5–3.5 conservando bytes/revisión exactos sin migración ni escritura. El corpus complejo conserva transferencias, repartos, reintegros, presupuestos aprobados, subítems y catálogo a través del motor compartido. La selección de archivos se prueba como validación/preview separada de restauración y con cancelación/archivos vacíos, truncados, incompatibles y excesivos.

La nueva suite añade 35 resultados Chromium (34 casos + contenedor), aprobados en la ejecución específica disponible: interfaz de producción de diagnóstico + SQLite real de escritorio, **no Android/iOS**. Cubre guardado pendiente sin éxito anticipado, fallo/retención de formulario/reintento, respuesta perdida/reconciliación sin duplicación, exportación consentida/cancelada, los cinco idiomas, 390/768/1280 px, ambos temas, teclado, zoom y ausencia de lecturas/escrituras financieras en WebView localStorage. Axe estricto mantiene sus reglas; los registros incompletos se conservan. La validación completa del estado final sigue pendiente en este checkpoint.

La primera prueba de recuperación mostró que los controles de la barra quedaban inaccesibles detrás de un formulario modal: se añade un diálogo de recuperación dentro de la jerarquía común de overlays. El formulario sigue montado, sus campos se conservan y nuevas escrituras permanecen bloqueadas. Si la confirmación llega después de que el formulario haya recibido error, se exige recarga para evitar reenviar una operación ya confirmada. Un selector de prueba que excluía el formulario por aria-hidden se corrige para comprobar explícitamente su conservación bajo el diálogo; no se rebaja la aserción. Se separan y amplían las áreas táctiles de las acciones del nuevo diálogo tras revisar su captura real.

Los 29 mensajes nuevos de almacenamiento y el aviso de prototipo se traducen mediante el sistema i18n existente. Se revisa la coincidencia léxica pt-PT «Cancelar», sin traducir datos personales ni guardar etiquetas traducidas. Ningún cambio en cálculos, FinanceStore, Web Locks, esquemas financieros, API/prompts, backend móvil o los 44 archivos protegidos de 5G.

## Compatibilidad y activación por plataforma

| Capacidad | Web | Android | iOS |
| --- | --- | --- | --- |
| Lectura persistente | Regresión final pendiente; contrato original conservado | Bloqueado: sin runtime | Bloqueado: sin macOS/Xcode/runtime |
| Escritura atómica/CAS | Contrato original; pruebas unitarias aprobadas | Infraestructura implementada/compilada; runtime bloqueado | Fuentes implementadas; compilación/runtime bloqueados |
| Cifrado en reposo | No añadido al contrato web | SQLCipher implementado; comprobación en Android bloqueada | SQLCipher implementado; comprobación en iOS bloqueada |
| Protección de claves | No aplicable al contrato web actual | Keystore implementado; ejecución bloqueada | Keychain implementado; ejecución bloqueada |
| Cierre forzado/actualización | No equivale a corte eléctrico; regresiones finales pendientes | Bloqueado | Bloqueado |
| Copia recuperable/restauración | Motor original conservado | Adaptador probado con SQLite de escritorio; runtime bloqueado | Adaptador probado con SQLite de escritorio; runtime bloqueado |
| Exportación y Share | Regresión final pendiente | Adaptador y consentimiento probados en Chromium; Share real bloqueado | Adaptador y consentimiento probados en Chromium; Share real bloqueado |
| Importación externa | Conservada; regresión final pendiente | Bloqueada por política, selector preparado | Bloqueada por política, selector preparado |
| Datos corruptos/esquema futuro | Unitarias originales conservadas | Motor Linux aprobado; puente Android pendiente | Motor Linux aprobado; puente iOS pendiente |
| Equivalencia financiera | 693 unitarias compartidas aprobadas | Pruebas del coordinador/SQLite aprobadas; ejecución Android bloqueada | Pruebas del coordinador/SQLite aprobadas; ejecución iOS bloqueada |
| Datos reales habilitados | Comportamiento web original | **NO** | **NO** |

Las columnas distinguen implementación, compilación y ejecución. Ninguna prueba nativa se marca como aprobada porque una simulación o CI web pase. No hay teléfono físico, emulador Android, macOS ni Xcode en este host. El APK unsigned no se distribuye. Capacitor8.6.2, Android SDK36/JDK21/Gradle8.14.3/AGP8.13.0 permanecen como en 5G; iOS requiere Xcode26+ con SwiftPM y el SDK oficial. Identificador provisional `invalid.finanzas.prototype` sin firma real.

## Política de instalación, actualización y recuperación

Instalación nueva: solo consentimiento explícito crea el sandbox; la detección de plataforma nunca importa localStorage. Actualización desde 5G: sus datos en memoria no se convierten automáticamente. Reapertura de 5H: se valida el documento y esquema1 sin migrar. Un SQL user_version desconocido bloquea; v0 únicamente inicializa tablas cuando está vacío y existe consentimiento. No se ofrece borrado/recreación ante apertura fallida. Toda evolución posterior de SQL deberá aportar copia previa, migración transaccional idempotente y revalidación; no se ha inventado una migración financiera nueva.

Android conserva allowBackup=false y las exclusiones anteriores; base, sobre y copias internas viven bajo noBackupFilesDir, temporales bajo cache privada. iOS excluye su directorio protegido de backup y usa Keychain ThisDeviceOnly. Preferencias de idioma/tema permanecen separadas; exports elegidos por el usuario quedan bajo su custodia. La política no promete recuperar otro teléfono ni una reinstalación: sin copia independiente portable se pueden perder los datos. Un restore de SO sin clave compatible bloquea y conserva la base; no la borra.

Antes de datos reales quedan pendientes ejecución por plataforma, rotación/rekey y fallos de Keystore/Keychain en dispositivo, cierre forzado/actualizaciones, verificación de backups/traslado, espacio y permisos reales, Share/picker, revisión de dependencias/licencias/privacidad y aprobación de identidad/producto. Una beta externa o distribución exigiría además identificador definitivo, firma, política de privacidad y decisión de cifrado/exportaciones. Nada de ello se activa en esta PR.

## Evidencia y validación final en curso

La batería inicial de ce1ec83 produjo 654 unitarias, 22 de infraestructura, lint y build correctos. Chromium inicial **NO aprobado**: 735/741 resultados en 36/44 suites, cinco fallos derivados del cierre del navegador por timeout global de multilingualCatalog, una cancelación; ocho suites no ejecutadas. Se conserva el informe fallido, sin ampliar su límite de 300s. Se repite esa suite aislada para separar contención del entorno de una regresión; el resultado se registrará al terminar. La batería final completa se ejecutará sin otro navegador local en paralelo.

Bundles de producción medidos frente a ce1ec83: landing 138.072→138.880 bytes gzip (+808; +0,59%); grafo estático de App 249.065→250.262 (+1.197; +0,48%). El incremento corresponde a mensajes y frontera de presentación, no al motor nativo. El análisis completo identifica **cero módulos Capacitor/SQLCipher/vault/driver de pruebas en todos los chunks web**, no solo en el inicial. Las cifras finales se volverán a recoger si cambia ese grafo. No hay medición de arranque/memoria Android/iOS sin runtime, ni se extrapola Chromium a dispositivos físicos.

Se conservan los 947 grupos axe incompletos de 5G, agrupados en 53 conjuntos equivalentes, pendientes de revisión contextual. Las observaciones nuevas se documentarán separadas; no se convierten en infracciones ni aprobaciones manuales. No se ha utilizado lector de pantalla ni dispositivo físico. Los screenshots son de la aplicación real con datos ficticios y se renovarán con el código final.

CI: se mantienen los tres checks y el presupuesto global de 50 minutos, sin cambiar workflows/protecciones ni reglas de fallo. Se publicará una única PR Draft y se registrarán resultados/URLs del SHA final; este checkpoint no afirma CI final verde.

## Comandos reproducibles

```bash
npm ci
npm test
node scripts/ci/run-check.mjs tools
npm run lint
npm run build
CHROMIUM_PATH=/usr/bin/chromium npm run test:ui
PERF_REQUIRE_LAZY=1 node scripts/performance/bundles.mjs /tmp/5h-bundles.json
git diff origin/main...HEAD --check

# Prueba criptográfica real de escritorio, separada de Android/iOS:
bash scripts/native/build-sqlcipher-test.sh
# Usar la ruta SQLCIPHER_LIBRARY impresa por el comando anterior:
SQLCIPHER_LIBRARY=/ruta/impresa/libsqlcipher.so npm run test:native:engine

npm run native:sync:android
npm run native:sync:ios
npm run native:android:assemble
npm run native:open:android
npm run native:open:ios # macOS con Xcode26+, no ejecutar como si Linux compilara iOS
```

El build de diagnóstico `vite.vault-test.config.ts` tiene marcador native-prototype-test y el validador de empaquetado lo rechaza. Su endpoint loopback __vault_test existe únicamente en el script de prueba; no se añade al servidor Express de la aplicación ni se crea un servicio financiero remoto. El navegador bloquea recursos externos y usa almacenamiento ficticio aislado. No hay claves de Gemini, telemetría ni servicios nuevos.

## Checkpoint 6 — Revisión de integridad y validación

La revisión añade una comprobación de integridad lógica: el documento activo debe referenciar un recibo **committed con su misma revisión**. Un head cuyo recibo falta, está abortado o pertenece a otra revisión se rechaza sin borrar el documento. Se aplica a Android, iOS y driver SQLite de pruebas. La nueva prueba reproduce la pérdida del recibo y verifica conservación de bytes. No cambia el modelo financiero ni el esquema SQL.

695/695 unitarias pasan tras esta revisión. La segunda prueba nueva ejecuta las mismas altas de préstamo/cuota, transferencia vinculada y reintegro en FinanceStore web y coordinador asíncrono; compara documentos, relaciones, saldos exactos, aprobación, catálogo, subítems, exportación y restauración con copia anterior. Su primera ejecución utilizó por error el parámetro de edición de una liquidación para una creación; se corrige el arnés para utilizar operationId, conservando todas las aserciones. SQLCipher real pasa ahora **11/11**: se añade inspección de base y journal durante una transacción sin commit, sin encontrar los marcadores financieros en claro. Son pruebas Linux, no de Keystore/Keychain.

La compilación Android se repite correctamente con la comprobación de recibos. El APK sin firma incorpora las cuatro ABI de desarrollo; el aumento respecto al APK conservado de 5G (5.543.039 bytes) hasta aproximadamente13,38MB corresponde principalmente a libsqlcipher.so nativa, no a JavaScript web. El hash y tamaño exactos finales se registrarán con el manifiesto de evidencias. No se distribuye ni instala.

La suite de catálogo de la base repetida aislada pasa **43/43 en 284,6s**, con el límite original de300s. Esto no convierte en aprobada la ejecución inicial incompleta. La batería web final está en curso, sin otro navegador local en paralelo.

PR Draft única: https://github.com/dlopezteruel-rgb/Finanzas-pro/pull/32. Primera ejecución CI de checkpoint273684e: https://github.com/dlopezteruel-rgb/Finanzas-pro/actions/runs/43922926002, con Unitarias y Lint/build/diff aprobados; Chromium pendiente al publicar esta revisión. La nueva publicación la sustituirá mediante la concurrencia normal del workflow. Una ejecución sustituida o cancelada no se presentará como aprobación final.

### Aislamiento del build de diagnóstico

Se detecta y corrige un caso reproducible de configuración: una variable de entorno heredada `VITE_VAULT_TEST=true` podía incluir el puente loopback de pruebas en un build nativo ordinario sin cambiar su marcador. El build nativo fija ahora ese valor a false; solo la configuración explícita de diagnóstico puede sobreescribirlo y siempre usa un marcador rechazado por el empaquetador. Además, el validador examina todos los assets JavaScript y rechaza el endpoint __vault_test.

La nueva prueba genera **ambos builds reales en memoria con la variable heredada activada** y comprueba módulos, endpoint y marcadores. 696/696 unitarias y lint pasan después de actualizar el inventario AST por la importación de esta prueba. No se cambia la configuración web ni ningún workflow. loggingBehavior:none y webContentsDebuggingEnabled:false siguen vigentes; el puente no registra documentos ni claves.
