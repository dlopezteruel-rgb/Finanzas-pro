# Móvil, datos locales y salida de la demo

El host web se rechaza en un contenedor nativo detectado mediante Capacitor, no user-agent. No se sustituye el almacén nativo por el BFF o IndexedDB. NativeIdentityPort amplía el contrato de proveedor con callback, resume/verificación y cancelación, **sin implementación nativa activa** en esta fase bloqueada por configuración/validación. No se inventan application IDs definitivos ni deep links.

La integración posterior seguirá la [guía oficial Ionic React/Capacitor](https://auth0.com/docs/quickstart/native/ionic-react): navegador seguro del sistema mediante Capacitor Browser y retorno App, Code+PKCE/state/nonce gestionados por SDK oficial, callback/logout exactos, cierre del navegador y manejo de cancelación/suspensión. No introducir credenciales en WebView ni trasladar cookies BFF al WebView como atajo. Preferir App/Universal Links con dominio e identificador final aprobados; registrar asociaciones Android/iOS sólo después de esa aprobación. Un custom scheme de la guía requiere evaluar interceptación y no sustituye esa validación.

Antes de instalar/activar SDK móvil: seleccionar y probar cache de credenciales en almacén OS apropiado; no usar Preferences/localStorage ni la clave SQLCipher como refresh token. Probar Keychain/Keystore y protección de claves en runtime/dispositivo; no basta que el plugin exista. Separar credenciales por aplicación/entorno y namespace de perfil. Validar expiración, logout, revocación, retorno tardío, reanudación y cambio de cuenta. Una operación financiera de resultado incierto debe reconciliar con su perfil original antes de cambiar de identidad; logout no borra bases, copias ni claves.

Android e iOS no se compilan ni ejecutan de nuevo por añadir este BFF web. La compilación/runtime nativos y la autenticación remota móvil permanecen **no ejecutados/bloqueados**. SQLCipher Linux es evidencia de motor, no de Keystore/Keychain. Los bloqueos para datos reales, importación externa real, backend móvil, distribución y copia portable no validada siguen intactos.

## Datos existentes y navegadores compartidos

La pantalla autenticada nunca monta App ni usa useFinanceData. No hay adaptador financiero, lectura de perfiles, exportación, asociación o subida. La propiedad continúa no adjudicada. issuer/sub y una sesión cifrada no adjudican el perfil anterior al primer login. applicationSubject permanece null hasta un registro estable confiable; no se deriva de email ni de un ID arbitrario del navegador.

El acceso local heredado y sus APIs mantienen el comportamiento previo, sin aislamiento por identidad. La interfaz lo advierte. Antes de beta real deberá bloquearse ese bypass de forma revisada, añadir autorización por recurso, namespace/ownership validado, registro estable e impedir que A vea la memoria/caché de B. No basta ocultar un botón o añadir auth al primer render mientras App ya abre IndexedDB. Esta PR bloquea producción Auth0 y acceso financiero desde el host autenticado; no afirma proteger retroactivamente el producto local.

7B/7C conservarán la transición7A.1: vista previa, identidad destino, reauth, consentimiento ligado a revisión/digest, copia recuperable verificada, CAS/transacción de documento+binding, recibo y reconciliación sin duplicados. Cancelar/fallar conserva el origen. No se ejecuta esa migración ni se cambia JSON3.5, Web Locks, CAS o SQLCipher aquí.

## Demo

El sandbox7A.1 permanece independiente, ficticio, en memoria, deshabilitado y sin invitados/cuentas anónimas. Ni la landing ni access crean un host demo o cuentas Auth0 anónimas. No se convierte en cuenta. Para una beta autorizada, el host demo tendría que inyectar explícitamente su adaptador ficticio, sin defaults webFinanceBinding/PlatformServices, sin importaciones reales o API remota. Retirarlo no requiere modificar Auth0 ni tocar perfiles.
