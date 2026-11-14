# Fase 5B — Traducción integral de FinanZas Pro

Base verificada y limpia: `origin/main`, PR #25, SHA `95d08a2dd7c2d9752b8865fc8aa4a32263b5eb96`. Rama `feature/phase-5b-full-translations`. Entrega en [PR Draft #26](https://github.com/dlopezteruel-rgb/Finanzas-pro/pull/26), sin fusionar ni desplegar. No se modifica main ni se sincroniza Google AI Studio.

La interfaz propia se ha extraído al sistema de 5A y los cinco idiomas quedan disponibles después de validar diccionarios, superficies y recorridos. Las pruebas finales locales utilizan el build real de producción: todas las matrices declaran isolatedPreview=false, sin sustitución de guardas. Los checkpoints anteriores conservaron los cuatro idiomas deshabilitados hasta completar esta revisión. El [historial](phase-5b-checkpoints.md) conserva SHA, fallos y resultados intermedios; no deben confundirse con el estado final.

## Matriz de idiomas

| Idioma | Locale | Claves canónicas compatibles | Estado | Recorridos de producción |
| --- | --- | --- | --- | --- |
| Español | es-ES | 1896/1896 | Habilitado, referencia canónica | Correctos |
| English | en-GB | 1896/1896 | Habilitado | Correctos |
| Italiano | it-IT | 1896/1896 | Habilitado | Correctos |
| Français | fr-FR | 1896/1896 | Habilitado | Correctos |
| Português | pt-PT | 1896/1896 | Habilitado | Correctos |

La cifra de claves se distingue de la cobertura de recorridos, detallada más abajo. Se validan duplicados, ausencia de claves, parámetros nombrados, plurales y coincidencias nativas por clave. La guarda continúa rechazando un diccionario incompleto, un estado previsto o flujos no revisados; las pruebas negativas se conservan mediante inyección de fallos controlada. La preferencia permanece en `finanzas.ui.language`, independiente de los datos financieros, sincronizada entre pestañas y sin recarga. Las preferencias inválidas recuperan español sin reescribirlas silenciosamente.

## Resultados finales locales

| Comprobación | Resultado real |
| --- | --- |
| npm ci | 188 paquetes; lockfile y dependencias sin cambios |
| npm test | **515/515**, 0 fallos, omisiones, cancelaciones o pendientes |
| Infraestructura CI | **22/22**, 0 fallos, omisiones o cancelaciones |
| npm run lint | Correcto |
| npm run build | Correcto; aviso de chunks >500 kB conservado |
| CHROMIUM_PATH=/usr/bin/chromium npm run test:ui | **655/655 resultados, 34 suites**, 0 fallos, omisiones, cancelaciones o pendientes |
| git diff --check y diff real contra origin/main | Correctos |
| Axe general | **128 superficies, 0 violaciones**, 132 grupos incompletos locales |
| Axe de matrices multidioma | **1217 observaciones, 0 violaciones**, 1495 grupos incompletos locales |

Entorno: Node v24.22.1; Chromium del sistema 156.0.8078.79; playwright-core 1.64.1; axe-core 4.14.0. Suma de las duraciones de las 34 suites: 32.63 minutos; no incluye instalación ni se presenta como tiempo de una única prueba. El [manifiesto de entrega](phase-5b-delivery.json) contiene resultados por suite, entorno, huella de fuentes y los 163 archivos modificados.

Los **136 grupos incompletos de referencia** permanecen pendientes de revisión manual. Se conservan individualmente con procedencia y SHA-256 verificados, separados de los 132 actuales locales, los 136 del checkpoint remoto y los adicionales de las matrices, en [el registro manual](phase-5b-axe-manual-review.json). No son infracciones automáticas ni verificaciones manuales aprobadas; los recuentos repetidos no equivalen a defectos únicos.

## CI verificable

El [checkpoint eb028b1](https://github.com/dlopezteruel-rgb/Finanzas-pro/actions/runs/43535258718) completó los tres trabajos: Unitarias **514/514**, infraestructura **22/22**, Lint/build/diff y Chromium/axe **655/655 en 34 suites**. El artefacto de navegador se descargó y su SHA-256 coincidió con GitHub. Duración del comando de navegador: **1745,148 s**; axe general 128 superficies, cero violaciones y 136 grupos incompletos. Runner ubuntu-24.04, imagen 20261111.370.1; Node 24.22.1; Chrome for Testing 156.0.8078.4, revisión 1248. En ese checkpoint los cuatro idiomas seguían deshabilitados y las matrices eran vistas de prueba: no se presenta como comprobación del selector final habilitado.

La activación añade una prueba de guarda, de ahí las **515** unitarias de entrega, y amplía las aserciones de la suite original de infraestructura sin retirar casos. El SHA publicado y la ejecución remota de la entrega se registran en la [descripción de PR #26](https://github.com/dlopezteruel-rgb/Finanzas-pro/pull/26) y en sus [checks asociados al SHA](https://github.com/dlopezteruel-rgb/Finanzas-pro/pull/26/checks). Los resultados focalizados o del checkpoint previo no sustituyen esos checks.

## Cobertura de superficies

La referencia canónica contiene 1896 claves. Español, English (en-GB), Italiano (it-IT), Français (fr-FR) y Português (pt-PT) comparten claves, parámetros nombrados y familias plurales. Se mantiene el proveedor, selector y preferencia de 5A; no se incorpora otra librería ni otro sistema de idiomas.

| Prioridad / superficie | Archivos y frontera de presentación | Comprobación específica |
| --- | --- | --- |
| P1 · Comunes, navegación y carga | Root, Brand, Header, Navigation, Overlay, SafeDialog, PeriodSelector, LanguageSelector | Infraestructura 5A ampliada; selector real, cinco idiomas, teclado, foco y metadatos |
| P1 · Almacenamiento y recuperación | App, RestorationModal, ConfirmClearModal, ConfirmDeleteDialog, storageMessages/domainMessages | Importación inválida/válida, cuota, Web Locks, exportación, descarga de copia original, dos niveles de confirmación; JSON 2.5–3.4 |
| P1 · Movimientos, histórico y propuestas | TransactionsView, TransactionModal, MovementProposalModal, PartidaSelector, SubitemSelector | Valores/input ISO y números originales, partida propia, confirmación explícita, error de reparto nativo |
| P1 · Cuentas y transferencias | WalletsView, WalletModal, TransferModal, etiquetas de tipos | Creación, duplicados, cuota de predeterminada, saldos, marcadores decimales y borrado protegido |
| P1 · Préstamos, liquidaciones y reglas periódicas | LoansView, LoanModal, DebtsWorkspace, FinanceReview, RecurringMovementsView, bankingReviews | Informes tipados, reintegros y pagos, reglas y fechas; sin alterar modelos contables |
| P1 · Inicio y tesorería | DashboardView, TreasuryView, presentadores de avisos | Saldos, previsiones, estados y datos guardados; EUR y Madrid |
| P1 · Planificación y presupuestos | BudgetWorkspace, PlanningView/Section, BudgetsView, PartidaDetailModal | Pestañas, déficits, aprobación, histórico, revisión, meses/años, nombres personales y fotos originales |
| P1 · Catálogo y automatización | CatalogManager, CatalogDragHandle, SubitemManager, SubitemBreakdown, PlanningAutomationPanel | Archivo con dependencias, barrera Ingresos/Gastos, teclado/táctil, copia/reglas/arrastres, subítems e identidades |
| P2 · Contactos y compartidos | ContactsView, CreateContactModal, SettleDebtModal, SharedExpenseDetail | Reparto exacto, cobro parcial, compensación sin banco, deuda inválida y eliminación bloqueada |
| P2 · Gráficos | ChartSlot, FinancialCharts, InteractiveChart y chartMessages | Series, filtros, selección, tabla accesible, estados, leyendas, fechas, porcentajes y nombres literales |
| P2 · Asistente y registro rápido | AssistantChatView, QuickNaturalLanguageInput, assistantMessages/naturalMessages | Negación, ambigüedad, propuestas corregibles, confirmación/doble envío, respuesta local, API simulada y eco exacto del fallback |
| P3 · Landing, ayudas y textos largos | LandingPage, diccionarios canónicos, capturas nativas y avisos de recuperación | Imagen por idioma, títulos, descripción, destrucción, plurales múltiples y advertencias económicas completas |

Las matrices usan 390, 768 y 1280 px, claro/oscuro, cinco locales y datos ficticios aislados. La landing conserva su paleta clara existente al volver desde ambos temas de la app; no se presenta como un rediseño con modo oscuro propio. El recorrido bancario inicial de seis resultados es de escritorio; los formularios bancarios móviles se cubren también en las matrices de presentación, cierre, préstamos y almacenamiento. Las comprobaciones de teclado/Tab/Shift+Tab/Escape y foco corresponden a esos recorridos, no a una afirmación de prueba física o con lector de pantalla.

## Excepciones deliberadas y conservación de significado

- Datos personales, nombres de carteras/contactos/familias/partidas, conceptos, notas, históricos y datos ficticios persistidos permanecen literales, incluso si coinciden con una frase de interfaz.
- Identificadores, enums internos, códigos y rutas JSON, versiones 2.5–3.4, CSV de intercambio, claves de almacenamiento, archivos de copia y la palabra **BORRAR** no se traducen. Se localizan sus etiquetas, nunca sus valores.
- Los prompts y ejemplos enviados al reconocimiento conservan su español original; se traducen sus etiquetas y se explica esa limitación. No se amplía el reconocimiento libre ni se solicita Gemini para las pruebas.
- Las respuestas externas y los mensajes desconocidos se conservan literalmente. Únicamente el eco exacto del fallback calculado y enviado por esa misma petición se reconoce como texto propio: se vuelve a presentar con el contexto original. Una respuesta externa parecida, con texto adicional, permanece intacta. No cambia el request ni el servidor.
- Los controles nativos del navegador pueden usar la configuración regional del navegador: no se reemplaza su calendario, selector de archivos ni mensajes nativos de validación. La presentación propia usa Intl, EUR y Europe/Madrid; input, ISO, céntimos y parsers permanecen independientes del idioma.
- Marca, siglas del modelo y homógrafos nativos revisados están documentados por clave; los signos, separadores e identificadores A/B se enumeran en el inventario. No se usa una excepción genérica para ocultar español residual propio.

## Límite de los cambios financieros

FinanceStore, Web Locks, parsers de entrada/intenciones, cálculos, migraciones, modelos, servidor/API y lockfile permanecen idénticos a la base remota. En financialAssistant.ts solo se añade presentación opcional de salida. Sus dos argumentos originales conservan exactamente 53 snapshots y los payloads del servicio; las funciones reciben los mismos céntimos originales. Los adaptadores de borrado y gráficos devuelven copias de presentación. Nunca se analiza de vuelta un importe formateado ni se traduce por coincidencia un nombre personal.

## Evidencias y reproducción

`docs/phase-5b-inventory.json` registra hashes y decisiones de cada candidato visible; se regenera con `node scripts/i18n/report.mjs`. Una prueba rechaza inventarios desactualizados y excepciones PENDING. El detector de residuales existe solo en tests, examina nodos/atributos visibles y mantiene las excepciones de datos y homógrafos explícitas.

Los artefactos de GitHub contienen logs, entorno, resumen por suite y observaciones axe. La [PR Draft #26](https://github.com/dlopezteruel-rgb/Finanzas-pro/pull/26) publica el SHA y las ejecuciones reales de cada entrega. Las imágenes de `docs/screenshots/phase-5b/` y las cuatro vistas de `public/preview/` usan exclusivamente fixtures ficticios. El manifiesto de captura conserva hashes y procedencia; las capturas previas con guardas de prueba se identifican como tales, sin presentarlas como prueba del build habilitado.

Reproducción local: Node 24.22.1, npm ci, npm test, node scripts/ci/run-check.mjs tools, npm run lint, npm run build, CHROMIUM_PATH=/usr/bin/chromium npm run test:ui y git diff --check. CI resuelve el ejecutable fijado por playwright-core 1.64.1; no presupone /usr/bin/chromium. No se requiere ni se utiliza API key.

## Limitaciones y pendientes ajenos a la cobertura lingüística

Las violaciones axe automatizadas y los grupos incompletos se cuentan por separado. Los grupos incompletos generales y los adicionales de las matrices requieren revisión manual; no son defectos únicos ni resultados de accesibilidad verificados. No se han probado dispositivos físicos ni lectores de pantalla. No se declaran Firefox, WebKit o Safari probados en esta fase.

Vite conserva el aviso de chunks superiores a 500 kB; el diccionario completo añade coste de descarga y se registra, sin introducir una refactorización o dependencias para ocultar el aviso. npm ci avisa de node-domexception deprecado, ya presente en la base. La única excepción de infraestructura es ampliar el presupuesto del trabajo Chromium de 30 a 40 minutos: la batería completa medida tarda 32,49 minutos sin instalación. No cambian los timeouts individuales, permisos, acciones, eventos ni protecciones de main. Se mantiene la incidencia histórica de clic francés móvil con su diagnóstico; las repeticiones y la ejecución final se registran con sus resultados reales, sin force-click, reglas axe ignoradas ni reintentos para esconder un fallo.

## Correcciones reproducibles durante la localización

Se corrigieron pérdida de foco al cambiar el título de un diálogo (5B-001), solapamientos franceses de etiquetas (002–003), botones X sin nombre accesible (004 y 013), tablas sin alternativa de foco (005), leyenda de gráfico truncada (006), listas Markdown con estructura inválida (007), contraste/recorte de avisos (008), errores de reparto sin localizar (009), error de preferencia bancaria sin localizar (010), resumen de borrado sin localizar (011), selección de gráfico con texto original (012), eco del fallback propio (014) y desbordamiento de metadatos del registro rápido (015). El historial enlaza pruebas, casos fallidos previos y capturas comparativas.

El fallo francés de CI quedó reproducido: el viewport de 390 crecía a 407 px por una fila sin ajuste; con una cartera ficticia larga crecía a 680 px. Se ajustan los campos y se comprueba clientWidth, sin ocultar el desbordamiento. Las dos regresiones nuevas y la ejecución remota completa verifican la navegación real, sin force-click, reintentos ni límites individuales ampliados.

La primera batería se interrumpió expresamente para añadir el eco del fallback; la primera pasada responsive focal coincidió con una recompilación y no se considera correcta. Ambas están documentadas y fueron sustituidas por ejecuciones completas desde un build estable, conservando todas las aserciones. No se eliminan pruebas ni se relaja axe.
