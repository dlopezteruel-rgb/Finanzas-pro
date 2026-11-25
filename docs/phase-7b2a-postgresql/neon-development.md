# Procedimiento posterior: Neon development

**No ejecutado ni autorizado para ejecución remota en esta PR. No enviar credenciales por chat.** No se ha abierto ninguna conexión al proyecto Neon ni aplicado SQL remoto. Las pruebas locales/CI no validan automáticamente particularidades de Neon, PgBouncer, sus roles o recuperación.

## Antes de proporcionar credenciales al servidor

1. Revisar esta PR, migración001, grants y ensayos. Obtener autorización expresa para la ventana de trabajo remoto con datos ficticios. Mantener production reservada y sin uso. No contratar, aumentar Free o configurar Better Auth; Auth0 sigue IdP.
2. En Dashboard, seleccionar proyecto finanzas-pro-dev y rama **development**, confirmar PG18/neondb/región Frankfurt y endpoint asociado. Registrar endpoint ID, rama, fecha, rol, esquema y finalidad. Un hostname o variable FINANZAS_DB_BRANCH no demuestra por sí solo la rama real; no deducirla del nombre neondb ni de la región.
3. Confirmar que development sólo contiene fixtures y que no hay consumidores. Revisar si DDL de roles/membresías se limita a la rama o afecta a otros recursos del proyecto; **si no está confirmado, detener bootstrap**. Nunca ejecutar sobre production por compartir nombres de base/rol.
4. Verificar disponibilidad del plan Free, límites de compute/almacenamiento/conexiones/historial6h, accesibilidad y backups. No hay restricciones IP configuradas según el propietario; no tratar esto como aislamiento. Evaluar controles disponibles/plan antes de producción, sin cambiarlos ahora.
5. Preparar credenciales distintas: administrador para bootstrap revisado, migrador directo para DDL y runtime restringido para pruebas/aplicación futura. No reutilizar la URL neondb_owner como runtime. Neon puede asignar neon_superuser a roles creados mediante determinadas interfaces: crear/revisar roles y consultar pg_roles/pg_auth_members reales; no confiar en su nombre o NOINHERIT. No ampliar privilegios para hacer pasar una prueba.

## Configuración segura por el propietario

Copiar config/postgres.env.example a un almacén secreto o fichero local de servidor ignorado por Git y con permisos600. Introducir valores desde Dashboard/gestor de contraseñas allí, nunca en mensajes, PR, logs, comandos con contraseña como argumento, VITE_ o código cliente. No publicar la salida del fichero. No copiar archivos secretos a recursos web/nativos.

FINANZAS_DB_ADMIN_URL y FINANZAS_DB_MIGRATOR_URL deben usar **endpoint directo**. FINANZAS_DB_RUNTIME_URL podrá ser directo o pooled según la prueba aprobada. Registrar cuál se usa. Usar neondb, nombres de rol previstos y TLS verify-full. Los valores se mantienen vacíos en Git.

El parámetro libpq channel_binding=require de una URL copiada no equivale a pg.enableChannelBinding. Esta implementación lo rechaza, no lo degrada silenciosamente. Antes de uso remoto decidir si prefer con TLS verify-full es suficiente o si se exige un driver/mecanismo oficial que verifique CB obligatorio. No retirar requisitos para lograr conexión. Tampoco desactivar validación de certificado al encontrar un error.

**El código actual no conecta con esas URLs:** requireLocal lo impide incluso con target neon-development y branch development. La apertura remota futura requiere otro cambio revisado/autorizado que fije una allowlist del endpoint development y los roles; no basta un flag de entorno. No quitar el guard para ejecutar el harness local sobre Neon.

## Secuencia de validación remota tras autorización

| Paso | Evidencia requerida | Estado actual |
| --- | --- | --- |
| Directo admin/migrador/runtime | current_user/session_user/current_database, PG18, pg_stat_ssl y hostname/cadena verificados, endpoint development confirmado fuera de SQL | No ejecutado |
| Roles/membresías | Atributos, membresías directas/transitivas, SET ROLE, ownership y CREATE/TEMP efectivos | No ejecutado |
| Migración | Backup previo verificado, revisión SQL/checksum, transacción directa, ledger, repetición sin cambios, owner correcto | No ejecutado |
| RLS A/B | Fixtures identificables, logins runtime reales, lectura/escritura/cruce y ausencia de contexto denegados; WITH CHECK | No ejecutado |
| Pool Neon | Repetir con endpoint pooled real: dos actores, COMMIT/ROLLBACK, reuse, missing context; no SET persistente ni afinidad de sesión | No ejecutado |
| CAS/recibos | Operaciones concurrentes y replay, rollback y reconciliación sin duplicados | No ejecutado |
| Recuperación | Dump independiente y restauración en entorno ficticio aprobado, comparaciones e integridad | No ejecutado |
| Fallos destructivos | Cancelar exclusivamente backend propio; checksum alterado/roles inseguros sólo en entorno desechable autorizado | No ejecutado / requiere aislamiento adicional |

Consultas de diagnóstico de sólo lectura (sólo tras autorización, mediante cliente servidor con TLS/secretos seguros):

```sql
SELECT version(), current_user, session_user, current_database();
SELECT ssl, version, cipher FROM pg_stat_ssl WHERE pid=pg_backend_pid();
SELECT rolname, rolsuper, rolbypassrls, rolcreaterole, rolcreatedb, rolinherit
FROM pg_roles WHERE rolname IN ('neondb_owner','finanzas_migrator','finanzas_runtime');
SELECT member::regrole, roleid::regrole, inherit_option, set_option FROM pg_auth_members;
```

SHOW ssl o pg_stat_ssl no prueban por sí solos verificación de hostname en cliente; comprobar también TLS del cliente. SQL no identifica de forma suficiente la rama Neon: contrastar endpoint con Dashboard. No registrar DSN o parámetros secretos junto con diagnósticos.

No ejecutar ciegamente scripts/postgres/integration.ts contra development: crea su propio laboratorio por diseño y contiene pruebas de alteración de checksum, privilegios, terminación y CREATEDB. En Neon se debe preparar un runner remoto separado/revisado, fixtures con IDs propios y respaldo, limpieza limitada a esas fixtures o una rama desechable adicional aprobada. Si Free o permisos impiden una prueba, marcarla bloqueada; no usar production ni conceder SUPERUSER/BYPASSRLS/runtime DDL. No confundir node-pg-pool local con validación de PgBouncer remoto.

## Referencias y decisiones pendientes

[Roles Neon](https://neon.com/docs/manage/roles), [pooling](https://neon.com/docs/connect/connection-pooling), [conexión segura](https://neon.com/docs/connect/connect-securely), [branching](https://neon.com/docs/introduction/branching).

La documentación pública de roles, consultada el25/11/2026 y actualizada el19/11/2026, distingue roles creados por Console/API (miembros de neon_superuser) de los creados mediante SQL con privilegios básicos. También describe roles por rama y su copia al crear una rama hija. Esto informa el diseño; **no demuestra los privilegios efectivos del proyecto concreto**. Antes de ejecutar SQL, contrastar development/endpoint y membresías reales; preferir creación SQL revisada de runtime/migrador, sin heredar neon_superuser. NOINHERIT no basta si existe posibilidad de SET ROLE: el laboratorio ya prueba ese caso. El bootstrap local no debe trasladarse ciegamente a un administrador gestionado con restricciones diferentes.

La autorización futura debe aprobar endpoint/roles, CA/política CB, bootstrap y backups, ámbito de pruebas destructivas, límites Free y procedimientos de recuperación. No se solicita ahora ninguna credencial ni se habilitan cuentas financieras mediante Auth0.
