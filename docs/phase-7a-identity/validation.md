# Validación y procedencia

## Línea base ejecutada

Base208f183, antes de modificar código:733 unitarias,50 infraestructura, lint y build correctos. Auditoría npm completa/omit=dev con salida1 y riesgo picomatch heredado. [Comandos/códigos reales](evidence/before/commands.json). No hay un nuevo npm ci local: se reutiliza una instalación con package-lock idéntico por falta de espacio. CI realiza instalaciones limpias; no se añaden SDKs/dependencias.

## Pruebas nuevas y matriz

| Capacidad | Cobertura ejecutable |
| --- | --- |
| Sin sesión / inicializando / errores | Coordinador sin proveedor; Promise suspendida; fallo sanitizado |
| UID manual o correo como identidad | Factory ignora inputs no admitidos; email/extra fields rechazados; no permiso financiero |
| Identidad estable y varios métodos | Proyección de UID de aplicación independiente de issuer/sub/método y rotación de referencia de sesión |
| Expiración / revocación | Reloj simulado, sesiones ya vencidas y limpieza de proyección |
| Race y cierre | Respuestas A/B fuera de orden, logout/revocación tardíos, cierre idempotente y observadores fallidos |
| No exposición de credenciales | Tokens/password/atributos no admitidos y errores que contengan secretos ficticios no se proyectan |
| Demo por defecto / flags / rutas | Política producto deshabilitada, aprobación/caducidad, aliases y acciones denegadas |
| Demo sin persistencia/red | Getters de storage/IDB/Capacitor/fetch lanzan en Node; Chromium offline sobre perfil anterior confirmado |
| Aislamiento e integridad | Canario preparado con motor IndexedDB real, comparación íntegra antes/después, dos tabs, copias de snapshots |
| Datos ficticios | Sólo acciones curadas; gasto1,23 y saldo98,77; FinanceStore/validación3.5 original |
| Retirada | Política caduca/falla/se desactiva, disposal de cola, salida/reentrada limpia |
| No conversión demo/cuenta | Transición de identidad cierra sandbox sin copiar datos |
| Retirada sin reescribir auth | Entry auth compila sin demo, FinanceStore ni persistencia |
| Producto sin demo | Bundle de producto no contiene módulos de identidad/demo ni SDK IdP; URLs de landing no abren perfil |
| Cross-account | Frontera de autorización nunca entrega datos reales; mismatch A/B y legado no adjudicado denegados |

Las pruebas de navegador nuevas se registran mediante un import en la suite exclusiva `nativeFoundation.browser.ts`, conservando las46 suites y todas las aserciones anteriores. No se modifica workflow, scheduler, límites, reglas axe ni verificador P0. Se añade una puerta independiente de evidencia7A.1 sobre el SHA limpio y se eleva el mínimo de997 a1005, sin relajar controles anteriores;2pruebas de infraestructura adicionales comprueban el rechazo de omisiones, duplicados y SHA incorrecto. La nueva prueba se ejecuta también de forma independiente mediante `node --import tsx scripts/identityFoundationCases.ts`.

Resultados de contratos antes de publicar:33 pruebas Node nuevas y8 resultados Chromium de arquitectura (incluido el padre), además de las733 unitarias anteriores. Los números definitivos de la batería conjunta se registran después de su ejecución, no se deducen sumando referencias. [Evidencia de contratos](evidence/contracts). Son pruebas de arquitectura y sandbox, no login real, lector de pantalla, dispositivo físico o autorización de backend.

La primera preparación tuvo dos fixtures de demo con deadline ya caducado, que correctamente se bloquearon. Se ajustó la fecha de la autorización **de prueba**. La primera prueba de reinicio comparaba también exportedAt de dos aperturas; ahora excluye sólo ese metadato al comparar la semilla ficticia. La comparación del perfil existente sigue íntegra. La primera captura npm mezcló los avisos de actualización de la CLI con stdout; se conservan sus bytes y se repiten ambas auditorías con streams separados, manteniendo la salida1. Se conservan los fallos previos; no se cambia FinanceStore para hacer pasar tests. El inventario AST5B se regenera por nuevos literales internos/códigos no visibles; no se alteran mensajes o aserciones anteriores.

## Registro final de ejecución

En el checkpoint local hay766unitarias (733anteriores+33nuevas),52infraestructura (50+2) y8resultados Chromium de arquitectura. La descripción de la única PR Draft `feature/phase-7a-identity-foundation` es el registro canónico final: SHA exacto, base, URL de Actions, estado/duración de los3checks, nuevos totales locales/CI, SIGKILL20+2+8, SQLCipher11, axe e incompletos y limitaciones. Se completa al terminar las ejecuciones, sin atribuir a un SHA pruebas de otro. Los artefactos Actions incluyen sourceCommit para P0 y las revisiones del checkout; sus hashes de descarga se verifican. El commit de este documento no puede incluir su propio SHA antes de existir.

[PR de la rama en GitHub](https://github.com/dlopezteruel-rgb/Finanzas-pro/pulls?q=is%3Apr+head%3Afeature%2Fphase-7a-identity-foundation) y [ejecuciones de la rama](https://github.com/dlopezteruel-rgb/Finanzas-pro/actions?query=branch%3Afeature%2Fphase-7a-identity-foundation). Estos enlaces se mantienen válidos sin inventar número de PR o URL de ejecución antes de publicarlos. La entrega final proporciona los enlaces exactos.

La CI financiera verde no implica npm audit verde ni autorización para datos reales móviles. El riesgo de main se documenta separadamente de la mitigación de #34. Los58 conjuntos axe incompletos de referencia continúan para revisión contextual; un resultado incompleto no es una infracción ni una aprobación manual. Mantener observaciones web y nativas simuladas separadas y agrupar equivalentes sin sumar históricos como defectos nuevos.

## Reproducción

```bash
npm ci
npm test
node scripts/ci/run-check.mjs tools
npm run lint
npm run build
CHROMIUM_PATH=/ruta/chromium node --import tsx scripts/identityFoundationCases.ts
CHROMIUM_PATH=/ruta/chromium npm run test:durability
CHROMIUM_PATH=/ruta/chromium npm run test:ui
npm run audit:bundles
npm audit --json
npm audit --omit=dev --json
git diff origin/main...HEAD --check
```

No ejecutar npm audit fix --force. Para SQLCipher Linux: SQLCIPHER_LIBRARY=<lib4.20> npm run test:native:engine, según documentación5H; no equivale a validar Keystore/Keychain. Compilaciones y runtime móviles conservan sus bloqueos y no se distribuyen. Ningún proveedor, backend, migración o sincronización se ejecuta por estas pruebas.
