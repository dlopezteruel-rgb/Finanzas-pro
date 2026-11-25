# SQL y operaciones previstas para etapa B

**No ejecutadas en Neon.** Obtener aprobación del propietario antes de cualquier GET de gestión, conexión o SQL remoto. Production no es destino válido. No ejecutar el harness local en Neon: crea clústeres propios y contiene controles de fallo que sólo pertenecen al laboratorio.

## Revisión del destino y de las operaciones

`npm run neon:plan` imprime alcances y hashes actuales. `node --import tsx scripts/neon/runner.ts sql <admin-preflight|bootstrap|migrate|privileges>` permite revisar el SQL exacto sin credenciales. El registro `server/neon/approved.ts` sigue con target/planHash nulos y listas vacías. La aprobación requiere IDs públicos reales revisados, hosts direct/pooled exactos, neondb, Frankfurt y planHash. No incorporar passwords/API keys a ese registro.

GET previstos, siempre desde servidor/runner autorizado y no desde React:

```text
https://console.neon.tech/api/v2/projects/{approved_project_id}
https://console.neon.tech/api/v2/projects/{approved_project_id}/branches/{approved_branch_id}
https://console.neon.tech/api/v2/projects/{approved_project_id}/endpoints
```

No se crean ramas ni se actualiza configuración. Deben coincidir los datos de esos GET con la selección independiente development del Dashboard. Si una limitación del plan, permiso o forma de respuesta impide verificarlo, marcar bloqueado, sin ampliar privilegios.

## Roles y bootstrap específico

SQL: [bootstrap.sql](../../server/neon/sql/bootstrap.sql), ejecutable por neondb_owner únicamente en conexión directa revisada.

- Crea finanzas_migrator y finanzas_runtime como **NOLOGIN, NOINHERIT, NOSUPERUSER, NOBYPASSRLS, NOCREATEDB, NOCREATEROLE y NOREPLICATION**, sin membresías. No crea contraseñas.
- Si los roles existen con atributos/membresías incompatibles, aborta. No los repara automáticamente ni rota credenciales. Una membresía con INHERIT false todavía puede permitir SET ROLE; se rechaza también.
- Revoca CREATE público y permisos PUBLIC de neondb; concede CONNECT/CREATE al migrador y sólo CONNECT al runtime. Esta operación puede afectar a otros consumidores de development: comprobar su ausencia antes de aprobarla.
- Rechaza ownership runtime de bases, esquemas, relaciones o funciones y permisos CREATE/TEMP inesperados. Todo el bootstrap ocurre en una transacción con advisory lock.

La documentación Neon describe roles por rama, copiados al crear ramas hijas. Console/API pueden añadir neon_superuser; para runtime/migrador se usa SQL revisado, no esas interfaces. Es documentación pública, no inspección de membresías del proyecto. El admin local SUPERUSER de los tests no equivale al administrador gestionado Neon. Si el admin gestionado no puede ejecutar una instrucción, detenerse; no convertir runtime en administrador.

El propietario configura passwords mediante `psql \password` interactivo y activa LOGIN sólo después de revisar las credenciales. Es una operación manual separada y sujeta a aprobación. No guardar passwords en SQL, argumentos de proceso o transcripciones. Repetir bootstrap preserva un LOGIN/password existente seguro.

## Migraciones

El plan generado por migrationPlan utiliza el **mismo archivo 001_registry.sql** y checksum de 7B.2A, no un segundo esquema financiero. Exige finanzas_migrator en neondb, conexión directa, transacción, advisory_xact_lock, owner correcto, ledger y checksums. Repetición/concurrencia no duplica objetos. Esquema preexistente sin ledger, versión inesperada o checksum alterado abortan sin borrar ni reparar datos.

Tras aplicar se comprueban siete tablas ENABLE/FORCE RLS y el ledger privado. El diagnóstico [privileges.sql](../../server/neon/sql/privileges.sql) examina atributos, membresías transitivas (incluido SET), ownership, DDL, CREATE/TEMP, permisos efectivos de tablas/columnas y funciones SECURITY DEFINER ejecutables. Runtime no puede cambiar propietarios ni identidades. La interfaz exige el login esperado; usar una URL admin como runtime no satisface el contrato.

## Runner preparado

La implementación de `stageBCommand` y `preparedValidation` está detrás de la puerta de etapa A. Se han ejercitado los escenarios SQL contra PostgreSQL local real; la ruta de transporte Neon, sus credenciales y su API **no se han ejecutado**.

Comandos de referencia **sólo después de aprobación y del cambio revisado de puerta/registro**:

```powershell
npm run neon:run -- --operation control-plane-read
npm run neon:run -- --operation connect-admin --secrets .secrets/neon-7b2a1/connections.json --psql $Psql
npm run neon:run -- --operation bootstrap --secrets .secrets/neon-7b2a1/connections.json --psql $Psql
npm run neon:run -- --operation migrate --secrets .secrets/neon-7b2a1/connections.json --psql $Psql
npm run neon:run -- --operation connect-diagnostics --secrets .secrets/neon-7b2a1/connections.json --psql $Psql
npm run neon:run -- --operation fixtures --secrets .secrets/neon-7b2a1/connections.json --psql $Psql
```

Bootstrap es anterior a la configuración manual de passwords/LOGIN; migrate y diagnóstico completo requieren que el propietario haya completado ese paso. Las cuatro URLs pueden prepararse con passwords elegidos en un gestor antes de crear los roles; no se prueban los logins inexistentes durante bootstrap. No ejecutar todos los comandos de una vez sin revisar cada resultado.

connect-admin permite comprobar login, base, propiedad y PostgreSQL 18 en una transacción READ ONLY antes de crear roles o esquema. No requiere que runtime/migrador existan y no realiza DDL. Bootstrap repite esta comprobación antes de su SQL. connect-diagnostics es el ensayo completo posterior a provisión/migración, no un sustituto de ese primer diagnóstico.

Los escenarios usan UUID y nombres 7B2A1-FICTIONAL, identidades bajo 7b2a1-fixtures.invalid, perfiles y recibos exclusivamente ficticios. Cubren A/B, ausencia de contexto, WITH CHECK (SQLSTATE 42501), conexiones directas/pooled, transacciones COMMIT/ROLLBACK, CAS concurrente (40001), idempotencia y reconciliación de respuesta incierta. No se escriben documentos financieros.

El ensayo de contexto retiene pg_backend_pid y actor en cinco observaciones. Exige observar el mismo backend después de un actor y después sin contexto; si el pool no permite observar reutilización, no lo presenta como aprobado. Debe revisarse una ampliación acotada del ensayo, sin afirmar una fuga ni elevar privilegios. En local se trata de una sesión directa, no de PgBouncer; la misma secuencia debe ejecutarse y documentarse sobre el host pooled real en B.

Antes de cada propuesta se registra su ID/fingerprint en un journal local de diagnóstico con flush; esto no demuestra un commit remoto. Un fallo conserva incertidumbre y bloquea repetición automática. La prueba de respuesta incierta usa un COMMIT real seguido de un error determinista antes de confirmar al caller; no equivale a una caída real de red o de energía. Si el proceso o el informe falla, no se repite la operación: consultar recibos/IDs del journal, detener escrituras si no puede reconciliarse.

No hay limpieza automática tras error. La operación cleanup-fixtures requiere aprobar aparte el hash de las fixtures del informe y añadirlo al registro revisado. Se verifica plan/target/hash y se borra únicamente el grafo marcado; un marker o dependencia inesperados abortan toda la limpieza. No se eliminan esquemas, tablas, ramas ni perfiles ajenos.

## Estados de validación al entregar etapa A

| Área | Estado |
| --- | --- |
| Planes SQL y escenarios en PostgreSQL 18 local/CI | Resultados verificables en la PR del SHA final |
| Allowlist/control plane | Contratos simulados y denegación ejecutable; proyecto real no consultado |
| Conexiones Neon directas/pooled, channel binding real | No ejecutado; puerta B bloqueada |
| Roles/migraciones/RLS en Neon | No ejecutado |
| PgBouncer real | No ejecutado; alias local no constituye prueba |
| Backup/restauración remota | No ejecutado; requiere autorización adicional |
| Datos financieros mediante Auth0 | Bloqueado; fuera del alcance |
