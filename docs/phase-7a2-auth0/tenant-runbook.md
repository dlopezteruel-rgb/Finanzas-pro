# Configuración externa pendiente: sólo el propietario tras aprobación

Estado original del entorno de Codex: no existía tenant/configuración autorizada y estos pasos no se habían ejecutado. Posteriormente el propietario comunica Auth0 Free, tenant `finanzas-pro-dev`, EU-2 y Regular Web Application con Express local en `127.0.0.1:3000`; véase el [registro manual 24–25/11/2026](manual-validation-2026-11-24-25.md). No se atribuye a Codex la creación o configuración del tenant. Las instrucciones siguientes se conservan como runbook y los pendientes no cubiertos continúan vigentes. No introducir pagos, contratar planes, activar trials facturables, usar credenciales de desarrollo del proveedor como si fueran producción ni registrar nombres definitivos sin aprobación.

## Región y plan

Recomendar **Europe (EU)**. La tabla oficial publica Europe con sublocalidades EU/EU-2; United Kingdom (UK) es una localidad distinta. También publica AU, CA, JP y US. Public Cloud asigna la sublocalidad: no se puede elegir EU-2 manualmente. Antes de crear el tenant, el propietario debe aprobar nombre/región, verificar en Dashboard/documentación contractual dónde se alojan identidad, logs, correos, soporte, backups y subencargados, y revisar DPA/transferencias. No se garantiza residencia efectiva de un tenant que todavía no existe ni una ciudad/región AWS específica por deducción del dominio. Verificación efectiva y creación están bloqueadas hasta esa intervención.

[Crear tenants y tabla de regiones](https://auth0.com/docs/get-started/auth0-overview/create-tenants), [sublocalidades](https://support.auth0.com/center/s/article/Tenant-Creation-in-a-Specific-Sub-region). Empezar en Free sólo si sus condiciones cubren las funciones necesarias. Account Linking no se habilita en Free ni se emula por email. Cualquier coste de email, MFA, dominios, Apple Developer, Google o revocación debe aprobarse aparte; no se contrata aquí.

## Aplicación web de desarrollo

Tras aprobar tenant/región, el propietario crea una **Regular Web Application**, con Universal Login, Code y autenticación confidencial del cliente. No elegir SPA para el BFF ni incluir Client Secret en React. Separar desarrollo/producción mediante aplicaciones/secretos/tenants según política aprobada. No crear producción ahora.

Definir ORIGIN como el origen real autorizado, sin path/query, y BASE como APP_BASE_PATH normalizado (por defecto /). Registrar exactamente:

| Ajuste | Valor calculado, sin comodines |
| --- | --- |
| Allowed Callback URLs | ORIGIN + BASE + api/identity/callback |
| Allowed Logout URLs | ORIGIN + BASE + access |
| Application Login URI | ORIGIN + BASE + access |
| Allowed Web Origins, si Auth0 exige el ajuste | ORIGIN exacto; no habilitar CORS para el cliente financiero |

Ejemplo **sólo loopback ficticio para desarrollo** con ORIGIN=http://127.0.0.1:3000 y BASE=/: callback http://127.0.0.1:3000/api/identity/callback; logout/login http://127.0.0.1:3000/access. No son dominios de producción. Si se usa /finanzas/, incluirlo también en callback y logout. No se aceptan dominios externos HTTP. No registrar localhost y127.0.0.1 como si fueran intercambiables: elegir el origen exacto.

Variables **sólo de servidor**, en un canal seguro del entorno autorizado, nunca VITE_ ni Git ni mensajes de chat con secretos:

```dotenv
AUTH0_ENABLED=false
AUTH0_DEVELOPMENT_APPROVED=false
AUTH0_BASE_URL=
AUTH0_ISSUER_BASE_URL=
AUTH0_CLIENT_ID=
AUTH0_CLIENT_SECRET=
AUTH0_SESSION_SECRET=
AUTH0_EMAIL_CONNECTION=
AUTH0_GOOGLE_CONNECTION=
AUTH0_APPLE_CONNECTION=
```

Issuer debe ser el HTTPS exacto del tenant/dominio autorizado. Client ID es público, pero no se rellena con uno inventado. Client Secret es confidencial. Generar SESSION_SECRET con `openssl rand -hex 32` en el entorno autorizado, conservarlo de forma segura y no publicar su salida. Sin valores completos o consentimiento la aplicación responde unconfigured/configuration/product-blocked, no cae en una identidad ficticia. NODE_ENV=production permanece bloqueado en esta PR.

## Conexiones y comprobación real pendiente

Correo: crear/habilitar la conexión DB para esta aplicación; configurar política de contraseñas/abuso, correo de verificación y recuperación con remitente/proveedor autorizado. Confirmar entrega, enlaces de un uso/caducidad, email_verified actualizado y reingreso. La pantalla muestra que debe verificarse el correo. Recuperar contraseña dirige al login de correo de Universal Login; allí se elige la opción de contraseña olvidada. No se inventa un screen_hint de reset ni se envían emails desde este servidor.

Google: el propietario necesita su proyecto OAuth y consentimiento, cliente/secret y callback de Auth0 indicados por el Dashboard de la conexión. Registrar **el callback de Auth0 en Google**, distinto del callback de esta aplicación. Probar cuentas de prueba autorizadas y errores/revocación; no usar production keys prestadas. Hasta entonces AUTH0_GOOGLE_CONNECTION vacío.

Apple: se necesitan cuenta Apple Developer autorizada, App/Service IDs, Team ID, Key ID y clave privada almacenada en Auth0, dominio/return URLs verificados según Dashboard y remitentes relay. No generar/subir claves en esta PR. Verificar identidad estable y correo relay; ni email ni private relay deben unir cuentas. Hasta entonces AUTH0_APPLE_CONNECTION vacío.

[Registro](https://support.auth0.com/center/s/article/How-to-Redirect-Users-directly-to-the-Hosted-Signup-Page), [reset](https://auth0.com/docs/authenticate/database-connections/password-change), [Google](https://auth0.com/docs/authenticate/identity-providers/social-identity-providers/google), [Apple](https://auth0.com/docs/authenticate/identity-providers/social-identity-providers/apple-native).

Los flags de conexión indican configuración declarada por el operador, no una prueba remota. No configurarlos hasta completar su checklist. No activar linking, extensiones automáticas o Connected Accounts. Cuando haya plan/autorización, diseñar prueba de ambas credenciales, consentimiento, desafío único y CAS del registro de identidades; ninguna vinculación de identidad debe fusionar perfiles financieros.

Checklist remoto original (el registro manual posterior cubre parcialmente correo y sesión; el resto permanece pendiente): signup y correo real, password login, password reset, Google, Apple, callbacks incorrectos/cancelados, logout/SSO, caducidad, reauth con mismo/otro usuario, revocación y ventanas reales, recarga/reinicio, dos usuarios/navegador compartido. Registrar tenant público/región, fechas, versiones y cuentas ficticias, sin tokens ni datos personales. No habilitar beta por aprobar sólo mocks.
