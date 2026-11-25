# Auditoría de acceso heredado y cierre seguro propuesto

Inspección estática del main de partida; no pruebas de intrusión sobre datos reales. Ninguna vía se modifica o habilita en 7B.1.

| Superficie / referencias | Comportamiento actual y riesgo | Cierre necesario antes de cuentas financieras reales |
| --- | --- | --- |
| src/app/Root.tsx, LandingPage, /app y acceso directo/recarga | Montan producto local heredado sin ownership autenticado; ocultar navegación no lo cierra | Gate antes de montar App y abrir adaptadores; cubrir rutas directas, reload, error y base path; autorización servidor adicional |
| server.ts: assets SPA, middleware Vite y catch-all APP_BASE_PATH | Servir HTML no equivale a autorizar lectura de almacenamiento local; dist puede cargarse con código anterior/cache | Diseño de transición/versionado del cliente y bloqueo de bypass; no confiar sólo en 302 de Express |
| server.ts: POST /api/parse-movement y /api/assistant-chat (applicationPaths) | No exigen autenticación; procesan contexto aportado por quien llama. No leen por sí solos la DB financiera local, pero pueden recibir información sensible y consumir servicios | Sesión, autorización de recurso/contexto y protección de abuso/coste en servidor antes de beta. No asumir que CORS o cookies autentican al dueño del contexto |
| server/identity/router.ts | SDK valida identidad; /session aún devuelve applicationSubject=null, financialAccess=false; acciones de login/logout protegidas por origen | Resolver registro confiable y revocación persistente; mantener sujetos no provisionados denegados |
| src/platform/services.tsx | Contexto web por defecto sin namespace por usuario; llamadas directas a usePlatformServices no pasan por identidad | Composición explícita por perfil autorizado, sin default que abra datos heredados en un host autenticado |
| src/utils/useFinanceData.ts, platform/financeSession.ts y financeBinding.ts | Abren el controlador por plataforma; no comprueban identidad/owner. Web abre IDB, prototipo memoria, nativo durable según servicios | No reutilizar una instancia abierta entre A/B; gate previo al open y control de generación; nunca usar fallback local para simular autorización |
| platform/web/openFinance.ts, indexedDb.ts, legacy.ts | Persistencia del origen, revisión/CAS y migración recuperable; el origen no es una identidad | Conservar archivo legacy, marcadores y divergencias; diseñar namespaces/ownership explícitos sin alterar garantías strict/Web Locks; ninguna migración nueva aquí |
| App.tsx: exportJSON, exportForensic, readRecoveryCopies y restore | Copias/forense/importación locales heredadas accesibles al usuario del navegador. Recuperación tampoco verifica identidad | En entorno futuro multiusuario, autorizar export/read/restore y recuperar sólo el ámbito correcto; mantener una ruta local de recuperación explícita sin publicarla como API financiera remota |
| platform/vault/asyncFinanceStore.ts, nativeDriver.ts y native/secure-vault | SQLCipher y controles nativos protegen integridad/cifrado; no demuestran por sí solos propiedad de una cuenta Auth0 | Verificar runtime/credenciales OS/namespace; impedir apertura de bóveda de otro usuario; no sustituir SQLCipher por IndexedDB ni desbloquear datos reales |
| Históricos, presupuestos, préstamos, transferencias y operaciones vinculadas | Todos comparten documento financiero y relaciones internas; subdividir por pantalla/filas podría romper semántica | Autorizar perfil/documento coherente antes de una operación; preservar IDs, snapshots y vínculos; evitar ownership por filas visibles |
| src/identity/demo.ts y policy.ts | Demo en memoria, acciones ficticias cerradas, deshabilitada; sin perfiles anteriores, cuentas anónimas ni API remota | Conservar aislamiento y posibilidad de retirada; nunca conectar demo al default webServices o reclamarla como perfil personal |

## Orden de transición que requiere aprobación

1. Inventariar versión/estado local sin atribuir propiedad ni transmitir datos. Definir experiencia de recuperación del propietario original en equipos compartidos.
2. Añadir autorización de servidor y registro real; aislar clientes, cachés y controladores antes del primer acceso. Probar ausencia de identidad/DB, usuario equivocado, revocación y downgrade/código anterior.
3. Diseñar cierre del acceso heredado y recuperación local de forma explícita; no borrar localStorage/IndexedDB/SQLCipher, copias o claves ni bloquear permanentemente a quien necesite exportar su perfil previo.
4. Migración/adopción posterior sólo con alcance autorizado, vista previa, consentimiento, copia verificada y transacción/idempotencia. Ningún login decide dueño por email o por ser el primero en usar el dispositivo.

Riesgo residual: una persona con control del navegador/OS/origen puede inspeccionar almacenamiento local, devtools, exportaciones y clientes antiguos. Una barrera React, un UUID o RLS remoto no elimina esa capacidad. El modelo de amenazas debe distinguir autorización remota, privacidad de almacenamiento local y dispositivo comprometido. No se presenta esta fase como cierre efectivo de esas vías.
