# Amenazas, contratos y validación

## Matriz de controles

| ID | Amenaza | Control diseñado / prueba ejecutable | Límite pendiente |
| --- | --- | --- | --- |
| B01 | A lee/escribe/exporta/restaura u opera en B | Resolución de actor por binding y owner de perfil; cinco acciones denegadas en planner.test.ts | Enforcement y RLS en DB real |
| B02 | Navegador inventa userId/owner/issuer/sub | Petición con claves exactas; seis campos de autoridad rechazados; sustitución de profileId denegada | SDK/session adapter servidor + integración HTTP |
| B03 | Sesión ausente/caducada/revocada/no provisionada | Denegación, deadline exacto, epoch y binding vigente | Revocación persistente real; cookie por sí sola insuficiente |
| B04 | Mismo correo implica misma persona | Clave exacta issuer/sub sin email; tests sujetos/proveedores distintos | Vinculación requiere plan y control de ambas identidades, no implementada |
| B05 | Dos callbacks crean usuarios distintos | UUID interno aleatorio, UNIQUE(issuer,sub), creación usuario+binding transaccional con revisión | Concurrencia/rollback en PostgreSQL real, no demostrado por generar UUIDs |
| B06 | Cambio A→B y respuesta tardía de A | Invalidate inmediato, generación/abort y rechazo de respuesta antigua; pruebas de orden invertido/cierre | Conectar con ciclo de vida y borrar proyecciones/cachés antes de beta, sin borrar perfiles |
| B07 | Dos escrituras usan revisión antigua | CAS en misma transacción que ownership/recibo; simulador determinista de dos operaciones deja una elegible | Simulador no es prueba de bloqueo, serialización o atomicidad real DB |
| B08 | Falla DB o falta autorización | Excepciones se convierten en UNAVAILABLE, sin fallback/grant ni diagnóstico privado | Probar desconexión, timeouts, pool y fallo de commit real |
| B09 | Se altera owner, estado o revisiones | FK/restricciones/rol mínimo, snapshot autoritativo y CAS; tests metadatos bloqueados/incompatibles | SQL propuesto sin ejecutar; ninguna política RLS permisiva activa |
| B10 | Confundir autenticación con propiedad | Incluso eligible-in-model tiene financialAccess=false; tests desconexión de entrypoints y SDK proyectando false | No hay autorización de finanzas Auth0 habilitada |
| B11 | Pérdida/adjudicación silenciosa del perfil local | Sin cambios de almacén, JSON, migración, rutas o demo | Transición/revisión/consentimiento y recuperación posterior, no implementados |
| B12 | Credenciales o datos financieros en logs/cliente | Nuevos contratos sin tokens/contraseñas/payloads; errores genéricos; módulos sólo servidor/pruebas | Revisión de infraestructura/retención/logs y pentest antes de activar |

## Alcance de pruebas

Las nuevas pruebas están registradas en src/tests.ts, por lo que se ejecutan con npm test y el job Unitarias existente. Ninguna prueba anterior se elimina o debilita. No se cambian los tres jobs obligatorios, el manifest de 46 suites, sus aserciones, reglas axe, puertas SIGKILL ni timeout de 50 minutos.

Los snapshots de identidad/propiedad, las respuestas tardías y la cola CAS son fixtures ficticias aisladas. No se usan credenciales reales, tenant de Auth0, IndexedDB personal o SQLCipher personal. Las pruebas del planner no son evidencia de aislamiento PostgreSQL real, ni de sesiones globalmente revocadas, ni de dispositivos Android/iOS.

Una primera ejecución dirigida pasó 34/34; lint detectó un error de exceso de propiedades en una fixture de correo. Se corrigió asignando la variante a una variable, manteniendo la aserción de independencia del correo. Se conservan los logs locales de preparación. La batería completa detectó también que el inventario AST publicado debía regenerarse por el nuevo import de pruebas: se ejecutó scripts/i18n/report.mjs, revisando que no se añaden superficies de UI, y se repitió la batería. No se modificaron sus aserciones. Los resultados finales se registran con su total real en la PR.

## Reproducción y procedencia

```bash
npm ci
node --import tsx --test server/ownership/planner.test.ts
npm test
node scripts/ci/run-check.mjs tools
npm run lint
npm run build
CHROMIUM_PATH=/ruta/chromium npm run test:ui
CHROMIUM_PATH=/ruta/chromium npm run test:durability
git diff origin/main...HEAD --check
```

La base tiene 796 unitarias, 54 de infraestructura y 1.044 resultados Chromium en 46 suites. Es una referencia histórica, no validación de esta rama. La CI del SHA final debe instalar limpiamente y ejecutar los tres checks completos. Por cuota local (menos de 100 MiB libres al iniciar), se reutilizan mediante enlace las dependencias instaladas de 7A.2 con lockfile idéntico, sin modificarlas; no se afirma npm ci local nuevo. No se incorporan dependencias ni paquetes de DB. Se preservan los worktrees anteriores.

SQL propuesto: no ejecutado. PostgreSQL/RLS real: no ejecutado y bloqueado hasta autorización de un entorno de pruebas. Android/iOS/Auth0 remoto: no ejecutados en esta fase. Los 58 conjuntos axe incompletos previos siguen pendientes de revisión contextual; se registran los recuentos actuales de CI sin sumarlos como defectos nuevos ni presentarlos como revisión manual.

El registro final en la descripción de la PR enlaza SHA/base, comandos y salidas reales, fallos/omisiones, resultados por job y sus URLs. No se atribuyen resultados de CI antigua al nuevo SHA ni se presenta una ejecución parcial/cancelada como aprobada.

## Checkpoint local antes de publicar

831/831 unitarias (796 conservadas + 35 nuevas), 54/54 pruebas de infraestructura, lint y build correctos; SQLCipher Linux 11/11. Este checkpoint utiliza el código de trabajo de esta rama, no el SHA de base. La CI del commit publicado y su batería Chromium completa se registran por separado en la PR; no se reutilizan resultados antiguos como evidencia de esta rama.

La revisión del contrato reprodujo además que un adaptador simulado podía devolver un motivo arbitrario que se propagaba al resultado. Se conserva el caso fallido y se añade validación cerrada de motivos y coherencia de elegibilidad; errores/proyecciones malformados se convierten en UNAVAILABLE. Es una corrección del contrato nuevo, sin conexión DB o rutas activas.

La ampliación del caso de peticiones malformadas reprodujo una excepción al convertir una acción objeto con toString nulo. Se verifica el tipo string antes de consultar la lista permitida; esa entrada ahora se rechaza sin conversión ni excepción. Se mantiene el mismo caso de prueba y no se relajan aserciones.
