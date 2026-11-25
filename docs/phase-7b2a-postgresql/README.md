# 7B.2A — PostgreSQL18, roles y RLS reproducibles

Base verificada `2ae61a6121344b1108dba9b5130c4d72420a55cb`, merge de PR#37. Rama `feature/phase-7b2a-postgresql-foundation`; worktree nuevo, sin modificar los anteriores ni main/PR#34.

Se implementa infraestructura de **metadatos ficticios**: usuarios UUID, identidades issuer/sub, perfiles, propietario, revisiones, eventos mínimos, recibos y ledger de migración. No contiene documentos financieros ni cambia su JSON2.5–3.5. Ningún módulo nuevo se monta en Express, React, useFinanceData o Auth0. financialAccess sigue false. No se migran, reclaman, asocian, suben o borran perfiles existentes.

## Implementado

- node-postgres pg8.23.1, tipos8.23.1; Node24, Express existente y PostgreSQL18. Versión exacta/lock, 14entradas nuevas; versiones e integridades anteriores conservadas. Sin cambiar React/Vite/Capacitor/FinanceStore.
- Variables exclusivamente servidor, roles/URLs separados, TLS con CA y hostname verificados. No se pasa connectionString a pg: sus parámetros SSL podrían reemplazar ssl explícito.
- Bootstrap local, migración001 atómica/versionada/checksummed, lock transaccional, repetición y rechazo de esquemas/versions inesperados.
- Runtime restringido, RLS ENABLE/FORCE en siete tablas de dominio; ledger privado por ACL, sin permisos runtime. Auditoría/recibos append-only; propietario/usuarios no modificables por runtime.
- Transacciones SERIALIZABLE con contexto local, CAS, recibo/fingerprint y evento atómicos; confirmación tras COMMIT; errores genéricos sin DSN/password. Sin reintentos automáticos.
- Pruebas reales PostgreSQL18 con roles LOGIN restringidos, conexiones directas y node-pg-pool, A/B, rollback, desconexión/terminación, privilegios y restauración separada. No son mocks de SQL.

## Bloqueo remoto explícito

**Neon no se ha conectado ni probado.** La configuración neon-development sólo se puede inspeccionar en seco; requireLocal bloquea todos los clientes, pools, bootstrap y migraciones remotos. Ninguna variable elimina el bloqueo. Habilitar un acceso development futuro exige revisión/autorización y un cambio controlado con allowlist del endpoint real, no sólo una etiqueta de rama suministrada en el entorno.

Neon Free está autorizado exclusivamente para desarrollo ficticio: proyecto finanzas-pro-dev, AWS Europe Central1/Frankfurt, PG18, neondb, development sin caducidad, historial6h. production está reservada y no se utiliza. No se ha verificado remotamente esta configuración comunicada ni se aprueba Neon como proveedor definitivo de producción. Auth0 permanece IdP; Better Auth no se configura.

- [Arquitectura, TLS y seguridad](security.md).
- [Roles, migraciones y modelo](schema.md).
- [Guía posterior de Neon development, sin credenciales por chat](neon-development.md).
- [Backups, recuperación y Free](operations.md).
- [Pruebas, evidencias e inventario](validation.md).

## Ejecución local reproducible

```bash
npm ci
npm run test:postgres
node --import tsx scripts/postgres/verify.ts
```

Requiere Docker accesible y OpenSSL; usa imagen oficial postgres18.7-alpine3.24 fijada por digest OCI en scripts/postgres/lab.ts. Sólo inicia y elimina su contenedor/volumen con nombre aleatorio propio. Certificados y contraseñas efímeros se generan en directorio privado y no se publican. No toca perfiles personales ni contenedores de terceros.

Alternativa para una instalación PostgreSQL18 existente: definir PG18_BIN absoluto y, si su distribución lo necesita, PG18_SHARE y PG18_LIB. El harness crea un clúster temporal propio con TLS, fsync y synchronous_commit activos; no se conecta a un servicio existente. En este workspace Docker usa VFS y no pudo extraer la imagen por cuota de disco; se ejecutó PG18.7 Debian con paquetes oficiales extraídos sin instalación del sistema. Índice PGDG firmado, fingerprint B97B0AFCAA1A47F044F244A07FCC7D46ACCC4CF8 y SHA256 de paquetes verificados; liburing de Debian con índice firmado. No se atribuye esa prueba local a Docker. La ejecución Docker de CI se registra por separado.

Pruebas locales con fuentes aún sin commit son checkpoints; la descripción de la única PR Draft registra el SHA final, CI real, resultados exactos y digests de artefactos. No se reutiliza la CI de main. No fusionar, desplegar, distribuir ni sincronizar Google AI Studio.
