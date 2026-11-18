# GHSA-fc5q-39xc-vjpf / CVE-2026-112366

## Checkpoint1 — Estado inicial y fuentes,2026-11-18

Base208f1830581dc6c424118ee0edb77903ec83042e, merge de PR32 confirmado; no hay commits posteriores al SHA de referencia. Rama independiente fix/security-picomatch-redos. Se preservan los diez worktrees originales y sus cambios pendientes; no se modifica main ni las PR anteriores. [Inventario](ghsa-fc5q-39xc-vjpf-evidence/initial-audit.json).

Node24.22.1/npm11.9.0. npm ci instala306paquetes. Baseline:733unitarias,50infraestructura, lint y build correctos. [Comandos, códigos y tiempos](ghsa-fc5q-39xc-vjpf-evidence/before/commands.json). La configuración heredada de npm de este host tiene audit=false; no la establece esta PR. Se ejecutan explícitamente npm audit y npm audit --omit=dev, ambos con salida1 y5paquetes high/0critical. Las siguientes instalaciones usarán npm_config_audit=true por comando, sin modificar la configuración global. No se confunde npm ci exitoso con auditoría aprobada.

| Paquete efectivo | Versión | Relación |
| --- | --- | --- |
| picomatch |4.0.7| Aviso directo |
| fdir |6.5.0| picomatch |
| tinyglobby |0.2.17| fdir+picomatch |
| vite |8.3.7| picomatch+tinyglobby |
| @vitejs/plugin-react |6.3.0| Vite |

No son cinco vulnerabilidades independientes. Vite y pluginReact están declarados en dependencies; también Tailwind/Vite depende de Vite. La auditoría omit=dev conserva los cinco paquetes afectados. No se cambia su clasificación para hacer desaparecer el aviso. [Árbol](ghsa-fc5q-39xc-vjpf-evidence/before/ls-picomatch.json), [npm explain](ghsa-fc5q-39xc-vjpf-evidence/before/explain-picomatch.json), [auditoría completa](ghsa-fc5q-39xc-vjpf-evidence/before/audit.json), [producción](ghsa-fc5q-39xc-vjpf-evidence/before/audit-production.json).

Las integridades del lockfile de picomatch,Vite,pluginReact,fdir,tinyglobby,Tailwind/Vite y Rolldown coinciden con los metadatos oficiales de sus versiones publicadas. [Integridades/engines/peers](ghsa-fc5q-39xc-vjpf-evidence/sources/installed-integrities-and-compatibility.json). No se actualizan dependencias, lockfile, React,Tailwind,TypeScript ni Capacitor en este checkpoint.

## Checkpoint2 — Investigación y decisión anterior a la mitigación

[Advisory oficial](https://github.com/advisories/GHSA-fc5q-39xc-vjpf): afecta a<=4.0.7; first_patched_version=null, sin retirada. Última actualización2026-11-17T15:56:44Z. [Consulta JSON](ghsa-fc5q-39xc-vjpf-evidence/sources/advisory.json). [Registro npm](https://registry.npmjs.org/picomatch) y [releases](https://github.com/micromatch/picomatch/releases) mantienen4.0.7 como última publicación. No existe una4.0.8 publicada en la consulta. No se supone seguridad por un número de versión.

El advisory referencia [PR194](https://github.com/micromatch/picomatch/pull/194), que sigue abierta/no fusionada y describe semántica de un signo? al comienzo de un extglob. No constituye una corrección oficial publicada de este CVE. Los commits recientes tratan otros casos de globstar/newlines/punct; no se atribuyen a este aviso sin evidencia. Se consultan por separado los demás advisories de picomatch, releases/avisos de Vite, y releases/commits/avisos de fdir/tinyglobby. [Peticiones y resultados](ghsa-fc5q-39xc-vjpf-evidence/sources/research-requests.json). No se confunden arreglos de otras vulnerabilidades con este CVE.

| Opción | Decisión |
| --- | --- |
| Actualización oficial compatible | No disponible según advisory y registro consultados. |
| Override | Descartado: ninguna versión corregida verificable para forzar. |
| Downgrade mayor de Vite/pluginReact sugerido por npm | Descartado: no demuestra corregir este CVE y rompe el alcance de compatibilidad. |
| Fork/parche de terceros | Descartado: innecesario y sin solución auditada demostrada. |
| Reducir exposición de producción | Candidato seleccionado, pendiente de pruebas: importación dinámica de Vite exclusivamente en desarrollo. |

**Resultado previstoB: mitigación de exposición, vulnerabilidad upstream pendiente.** El paquete continuará instalado y npm audit seguirá fallando mientras no haya remediación fiable; no se presentará como corregido.

## Exposición inicial comprobada

server.ts importa createServer de Vite estáticamente aunque solo lo utiliza cuando NODE_ENV no es production. Una traza real del arranque de producción observa carga de módulos de Vite,picomatch,tinyglobby y fdir; la petición ficticia del asistente conserva su fallback original. [Traza/respuesta](ghsa-fc5q-39xc-vjpf-evidence/before/production-import-exposure.json). Cargar un módulo no demuestra por sí solo que exista una ruta explotable a su compilador de globs.

Las rutas Express reciben texto/catálogos/contexto financiero, no patrones glob para Vite. Se revisarán sus consumidores y los del matching antes de concluir el alcance. Las fuentes/configuración de Vite/Tailwind, import.meta.glob y entradas de compilación deben ser confiables. El servidor de desarrollo no debe exponerse como servidor de producción. npm start no configura NODE_ENV por sí solo: producción requiere NODE_ENV=production. No se cambia el comportamiento de arranque, HMR,DISABLE_HMR,APP_BASE_PATH o Gemini para ocultar el problema.

## Seguridad de los datos y entorno

No se modifican FinanceStore,IndexedDB strict,Web Locks,CAS,recibos,copias,migración/restauración,SQLCipher,Keystore,Keychain ni JSON3.5/lectura2.5–3.5. Las protecciones de datos reales móviles siguen activas. Las pruebas usan perfiles/catálogos ficticios y claves de API vacías; no consultan Google AI Studio. Los58conjuntos axe incompletos previos siguen pendientes de revisión contextual.

El disco tenía122MB libres. Se verificó la identidad de390archivos ya instalados de JDK/SDK antes de retirar solo sus dos archivos de instalación descargados, liberando389.691.980bytes. No se borran worktrees, herramientas instaladas ni evidencias históricas de5H. Solo se deduplican archivos inmutables idénticos del node_modules nuevo, conservando todos sus bytes.

Los siguientes checkpoints añadirán la prueba que rechaza Vite/picomatch en producción, su resultado anterior/posterior, la mitigación mínima, diagnóstico de seguridad visible independiente de los tres checks financieros, regresión completa, pruebas nativas disponibles y mediciones. No se declara ninguna de esas verificaciones aprobada anticipadamente.

## Checkpoint3 — Mitigación y pruebas de exposición

Se elimina únicamente la importación estática de Vite en server.ts y se importa dentro del camino existente de desarrollo. Producción debe arrancar con NODE_ENV=production; npm start por sí solo conserva el comportamiento anterior de entorno. No se modifica configuración de middleware, HMR, DISABLE_HMR, APP_BASE_PATH, endpoints, prompts, modelos ni almacenamiento.

Prueba de regresión: antes del cambio, las dos pruebas de producción fallan al prohibir importar Vite/picomatch; las cuatro pruebas de desarrollo/HMR pasan. Después,6/6 pasan: HTML/assets/SPA/API en raíz y subruta, DISABLE_HMR y actualizaciones reales por WebSocket con un módulo ficticio privado. Se comprueban módulos ESM y caché CommonJS; producción no carga Vite ni picomatch. No se ejecutan payloads ReDoS. Los artefactos de este checkpoint identifican HEAD2d4ad00 más el cambio de trabajo, no pretenden que ese commit contuviera la mitigación.

La revisión de server.ts no identifica entradas HTTP convertidas en patrones glob: los endpoints reciben mensajes, fechas y categorías, no APIs de matching. fdir usa picomatch en glob(), tinyglobby compila patrones match/ignore y Vite los utiliza para configuración y herramientas de desarrollo/compilación. La ausencia de un camino HTTP identificado no es una demostración universal de inexplotabilidad. Desarrollo y CI siguen procesando código/configuración: usar fuentes y configuraciones de confianza y no exponer el servidor de desarrollo a redes no confiables. No se añaden validadores de globs especulativos a formularios financieros.

Se añade una cuarta comprobación independiente: **Seguridad npm (resultado real)**. Conserva los códigos reales de ambos npm audit, árbol e integridades; falla con esta alerta o cualquier vulnerabilidad futura, sin excepciones de CVE ni severidad. Publica diagnóstico incluso al fallar. Los tres checks financieros originales permanecen independientes; el límite Chromium sigue en50minutos. Mientras siga el aviso, se espera security rojo y no se podrá describir el workflow global como aprobado.

Se añaden6 pruebas del diagnóstico (incluyen que omit=dev no oculte hallazgos, errores de proceso, informes malformados y un advisory futuro). Infraestructura56/56. El registro de44 huellas auditadas detectó los cambios autorizados de server.ts/workflow: se revisan únicamente esas dos huellas, conservando las42 restantes y todas las aserciones. [Justificación y huellas anteriores/nuevas](ghsa-fc5q-39xc-vjpf-evidence/reviewed-protected-hashes.json). Unitarias733/733 tras esa revisión. El inventario AST i18n se regenera por la huella del servidor; no se cambian textos de producto.

### Variación de propagación del informe npm

Una ejecución con caché npm alternativa informó6paquetes high al incluir @tailwindcss/vite por su relación con Vite. Se conserva su informe completo/resumen; no se atribuye a una vulnerabilidad nueva ni a una actualización: lockfile y versiones no cambian y hay un único advisory. Repetidos main virtual (package+lock originales), main instalado y rama con la misma caché explícita informan5high/0critical en ambos modos. Es una variación del diagnóstico/propagación de npm, no evidencia de remediación. Se registrarán los recuentos reales de CI aunque difieran.

No se cambia package-lock.json ni ninguna dependencia; package.json añade solamente comandos de diagnóstico y pruebas. La alerta permanece abierta tanto en instalación completa como omit=dev. Actualizar cuando el mantenedor publique una corrección específica verificable; entonces validar semver, consumidores, integridades, repetir auditoría y regresión. No hay excepción permanente para impedir detectar avisos futuros.
