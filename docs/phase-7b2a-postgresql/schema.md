# Esquema, migraciones y permisos

server/postgres/migrations/001_registry.sql implementa el modelo de7B.1, con una tabla global de revisión privada, usuarios UUID independientes de Auth0, binding exacto issuer/sub con colación C, perfil, propietario único, eventos mínimos y recibos. No existe columna email ni unión automática. Crear fixtures A/B no vincula cuentas reales ni importa datos locales.

| Tabla | Restricción y acceso runtime |
| --- | --- |
| registry_state | Singleton/revisión segura; ningún grant runtime |
| app_user | UUID PK, revisión/epoch y estado; SELECT del actor activo, sin escritura |
| external_identity | PK(issuer,subject), FK usuario/revisión; SELECT propio; sin provisión o reasignación runtime |
| profile | UUID PK, etiqueta acotada, revisión segura/estado; SELECT propio y UPDATE sólo label/revision |
| profile_owner | PK perfil y UNIQUE(perfil,usuario), FKs RESTRICT; SELECT propio, sin INSERT/UPDATE/DELETE runtime |
| authorization_event | FK actor/perfil coherente, acciones/outcomes cerrados; SELECT/INSERT propio, sin modificar/borrar |
| operation_receipt | UUID operación único, FK owner compuesta, huella32bytes y revisión resultado; SELECT/INSERT propio; append-only |
| schema_migrations | Versión/checksum/fecha servidor; privado del migrador por ACL, no RLS de usuario |

Siete tablas de dominio llevan ENABLE y FORCE RLS, políticas explícitas para runtime y mantenimiento autorizado del migrador. El ledger no recibe grants runtime. current_actor es SECURITY INVOKER con search_path fijo, sin SQL dinámico. El trigger exige incremento de revisión exactamente1. No hay SECURITY DEFINER ni función pública de cambio de owner. Eventos no contienen tokens, correos, prompts, DSN ni payloads financieros; los UUID siguen siendo datos seudónimos, no anónimos. Política de retención/exportación/borrado requiere revisión antes de producción.

## Separación de roles

| Rol | Propósito local | Límites |
| --- | --- | --- |
| neondb_owner | Bootstrap administrativo ficticio | SUPERUSER local sólo para laboratorio; no usar como runtime, no extrapolar a Neon |
| finanzas_migrator | LOGIN NOINHERIT, CREATE DB-schema autorizado, propietario del esquema y objetos | NOSUPERUSER/NOBYPASSRLS/NOCREATEROLE/NOCREATEDB/NOREPLICATION; puede alterar sus políticas: credencial de mantenimiento privilegiada |
| finanzas_runtime | LOGIN NOINHERIT, CONNECT/USAGE y grants mínimos anteriores | Sin membresías, ownership, DDL, CREATE/TEMP, cambios de identidad/owner o privilegios administrativos |

El bootstrap es local-only, transaccional e idempotente; no rota contraseñas de roles existentes. Revoca CREATE público y permisos DB de PUBLIC, concede sólo lo requerido y rechaza drift inseguro. Se prueban logins reales, no sólo SET ROLE desde admin. La prueba de privilegios heredados concede temporalmente una membresía ficticia y demuestra el rechazo; luego la revierte. No se alteran roles remotos.

## Migraciones reproducibles

migrate conecta directamente como migrador, exige PG18, toma advisory_xact_lock, comprueba propietario/ledger, versiones conocidas y hashes SHA256, y aplica SQL+registro de versión en una sola transacción. Un esquema preexistente sin ledger, checksum alterado, versión futura o fallo aborta sin reparar/borrar datos. Repetir o ejecutar dos migradores a la vez no duplica filas o versiones. El lock es transaccional y no requiere afinidad de sesión persistente, pero **la migración no usa endpoint pooled**.

No editar una migración ya aplicada: crear una versión nueva revisada. No añadir migraciones destructivas, normalizaciones financieras o cambios de JSON por la introducción de PostgreSQL. Antes de remoto: revisión del diff SQL, privilegios y backups verificables; no existe un comando de esta PR que supere requireLocal. Las conexiones cliente y servidor deben conservar el contrato COMMIT antes de éxito; ante fallo de rollback se destruye la conexión y no se devuelve al pool como sana.
