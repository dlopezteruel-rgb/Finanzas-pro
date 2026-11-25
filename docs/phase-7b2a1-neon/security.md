# Destino remoto, TLS y límites de confianza

## Channel binding

Investigación del 25/11/2026: npm publica pg 8.23.1; su enableChannelBinding activa SCRAM-PLUS cuando se ofrece, pero no exige utilizarlo. La PR oficial upstream 3746 permanece abierta. No se instala código de una PR no publicada ni se trata una opción desconocida como una política válida.

Para la validación operativa se utiliza **psql/libpq 18** con PGCHANNELBINDING=require, PGREQUIREAUTH=scram-sha-256 y PGSSLMODE=verify-full. Las URLs Neon con sslmode=require se descomponen y se refuerzan a verify-full; channel_binding=require se conserva sin cambiarlo a prefer. Se rechazan parámetros duplicados, opciones arbitrarias, otros roles/bases, puertos no aprobados, hosts sustituidos o credenciales reutilizadas entre roles.

Las CA proceden de las raíces públicas del runtime Node oficial instalado; el bundle temporal no contiene secretos. No se confía automáticamente en un certificado descargado del servidor ni se desactiva la comprobación de hostname. NODE_TLS_REJECT_UNAUTHORIZED=0 se rechaza. El cliente usa stdin para SQL y variables de proceso para credenciales, sin DSN/password en argv, psqlrc, shell o logs. El entorno PG heredado se limpia antes de imponer la política. Un administrador local puede inspeccionar procesos/memoria; esto no protege frente a un equipo comprometido.

La evidencia local verifica una conexión real a PostgreSQL 18 y que el mismo cliente **rechaza** autenticación password y trust bajo TLS. Se verifica también que el servidor sigue accesible con TLS para distinguir esos rechazos de una caída de conexión. Es evidencia de la política oficial libpq, no un trazado independiente de todos los mensajes SASL ni una prueba de Neon. Los errores de SQL conservan únicamente SQLSTATE; una pérdida de red no se cuenta como denegación RLS.

pg-native/libpq es una alternativa para una futura integración Express, pero añade compilación y diferencias de API; el wrapper pg.native debe revisarse porque no todas sus opciones pasan a libpq. No se instala en esta entrega. Un driver JS con require oficial sería otra opción cuando exista una versión publicada y validada. **La elección del driver de rutas activas queda pendiente**; el runner CLI no sustituye al backend financiero.

## Tres controles previos a una conexión

1. Puerta incondicional de etapa A, antes de argumentos sensibles, archivos, DNS, HTTP o procesos de cliente. Se conserva además el bloqueo remoto de 7B.2A.
2. Registro de revisión en código, vacío por defecto: target exacto, planHash, operaciones autorizadas y hashes de fixtures cuya limpieza se autoriza. No se lee de una variable ni del ejemplo JSON. El hash del plan cubre SQL, migración original y fuentes de preparación/transportes.
3. Tras una futura aprobación, GET autenticados al control plane: proyecto, rama y endpoints. Se exige coincidencia de IDs, región, rama development no predeterminada, endpoint read_write y hostname directo exacto. El pooled debe corresponder al mismo endpoint, con sufijo pooler exacto. Se admiten los formatos de hostname regional con/sin componente c-N; nunca una autorización wildcard.

El transporte remoto sólo recibe una capacidad interna emitida tras esas comprobaciones, con caducidad monotónica de cinco minutos y revocación al cerrar el comando. Copiar los mismos campos de un JSON no crea esa capacidad. Una autorización de lectura del control plane no permite abrir clientes de base de datos. La API se consulta por HTTPS, sólo GET, sin redirects, con timeout y respuesta acotada. Las respuestas no se registran en bruto ni se publican tokens.

La evidencia normaliza project_id de una rama a partir de su GET autenticado bajo el proyecto cuando la respuesta no incluye ese campo. Cualquier otro campo requerido ausente o distinto provoca rechazo; **ese mapeo todavía no se ha comprobado contra el proyecto real**. Un API key con alcance excesivo no se crea automáticamente: si no se dispone de una opción aceptable, detener B y revisar la alternativa con el propietario.

## Límites que la aprobación debe reconocer

- TLS autentica el host, no por sí solo la rama. La asociación se contrasta con el control plane; la etiqueta development de una URL/variable no prueba nada.
- Debe existir una ventana exclusiva sin cambios de rama, endpoint, rol o titularidad durante la prueba. No existe una transacción distribuida entre el control plane de Neon y SQL: una reasignación administrativa después de la comprobación plantea una carrera. Detenerse ante cambios y volver a autorizar; no se promete resistencia frente a un administrador Neon comprometido.
- pg_stat_ssl describe el tramo que ve PostgreSQL, que puede diferir del tramo cliente–proxy. No sustituye la política libpq ni la validación de CA/hostname; una discrepancia en Neon requiere revisión, sin relajar require o TLS para conseguir aprobación.
- RLS depende del servidor confiable que resuelve el actor. Las credenciales runtime permiten SET LOCAL con otro UUID; ya se demostró en 7B.2A. No se aceptan IDs de navegador como prueba de identidad y no se conecta aquí Auth0 a PostgreSQL.
- El migrador puede alterar sus objetos/políticas y el administrador puede cambiar privilegios. Son credenciales operativas, no de peticiones. No se declara producción segura por pasar los ensayos locales.
- La versión Windows del cliente, las ACL y el control plane real están pendientes. No se presentan pruebas Linux, alias locales o simulaciones como evidencia de Windows, Neon, PgBouncer, Android o iOS.
