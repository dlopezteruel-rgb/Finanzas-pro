# Validación y procedencia

## Batería PostgreSQL real

scripts/postgres/integration.ts ejecuta23casos (24resultados Node incluyendo el padre) contra PostgreSQL18 real. Usa logins admin, migrador y runtime separados con TLS; A/B son fixtures, no usuarios Auth0 reales.

Incluye certificado/cadena/hostname y rechazo plaintext, privilegios/membresías/ownership efectivos, ENABLE/FORCE, contexto ausente/inválido, denegación A/B y WITH CHECK, pares únicos issuer/sub sin email, FKs/revisiones, pool reutilizado tras commit/rollback, CAS+recibo+evento atómicos y replay, dos escritores SERIALIZABLE, rollback, terminación de backend propio, repetición/concurrencia de migraciones, checksums/versión desconocidos, conexión fallida genérica, drift DDL/membresías, actor deshabilitado y dump/restore separado.

El caso que cambia manualmente GUC de A a B con credenciales DB es **una demostración de frontera de confianza**, no resistencia frente a servidor comprometido. La elección de actor por servidor verificado se integrará en2B; no se afirma haberla validado remotamente.

## Preparación y fallos conservados

Docker local con VFS falló dos veces al extraer imagen por cuota; no se convirtió en éxito ni se eliminó ningún worktree. Se liberaron sólo caché pública npm y transformaciones Gradle regenerables; se conservaron fuentes, SDK, dependencias originales y evidencias. La prueba local se ejecutó con PG18.7 Debian verificado por índices firmados/checksums. La imagen Docker oficial fijada se utiliza en CI con resultado propio.

La primera ejecución pasó20casos de datos pero el padre falló por cerrar servidor antes de clientes. Se conservan log/reporte de preparación; se corrigió cleanup y el informe ahora sólo marca éxito tras limpieza completa. Se añadieron tres casos reales de drift/actor deshabilitado, sin quitar anteriores.

La batería unitaria detectó el hash protegido de ci.yml al añadir el job requerido. Se rebaselinea exclusivamente esa huella con anotación; una prueba nueva exige que **todo el workflow anterior** siga byte-idéntico antes del job añadido. Los otros43 archivos protegidos no cambian, ni sus aserciones. El inventario AST se regenera por el import de pruebas servidor, sin añadir superficies visibles.

No se instalan nuevos frameworks. pg8.23.1 y @types/pg8.23.1 añaden14entradas al lock; se verifican versiones/resolved/integridades anteriores sin cambios. Dependencias locales reutilizadas mediante hardlinks y nuevas dependencias instaladas en staging con versiones concordantes; no se afirma npm ci local limpio. CI exige npm ci en todos los jobs. Se registran npm audit y bundle real por separado, sin ocultar alertas.

## CI y límites

Se preservan los tres checks obligatorios, sus46suites/1044resultados de referencia, puertas de identidad/Auth0/SIGKILL y axe. El presupuesto Chromium sigue50min. Se añade un job independiente PostgreSQL18/RLS con10min, Docker oficial por digest y gate de informe/SHA limpio. No usa secretos Neon ni URLs del propietario. No hay continue-on-error, reintentos automáticos ni omisiones presentadas como éxito.

El artefacto PG contiene fuente/dirty flag, versiones,23casos, roles/checksums y cleanup; postgresReal=true, neonTested=false y financialAccess=false. Se rechazan informes simulados, incompletos, remotos atribuidos a local o con runtime/migrador elevados. Un fallo de inicialización, test o cleanup falla realmente el job, aunque otros casos hayan pasado.

Los números definitivos de unitarias/infraestructura/Chromium/PG, checks y duraciones corresponden al SHA publicado y se registran con enlaces/digests en la descripción de la única PR Draft. La referencia de main (831unitarias,54infraestructura,1044Chromium) no prueba la nueva rama. Los58conjuntos axe incompletos siguen pendientes de revisión contextual; no hay pruebas con lectores de pantalla/dispositivos físicos.

PostgreSQL real local y Docker CI se distinguen; **Neon, PgBouncer Neon, roles administrados, historial y restauración remotos no ejecutados**. Android/iOS/runtime físico no se prueban de nuevo por introducir metadatos de servidor; SQLCipher Linux, cuando se ejecute, sólo prueba ese motor. No se habilitan datos reales móviles o financieros mediante Auth0.

## Inventario

server/postgres/{config,database,metadata,privileges,migrate,config.test}.ts; migración001; scripts/postgres/{lab,integration,verify}.ts; gate y tests CI; nuevo job workflow; package.json/lock; config/postgres.env.example; import de tests; inventario AST/huella workflow revisados; documentación de esta fase. No cambios en FinanceStore, cálculos, prompts/API del asistente, Auth0, persistencia web/nativa, formatos financieros, rutas activas o PR#34.

## Comandos

```bash
npm ci
npm test
node scripts/ci/run-check.mjs tools
npm run lint
npm run build
npm run test:postgres
node --import tsx scripts/postgres/verify.ts
CHROMIUM_PATH=/ruta/chromium npm run test:ui
npm run audit:bundles
npm audit --json
git diff origin/main...HEAD --check
```

Para binarios locales usar PG18_BIN, PG18_SHARE y PG18_LIB según README. El verificador exige SHA limpio, por lo que los checkpoints de preparación dirty no equivalen a la evidencia final de CI.

## Checkpoint local antes de publicar

849/849 unitarias, 56/56 infraestructura, 24/24 resultados PostgreSQL real (23casos y padre), lint/build/diff correctos. npm audit completo: código0 y0alertas. Bundle inicial141263bytes gzip; ningún módulo PG en el grafo web. Estos resultados corresponden a fuentes de trabajo aún sin commit; la CI del SHA final se registra aparte en la PR.

CI45667168011 del checkpoint758f588: Unitarias y Lint/build/diff pasaron, pero el job PostgreSQL falló antes de los casos por inicialización Docker. El script HBA se copiaba root700, ilegible para postgres; se fija modo755 y se añade diagnóstico por fase/señales cerradas, sin logs crudos ni credenciales. La ejecución anterior no se presenta como aprobada. La CI vuelve a ejecutar el código corregido, sin aumentar tiempos ni omitir casos.
