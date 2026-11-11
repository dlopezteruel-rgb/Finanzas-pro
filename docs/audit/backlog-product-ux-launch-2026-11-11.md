# Backlog propuesto — producto, UX y lanzamiento

Fecha y base: **11/11/2026 · `66a045e17e310527c790a15ff2fe5dceaaba48a3`**.
Complementa el [informe de auditoría](product-ux-launch-2026-11-11.md). **Es una propuesta de ejecución; no autoriza ni implementa estas funciones.**

Prioridades: **P0** bloquea la entrega correspondiente o el lanzamiento anunciado; **P1** mejora necesaria para la experiencia prevista; **P2** queda fuera del primer lanzamiento. Los riesgos condicionados a nube, IA externa o tienda solo se activan si se elige esa modalidad. No se asignan fechas sin cerrar esas decisiones.

## Acuerdos previos — antes de programar

| ID   | Prioridad | Decisión / entregable                                                                                        | Criterio de cierre                                                                                                                                                |
| ---- | --------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D-01 | P0        | Glosario: raíz de sistema → familia → partida → ítem; fijar política de traslados y baja.                    | Producto aprueba qué es reordenación, qué es reclasificación y cuándo se archiva/bloquea una eliminación. No se permite una modificación implícita de históricos. |
| D-02 | P0        | ADR de datos: identidades, pertenencia temporal, importe directo/desglosado, snapshots, versión y reversión. | Ejemplos de conversión exacta y de rechazo, incluidas aprobaciones 3.1, referencias fuera de catálogo y error de cuota.                                           |
| D-03 | P0        | Identidad y propiedad: cuenta con finanzas locales o cuenta con persistencia remota; PWA o posterior nativo. | Alcance comercial y mensajes veraces; no equiparar autenticación a sincronización/cifrado. Proveedor aún por seleccionar.                                         |
| D-04 | P0        | Kit visual: logo maestro, derechos, tokens, navegación móvil y variantes regionales en/pt.                   | Revisión de Inicio, Planificación y Movimiento en 390 y 1440 px, con errores/estados vacíos; validación de propuesta sin tocar producción.                        |

Dependencias: estas decisiones parten del estado documentado, no necesitan cuentas reales. Archivos futuros propuestos: `docs/adr/` y guía de diseño. Riesgo: empezar por una maqueta sin fijar el modelo produciría otra migración o pantallas que prometen funciones ausentes. Validación: revisión de producto y walkthrough con fixtures, sin escrituras sobre datos del usuario.

## 1. Fase visual / UX

**Alcance:** identidad, accesibilidad, idioma base, rutas públicas, apertura móvil y navegación. Conservar cálculos y protecciones; no mezclar este trabajo con cambios de esquema presupuestario.

| ID   | Prioridad                        | Trabajo                               | Entregable y aceptación                                                                                                                                                                                                                                 |
| ---- | -------------------------------- | ------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| V-01 | P0                               | Tokens y componentes visuales         | Granate/marino/neutros aprobados; botones/campos/estados/foco comunes. Ningún texto esencial depende de colores de bajo contraste o de 8–10 px. Sin reemplazos globales de clases que rompan estados.                                                   |
| V-02 | P0                               | Infraestructura i18n                  | Claves es/en/it/fr/pt, fallback controlado, `html.lang`, plurales, errores y formateadores. Moneda y zona contable independientes del idioma. Entradas numéricas inequívocas. El nuevo código de las fases siguientes nace traducible.                  |
| V-03 | P1                               | Navegación móvil y detalle progresivo | Prototipo de cinco destinos y Más, con acceso a todos los módulos; etiquetas ≥12 px, objetivos táctiles recomendados 44×44 px, orientación horizontal y sin scroll global. Validar la hipótesis antes de consolidarla.                                  |
| V-04 | P0 para identidad de lanzamiento | Landing `/` y aplicación `/app`       | Landing corta con captura real ficticia, CTA funcional, explicación de almacenamiento y enlaces legales. URL de aplicación recuperable; no mostrar un login ficticio. No cargar todo el editor financiero para leer la landing.                         |
| V-05 | P0 para móvil anunciado          | Bootstrap/splash y activos            | Logo aprobado, carga ligada a disponibilidad real, estado de recuperación accesible; sin pausas artificiales ni pérdida de datos. Si se elige PWA, manifest/iconos y prueba de actualización; no afirmar soporte nativo por tener un splash web.        |
| V-06 | P1                               | Claridad y estados                    | Sustituir «Patrimonio Total en Cuentas» por etiqueta fiel al saldo líquido; demo identificada y separada, onboarding de cuenta vacía, contexto del periodo/filtro y aviso de estimación. Estados de cuota/conflicto/sin conexión sin perder borradores. |

**Módulos actuales afectados:** `src/index.css`, `src/responsive.css`, `Header.tsx`, `Navigation.tsx`, `DashboardView.tsx`, `BudgetWorkspace.tsx`, `PlanningView.tsx`, `TransactionModal.tsx`, `Overlay.tsx`, `SafeDialog.tsx`, `AssistantChatView.tsx`, `src/main.tsx`, `src/App.tsx`, `index.html`, `src/utils/finance.ts`, `planningMoney.ts`, `financialCalendar.ts`, validadores y mensajes.

**Módulos nuevos propuestos:** `src/styles/tokens.css`, componentes UI, `src/i18n/` y diccionarios, `src/app/` con separación de shell/rutas, `LandingPage`, `AppBootstrap`, activos de marca en `public/brand/` e iconos/manifest si se aprueba PWA. No existen todavía.

**Riesgos:** cascada de overrides `!important`; cortar modales; perder foco o el borrador al introducir rutas; ocultar navegación enlazada; confundir demo con datos personales; cambiar interpretación del dinero o del calendario por idioma. Un cambio de origen requiere traslado explícito de datos, aunque cambiar solo la ruta no lo requiera.

**Dependencias:** D-04 para marca; D-03 para mensajes/CTA y PWA; contrato de navegación que conserve `guardPlanning`, scroll y foco. No requiere implementar proveedores OAuth ni subítems para mejorar contraste.

**Pruebas necesarias para cerrar el bloque:**

- Capturas de los siete módulos en 360/390/768/1280/1440/1920, claro/oscuro; contraste AA por par real y estados, no solo color de marca. Teclado, foco visible, Escape/Tab, retorno de foco y lector de pantalla.
- Guardar/cancelar/descartar planificación antes de cambiar módulo/ruta; enlace Deudas/Tesorería al registro visible pese al filtro. No reiniciar FinanceStore por cambios de presentación.
- Cambio de idioma con un borrador: conserva entrada y cifras, sin escritura contable. Formatos `1.234,56`, `1,234.56` y separación francesa según locale, casos ambiguos rechazados y mes Madrid estable en otras zonas.
- Carga vacía, storage inválido/no disponible, Web Locks ausente, lentitud y movimiento reducido. El splash termina en app o recuperación, nunca en sustitución automática de datos.
- Safari/iOS y Android físicos para teclado, zoom, safe areas e instalación si corresponde. Los 42 estados auditados no sustituyen esas pruebas futuras.

**Puerta de salida:** revisión visual del usuario y regresiones financieras intactas. Se puede publicar una beta visual local con límites explícitos; no anunciar todavía funciones pendientes.

## 2. Fase de estructura presupuestaria

**Alcance:** identidad del catálogo, CRUD completo con raíces protegidas, desglose opcional y asignación de movimientos, con migración revisada y propagación a todos los lectores.

| ID   | Prioridad | Trabajo                              | Entregable y aceptación                                                                                                                                                                                                                 |
| ---- | --------- | ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01 | P0        | Prototipo de migración e IDs         | Mapear `type:code` y el contenedor real a IDs estables; mantener códigos/refs heredadas. Preview con conteos y saldos invariantes. Formato nuevo solo cuando se confirma una función nueva, sin escritura al abrir.                     |
| B-02 | P1        | Corregir duplicación actual          | La reproducción de 77→77 pasa a 77→78 tras confirmación válida; copia con ID/código único globalmente. Detectar grupo contenedor aunque `groupCode` sea `F.001` y el paquete `F_EXP`. Error/cuota no cierran ni aparentan éxito.        |
| B-03 | P0        | CRUD de familias/partidas/ítems      | Crear, renombrar, ordenar, mover, archivar y eliminar sin referencias. Ingreso/Gasto inmutables en UI y dominio. Traslado entre sentidos separado/bloqueado según D-01. Baja con conteo de referencias de todas las fechas.             |
| B-04 | P0        | Planificación directa o por ítems    | Unión de modos con una fuente por partida/mes. Cine 40 + Cultura 30 + Otros 20 = Ocio 90. Sin ítems: edición directa. Activar/desactivar desglose sobre importes previos exige preview y resolución explícita.                          |
| B-05 | P0        | Movimiento a ítem opcional           | Selector solo si hay ítems válidos; opción sin ítem, validación y descripción histórica. Cambiar partida limpia incompatibilidad solo en borrador. Todas las altas/ediciones y propuestas respetan el mismo contrato.                   |
| B-06 | P0        | Lectores, automatización y snapshots | Gráficos, tablas, planes, préstamos, recurrencias, copias, arrastres, aprobaciones, asistente y exportación agregan con las mismas reglas. Conservar identidad de ocurrencia y reserva regla/mes tras cambios; no duplicar movimientos. |

**Módulos actuales afectados:** `src/types/finance.ts`, `src/utils/backup.ts`, `financeStore.ts`, `budgetChanges.ts`, `deletion.ts`, `clearData.ts`, `planning.ts`, `planningBasis.ts`, `planningCarry.ts`, `planningAutomation.ts`, `planningAutomationValidation.ts`, `intelligentValidation.ts`, `recurringMovements.ts`, `finance.ts`, `chartData.ts`, `financialAssistant.ts`, `chatRegistration.ts`, `parser.ts`, catálogo inicial, `App.tsx`, `BudgetsView.tsx`, `PlanningSection.tsx`, `PlanningView.tsx`, `PartidaSelector.tsx`, `PartidaDetailModal.tsx`, `TransactionModal.tsx`, `MovementProposalModal.tsx`, `RecurringMovementsView.tsx` y gráficos.

**Módulos nuevos propuestos:** dominio/validación de catálogo, asignaciones mensuales, migración/lectores de versiones y un editor de estructura. Introducir servicios alrededor de funciones existentes; no una reescritura global del motor financiero.

**Riesgos:** doble cómputo de padre/hijos; IDs huérfanos; atribución histórica alterada al mover; cambio accidental del tipo de transacción; edición de totales aprobados; referenciar ítems eliminados en reglas/préstamos; arreglos heurísticos de históricos; consumo de cuota por copias/versiones.

**Dependencias:** D-01 y D-02 cerrados; i18n V-02 para nuevos textos. B-01 precede al editor persistente. B-04 y B-05 se activan tras B-03; B-06 debe cerrarse antes de habilitarlas al usuario. No exponer medio editor con agregadores antiguos en producción.

**Pruebas necesarias para cerrar el bloque:**

1. Fixtures de todas las versiones 2.5–3.1 y de la futura versión: lectura sin mutación, exportación/restauración, identidades estables, copia recuperable íntegra y rechazo de etiquetas/campos/céntimos/referencias corruptos.
2. Modos directo/desglosado, cero y céntimos, suma exacta, eliminación del último ítem, creación sobre un plan aprobado y cancelación. No hay total padre editable con importe contradictorio.
3. Duplicar, reordenar y trasladar entre contenedores reales; colisiones globales, familia vacía y con descendientes, eliminación con y sin dependencias, raíces protegidas también mediante llamada directa al dominio.
4. Ítem que cambia de padre: históricos conservados y nuevas altas vinculadas al periodo correcto. Nombres personalizados preservados en cada idioma. Movimientos con fecha anterior y planes futuros con reglas requieren un caso explícito en la especificación. Probar el catálogo personalizado en el parser: no resolver una categoría desconocida eligiendo silenciosamente la primera partida.
5. Gasto compartido: total bancario completo, parte propia económica; reintegros y principal sin inflar ingresos; traspasos con neto correcto. Añadir/quitar el ítem de un borrador no mueve dinero.
6. Copiar planificación y aplicar reglas conserva detalle, omite destinos protegidos y es idempotente. Arrastres y presupuesto efectivo se presentan separados; no duplicar un arrastre al sumar hijos. Fotografías antiguas no reciben desgloses inventados.
7. Quota, error/verificación de backup, bloqueo, doble envío, revisión obsoleta y dos pestañas: operación íntegra o ningún cambio. Guardias de borrador y navegación enlazada conservadas.

**Puerta de salida:** fixtures doradas con importes/fechas/históricos equivalentes antes/después, diferencias solo consentidas y revisión del usuario del modelo final. Exportar el formato nuevo no permite usarlo con un código antiguo que no lo admite; preparar recuperación y comunicación.

## 3. Fase de cuentas y autenticación

**Alcance obligatorio:** cartera predeterminada coherente; identidad y propiedad reales para el modo comercial elegido; correo/contraseña y Google; preparación Apple. La sincronización se implementa **solo si D-03 la incluye**, no por el mero hecho de añadir login.

| ID   | Prioridad                                   | Trabajo                                        | Entregable y aceptación                                                                                                                                                                                                                                                |
| ---- | ------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| C-01 | P0                                          | Cartera predeterminada                         | Resolver por ID, automática con una cartera sin escribir en lectura; selección con varias. Altas, filtros y gráficos contextuales coherentes, con Todas; editar conserva el vínculo. Los totales globales y los enlaces profundos no quedan limitados silenciosamente. |
| C-02 | P0                                          | Contrato de identidad y proveedor              | Selección de proveedor por recuperación, Google/Apple, coste, región y portabilidad. Sesión/loading/guest/authenticated/recuperación separados del snapshot financiero. Sin proveedor ficticio ni contraseñas propias.                                                 |
| C-03 | P0 para cuentas anunciadas                  | Correo y Google de extremo a extremo           | Alta, verificación, inicio, recuperación, cierre, sesiones expiradas, callbacks y vinculación con reautenticación; UI y servidor unidos. Ningún secreto en Vite, backups, repositorio o logs.                                                                          |
| C-04 | P0                                          | Partición y adopción revisada de datos locales | Espacio/propietario, caché y recuperaciones aislados; cambio A→B sin destello de datos de A. Preview/copia y consentimiento antes de asociar o subir datos. No eliminar storage original automáticamente ni adoptar la demo como personal.                             |
| C-05 | P0 si se elige nube                         | Repositorio remoto y concurrencia              | API autorizada por espacio, transacción/revisión servidor y operationId idempotente. Exportación privada y conflictos visibles. Versión inicial online; offline sincronizado queda P2 salvo alcance independiente.                                                     |
| C-06 | P1; P0 antes de una app iOS que lo requiera | Preparación Apple/iOS                          | Adaptador de proveedor, identidad estable/relay email, callbacks según web o nativo y revisión de requisitos vigentes de tienda. Botón habilitado y anuncio de soporte solo después de prueba real.                                                                    |

**Módulos actuales afectados:** `WalletsView.tsx`, `WalletModal.tsx`, `TransactionModal.tsx`, `MovementProposalModal.tsx`, `TransferModal.tsx`, `SettleDebtModal.tsx`, `RecurringMovementsView.tsx`, `TransactionsView.tsx`, `DebtsWorkspace.tsx`, gráficos, `chatRegistration.ts`, `backup.ts`, `financeStore.ts`, `useFinanceData.ts`, `deletion.ts`, `App.tsx` y `server.ts`.

**Módulos nuevos propuestos:** resolver de cartera, `src/auth/`, rutas/páginas de cuenta, contrato de repositorio y workspace, middleware de sesión/autorización, migración de perfil local. Si se aprueba nube: adaptador de base de datos y transacciones de agregado con revisión; índice de propietario y recuperación. Son propuestas, no componentes ya existentes.

**Riesgos:** tratar `wallets[0]` como identidad; filtrar el saldo global sin indicarlo; sesión meramente cosmética; mezclar A/B por la clave global actual; pérdida por limpieza en logout; linking inseguro por email; callbacks abiertos; retries que duplican una liquidación; creer que Web Locks coordina otros dispositivos.

**Dependencias:** D-03 antes de C-02–C-05; contrato de referencia/defaultWalletId y versión de datos antes de C-01. C-01 puede adelantarse después de B-01/D-02, sin esperar a OAuth. C-03 necesita configuración externa legítima del proveedor, dominio y canal de email; no se dispone de una configuración comprobada en esta auditoría. C-04 precede a habilitar login sobre datos existentes.

**Pruebas necesarias para cerrar el bloque:**

- Cero/una/varias carteras, preferencia ausente/válida/huérfana, renombrar/eliminar, cuenta explícita del parser y doble pestaña. No corregir un ID inválido mediante asignación silenciosa. Verificar toda la matriz de alcance del informe.
- Nuevo movimiento, edición, traspaso, deuda y regla con la preferencia cambiada: solo las nuevas elecciones elegibles se preseleccionan. Un enlace a otra cartera sigue encontrándose y enfocándose.
- Usuario A y B en el mismo navegador y en llamadas directas a API: lectura, edición, exportación y restauración cruzadas denegadas; expiración y peticiones en vuelo no reintroducen datos de A.
- Email no verificado, contraseña incorrecta, recuperación caducada/reutilizada, cuenta existente por Google/email, cancelación y caída de proveedor. Tests de contrato con IdP de pruebas; E2E real en configuración de staging antes de anunciarlo.
- CSRF/origen, cookie/sesión, state/nonce/PKCE, autorización de workspace y cambio de sesión. Prueba local aislada no certifica seguridad de una configuración OAuth real.
- Si hay nube: escrituras concurrentes desde dos dispositivos, replay del operationId, restauración con revisión obsoleta, error parcial de red y operación contable vinculada atómica. La demo no se sincroniza sin elección explícita.
- Apple relay, proveedor que no devuelve nombre/email de nuevo, web versus flujo nativo, revocación y unlink; pruebas físicas y política aplicable antes de tienda.

**Puerta de salida:** cuentas reales verificadas en staging con usuarios de prueba, aislamiento demostrado y promesas comerciales fieles al modo local/nube elegido. No es suficiente que «se vea el login».

## 4. Fase de lanzamiento

**Alcance:** estabilización, distribución, soporte, información comercial/legal y operación. Sin nuevas funciones bancarias ni inversiones. Pagos/suscripción requieren decisión y alcance aparte si se elige vender de esa forma.

| ID   | Prioridad | Trabajo                                | Entregable y aceptación                                                                                                                                                                                        |
| ---- | --------- | -------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| L-01 | P0        | CI de producto y staging               | Checks en cada PR de producto, unitarios/UI/migración/aislamiento, artefacto trazable y despliegue de prueba. No depender del workflow de demo restringido a #16.                                              |
| L-02 | P0        | Protección del servicio público        | Sesión/autorización cuando proceda, límites de uso y coste, payload/timeout, cabeceras y errores sin PII. IA externa desactivada hasta tener controles, información y configuración verificadas.               |
| L-03 | P0        | QA de lanzamiento completo             | Matriz de dispositivos/navegadores/idiomas y accesibilidad, tareas de usuario, recuperación y actualización. Bloqueos críticos resueltos; límites publicados.                                                  |
| L-04 | P0        | Transparencia, documentación y soporte | README coherente con lockfile/JSON actual, guía de recuperación, política de datos/IA, términos y soporte; validación de derechos de marca/licencias. Definir oferta/precio sin prometer capacidades ausentes. |
| L-05 | P1        | Rendimiento y observabilidad           | Reducir carga inicial por rutas/idioma/módulo, medir Core Web Vitals reales y errores sin importes/conceptos. No convertir medición del tamaño en puntuación de rendimiento inventada.                         |
| L-06 | P0        | Salida gradual y reversión             | Checklist, versión de código y datos, plan de recuperación, cambio de origen comunicado, beta controlada y responsable de decisión. Nunca restauración/downgrade ciego sobre escrituras posteriores.           |

**Módulos afectados:** `.github/workflows/` nuevo CI general; `vite.config.ts`, `src/main.tsx`, shell/rutas, gráficos, i18n, `server.ts`, configuración de hosting/IdP, `README.md`, `docs/`, activos `public/`. Hosting, dominio, tienda y textos legales aún no acreditados; no son archivos ya configurados por este informe.

**Riesgos:** activar una clave en endpoints sin controles del servicio; claim de seguridad/IA/sincronización falso; versiones antiguas sobre datos nuevos; perder acceso al almacenamiento por cambio de origen; borrar copias al liberar cuota; emails que no llegan; publicar logs con datos; soporte sin recuperación reproducible.

**Dependencias:** puertas de V/B/C cerradas para lo que se anuncia, proveedor/hosting legítimos, responsables de producto/operación y revisión de privacidad/licencias. La auditoría no ejecuta cambios de infraestructura, pagos ni envíos a usuarios.

**Pruebas necesarias:**

- Repetir regresión completa del producto con fixtures: unitarios, lint, build, UI, migraciones y cuotas. Añadir los tests de nuevas funciones; los 255/180 actuales no las cubren por existir en el backlog.
- Staging HTTPS con cuentas de prueba y límites; ausencia de secretos en bundle/export y de datos financieros en logs. Verificar error del proveedor y exceso de cuota sin perder el borrador.
- Safari/iOS, Chrome/Android y Firefox; teclado/lector de pantalla; zoom nativo 200/400 % y reflow; idiomas anunciados sin cortes ni textos pendientes de traducir. Aplicar excepciones legítimas de tablas bidimensionales y targets, no un checker indiscriminado.
- Exportación/restauración entre versiones, contraseña/sesión recuperada sin mezclar finanzas, pérdida de conexión, actualización PWA si existe y app antigua abierta. Simular traslado entre orígenes solo con backups ficticios.
- Landing sin promesas falsas, flujos de datos explicados, soporte y cuentas de prueba recuperables. Core Web Vitals de campo aún requieren medición tras una salida controlada; fijar objetivos previos en staging y no inventar resultados de campo.

**Puerta de salida:** acta de revisión con bugs P0 cerrados, evidencias por capacidad anunciada, controles operativos comprobados y autorización posterior del usuario para publicar. No se fusiona nada ni se despliega desde esta auditoría.

## Secuencia y fuera de alcance

1. D-01–D-04: aprobar contratos y muestras visuales.
2. V: tokens/i18n primero; después shell, navegación, landing y bootstrap. Mantener el dominio estable.
3. B: migración/identidades antes del CRUD; desglose y asignación de movimientos con todos los lectores integrados antes de habilitar.
4. C: cartera puede adelantarse una vez fijado el esquema; identidad, separación de datos y proveedores se habilitan juntos para el alcance elegido. La arquitectura de propiedad se decide desde D-03.
5. L: staging, validación, soporte y salida comercial gradual.

Fuera del primer alcance sin nueva aprobación: banca conectada, multimoneda, facturación empresarial, motor nuevo de amortización, asesoramiento regulado, edición colaborativa, sincronización offline compleja y app nativa completa. Preparar un adaptador no acredita esas funciones.

Antes de cada fase: propuesta concreta, archivos, migraciones, demo ficticia y criterios de aceptación. Después: pruebas, diff de alcance y revisión del resultado. **El siguiente paso es aprobar las decisiones del bloque D y el alcance de la fase V, no implementar todo este backlog de una vez.**
