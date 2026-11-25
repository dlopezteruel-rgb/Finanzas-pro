# Operación, backups y recuperación

## Qué se ha demostrado y qué no

El laboratorio crea un dump PostgreSQL custom-format con cliente18 y TLS verify-full, restaura en otra base ficticia y compara UUID/etiqueta/revisión y propietario. No modifica la base original ni restaura sobre ella. El dump se elimina junto con el laboratorio propio; no se sube como artefacto ni es una exportación financiera JSON. Roles globales/contraseñas no se incluyen mediante pg_dumpall. La CI publica sólo resultados, versiones, checksums y flags de privilegios.

No se ha probado un backup, restore de rama, PITR o cambio de teléfono en Neon. El historial de6horas es configuración comunicada por el propietario, no una prueba de recuperación ni un RPO. Una ventana de historial no equivale a un backup independiente o a protección ante compromiso/eliminación del proyecto.

## Procedimiento remoto futuro, sujeto a aprobación

1. Confirmar development, consumidores ausentes y sólo datos ficticios. Registrar revisión de esquema/checksums y dueño del backup. Fijar RPO/RTO y alcance de la operación.
2. Generar dump consistente con pg_dump18, TLS verificando servidor, credenciales de respaldo de mínimo privilegio aprobadas y ubicación privada. Preferir service/pgpass protegido600 o gestor secreto; nunca contraseña en URL de comando, shell history o logs. Comprobar salida0, tamaño no vacío y checksum SHA256. El checksum detecta cambios, no cifra el contenido.
3. Cifrar el backup con herramientas contrastadas/gestión de claves aprobadas antes de retener o transferir fuera del equipo autorizado; copia fuera del mismo fallo del proveedor. Esta PR no implementa un contenedor cifrado propio ni sincronización.
4. Restaurar primero en entorno/DB/rama ficticia **separada y autorizada**. No usar production ni sobrescribir development como ensayo. Preparar roles revisados sin importar contraseñas globales automáticamente.
5. Verificar constraints, ledger/migraciones, recuentos, hashes normalizados de metadatos, UUID/bindings/owner, privilegios y RLS con runtime. Registrar duración observada y puntos recuperables. No declarar recuperación por disponer sólo del archivo o porque pg_restore acabó sin error.
6. Si falla, conservar origen y backup; no borrar/recrear perfiles. Una restauración con efectos reales requerirá autorización explícita y plan de vuelta. Borrar sólo temporales propios, nunca archivos ajenos o perfiles personales.

La recuperación histórica financiera web (IndexedDB strict/copias/forense) y nativa (SQLCipher) continúa separada; introducir PostgreSQL no migra sus documentos ni cambia JSON3.5 o formatos2.5–3.5. No restaurar archivos recibidos automáticamente ni atribuir su propiedad al usuario autenticado.

## Objetivos propuestos, no compromisos aprobados

| Uso | RPO propuesto | RTO propuesto | Condición |
| --- | --- | --- | --- |
| Desarrollo ficticio | <=1h | <=60min | Dump independiente, ensayo y disponibilidad de herramientas; aún no establecido como servicio periódico |
| Producción futura | <=15min | <=60min | Plan/arquitectura aprobados, backups/PITR independientes, alertas, personal/automatización y ensayos reales; no habilitado con esta PR |

El ensayo local corto no demuestra cumplir esos objetivos ante caída de proveedor, región o pérdida de credenciales. No se han creado schedules, servicios de backup o recursos remotos.

## Free: consumo, costes y criterios de exclusión de producción

El plan aprobado es Free, exclusivamente desarrollo ficticio; no se activa facturación ni upgrade. Confirmar en Dashboard y [pricing oficial](https://neon.com/pricing) los límites vigentes de compute CU-h, almacenamiento, ramas, conexiones, transferencia, suspensión, historial, soporte/SLA y funciones de seguridad. No se fijan cuotas/precios no comprobados ni se garantiza que Free cubra una carga futura. Registrar consumo e incidencias sin datos personales; si se alcanza un límite, detener la prueba o marcarla bloqueada, sin comprar capacidad automáticamente.

No considerar Free apto para producción si no satisface retención ante incidentes detectados después de6h, backup independiente, RPO/RTO, capacidad/concurrencia, cold start y disponibilidad, controles de red/identidad requeridos, residencia de réplicas/logs/backups/soporte, DPA/retención y recuperación ensayada. La región Frankfurt no certifica por sí sola residencia de todos los datos operativos. Sin restricciones IP configuradas, la protección de credenciales y privilegios es especialmente relevante; no se cambian políticas remotas en esta fase.

[PITR/restauración Neon](https://neon.com/docs/introduction/point-in-time-restore), [PostgreSQL backup](https://www.postgresql.org/docs/18/backup.html). Verificar condiciones comerciales/operativas antes de cualquier aprobación productiva; ninguna prueba local/CI sustituye esa verificación.
