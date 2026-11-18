# Auditoría del punto de partida

Base `208f1830581dc6c424118ee0edb77903ec83042e`, rama limpia desde `origin/main`. Se actualizan las referencias de main explícitamente (el fetch configurado del worktree anterior sólo seguía su rama). PR #32 fusionada; PR #34 independiente. Inventario de once worktrees y pendientes conservado en [evidencias](evidence/initial-worktrees.json). No se cambia main ni se incorporan commits de #34.

| Superficie | Contrato actual | Consecuencia para identidad |
| --- | --- | --- |
| `src/main.tsx`, `src/app/Root.tsx` | Web/landing y carga diferida App; entry nativo explícito | Conservar entradas y APP_BASE_PATH; ninguna integración auth en 7A.1 |
| `src/App.tsx` | Estado confirmado compartido, cinco idiomas, formularios | No insertar una UI de acceso sin proveedor real; el legado sigue disponible |
| `useFinanceData`, `financeSession`, `PlatformServices` | Un controlador por sesión/plataforma; apertura asíncrona | Separar sesión auth del controlador y de la propiedad; no duplicar instancias al cambiar idioma/tema |
| FinanceStore | Propuestas aisladas, validadores económicos, revisión y confirmación | Compartido e intacto; identidad no cambia cuentas, importes, IDs ni aprobaciones |
| WebFinanceController / IndexedDB | DB `finanzas-pro-web-v1`, schema1; documento3.5, strict, Web Locks, CAS, recibos, copias atómicas, reconciliación | No existe partición por cuenta aún. El perfil debe considerarse **local no adjudicado** |
| Archivo localStorage | `finanzas_pro_data_v1`, copias `finanzas_pro_recovery_`, claves históricas y autoridad de migración | No reutilizarlo para tokens ni borrar origen; no migrar por login |
| SQLCipher Android/iOS | Schema1;4.20, CAS, recibos, EXTRA/DELETE, claves OS separadas de JS | No hay propiedad verificada por cuenta; conservar bloqueo de datos reales |
| Memoria | `memoryFinanceStorage()` síncrono, mapa privado | Reutilizado exclusivamente por sandbox nuevo, con cola por instancia; no reemplaza Web Locks persistentes |
| `server.ts` | Express, APIs de asistente/registro, Vite estático en main | No auth ni almacenamiento financiero remoto. No activar servicios, CORS ni endpoints nuevos |
| Credenciales | Sin proveedor IdP ni tenant/dominios autorizados | `provider:null`, autenticación real deshabilitada |
| CI | Tres checks,46 suites; Chromium50min, P0 obligatorio | Se mantienen workflow, manifiesto y aserciones originales |

`DEMO_DATA` en el App heredado es el nombre de sus **valores iniciales**, no prueba de que un perfil local sea ficticio o eliminable. Un usuario puede haber convertido ese perfil en finanzas personales. No se clasifica, borra ni vincula por nombres, IDs semilla, correo o primera sesión autenticada.

## Comprobaciones de partida reales

Node24.22.1/npm11.9.0. Ejecución local:733 unitarias,50 infraestructura, lint y build correctos. [Códigos y duración](evidence/before/commands.json). Las dependencias se reutilizan por enlaces de archivos instalados con lockfile idéntico y caches mutables excluidas: no se afirma un nuevo npm ci local con sólo unos138MB libres. GitHub CI realiza npm ci limpio; no se añaden dependencias de proveedor.

Ambos npm audit se ejecutan explícitamente y conservan salida1:6paquetes high/0critical en este host, por el mismo advisory propagado (incluye Tailwind/Vite). No son6CVE distintos ni una actualización de dependencias. Picomatch4.0.7 y su propagación a fdir/tinyglobby/Vite/pluginReact siguen siendo un riesgo de la base. Vite sigue importándose estáticamente en producción en **esta rama**, porque la mitigación pertenece a #34 y no se integra sin autorización. Ver [auditoría completa](evidence/before/audit.json) y [omit=dev](evidence/before/audit-production.json). No se elimina ni modifica un check de seguridad para hacer pasar esta PR: se conserva el workflow original de main, que no contiene el cuarto job añadido por #34.

No se inspeccionan perfiles financieros personales ni Google AI Studio. Las pruebas sólo preparan perfiles ficticios y aislados. Android/iOS conservan sus bloqueos; Chromium y SQLCipher Linux no verifican Keystore, Keychain ni sesiones reales móviles.
