# Fase 7A.1 — Fundamentos de identidad y demostración temporal

Estado: arquitectura y contratos ejecutables, sin proveedor configurado, cuentas reales, infraestructura alojada ni migración. Proveedor recomendado **Auth0, pendiente de aprobación**, con condiciones de plan, región y vinculación. Supabase Auth continúa como alternativa condicionada a verificar su política de vinculación; PostgreSQL futuro no queda ligado al proveedor de identidad.

Base efectiva: `208f1830581dc6c424118ee0edb77903ec83042e` de `origin/main`, merge de PR #32. Rama independiente `feature/phase-7a-identity-foundation`. PR #34 permanece abierta/Draft en `c18638c57c062d0295fb352d00e75889c89d3526`; no se incorpora su código ni se modifica esa PR. Los once worktrees anteriores se preservan.

La [decisión de producto del 18/11/2026](https://app.notion.com/p/41cfedd2019f81f0b26bcdde776a71fb) exige cuenta para el producto real, descarta invitados con datos personales y reserva una demo ficticia temporal para beta privada. Correo, Google y Apple no implican selección de proveedor. En esta fase no se crean proyectos de autenticación ni credenciales.

## Implementado y propuesto

| Superficie | 7A.1 ejecutable | Pendiente |
| --- | --- | --- |
| Identidad/sesión | Contratos; estados; expiración/revocación **simuladas**; cancelación y proyecciones sin credenciales | Verificación real por IdP/BFF y autorización por recurso |
| Acceso real nuevo | Siempre denegado por la nueva frontera, incluso con un objeto de usuario inventado | 7A.2 y aislamiento validado antes de habilitar perfiles reales |
| Demo | Adaptador existente en memoria; acciones ficticias cerradas; ciclo de vida; política deshabilitada; pruebas en navegador | Host/UI de beta aprobado; no hay entrada de producto activa |
| Datos existentes | Ninguna modificación; sólo contratos de propiedad/transición | Vista previa, copia, consentimiento y asociación verificada en fases posteriores |
| Backend/proveedor | Interfaces sin implementación remota | Selección autorizada e implementación 7A.2 |
| Almacenamiento/sync | Diseño 7B/7C | Nada remoto implementado |

**El comportamiento financiero heredado de main sigue funcionando sin cambios.** `/app` aún es el acceso local anterior, no un acceso autenticado de 7A.2. No se presenta esta PR como cierre de acceso a ese producto heredado ni como aislamiento por identidad ya implantado allí. La nueva frontera no está conectada a React, Express o los proyectos nativos. No hay formulario de login ficticio. Las pruebas de contratos no certifican autorización de servidor ni login nativo.

La demo es una composición opcional separada del coordinador de autenticación. El build normal no incluye sus módulos ni SDK de identidad. Activar una variable o escribir un identificador en el navegador no configura un proveedor ni da acceso financiero. Toda demo abierta por el contrato sólo dispone de su memoria y acciones ficticias, nunca de un perfil previo.

## Documentación y entrega

- [Auditoría de main y superficies](audit.md).
- [Comparativa de proveedores y recomendación](providers.md).
- [Arquitectura, sesiones y correo/Google/Apple](architecture.md).
- [Demo y retirada](demo.md).
- [Transición local, amenazas, 7B y 7C](migration-threats.md).
- [Pruebas, límites y registro final de CI/SHA](validation.md).
- [Fuentes oficiales consultadas el 18/11/2026](sources.md).

La descripción de la única PR Draft de esta rama es el **registro final de entrega**: SHA exacto, URL de CI, tres checks individuales, números reales y procedencia local/CI. Se actualiza al terminar la ejecución sin introducir otro commit únicamente para escribir su propio hash. Los artefactos incluyen las revisiones utilizadas. Los resultados previos se mantienen separados de los del SHA final.

No fusionar, desplegar, contratar, distribuir APK/IPA, sincronizar Google AI Studio ni habilitar datos reales móviles. Antes de 7A.2 se requiere autorización expresa de proveedor, plan/región, flujos y política de vinculación.
