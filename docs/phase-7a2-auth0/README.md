# 7A.2 — Auth0, integración web preparada y activación controlada

Base efectiva `40c16e6602bef8338d43fd833fe578fced9d670f`, merge de #35. Rama `feature/phase-7a2-auth0`. Auth0 es el proveedor aprobado; no se reabre la comparativa. PR #34 permanece independiente en `c18638c57c062d0295fb352d00e75889c89d3526`.

Se implementa un BFF de identidad sobre Express con **express-openid-connect 3.4.0**, SDK oficial de Auth0, fijado en el lockfile y compatible con Node24.22.1. No se añade un SDK al navegador. `/access` es un host React independiente, con cinco idiomas; no importa App, FinanceStore, PlatformServices ni los adaptadores financieros. Los botones se muestran sólo para conexiones configuradas en servidor. El formulario hace POST al mismo origen y el SDK redirige a Universal Login; no captura credenciales.

**Estado del checkpoint automatizado original:** no existía tenant autorizado en el entorno de Codex y no se había validado autenticación contra Auth0 real. **Actualización 24–25/11/2026:** el propietario comunica pruebas manuales satisfactorias de correo y sesión en su tenant de desarrollo; véase el [registro manual y sus límites](manual-validation-2026-11-24-25.md). Esta actualización documental no crea cuentas, aplicaciones externas, conexiones, dominios, facturación, claves de distribución ni infraestructura. No se activan datos financieros reales móviles.

| Capacidad | Código preparado | Evidencia disponible | Pendiente |
| --- | --- | --- | --- |
| Correo/contraseña | Universal Login, signup, recovery | SDK frente a IdP ficticio; registro, verificación y recuperación reales comunicados por el propietario | Ampliación de evidencia según registro manual |
| Google | Conexión permitida elegida por servidor | Parámetros/redirects simulados | Proyecto/consentimiento/credenciales Google y conexión autorizada |
| Apple | Conexión permitida elegida por servidor | Flujo OIDC común simulado | Apple Developer, IDs/dominio/clave/consentimiento y conexión autorizada |
| Sesión | Cookie SDK cifrada, HttpOnly, límite15min; reauth explícita | Automatizadas simuladas; login/logout, recarga, reapertura de pestaña y expiración observada por el propietario | Revocación global, duración cronometrada y reauth con otra identidad |
| Identidad de aplicación | Contratos7A.1 preservados; issuer/sub verificados | Subject equivocado y correo coincidente rechazados/sin unión | Registro confiable de UUID/bindings; applicationSubject=null hasta provisionarlo |
| Finanzas multiusuario | **Siempre bloqueadas** en el host autenticado | Sin accesos a perfiles locales/SQLCipher | Autorización, ownership y namespaces validados antes de beta |
| Android/iOS | Contrato NativeIdentityPort y diseño de flujos | Bloqueo del host BFF en WebView simulado | SDK/cache OS/callbacks finales y runtime real; no implementado ni validado |
| Demo | Sandbox7A.1 sin cambios, deshabilitado | Se conserva batería de aislamiento | Host de beta autorizado; no se conecta en esta PR |

El SDK sólo se activa con configuración completa y consentimiento explícito de desarrollo. `NODE_ENV=production` lo bloquea incluso con credenciales: esta entrega no habilita beta real. El bloqueo es control de producto; la seguridad financiera procede además de no tener puertos financieros ni autorización en este host.

El acceso local heredado `/app` **se conserva sin convertirlo en multiusuario**. Tampoco se protegen retroactivamente sus APIs anteriores. La landing y la pantalla de acceso advierten de ese límite. Ningún login abre, importa, exporta, asocia ni migra IndexedDB, SQLCipher o copias. No se adjudican datos al primer usuario. No se altera JSON3.5 ni lectura2.5–3.5.

- [Arquitectura y límites de sesión](architecture.md).
- [Configuración por el propietario y checklist remoto](tenant-runbook.md).
- [Android/iOS y transición de perfiles](native-and-data.md).
- [Validación, evidencias y CI](validation.md).

La descripción de la única PR Draft es el registro final de SHA, URL de CI, resultados exactos y hashes de artefactos, completado al finalizar las ejecuciones. No se presenta un resultado simulado como login real. No fusionar, desplegar, contratar servicios, distribuir ni sincronizar Google AI Studio.
