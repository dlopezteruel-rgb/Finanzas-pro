# Windows y PowerShell: preparación local

**No ejecutar conexiones o SQL remoto durante etapa A. No enviar cadenas completas, passwords, tokens o API keys por chat.** La guía prepara herramientas y archivos locales; no habilita la puerta B. Estos comandos no se han ejecutado en Windows en el entorno Linux de esta entrega.

## 1. Herramientas y repositorio

Usar Windows con una cuenta personal controlada, fuera de carpetas compartidas, OneDrive y otros mecanismos de sincronización. Conservar Node 24 compatible con el proyecto, Git y el repositorio revisado. No usar un ordenador público para credenciales.

Obtener el cliente PostgreSQL **18** desde [la distribución oficial para Windows](https://www.postgresql.org/download/windows/), verificando versión, origen y firma del instalador. Instalar Command Line Tools; no hace falta crear un servidor/servicio PostgreSQL local ni configurar un superusuario del sistema. No copiar DLL de procedencia desconocida. PostgreSQL 19 no se adopta automáticamente.

```powershell
$Psql = 'C:\Program Files\PostgreSQL\18\bin\psql.exe'
& $Psql --version
node --version
npm --version
git status --short
npm ci
npm run neon:plan
```

El plan no contiene secretos ni conecta. Conservar la salida para comparar su hash con la revisión. Un fallo de npm/audit no se convierte en aprobación. La instalación Windows/libpq y sus DLL requieren validación local; la prueba Linux no la sustituye.

## 2. Identificar el destino, sin publicar credenciales

En el Dashboard del propietario: proyecto **finanzas-pro-dev**, región Frankfurt, rama **development**, PG18 y neondb. Production está reservada y no se usa. Confirmar Never para caducidad, historial comunicado de seis horas y ausencia de consumidores. No cambiar plan, región, IP rules o Better Auth.

Registrar únicamente metadatos públicos para revisión: project ID, branch ID, endpoint ID, host directo y host pooled. Usar Connect sobre development: alternar conexión directa y Connection pooling; no deducir la rama por el nombre neondb ni por un prefijo ep-. Los dos hosts deben pertenecer al mismo endpoint. No copiar a una PR capturas que contengan passwords/URIs completas.

Antes de B, se contrastarán esos IDs mediante GET autenticados del control plane y la allowlist exacta revisada. Si falta un API key de alcance aceptable, **no crear automáticamente una clave administrativa amplia**. Solicitar decisión del propietario sobre ese alcance/alternativa de verificación, nunca el valor de la clave por chat. Todavía no hace falta crear ni facilitar ninguna clave para revisar etapa A.

## 3. Archivo privado e ignorado por Git

Se necesitan cuatro URLs: adminDirect, migratorDirect, runtimeDirect y runtimePooled. Cada rol usa su propia contraseña; las dos URL runtime usan la misma contraseña, usuario y base, cambiando sólo el host. Los roles restringidos se crean mediante SQL revisado, no mediante interfaces que les añadan neon_superuser. Pueden prepararse sus URLs con contraseñas elegidas en un gestor antes del bootstrap, aunque sus logins todavía no existan.

Conservar channel_binding=require. sslmode=require del panel se reforzará a verify-full; no sustituir require por prefer. Codificar correctamente caracteres especiales de usuario/password en la URI. El archivo sólo se valida localmente, nunca se incorpora al frontend ni a variables VITE_.

El helper solicita las URL con entrada oculta. No acepta passwords como argumentos, no imprime objetos ni crea conexión:

```powershell
# Desde la raíz del clon. Para ensayar etapa A, usar exclusivamente valores ficticios.
& .\scripts\neon\Initialize-Secrets.ps1
& .\scripts\neon\Initialize-Secrets.ps1 -ValidateOnly
git check-ignore .secrets/neon-7b2a1/connections.json
git status --short
```

El destino es `.secrets/neon-7b2a1/connections.json`. Se crea una carpeta nueva con ACL protegida, sin herencia, para el SID del propietario y SYSTEM. Se rechaza un archivo o directorio existente: no se cambian ACL ajenas ni se sobrescriben credenciales. ValidateOnly comprueba ACL y estructura sin mostrar valores. La carpeta .secrets está ignorada por Git. No añadirla mediante git add -f, copiarla a dist o incluirla en artefactos/ZIP.

En caso de error, inspeccionar localmente sin imprimir el contenido y conservar archivos existentes. No desactivar ACL ni volver a una carpeta pública para conseguir que pase. Los administradores locales pueden tomar posesión y un proceso del mismo usuario puede acceder: una ACL no protege un equipo comprometido. Evitar transcripción, debug/verbose, capturas o herramientas que registren valores pegados. Los strings de passwords pueden permanecer temporalmente en memoria; no se promete borrado criptográfico.

## 4. CA y autenticación del cliente

El runner preparado genera un bundle **público** de raíces desde el runtime Node oficial instalado, en un temporal propio, e impone PGSSLROOTCERT, verify-full, channel binding require y SCRAM requerido. No incorpora secretos o certificados privados. Un error de certificado implica detenerse; no usar no-verify, SSL desactivado o NODE_TLS_REJECT_UNAUTHORIZED=0.

Para una sesión psql interactiva posterior autorizada, generar también un archivo de raíces públicas local, sin conexión:

```powershell
node -e "require('fs').writeFileSync('.secrets/neon-7b2a1/roots.pem',require('tls').rootCertificates.join('\n'),{flag:'wx',mode:0o600})"
```

No se sobrescribe un archivo existente. Esto no valida el endpoint: sólo prepara CA confiables del runtime instalado. La versión de libpq debe corresponder al cliente oficial 18, sin DLL sustituidas. Revisar el comportamiento de la distribución Windows antes de declarar channel binding validado allí.

## 5. Passwords de roles: sólo tras aprobación B

El bootstrap revisado crea roles NOLOGIN. Después, el propietario elegirá passwords distintos en su gestor y usará `\password finanzas_migrator` y `\password finanzas_runtime` en una sesión **admin directa** protegida. `\password` solicita entrada oculta y evita escribir passwords en SQL plano. Revisar password_encryption=scram-sha-256. Activar LOGIN es un paso explícito posterior:

```sql
-- Referencia para revisión; NO ejecutar en etapa A.
ALTER ROLE finanzas_migrator LOGIN;
ALTER ROLE finanzas_runtime LOGIN;
```

No usar el SQL Editor para pegar un ALTER ROLE PASSWORD con un secreto real, ni pasar la URI completa a psql como argumento. Para la sesión autorizada se cargará el adminDirect desde el archivo privado en variables de proceso PGHOST/PGUSER/PGDATABASE/PGPASSWORD y se impondrán PGSSLMODE=verify-full, PGSSLROOTCERT, PGCHANNELBINDING=require y PGREQUIREAUTH=scram-sha-256. Las variables se eliminan al cerrar/finally; no imprimirlas con Get-ChildItem Env:. El runner automatizado hace esa separación, pero **no automatiza la introducción de passwords**.

## 6. API de gestión y diagnóstico posterior

Sólo si el propietario autoriza un token con alcance adecuado, introducirlo con Read-Host -AsSecureString y mantenerlo únicamente en el proceso servidor como NEON_MANAGEMENT_API_KEY. No ponerlo en comandos literales, source, URL, frontend, .env versionado o chat. Limpiar la variable al terminar. El runner sólo prevé GET del destino revisado y rechaza redirects; no cambia recursos Neon.

Los comandos exactos y el orden de operaciones están en [el plan remoto](remote-plan.md). En esta PR fallarán antes de cargar credenciales o conectar. No retirar guardas localmente por intuición: la etapa B requiere revisión y autorización explícitas del destino, hash y alcance, más el cambio correspondiente con sus pruebas.

## 7. Rotación e incidentes

Si se expone una contraseña o API key, detener pruebas, revocar/rotar mediante procedimiento autorizado del propietario y revisar dónde se copió. No pegar el secreto para comunicar el incidente. El bootstrap no rota passwords existentes y repetirlo no es una solución de rotación.

Coordinar consumidores, actualizar el archivo mediante una **carpeta privada nueva** y entrada oculta, comprobar TLS/roles antes de retirar credenciales previas y cerrar procesos/pools antiguos. Conservar las restricciones del rol. No borrar datos, regenerar claves SQLCipher o atribuir perfiles financieros a una cuenta para resolver un error de autenticación. La recuperación y la rotación son operaciones diferentes.
