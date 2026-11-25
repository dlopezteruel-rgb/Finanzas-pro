# Recuperación planificada, no ejecutada en Neon

Se conserva el procedimiento de 7B.2A. Historial de Neon, copia independiente, snapshot y restauración no son equivalentes. Las seis horas comunicadas del proyecto no garantizan seis horas recuperables bajo cualquier carga; la página pública de Free consultada en 7B.2A indica también un límite de cambios. Confirmar condiciones vigentes en Dashboard y [pricing](https://neon.com/pricing) antes de cualquier ensayo. No se consulta ni cambia el plan del proyecto en esta entrega.

## Autorización separada necesaria

Una aprobación para diagnosticar o migrar development no autoriza restauraciones, reset de ramas, creación/borrado de ramas, limpieza de fixtures o cambios de plan. El runner no automatiza backup/restore. Production no se modifica, ni se utiliza como destino de ensayo. Si Free no permite un procedimiento, registrarlo bloqueado sin contratar capacidad.

## Backup independiente con datos ficticios

1. Confirmar ventana exclusiva y destino development mediante las mismas comprobaciones de control plane/allowlist. Registrar versión PostgreSQL, revisión de esquema, ledger/checksums, UUID/propiedades y hora de referencia; sin DSN o passwords en logs.
2. Acordar alcance y credencial de backup de mínimo privilegio. No conceder BYPASSRLS al runtime por comodidad ni exportar un subconjunto filtrado creyendo que es toda la base. Un backup global requiere un rol de mantenimiento autorizado y verificación de cobertura.
3. Usar pg_dump 18 oficial, formato custom, con TLS verify-full, require_auth=scram-sha-256 y channel_binding=require, contra el **host directo aprobado**. Credenciales por un mecanismo privado revisado, sin argumentos con secretos. No ejecutar pg_dumpall para capturar passwords/roles globales indiscriminadamente.
4. Ubicación privada fuera de directorios públicos/sincronizados. Verificar código de salida, tamaño y SHA-256; inspeccionar el índice con pg_restore --list sin publicar contenidos. Un hash no cifra el archivo.
5. Cifrar una copia retenida con herramientas contrastadas y gestión de claves aprobadas, independiente del fallo del proveedor. No se implementa un formato criptográfico propio ni se confunde con JSON financiero 3.5.

Comandos de **referencia** para revisar tras autorización (parámetros de conexión/seguridad sólo mediante configuración privada, no se ejecutan ahora):

```powershell
& $PgDump --format=custom --file=$PrivateDump --no-password
Get-FileHash -Algorithm SHA256 -LiteralPath $PrivateDump
& $PgRestore --list $PrivateDump
```

El stdout de pg_restore --list puede contener nombres de objetos; no publicarlo sin revisar. El backup no contiene datos financieros reales porque este entorno sólo admite fixtures.

## Restauración en una rama desechable distinta

1. El propietario aprobará **otra rama y endpoints**, creados para restauración. Requiere su propia allowlist; no basta que el nombre contenga restore. No reutilizar production ni sobrescribir development.
2. Registrar inicio, versión y estado vacío/revisado de destino. Inspeccionar el dump y preparar roles de mantenimiento/runtime separados con SQL revisado; no heredar neon_superuser por crear runtime desde Console/API.
3. Restaurar con pg_restore 18 en transacción cuando el alcance lo permita. No usar --clean/--create ni eliminar recursos existentes sin autorización específica. Conservar origen y backup ante errores.
4. Comparar todas las tablas de metadatos normalizadas: identidades issuer/sub, UUID, ownership, revisiones, recibos y eventos. Comprobar claves/FKs, ledger, propietario de objetos, permisos efectivos, ENABLE/FORCE RLS y pruebas A/B con login runtime real. Una restauración terminada no demuestra por sí sola aislamiento correcto.
5. Medir RTO hasta completar esas verificaciones, no sólo hasta que pg_restore termine. Medir RPO comparando el último estado recuperable con la referencia confirmada. Documentar errores, omisiones y limitaciones del plan.
6. La eliminación posterior de la rama o archivos requiere revisión/alcance específico y sólo debe afectar a recursos propios de la prueba. No ejecutar limpieza automática al fallar ni borrar evidencias necesarias para investigar.

## Objetivos y límites

Se mantienen como propuestas de 7B.2A: desarrollo ficticio RPO <=1 hora/RTO <=60 minutos; futura producción RPO <=15 minutos/RTO <=60 minutos, sujetos a arquitectura, plan, personal y ensayos aprobados. No están demostrados en Neon, no son un SLA y no se activan tareas periódicas en esta PR.

Free no se considera aprobado para producción. Revisar consumo CU-h, almacenamiento, conexiones, egress, suspensión/cold start, retención, tamaño de cambios, snapshots, seguridad de red, DPA/residencia y soporte. La región Frankfurt no certifica residencia de todo dato operativo. La ausencia de IP restrictions exige especial protección de credenciales, sin prometer aislamiento de red.

La restauración de IndexedDB/SQLCipher y los backups financieros históricos siguen separados y sin modificaciones. No se migra un perfil local a Neon, no se cambia JSON 3.5 y no se suben datos del navegador durante estos procedimientos.
