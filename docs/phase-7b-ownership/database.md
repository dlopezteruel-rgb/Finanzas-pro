# Evaluación de base de datos — sin aprovisionamiento

Auth0 permanece como IdP; esta comparación trata persistencia y autorización de aplicación, no vuelve a comparar proveedores de identidad.

| Alternativa | Aislamiento/atomicidad | Recuperación/operación | Costes y región |
| --- | --- | --- | --- |
| PostgreSQL gestionado | Transacciones, UNIQUE/FK/CAS, RLS por fila y roles separados; encaja con registro y ownership | Backups/PITR y HA dependen de plan; menor operación que autogestión; probar restore | Recomendado. Evaluar consumo, conexiones, almacenamiento, egress y PITR; región UE y residencia de backups/logs por verificar antes de contratar |
| PostgreSQL autogestionado en UE | Mismas capacidades de motor; roles/superusuario bajo control propio | Parches, TLS, claves, monitorización, HA, PITR y ensayos de recuperación a cargo del equipo | Coste operativo significativo además del servidor; no es gratis por ser software libre |
| SQLite/SQLCipher servidor | Transacciones ACID y constraints, sin RLS de PostgreSQL; un fichero exige disciplina de autorización en cada acceso | Backups consistentes y concurrencia multiproceso deben diseñarse; escalado servidor más limitado | Adecuado al almacenamiento local nativo existente, no se recomienda como registro remoto multiusuario compartido |
| Firestore/documental gestionada | Reglas y transacciones con modelo diferente; invariantes relacionales y ownership requieren diseño específico | Herramientas/planes de backup y modelo de conflictos distintos | No elegida: complejidad adicional y costes por operaciones; no confundir sus reglas con RLS PostgreSQL |

**Recomendación:** PostgreSQL gestionado con versión soportada, TLS, roles de mínimo privilegio y RLS como defensa adicional. No se elige proveedor, plan, versión exacta, región contratada ni dominio. Supabase Database, Neon o un servicio PostgreSQL europeo equivalente pueden evaluarse sin sustituir Auth0; un nombre comercial no certifica residencia o aislamiento. No se citan precios fijos ni disponibilidad de funciones en Free sin comprobar el plan concreto.

## Roles y RLS

- Administrador/migrador separado del rol runtime, sin credenciales en React, APK/IPA o Git. Runtime sin SUPERUSER, BYPASSRLS, ownership de tablas, DDL o privilegios para transferir titularidad/provisionar arbitrariamente.
- ENABLE y FORCE ROW LEVEL SECURITY; ninguna política implica denegación. Políticas de lectura y escritura independientes y WITH CHECK en mutaciones. Vistas/funciones SECURITY DEFINER pueden eludir controles: evitarlas o auditar search_path/propietario/EXECUTE explícitamente.
- El actor se resuelve por issuer/sub verificados y registro, no por un JWT de navegador usado como claim DB. No exponer SQL ni credenciales del rol runtime a clientes.
- Si se usa SET LOCAL de contexto de actor, sólo el BFF confiable lo establece dentro de la transacción. Un custom GUC no autentica a quien posee las credenciales DB: no presentarlo como defensa frente a compromiso del BFF. Probar reset de contexto en pool, rollback, conexiones reutilizadas y ausencia de contexto.
- Las políticas concretas de acceso no se activan en la propuesta SQL: todas las tablas quedan sin políticas permisivas. Su futura implementación requiere pruebas reales con los roles exactos, no sólo tests como superusuario ni mocks.

## Fuentes técnicas y verificación pendiente

- [PostgreSQL RLS y excepciones de propietarios/superusuarios](https://www.postgresql.org/docs/current/ddl-rowsecurity.html).
- [Aislamiento transaccional y reintentos serializables](https://www.postgresql.org/docs/current/transaction-iso.html).
- [Backups/PITR](https://www.postgresql.org/docs/current/backup.html).
- [SQLite: usos y límites](https://www.sqlite.org/whentouse.html).
- [Firestore: transacciones](https://firebase.google.com/docs/firestore/manage-data/transactions).

Se usan estas referencias para el diseño; no se ejecutó aislamiento en PostgreSQL ni se verificó una oferta comercial, coste o residencia efectiva de un servicio. Esos puntos requieren aprobación del propietario. Antes de 7B.2 fijar RPO/RTO, retención y restauración de backups, región de réplicas/logs/soporte, cifrado/KMS, rotación de credenciales, DPA y borrado/exportación de cuenta. Perder el proveedor Auth0 no debe reasignar UUID ni perfiles; exportar/migrar bindings requiere un procedimiento auditado.
