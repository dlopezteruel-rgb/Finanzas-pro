# Fase 5A — Infraestructura multidioma

Base: `e186615474d6670d613b0b1a6d39dbefc0379c20` (merge PR #24), verificada en origin/main. Rama creada con árbol limpio: `feature/phase-5a-i18n-infrastructure`. Sin despliegues, migraciones ni cambios de protecciones. `docs/phase-5.md` histórico se conserva.

## Arquitectura reutilizada

Se mantiene `src/i18n/index.tsx`, I18nProvider/useI18n, las integraciones de Root, navegación, Brand y landing, y las funciones presentationMoney/presentationDate. No hay segundo proveedor ni dependencias nuevas. El diccionario español se separa en `src/i18n/es.ts`; `messages.ts` centraliza idiomas, tipos, fallback e interpolación; `preference.ts` aísla almacenamiento visual.

`MessageKey` deriva del español y `Messages` exige sus claves. Los parámetros entre llaves se deducen de cada mensaje y TypeScript exige sus nombres. Se sustituyen una sola vez como texto: nunca HTML ni evaluación recursiva. `translateFrom` vuelve al español por clave ausente o vacía. `validateDictionary` recibe entradas antes de construir un objeto y detecta duplicados, ausentes, desconocidas, vacías y placeholders incompatibles. Las pruebas comprueban también duplicados en el archivo fuente español. Para plurales se ofrece la categoría estándar de `Intl.PluralRules`; 5B podrá asociarla a claves tipadas sin concatenar frases o construir otro motor.

El proveedor cambia el estado React sin recargar, ofrece setLanguage y actualiza `document.documentElement.lang` al locale. Solo es-ES está habilitado. Registro: es/es-ES, en/en-GB, it/it-IT, fr/fr-FR, pt/pt-PT. No se consulta navigator.language. Los nombres de los idiomas son nativos.

## Preferencia y recuperación

Clave independiente: `finanzas.ui.language`, valor plano validado `es`. No se guarda por montar/leer el proveedor ni por encontrar un valor corrupto. Una selección válida intenta persistir; una selección desconocida o prevista se rechaza. Un fallo de acceso o cuota mantiene el estado en la pestaña y muestra un mensaje de estado. Al recargar sin almacenamiento utilizable vuelve a español. El listener storage escucha la clave y el borrado global, ignora otros cambios y no escribe en respuesta al evento: prepara la sincronización entre pestañas sin bucles.

La preferencia no se incorpora a FinanceStore, revisiones, Web Locks, snapshots, exportaciones o restauraciones. No se cambia DATA_KEY ni JSON 2.5–3.4. La restauración financiera sigue exigiendo sus copias recuperables y confirmación. Las pruebas comprueban conservación literal de la escritura financiera durante acciones de idioma y conservación de registros al restaurar/exportar.

## Selector y elementos comunes

«Opciones y datos» incluye select nativo etiquetado y descripción accesible. Español disponible; English, Italiano, Français y Português próximamente y deshabilitados. Las dimensiones y scroll del panel se limitan al viewport. Apertura por teclado, foco en primera acción, Tab/Shift+Tab, Escape y retorno al botón permiten operar sin ratón. No se presenta el panel como un menú ARIA cuyo patrón no implemente: es una región con controles nativos.

Se reutilizan traducciones en cabecera (tema y etiquetas accesibles), opciones de datos, cancelación compartida en formularios/restauración/eliminación y etiqueta de nombre de cuenta. Navegación, carga/error de Root y landing ya usaban el proveedor. No se reemplazan masivamente contenidos de módulos.

## Presentación y datos financieros

presentationMoney usa Intl.NumberFormat, EUR invariable. presentationDate usa Intl.DateTimeFormat y Europe/Madrid. Las pruebas recorren los cinco locales y verifican fechas que cruzan medianoche. La entrada sigue usando los parsers actuales; ninguna cadena localizada vuelve a convertirse en importe. Se mantienen números internos, ISO, cálculos, redondeos, enumeraciones GASTO/INGRESO e identidades.

Nombres personalizados de cuentas/contactos, catálogo, conceptos, notas e históricos se presentan literalmente. No se traduce automáticamente ningún dato del usuario. Gemini y el registro natural no se modifican.

## Inventario para 5B

| Prioridad | Componentes/área | Familias de claves a incorporar |
| --- | --- | --- |
| P1 | Overlay, PeriodSelector y diálogos comunes | dialog.*, period.*, common.*, form.*; etiquetas, errores y estados pendientes |
| P1 | App y avisos de almacenamiento/recuperación | storage.*, recovery.*, import.*; instrucciones y confirmaciones con consecuencias exactas |
| P1 | TransactionModal, LoanModal, TransferModal, SettleDebtModal | movement.*, loan.*, transfer.*, settlement.*; sin traducir valores internos |
| P1 | DashboardView, WalletsView y TransactionsView | dashboard.*, wallets.*, transactions.*; totales y fechas de presentación |
| P1 | BudgetWorkspace, PlanningView, BudgetsView, CatalogManager y automatizaciones | planning.*, catalog.*, automation.*; archivo, dependencias, aprobaciones y plurales |
| P2 | ContactsView, SharedExpenseDetail y gastos compartidos | contacts.*, shared.*; reparto, reintegros, estados y accesibilidad |
| P2 | AssistantChatView, MovementProposalModal y registro rápido | assistant.*, proposal.*; textos visibles solamente, sin cambiar el parser |
| P2 | ChartSlot, gráficos y leyendas | charts.*; nombres de series estáticas y anuncios accesibles |
| P2 | Landing y navegación | completar/verificar claves existentes en los cuatro idiomas previstos |
| P3 | Ayudas, tooltips y textos largos de módulos | help.*; revisión lingüística contextual y responsive |

Las familias son una propuesta de inventario, no claves declaradas sin uso. 5B debe inventariar además literales en JSX, aria-label/title/placeholder y mensajes de utils antes de considerar completa una traducción.

## Criterios para habilitar un idioma

1. Diccionario completo y compatible con español; entradas únicas, parámetros y plurales verificados.
2. Todos los textos estáticos del flujo (incluidos errores, accesibilidad y confirmaciones destructivas) extraídos y traducidos con revisión lingüística.
3. Unitarias y Chromium completas, navegación/teclado y axe, varios tamaños y ambos temas, verificando ausencia de interfaz mezclada.
4. Importes/fechas correctos sin modificar parsers o contabilidad; datos personalizados e históricos intactos.
5. Solo entonces registrar el diccionario y marcar status ready. La existencia parcial de un diccionario no habilita por sí sola un idioma previsto.

## Incidencia observada en GitHub

La ejecución [43399992606](https://github.com/dlopezteruel-rgb/Finanzas-pro/actions/runs/43399992606) detectó contraste insuficiente al cargar Inicio oscuro a 768 px: seis estados con colores intermedios entre claro y oscuro (4.19:1 y 4.48:1). Fueron 289 resultados correctos y dos fallidos (caso y contenedor); la suite i18n no llegó a ejecutarse. Unitarias y código verdes no equivalen a CI completo correcto.

El tema se aplicaba en un efecto pasivo después del render. Se adelanta únicamente ese atributo a useLayoutEffect, antes del pintado, conservando valores y guardado. La regresión comprueba el tema en el primer frame visible en seis combinaciones y mantiene intacta la auditoría axe. La auditoría focalizada con Chrome for Testing 156.0.8078.4 completó sus ocho escenarios y contenedor sin fallos; se exige otra regresión completa local y remota.

## Validación

Resultados iniciales y finales, ejecuciones reales de Actions e incidencias se incorporarán tras completar las baterías. Las referencias históricas no se cuentan como pruebas actuales.

Se añade `scripts/i18n.browser.ts` al final de npm run test:ui, preservando todas las suites y aserciones existentes. El ejecutor de CI descubre automáticamente la nueva suite. Los tres checks obligatorios continúan siendo Unitarias; Lint, build y diff; Chromium y axe. No se alteran workflow, protecciones o reglas axe.

Las pruebas son ficticias y aisladas; no usan Google AI Studio ni credenciales Gemini. Axe es automatizado; sus resultados incompletos requieren revisión manual. No se afirma prueba con lector de pantalla ni dispositivo físico.
