# Pruebas, evidencia e inventario

## Estado inicial y procedencia

Base ba7dbb1d9d9a4732da918c89dc84baa9e4c11c5c verificada con PR #38 fusionada. Se inventariaron los quince worktrees previos y sus cambios antes de crear el nuevo. Se preservan main y PR #34. La preparación arquitectónica se publicó como checkpoint separado antes de implementar.

Baseline local repetida: 849 unitarias, 56 de infraestructura, lint y build correctos. La validación histórica de PR #38 (1044 Chromium/46 suites, SIGKILL y PostgreSQL) no equivale a prueba del código nuevo. La ejecución final se registra por SHA en la PR Draft y sus artefactos, sin atribuir a este código ejecuciones anteriores.

El entorno Linux no dispone de PowerShell/Windows. Docker local con VFS conserva la limitación de cuota documentada en 7B.2A; se usa PG18.7 real de los paquetes oficiales previamente verificados por índices firmados/checksums, sin modificar la instalación del sistema. CI ejecuta Docker oficial por digest. Ninguna de esas pruebas se presenta como Neon remoto.

No se añaden paquetes npm ni se modifica el lockfile. Por cuota, local reutiliza node_modules concordante con el lock mediante hardlinks; no se afirma un nuevo npm ci local limpio. Los cuatro jobs exigen npm ci limpio y sus resultados se comprueban separadamente. Los módulos nuevos no se importan desde Express activo ni React.

## Cobertura nueva

- Contratos unitarios: target exacto/branch/región, evidencia normalizada simulada, antigüedad/duplicados, DSN require, inyección de opciones, roles, flags que no desbloquean etapa B, cero llamadas HTTP/cliente desde cualquier entrada remota, imposibilidad de mint de capacidad por JSON, entorno PG aislado, argumentos sin secretos, errores SQLSTATE cerrados, planes/hashes, fixtures/markers, propuestas inmutables e incertidumbre/recibos.
- PostgreSQL/libpq reales: **21 casos, 22 resultados Node incluyendo el padre**. Cliente oficial require/verify-full/SCRAM; bootstrap NOLOGIN y repetición sin rotación; migración original y drift; privilegios efectivos; A/B; ausencia de contexto; WITH CHECK; CAS/concurrencia; idempotencia; rollback; fallo después de COMMIT y reconciliación sin repetición; CA/hostname/conexión fallida; membresías transitivas y SET ROLE; limpieza acotada/sentinel; runner independiente con alias locales y controles negativos password/trust bajo TLS.
- Los alias locales direct/pooled no prueban PgBouncer. El fallo tras COMMIT se inyecta con un error determinista de respuesta, no una caída real de red. Se conservan en la batería los SIGKILL reales previos para persistencia web.
- Dos tests de infraestructura exigen evidencia local completa, SHA limpio, política strict y flags negativos para Neon/PgBouncer/autorización remota. No se aceptan simulaciones como resultados del proveedor.

## Fallos conservados

La primera ejecución nueva pasó 18 de 20 casos pero fallaron dos diagnósticos por un paréntesis incorrecto en privileges.sql. Se conserva esa salida; se corrigió SQL y la ejecución posterior pasó completa. No se redujeron aserciones. Se añadió después el caso del runner independiente (21 escenarios actuales).

El inventario i18n detectó el nuevo import en src/tests.ts: se regenera sólo su fuente/conteo de import, sin añadir textos visibles. La huella protegida de ci.yml se actualiza exclusivamente por la ampliación autorizada del job PostgreSQL. Se conserva la prueba que exige byte a byte el prefijo con los tres jobs financieros originales, y los otros archivos protegidos permanecen intactos. Los fallos de preparación no se presentan como éxito final.

## CI y comandos reproducibles

Los cuatro controles permanecen: Unitarias; Lint/build/diff; Chromium/axe; PostgreSQL/RLS. El cuarto conserva sus 23 casos anteriores y añade el ensayo libpq y su gate. Presupuesto Chromium 50 minutos, PostgreSQL 10 minutos; sin reintentos automáticos, continue-on-error, eliminación de casos o reglas axe deshabilitadas.

```bash
npm ci
npm test
node scripts/ci/run-check.mjs tools
npm run lint
npm run build
npm run test:postgres
node --import tsx scripts/postgres/verify.ts
npm run test:neon:local
node --import tsx scripts/neon/verify.ts
CHROMIUM_PATH=/ruta/al/chromium npm run test:ui
npm run audit:bundles
git diff origin/main...HEAD --check
```

Para el laboratorio sin Docker definir PG18_BIN, PG18_SHARE y PG18_LIB según la documentación de 7B.2A. Ambos verificadores de evidencia exigen fuente limpia y SHA exacto; una ejecución dirty es preparación, no evidencia final de CI. El informe libpq declara stage=A, neonTested=false, pgBouncerTested=false, remoteAuthorized=false y financialAccess=false; el gate rechaza atribuciones distintas.

La descripción de la única PR Draft es el registro canónico del SHA final, URLs/estados/duraciones de sus cuatro jobs, números exactos, hashes de artefactos, SIGKILL, axe, SQLCipher Linux y limitaciones. Así se distingue la evidencia final de los checkpoints sin crear un ciclo de commits para escribir el propio SHA dentro del documento. La retención diagnóstica de artefactos es de siete días; el resumen/hashes quedan en la PR.

## Accesibilidad y plataformas

No hay cambios de interfaz. Se conservan cinco idiomas, temas, navegación y toda la batería Chromium. Cero violaciones axe automatizadas es el objetivo; los 58 conjuntos incompletos históricos siguen pendientes de revisión contextual, y el nuevo resultado se agrupa sin sumarlos como defectos distintos. No se afirma lector de pantalla o dispositivo físico.

SQLCipher Linux sólo comprueba ese motor, no Keystore/Keychain. No se ejecutan builds o runtimes Android/iOS de nuevo por esta preparación de servidor. Windows ACL/PowerShell/psql y Neon real permanecen no ejecutados. Todos los datos de laboratorio son ficticios; no hay conexiones al tenant Auth0 ni cambios en sus sesiones.

## Inventario de cambios

| Grupo | Archivos |
| --- | --- |
| Control de destino | server/neon/approval.ts, approved.ts, attestation.ts |
| Cliente y operaciones | server/neon/libpq.ts, fixtures.ts, validation.ts, privileges.ts, plans.ts, remote.ts |
| SQL | server/neon/sql/bootstrap.sql, privileges.sql; se reutiliza 001_registry.sql sin cambiarlo |
| Contratos unitarios | server/neon/preparation.test.ts; import en src/tests.ts |
| Runner/herramientas | scripts/neon/runner.ts, localClient.ts, libpq.integration.ts, verify.ts, Initialize-Secrets.ps1 |
| Evidencia CI | scripts/ci/neon-report.mjs, neon-report.test.mjs; ampliación del cuarto job |
| Fixture local | scripts/postgres/lab.ts: sólo capacidad de ensayos psql/reinicio de autenticación de su propio clúster |
| Configuración | config/neon-development.review.example.json, .gitignore y scripts package.json; lockfile intacto |
| Inventarios | docs/phase-5b-inventory.json y huella justificada de ci.yml en docs/phase-5g-protected-files.json |
| Documentación | Este directorio; decisión inicial y guías de seguridad, SQL, Windows, recuperación y validación |

No se modifican FinanceStore, cálculos, almacenamiento financiero, parsers de movimientos, JSON 2.5–3.5, prompts/API del asistente, Auth0, proyectos nativos o PR #34. Ninguna operación visual crea escrituras financieras.

## Checkpoint local de implementación, antes de publicar

873/873 unitarias, 58/58 de infraestructura, 24/24 resultados del PostgreSQL anterior (23 casos y padre), 22/22 del cliente libpq/planes nuevos (21 casos y padre), lint y build correctos. Son resultados de preparación con fuentes aún sin commit; no equivalen a la CI del SHA final. No hay omisiones o cancelaciones. Se mantiene separado el rechazo esperado de neon:run, que demuestra el bloqueo de etapa B y no un intento de conexión.
