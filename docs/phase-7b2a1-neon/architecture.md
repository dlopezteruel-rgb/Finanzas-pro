# 7B.2A.1 — Decisión de arquitectura, etapa A

Base verificada: `ba7dbb1d9d9a4732da918c89dc84baa9e4c11c5c`, merge de PR #38. No hay commits posteriores en origin/main al iniciar el trabajo. Los quince worktrees anteriores y sus cambios se conservan. Rama nueva: `feature/phase-7b2a1-neon-preparation`.

## Decisión antes de implementar

Se mantiene pg 8.23.1 para el laboratorio y los contratos existentes. El registro npm y el código publicado, consultados el 25/11/2026, no proporcionan una política require: enableChannelBinding es prefer. La PR upstream [3746](https://github.com/brianc/node-postgres/pull/3746) continúa abierta. No se incorporan forks, algoritmos SASL propios ni opciones que el driver pueda ignorar.

Para el **runner operativo de validación**, se selecciona el cliente oficial psql/libpq 18: `channel_binding=require`, `require_auth=scram-sha-256`, `sslmode=verify-full` y CA confiable. Se probará positivamente contra PostgreSQL 18 real y negativamente ante autenticación que no satisfaga el contrato. El servidor Express no cambia de driver ni adquiere acceso remoto. La selección de un driver para futuras rutas activas sigue pendiente de revisión; psql no se presenta como nuevo backend financiero.

El runner remoto se separa del laboratorio. La etapa A conserva una denegación en código antes de cargar credenciales, resolver DNS, consultar el control plane o lanzar el cliente. Una variable de entorno no autoriza etapa B. Los planes y sus hashes se pueden revisar sin conexión. No hay endpoint real aprobado en el repositorio.

El diseño de etapa B exige una allowlist exacta revisada, asociación independiente proyecto/rama/endpoint desde el control plane, coincidencia con URLs directas y pooled y autorización por operación. El nombre development en una variable o un JSON suministrado por el mismo cliente no constituye prueba independiente. Las respuestas de control plane de los tests son simulaciones, no evidencia de Neon. La activación requerirá aprobación del propietario y un cambio revisado de la puerta; editar un JSON de ejemplo no basta.

Bootstrap específico de Neon: SQL revisable, roles inicialmente NOLOGIN, sin membresías ni privilegios administrativos para migrador/runtime; credenciales mediante procedimiento interactivo del propietario. No se cambia la contraseña de un rol existente al repetir bootstrap. Las migraciones usan conexión directa, el mismo SQL/checksum de 7B.2A, transacción y advisory lock. No se ejecuta SQL remoto en esta fase.

Los ensayos remotos se limitan a metadatos ficticios identificables. Creación de fixtures, modificaciones, limpieza, backups y restauración requieren alcances explícitos; no se ejecuta limpieza destructiva automática tras un error. Recuperación se planifica en una rama desechable adicional, sin usar production y sin crearla ahora.

FinanceStore, Auth0, financialAccess, IndexedDB strict, Web Locks, CAS financiero, SQLCipher, JSON 2.5–3.5, perfiles locales, demo y rutas activas permanecen intactos. Se conservan los cuatro jobs y toda la batería anterior. Las pruebas nuevas del runner/cliente se añadirán al job PostgreSQL, sin sustituir sus 23 casos anteriores.

## Referencias primarias

- [SSL node-postgres](https://node-postgres.com/features/ssl).
- [Cliente nativo y diferencias de API](https://node-postgres.com/features/native): alternativa evaluada, no instalada; requiere compilador/libpq y no evita revisar qué opciones pasa el wrapper.
- [libpq 18: channel_binding y require_auth](https://www.postgresql.org/docs/18/libpq-connect.html).
- [psql 18](https://www.postgresql.org/docs/18/app-psql.html).
- [Roles Neon](https://neon.com/docs/manage/roles): roles por rama; Console/API puede conceder neon_superuser, por lo que no se utiliza para crear runtime.

Esta decisión autoriza preparación y pruebas locales, no conexiones a Neon. El detalle de comandos, riesgos, evidencias y puerta de autorización se completará en los documentos de esta fase antes de entregar la PR Draft.
