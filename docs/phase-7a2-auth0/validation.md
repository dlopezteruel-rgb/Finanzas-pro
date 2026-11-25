# Validación y procedencia

Referencia conservada:766 unitarias,52 infraestructura,1005 resultados Chromium en46 suites, SIGKILL20+2+8, SQLCipher Linux11 y cero violaciones axe. Los58 conjuntos incompletos de la CI7A.1 siguen pendientes de revisión contextual; no se suman repeticiones como defectos nuevos ni se consideran aprobaciones manuales.

## Actualización manual posterior

Los [resultados de las pruebas manuales del 24–25/11/2026 comunicados por el propietario](manual-validation-2026-11-24-25.md) corresponden al SHA `79b33d6f83533931c1b29fe515d01199c1434276` y se distinguen de las pruebas automatizadas siguientes. No los ejecutó ni verificó de forma independiente Codex. Las evidencias originales se conservan.

## Pruebas añadidas

- SDK oficial3.4.0 contra IdP **ficticio**, sin red externa: discovery/JWKS/token con firma estándar de prueba, Code+PKCE real del SDK, nonce/issuer/audience/exp, state inválido, CSRF, redirects fijos, signup/recovery, cookies cifradas/HttpOnly, recarga/nueva instancia y logout. No es un tenant Auth0 ni un test de entrega de email, Google o Apple.
- Subject distinto con el mismo correo: no linking/UUID inventado. Reauth con otra identidad falla y elimina la sesión local. Un grant rechazado simula un estado revocado; no certifica revocación instantánea de cookies o del proveedor.
- Configuración incompleta/no aprobada/producción/DEBUG falla cerrada. No secretos proyectados ni logs del error remoto. El SDK y variables confidenciales no aparecen en assets web.
- Host real `/access` con respuestas ficticias: cinco idiomas × tres anchos × dos temas, teclado/foco, métodos ocultos cuando no disponibles, ausencia de formularios de credenciales, acceso bloqueado en WebView, recargas/logout, respuestas tardías y navegador compartido. Spies rechazan lecturas/escrituras financieras de localStorage, IndexedDB y plugin nativo; canarios ficticios previos no se abren.
- Axe usa las mismas reglas estrictas; matrices y estados configurado/autenticado/error/caducado se registran separados de los informes previos. No se realizaron pruebas con lector de pantalla o dispositivo físico.
- Puerta de CI explícita para el informe Auth0 sobre SHA limpio, todas sus observaciones y cero violaciones. Se conservan manifest/scheduler/46suites, puerta7A.1, SIGKILL y checks originales. El mínimo se eleva de1005 a1044 al añadir39resultados;2pruebas de infraestructura comprueban la puerta nueva.

## Cambios de evidencias y fallos de preparación

No se modifica ninguna aserción anterior. CI44826903229 reprodujo una regresión de orden Tab en las30combinaciones de la landing (624resultados aprobados y31fallidos incluido el padre, resto no ejecutado): el enlace nuevo intercalado entre Abrir/Detalles rompía su orden original. Se mueve después de ambos enlaces y se repite la suite original sin tocar sus aserciones. Esa CI fallida y la ejecución local parcial se conservan; no se presentan como aprobadas. El test histórico de44 archivos protegidos se mantiene: sólo se rebaselinea server.ts por las dos importaciones y montaje de identidad autorizados; un test adicional quita exactamente esas tres líneas y exige el hash íntegro anterior `ed3b4ae2cceafd2cd51370a4ce4279dd6bc621b63cca19804eb7ae6a883406e6`. Los otros43 hashes no cambian. El inventario5B se regenera con report.mjs tras revisar los nuevos textos; no es el volcado AST bruto. La revisión visual detectó que la clase landing forzaba sus colores claros sobre el tema del host de acceso: se separó esa clase y se reutilizan los tokens/preferencia existentes; el test comprueba también el fondo calculado, no sólo el atributo. La regresión de Origin con cuerpo excesivo reprodujo un rechazo tardío303 en vez de403; ahora el control precede al parser/SDK y un callback espurio no cierra una sesión ajena. La revisión posterior del SDK3.4 detectó que el filtrado del callback descartaba sessionExpiresAt: se reprodujo con un ID token ficticio firmado, se preservó el campo y se limitó la proyección al techo del proveedor. La validación parcial del primer SHA se interrumpió y no se aprueba; se repite sobre el nuevo SHA. Los primeros fallos de tipos del SDK, inventario y hash fueron visibles y corregidos; no se ocultan reduciendo tests. Las propiedades legacy de tokens del tipo Session del SDK se vacían explícitamente: sólo se conserva ID token cifrado y metadatos, sin refresh/access tokens útiles.

Por espacio se reutilizó node_modules con las versiones/lock de la base, añadiendo únicamente el SDK oficial y sus transitivas. No se ejecuta un nuevo npm ci local; CI sí exige instalación limpia. Se liberaron sólo blobs recreables de caché pública npm, preservando worktrees, fuentes, cambios y evidencias anteriores. No se ejecutó clean/reset ni se eliminaron perfiles. npm install no cambió versiones ni integridades existentes; el lock registra las nuevas transitivas. No hay actualización general de frameworks.

## Registro final

Los resultados definitivos locales y de Actions se escriben en la descripción de la única PR Draft de `feature/phase-7a2-auth0`: SHA/base, resultados por job, cifras reales, duración, hashes de artefactos, accesibilidad, SQLCipher y límites. Se completa al finalizar la ejecución, sin atribuir al SHA base pruebas de código aún sin commit. Los informes CI incluyen SHA del checkout y las puertas exigen árbol limpio.

[PR de la rama](https://github.com/dlopezteruel-rgb/Finanzas-pro/pulls?q=is%3Apr+head%3Afeature%2Fphase-7a2-auth0) y [Actions](https://github.com/dlopezteruel-rgb/Finanzas-pro/actions?query=branch%3Afeature%2Fphase-7a2-auth0). El registro final proporciona números/URL exactos. La evidencia de checkpoint, cuando lleva el SHA base o árbol dirty, corresponde expresamente a preparación sin publicar.

## Seguridad npm

PR34 no se modifica ni integra. Las auditorías se capturan completas con sus códigos de salida. La comprobación de7A.1 observó la retirada de GHSA-fc5q-39xc-vjpf del catálogo; se vuelve a consultar el aviso oficial para esta entrega. Retirada no significa que esta PR haya parcheado picomatch4.0.7 o Vite8.3.7; siguen las versiones de la base y su importación estática. No se atribuye la mitigación independiente de #34 a esta fase. El estado actual y los informes npm se registran en la entrega; un catálogo sin alertas no certifica seguridad de patrones no confiables.

## Reproducción

```bash
npm ci
npm test
node scripts/ci/run-check.mjs tools
npm run lint
npm run build
CHROMIUM_PATH=/ruta/chromium node --import tsx scripts/auth0Access.browser.ts
CHROMIUM_PATH=/ruta/chromium npm run test:durability
CHROMIUM_PATH=/ruta/chromium npm run test:ui
npm run audit:bundles
SQLCIPHER_LIBRARY=/ruta/libsqlcipher.so npm run test:native:engine
npm audit --json
npm audit --omit=dev --json
git diff origin/main...HEAD --check
```

No activar AUTH0_ENABLED en CI: el protocolo externo se simula aisladamente y los secretos reales no son necesarios. En el checkpoint automatizado original, las pruebas remotas, correo entregado, Google/Apple, Apple relay, Auth0 real y runtimes móviles estaban **no ejecutados/bloqueados**. El registro manual posterior actualiza únicamente los recorridos de correo y sesión comunicados por el propietario; Google, Apple, reautenticación con otra identidad, aislamiento financiero multiusuario, validación nativa y revocación global siguen pendientes. No se altera el límite Chromium50min, no se reintentan casos para ocultar fallos ni se deshabilita axe.
