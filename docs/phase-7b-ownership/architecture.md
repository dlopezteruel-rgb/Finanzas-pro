# Arquitectura propuesta

```mermaid
flowchart TD
  A[Auth0: issuer y sub verificados] --> B[BFF: sesión y revocación vigentes]
  B --> C[Registro estable UUID de aplicación]
  C --> D[Transacción: perfil y propietario verificados]
  D --> E[Autorización por acción + CAS + recibo + auditoría]
  E --> F[Commit confirmado antes de comunicar éxito]
  L[Perfil local no adjudicado] -. Sin migración en 7B.1 .-> X[Recuperación explícita preservada]
```

Este es un diseño futuro. El código 7B.1 no conecta estas flechas a las rutas de producción. El evaluador puro sólo describe elegibilidad en el modelo; nunca concede una capacidad utilizable.

## Modelo e identidad

| Entidad | Clave y revisiones | Regla |
| --- | --- | --- |
| Usuario | UUID v4 aleatorio asignado en servidor; revisión y authorization_epoch | Independiente de correo, Auth0 sub o dispositivo; no aceptar UUID elegido por navegador |
| Identidad externa | UNIQUE(issuer, subject), usuario FK y revisión | Par exacto de claims verificados por SDK; sin normalizar sub ni deducir método/cuenta del correo |
| Perfil | UUID aleatorio, estado y revisión de metadatos | No es un ID de cartera ni una nueva versión JSON financiera |
| Propietario | Una fila por perfil, FK usuario/perfil y revisión | Un propietario inicialmente; no activar miembros/roles de compartición sin diseño autorizado |
| Evento | ID de operación/decisión, acción, actor y recurso seudónimos, revisión, resultado y fecha servidor | Sin secretos, correos, payload financiero, prompts o tokens |

Un usuario puede tener varias identidades sólo tras un procedimiento autorizado de vinculación y control de ambas; un correo coincidente no crea ni une filas. Provisión futura: generar UUID de servidor y crear usuario+binding en una sola transacción serializable, releyendo UNIQUE(issuer,subject). Dos callbacks del mismo sujeto deben obtener la misma fila confirmada; un conflicto de revisión aborta/reconcilia, no crea otro usuario ni reasigna binding. No se aplica este procedimiento en 7B.1.

La sesión debe obtener issuer/sub del SDK verificado, nunca del cuerpo HTTP ni de un ID token decodificado por el navegador. UUID interno se resuelve en registro confiable. Sujeto no provisionado, usuario deshabilitado, sesión caducada/revocada, epoch obsoleto o DB inaccesible => denegar. Las cookies stateless de 7A.2 no resuelven por sí solas revocación global: falta un mecanismo persistente/oficial cuya vigencia se verifique al autorizar.

## Enforcement futuro y atomicidad

1. Validar sesión actual y petición con acción permitida; el navegador sólo propone recurso, operación y revisión, no actor/owner.
2. En una transacción, resolver binding/usuario y verificar revocación vigente. Bloquear filas relevantes en orden estable (usuario, perfil, propietario) para que revocación, cambio de owner y operaciones compartan exclusión.
3. Denegar por defecto; comparar owner real con usuario resuelto y revisión del perfil. Leer/exportar requiere autorización igual que escribir/restaurar; no existe bypass de diagnóstico o recuperaciones remotas.
4. Para mutaciones futuras, comprobar recibo de idempotencia ligado a actor+perfil+acción+fingerprint. Reutilizar operación con otro contenido/actor debe fallar. Aplicar CAS dentro de la misma transacción que la operación, recibo y evento de autorización.
5. Confirmar commit antes de publicar éxito. Resultado incierto => reconciliar recibo/revisión; no repetir una operación financiera ciegamente. Auditar fallos sin registrar información sensible.

Un plan calculado y liberado antes de consumirlo introduce TOCTOU: está prohibido como autorización posterior. RegistryRepository.serializable documenta la frontera, pero no tiene implementación DB en esta fase. Lecturas/exports futuras deben generar su snapshot bajo autorización transaccional; streams largos requieren política explícita de cancelación/revalidación, sin prometer borrar bytes ya entregados.

Los estados de autorización/modelo son independientes de los documentos financieros y de sus revisiones de IndexedDB/SQLCipher. Nunca cambiar IDs de carteras/movimientos ni separar extremos de transferencias, préstamos, reintegros, presupuestos aprobados o fotografías por introducir ownership. No recalcular ni normalizar importes. La revisión de ownership se compara además de la financiera, no la sustituye.

## Navegador compartido y datos existentes

Logout/cambio de cuenta invalida inmediatamente proyecciones y solicitudes pendientes (generación+AbortController); una respuesta tardía de A nunca se publica en B. B no hereda cachés, objetos React, descargas, selección ni una instancia de almacenamiento de A. El servidor verifica de nuevo la identidad efectiva; la generación JS no es autorización. No borrar perfiles, copias o claves al salir de sesión.

Los perfiles locales actuales permanecen no adjudicados. En 7B.1 no se leen para descubrir usuario ni se reclaman, suben o asocian. Una futura transición necesitará vista previa, reautenticación, consentimiento explícito ligado a digest/revisión, copia recuperable verificada, binding transaccional/idempotente y reconciliación. En un equipo compartido, poder leer una base local no prueba su propiedad. Cancelar/fallar conserva el origen. La adopción local y la sincronización requieren alcance y autorización posteriores, sin implementarlas aquí.

Los contactos y participantes de gastos compartidos no son cuentas autenticadas ni ACL: no asociar automáticamente sus nombres o correos a usuarios Auth0. El perfil conserva sus vínculos e importes originales. Un cambio de issuer/dominio del proveedor exige un procedimiento de continuidad verificado; no unir sujetos sólo por coincidir sub o correo. El esquema propone colación C para comparar issuer/sub exactamente.
