# 7B.2A.1 — Preparación segura de Neon: etapa A

Base `ba7dbb1d9d9a4732da918c89dc84baa9e4c11c5c`, merge de PR #38 verificado. Rama `feature/phase-7b2a1-neon-preparation`. No se ha conectado a Neon, ni a su API de gestión, ni se han proporcionado credenciales reales. La configuración comunicada por el propietario sigue siendo development / neondb / PostgreSQL 18 / Frankfurt / Free, con seis horas de historial. Production queda reservada y prohibida.

Se entrega un plan revisable y un runner independiente del laboratorio, con cliente oficial psql/libpq 18, TLS verify-full y channel binding require. pg 8.23.1 no cambia: sigue rechazando el require que no puede imponer y mantiene el bloqueo remoto original. No se añaden dependencias npm ni se cambia el lockfile.

## Lectura para aprobar la siguiente etapa

1. [Decisión arquitectónica y alternativas](architecture.md).
2. [Destino, capacidades y límites de seguridad](security.md).
3. [SQL, roles, migraciones y operaciones previstas](remote-plan.md).
4. [Windows y PowerShell: configuración local sin secretos por chat](windows.md).
5. [Backups, restauración separada y límites de Free](recovery.md).
6. [Pruebas, fallos conservados, inventario y CI](validation.md).

## Preparación sin conexión

```bash
npm ci
npm run neon:plan
node --import tsx scripts/neon/runner.ts sql bootstrap
node --import tsx scripts/neon/runner.ts sql migrate
node --import tsx scripts/neon/runner.ts sql privileges
```

Estos comandos sólo leen código del repositorio y producen planes/SQL sin credenciales. `npm run neon:run` falla expresamente con NEON_STAGE_B_NOT_AUTHORIZED; no es un fallo de conexión ni una prueba de Neon. Ni un JSON de ejemplo rellenado ni una variable de entorno pueden habilitarlo.

El laboratorio se ejecuta mediante `npm run test:postgres` y `npm run test:neon:local`. El segundo crea su propio PostgreSQL temporal; no acepta una URL remota. En CI usa la imagen PostgreSQL 18 oficial ya fijada por digest. No ejecutar estos laboratorios sobre un servicio existente.

## Puerta de autorización

La PR corresponde únicamente a la etapa A. Antes de B, el propietario debe aprobar el destino público exacto, plan/hash y alcances enumerados. Hace falta un cambio revisado en la puerta y en el registro vacío `server/neon/approved.ts`, seguido de verificación independiente del control plane. El registro es control operativo por revisión de código; no es autenticación de usuarios ni una defensa ante un servidor/operador comprometido.

Se recomienda aprobar primero sólo verificación de destino y diagnóstico, y revisar los resultados antes de DDL, fixtures o limpieza. Restauraciones, resets, borrados de ramas y cambios de plan requieren otra autorización específica y no están automatizados aquí. La limpieza de fixtures requiere además aprobar su hash después de conocer los IDs generados.

No se habilita financialAccess, no se conectan rutas financieras, no se migra/asocia ningún perfil local y no hay sincronización. Auth0, FinanceStore, IndexedDB strict, Web Locks, CAS financiero, SQLCipher y JSON 2.5–3.5 permanecen intactos. La demo sigue deshabilitada y se mantienen los bloqueos móviles. No fusionar, desplegar, distribuir ni sincronizar Google AI Studio.
