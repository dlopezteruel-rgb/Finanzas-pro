# Decisión previa al merge

Base main31a8e8d; PR32ceb08c7. Se verifica GitHub y se preservan los diez worktrees, incluidos los cambios ajenos sin seguimiento. Respaldo local recovery/phase-5h-before-web-integration-20261117 y bundle verificado con prerrequisito ce1ec839.

El inventario initial-audit.json enumera14conflictos reales antes de resolverlos. La integración será un merge de main en la rama existente, sin reset ni force-push.

Un hook comparte el contrato de datos confirmados y selecciona controlador por servicios de plataforma: web abre IndexedDB; el contenedor nativo entrega únicamente su controlador ya abierto tras consentimiento; memoria es exclusivamente prototipo explícito. La API discrimina web/native/prototype. La recuperación forense solo existe en web. Bootstrap es propietario del controlador nativo; el hook es propietario del web. El desmontaje deja terminar las operaciones concedidas y retira observadores; nunca anuncia rollback ni reenvía propuestas.

Se conserva FinanceStore sobre staging síncrono y todos los controladores/validadores de ambos padres. No se cambian motores, cifrado, journal, EXTRA, claves, modelos ni JSON. Los bloqueos nativos no se desbloquean por instalar plugins o aprobar pruebas web.

CI tendrá un manifiesto único con46suites (44comunes+vault+durabilidad), excluyendo duplicados de registro pero sin perder casos. Las pruebas de ambos planificadores se preservan/adaptan al único plan: máximo2 y barreras exclusivas para rutas, builds compartidos y SIGKILL. No se amplían50min. Se documentarán los totales realmente medidos.
