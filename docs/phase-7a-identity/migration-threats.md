# Perfiles existentes, amenazas y siguientes fases

## Transición propuesta: no ejecutada en7A.1

Un perfil actual es **local no adjudicado**. Ni primer login, email, nombre de cartera, semilla DEMO_DATA ni documento importado pueden decidir propiedad. Ningún estado auth nuevo tiene un puerto para abrir o reclamar ese perfil; `realFinancialAccess` deniega aun coincidiendo IDs hasta autorización real de servidor.

Secuencia futura: inventario y lectura controlada autorizada → vista previa del perfil y destino → reautenticación → consentimiento explícito ligado a perfil/revisión/digest/destino → copia recuperable verificada → transacción protegida que compruebe revisión financiera y de binding → recibo duradero y lectura de verificación → publicación UI. `LocalClaimProposal` describe esas referencias, no ejecuta la operación. Una cadena de texto que diga consentReference no constituye consentimiento verificado.

Al fallar, conservar origen y copias; resultado incierto exige reconciliar recibo/operationId antes de permitir otra operación. No repetir una migración al recargar, login repetido o cambio de método. El registro de claims debe ser idempotente y CAS debe comprobar documento+binding dentro del mismo límite transaccional. Web Locks se mantienen y complementan la transacción; en SQLCipher CAS sigue en SQL bajo su protección nativa. Planificar una migración interna de esquema sólo si es indispensable y con copia/versión explícita; no cambiar JSON3.5 por añadir identidad.

Namespaces por perfil/propietario necesitarán diseño validado de adapters/metadatos: nunca cambiar DATA_KEY por un userId recibido de localStorage ni elegir otra base por una query. Un único namespace por origen no ofrece aislamiento entre cuentas. Mantener datos antiguos no adjudicados y sin abrir al usuario B. No mostrar documentos por defecto mientras se resuelve identidad/propiedad ni cargar primero datos reales y ocultarlos después con un modal.

Cambiar de A a B: invalidar callbacks anteriores, cerrar/quiescer el controlador A, reconciliar resultados inciertos con su namespace original y limpiar la vista de datos, sin borrar almacenamiento. Resolver B y su permiso antes de abrir otro controlador. Una operación ya confirmada no se revierte ficticiamente al caducar sesión o desmontar UI. Un callback tardío de A no puede escribir en B. Nunca eliminar bases, claves SQLCipher o backups por logout, revocación o falta de credenciales.

En navegador compartido, proteger caches/UI/service workers y datos offline según política aún pendiente. El control de identidad no cifra por sí solo un perfil web; amenazas de usuario del mismo dispositivo/origen y XSS requieren decisiones explícitas. No prometer aislamiento de disco sólo por ocultar pantallas o usar rutas. La entrada local heredada continúa igual en esta PR; antes de activar cuentas reales debe resolverse esta frontera, o mantener esas cuentas sin acceso financiero real.

## Modelo de amenazas y evidencia

| Amenaza | Control ejecutable7A.1 | Requisito posterior |
| --- | --- | --- |
| Usuario/owner inventado en navegador | Factory sin proveedor; acceso financiero siempre denegado; simulaciones marcadas | Verificación IdP/BFF y autorización por recurso |
| Toma de cuenta por correo coincidente | No hay linking ni inferencia de UID desde correo | Prueba de ambas credenciales, consentimiento y CAS de registro |
| Datos de A visibles a B | Nueva frontera sin puertos de datos reales; mismatch y legado denegados | Aislamiento efectivo de namespaces y servicios antes de habilitar login financiero |
| Tokens en storage/logs | Proyecciones con campos exactos; errores sanitizados; sin credenciales reales | Cookies HttpOnly/OS stores, redacción y no-retención de secretos |
| Demo evade flag/ruta | Default deshabilitado, acciones guardadas, sólo memoria y fixture cerrado | Host de beta autorizado; la flag no autoriza datos reales |
| Carrera logout/reanudación/cambio de usuario | Generaciones, AbortSignal y disposal; respuesta antigua ignorada | Revocación real y reconciliación de commits por propietario |
| Importación/claim no consentido | Demo sin import/restore/sync y sin adopción | Copia previa, vista previa, confirmación y commit atómico |
| Pérdida de clave nativa / mezcla con credenciales | No se toca SQLCipher ni se habilitan datos reales | Aliases OS separados; no recrear claves/DB ante error; recovery independiente |
| Caída del proveedor/offline | Sin proveedor remoto; demo funciona offline | Plazos y fallos del SDK/BFF; política offline aprobada, no autorizar sólo con reloj local |
| ReDoS de picomatch en la base | Riesgo documentado, auditoría real salida1 | Revisar #34 por separado y parche upstream verificable; sin downgrade o excepciones |
| UI/TS considerados autenticación | Estado simulado nunca autoriza finanzas reales | Servicios/DB rechazan solicitudes sin verificación efectiva |

No se implementa criptografía propia, servidor de tokens ni cifrado adicional. No hay afirmaciones de seguridad Keystore/Keychain por compilar o pasar un navegador.

## Requisitos7B — Base de datos segura

UUID estable de aplicación y relaciones de bindings auditables; propiedad por perfil/registro; autorización en servidor y políticas RLS con comprobación del actor real, no del owner declarado por cliente. Denegación por defecto, pruebas cruzadas A/B y separación de privilegios administrativos. Operaciones vinculadas y snapshots mantienen referencias e integridad; documentar eliminación, retención, recuperación, copias y acceso de soporte. No exponer service-role/secretos en cliente. Región/proveedor de DB son decisiones separadas del IdP. No se crea base remota en7A.1.

## Requisitos7C — Sincronización

Asociación explícita dispositivo/cuenta; outbox por namespace/owner; opId y recibos idempotentes; revisiones financieras y de ownership; resolución explícita de conflictos. Transferencias, repartos, reintegros, cuotas y aprobaciones se transmiten como operaciones atómicas completas; no dividir extremos ni recalcular sólo filas visibles. Reintentos tras respuesta incierta primero reconcilian. Offline no cambia propietario ni interpreta una sesión local como permiso de servidor. Claims locales con copia verificada y consentimiento; importaciones históricas2.5–3.5 conservan semántica y referencias. No hay sincronización ni subida de finanzas en esta PR.

## Decisiones que requieren autorización antes de7A.2

Proveedor definitivo y plan (incluido linking/MFA), presupuesto, región/DPA/subencargados, dominio/redirects e identificador móvil definitivo, política de vinculación y recuperación, BFF/cookies y expiración/revocación, autorización y aislamiento del legado antes de acceso financiero real, alcance/fecha de retirada y despliegue autorizado de demo. No registrar dominios, crear tenants, comprar servicios, instalar SDKs de auth ni generar credenciales hasta esa aprobación. Mantener los bloqueos nativos para datos reales hasta sus validaciones independientes.
