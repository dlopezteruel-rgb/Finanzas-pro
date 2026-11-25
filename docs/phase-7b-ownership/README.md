# 7B.1 — Identidad estable, propiedad y autorización financiera

Base: `ebcbefb24ec831c2b9a4a8ee19ac69d0269d13cb`, merge de PR #36 confirmado en GitHub. Rama: `feature/phase-7b1-ownership-foundation`, creada desde origin/main en un worktree nuevo y limpio. No se modifica main ni PR #34. Auth0 sigue siendo el proveedor aprobado.

## Estado revisable

Se entregan contratos TypeScript y un evaluador de reglas **sin acceso financiero**, pruebas de contratos, arquitectura y propuesta de esquema PostgreSQL. No hay conexión DB, aprovisionamiento, middleware de autorización activo, migración ni sincronización. Incluso un resultado `eligible-in-model` lleva `financialAccess:false` y exige enforcement transaccional posterior. Los módulos nuevos sólo son importados por pruebas, nunca por React o las rutas Express activas. No hay cambio de UI.

Se revisaron los contratos de 7A.1, Auth0 7A.2 y la persistencia 5H. Las pruebas manuales comunicadas por el propietario el 24–25/11 sobre correo/sesión son evidencia de autenticación, no de propiedad financiera, aislamiento DB o revocación global. La sesión BFF sigue proyectando applicationSubject=null y financialAccess=false. No se habilitan datos reales mediante Auth0.

- [Arquitectura, modelos y transacciones](architecture.md).
- [Comparativa de bases y recomendación](database.md).
- [Esquema propuesto, NO aplicado](proposed-schema.sql).
- [Auditoría de accesos y cierre seguro](access-audit.md).
- [Amenazas, controles y pruebas](threats-validation.md).

## Inventario y riesgos

Añadidos server/ownership/contracts.ts, planner.ts y planner.test.ts; registro de sus pruebas en src/tests.ts; esta documentación. Sin dependencias, workflows o cambios financieros. FinanceStore, IndexedDB strict, Web Locks, CAS, recibos, copias, SQLCipher, JSON 2.5–3.5, importaciones y demo deshabilitada permanecen intactos.

Riesgo principal todavía abierto: el producto local heredado permite acceder al perfil del origen/dispositivo sin identidad. Estas pruebas no lo cierran. Antes de beta financiera hacen falta autorización real, ownership validado, namespaces y revocación comprobada. Cerrar únicamente /app en Express no protegería un IndexedDB ya accesible en el navegador. Tampoco una política RLS propuesta constituye aislamiento real.

## Decisiones para 7B.2

Aprobar motor y versión soportada de PostgreSQL, alojamiento/región europea y residencia efectiva, presupuesto, DPA/subencargados, backups/PITR/RPO/RTO y custodia de credenciales. Aprobar alcance de identidad/provisionamiento, política de revocación persistente y procedimiento de cierre del acceso heredado preservando recuperación local. Autorizar un entorno aislado con datos ficticios para verificar roles, RLS, concurrencia y recuperación en PostgreSQL real.

La recomendación técnica no autoriza contratar o crear un servicio. No hay decisiones externas necesarias para ejecutar los contratos actuales. Account Linking sigue pendiente de plan/aprobación y prueba de control de ambas identidades; no se usa coincidencia de correo. No se crean cuentas anónimas ni invitados.

7B.2 debe implementar y probar el registro y enforcement de metadatos antes de cualquier habilitación financiera. **7C** se reserva para transporte de documentos financieros, sincronización offline, reconciliación entre dispositivos e idempotencia distribuida. Ninguna fase reclama automáticamente perfiles locales.

La descripción de la única PR Draft de esta rama será el registro final de SHA, resultados locales, CI del SHA correspondiente y limitaciones. Los resultados históricos de main no se presentan como pruebas actuales. No fusionar, desplegar, distribuir ni sincronizar Google AI Studio.
