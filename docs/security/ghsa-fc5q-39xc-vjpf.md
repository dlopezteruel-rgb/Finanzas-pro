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
