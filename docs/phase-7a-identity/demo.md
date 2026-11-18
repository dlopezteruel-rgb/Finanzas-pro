# Demo temporal aislada y retirada

No es un sistema de invitados ni una cuenta anónima. No hay UUID de invitado persistido, tenant, usuario remoto, sincronización ni conversión a una cuenta. La nueva demo es un sandbox de contratos sin entrada en la UI del producto7A.1.

`demo.ts` utiliza `memoryFinanceStorage()` y FinanceStore intacto, en una instancia privada. Cada apertura produce una semilla nueva de categorías de sistema y una cartera **DEMO FICTICIA**, con100EUR ficticios, sin contactos o transacciones personales. La API permite exclusivamente dos acciones curadas: añadir cartera ficticia y registrar un gasto ficticio de1,23EUR. No acepta snapshots arbitrarios, mutaciones externas ni archivos. Los IDs de movimientos ficticios son de esa instancia, no sujetos de autenticación. No usa localStorage/IndexedDB/SQLCipher ni servicios remotos.

Los datos retornados son copias aisladas. Cerrar libera la referencia al store; las operaciones en cola verifican que la instancia siga abierta antes de ejecutar. Una nueva apertura empieza desde cero. No se promete conservación, fsync ni borrado criptográfico de copias que queden en el heap. `exportedAt` de una nueva semilla puede cambiar: la prueba de reinicio compara todos los campos financieros y versión, excluyendo sólo ese timestamp. El perfil anterior de IndexedDB se compara íntegro, sin esa exclusión.

`demoEntry.ts` compone opcionalmente demo e identidad. Entrar limpia la proyección de sesión anterior; cualquier transición de identidad cierra el sandbox. Salir no copia un documento ni restaura la sesión anterior. Retirar/cerrar la composición deja el coordinador auth utilizable. El entry auth se compila sin módulos de demo ni persistencia; no contiene referencias a ellos.

## Disponibilidad y rutas

`disabledDemoPolicy` es el valor por defecto del producto. Requiere simultáneamente canal private-beta, enabled, referencia de aprobación explícita y fecha futura. Cada lectura/acción revalida; error de política, desactivación o caducidad cierran irreversiblemente esa instancia. Volver a habilitar requiere una nueva instancia sin los cambios anteriores.

`demoRouteDecision` es un contrato para el futuro host, no un router registrado ahora. Sólo acepta el pathname canónico base+demo bajo política válida; flags, query/hash, aliases y rutas alternativas no lo activan. Las acciones del controlador vuelven a comprobar disponibilidad: no se limita a ocultar un botón.

La configuración es **gobernanza de despliegue**, no autenticación ni barrera de acceso a información real. Un atacante puede alterar su JS o falsificar una configuración local: seguirá encontrando únicamente una API en memoria sin puertos hacia perfiles reales. En7A.2 el despliegue de beta debe aprobarse explícitamente y el host debe respetar el contrato. No hay una variable de entorno que active autenticación, importación real o propiedad.

El build normal7A.1 no incluye el código de identidad/demo por no estar conectado a las entradas. `/demo`, query flags y variantes de landing mantienen la landing sin leer perfiles financieros. `/app` y sus variantes heredadas conservan su comportamiento local anterior: no se presentan como rutas demo ni como acceso autenticado. No se usa una nueva pantalla ficticia para aparentar seguridad sobre ese legado.

## Retirada tras la beta

1. Retirar autorización y entregar política deshabilitada; cada sesión activa cierra su memoria al comprobarla.
2. Retirar el host/entry opcional de demo y sus enlaces de la futura pantalla de acceso.
3. Mantener el entry/coordinador de autenticación; el contrato de compilación verifica su independencia.
4. No borrar ni migrar IndexedDB, SQLCipher, backups o cuentas al retirar demo. No hay perfil de invitado que convertir.

Las pruebas Chromium migran primero un perfil ficticio con el **motor web real**, guardan el contenido completo, descargan el App y abren el harness aislado. Durante demo se bloquean/registran accesos a storage, DB, puente nativo y red; se ejercita offline y se compara el perfil previo íntegro. Es evidencia de aislamiento en Chromium, no de autenticación remota o runtime nativo. La preparación del canario ocurre antes de la demo y se distingue de sus operaciones.
