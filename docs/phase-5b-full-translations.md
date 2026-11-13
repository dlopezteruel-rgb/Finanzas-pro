# Fase 5B — Traducción integral (en curso)

Base limpia: `95d08a2dd7c2d9752b8865fc8aa4a32263b5eb96`, merge PR #25. Rama `feature/phase-5b-full-translations`. No se modifica main ni se fusiona/despliega/sincroniza Google AI Studio. Se mantienen dependencias, workflow y protecciones.

## Checkpoints y estado real

1. Inventario y extracción de P1 bancario/común: validado en español, traducciones pendientes. Reutiliza I18nProvider/useI18n, es.ts, messages.ts y preference.ts; añade mensajes canónicos en es.p1.ts y parámetros React al mismo sistema.
2. P1 de almacenamiento, inicio, histórico, planificación, catálogo y automatizaciones: pendiente.
3. P2/P3, diccionarios completos en-GB, it-IT, fr-FR, pt-PT y adaptadores de presentación: pendiente.
4. Matriz completa multidioma, accesibilidad, activación por idioma validado y entrega: pendiente.

**Ningún idioma nuevo está habilitado.** No se declara una traducción completa mientras haya superficies o pruebas pendientes.

| Idioma | Locale | Estado del selector | Cobertura actual | Flujos integrales traducidos |
| --- | --- | --- | --- | --- |
| Español | es-ES | Disponible | Referencia canónica, UI previa en español | Regresión española inicial correcta |
| English | en-GB | Próximamente, deshabilitado | 425/425 claves registradas; UI incompleta | No verificados |
| Italiano | it-IT | Próximamente, deshabilitado | 425/425 claves registradas; UI incompleta | No verificados |
| Français | fr-FR | Próximamente, deshabilitado | 425/425 claves registradas; UI incompleta | No verificados |
| Português | pt-PT | Próximamente, deshabilitado | 425/425 claves registradas; UI incompleta | No verificados |

## Diccionarios y guarda de disponibilidad

Los archivos independientes en.ts, it.ts, fr.ts y pt.ts contienen 425 claves cada uno: controles y mensajes canónicos P1, contadores plurales y metadatos. Esto es cobertura completa del **catálogo registrado actual**, no de toda la interfaz. Las superficies sin extraer siguen pendientes; por eso los cuatro idiomas siguen inactivos.

`isLanguageAvailable` exige status ready, diccionario completo/compatible y las dos condiciones de languageReadiness: uiComplete y flowsVerified. Un diccionario completo por sí solo no permite activarlo ni persistirlo. Provider, validación de preferencias y selector comparten esa guarda. No hay detección automática del navegador ni un segundo sistema de idiomas.

Los plurales usan las reglas Intl existentes, claves one/other y familias tipadas; hay casos de cero, uno, varios y cantidades grandes en los cinco locales. Las cantidades se formatean solo para mostrar; no vuelven a ningún parser. La primera aplicación es el contador «y N más» en eliminación, sin cambiar su significado.

Las coincidencias de ortografía nativa (por ejemplo «Guardar» en pt-PT o «disponible» en fr-FR) no se contabilizan como texto español residual. El listado revisado de claves coincidentes está en phase-5b-lexical-exceptions.json, restringido a las claves actuales, sin eximir superficies pendientes. IBAN y nombres propios de ejemplos siguen intactos. Se conservan TIN/TAE como siglas del modelo existente, sin reinterpretarlas como otros indicadores regulatorios.

## Inventario reproducible

`scripts/i18n/inventory.mjs` usa el parser AST que ya incluye Rolldown/Vite; no se añade ninguna dependencia. Ejecutar `node scripts/i18n/inventory.mjs /tmp/finanzas-i18n.json` desde el repositorio. Registra archivo, línea, posición, tipo, atributo/propiedad, texto, expresiones dinámicas y clasificación. Incluye los literales no JSX que requieren revisión; no presupone que todo string de código sea texto traducible.

Inventario inicial: 790 fragmentos JSX y 300 atributos visibles, además de 3.618 literales para revisión semántica. Otros 768 son de importación/tipo y 2.057 son atributos internos. Esas categorías automáticas son candidatos, no una certificación de cobertura. Las claves ya localizadas se distinguen de textos pendientes; el informe resumido permite reproducir el análisis por archivo.

Superficies: Root/carga/error y landing; navegación, cabecera, opciones, PeriodSelector y Overlay; DashboardView/TreasuryView; TransactionsView y registro rápido; WalletsView, transferencias, préstamos y liquidaciones; BudgetWorkspace/PlanningView/BudgetsView, catálogo/subítems y automatizaciones; ContactsView y gastos compartidos; AssistantChatView y propuestas; ChartSlot/FinancialCharts/InteractiveChart; validaciones y mensajes producidos por utilidades.

### Política de excepciones

- Nombres, notas, conceptos, carteras, contactos, familias y partidas son datos, incluidos los ficticios del catálogo y los históricos: se conservan literalmente. No se traducen valores por coincidencia de texto.
- Identificadores, enumeraciones, claves de almacenamiento, códigos, versiones JSON, rutas de validación, clases CSS y atributos técnicos permanecen invariantes.
- Parser, prompts, intención y API del asistente quedan intactos. Los ejemplos que se envían al parser deben conservar su payload español y anunciarse como ejemplos en español; localizar sus etiquetas no debe cambiar las consultas enviadas.
- Los errores de dominio se mantienen dentro de las utilidades financieras; su presentación requiere un adaptador explícito, sin traducir por defecto textos desconocidos ni campos del usuario.
- FinanZas, EUR, IBAN y nombres propios de ejemplos son invariantes deliberados. Un literal pendiente de revisar no se considera una excepción justificada ni cobertura completa.

## Arquitectura y seguridad de datos

Las claves siguen derivando del español y son tipadas. Las frases con formato usan `I18nText`, conectado al mismo useI18n y diccionario: los slots tienen nombre y conservan React nodes, sin HTML crudo, sin evaluación de parámetros ni concatenaciones traducidas por partes. Los datos del usuario se insertan como valores escapados. Las traducciones siguen siendo objetos por clave; no tablas de índices.

No cambian FinanceStore, sus revisiones/Web Locks, lógica financiera, cálculos, parsers, migraciones, modelos, API o JSON 2.5–3.4. La preferencia continúa independiente en `finanzas.ui.language`. EUR y Europe/Madrid se mantienen para presentación Intl; ninguna cadena localizada vuelve a un parser.

## Glosario de revisión

| Concepto | en-GB | it-IT | fr-FR | pt-PT |
| --- | --- | --- | --- | --- |
| Movimiento | Transaction | Movimento | Opération | Movimento |
| Cartera/cuenta | Account | Conto | Compte | Conta |
| Familia presupuestaria | Budget family | Famiglia di budget | Famille budgétaire | Família orçamental |
| Partida | Budget item | Voce di budget | Poste budgétaire | Rubrica orçamental |
| Traspaso | Transfer | Trasferimento | Virement | Transferência |
| Tramitado/pendiente | Processed/Pending | Contabilizzato/In sospeso | Comptabilisé/En attente | Processado/Pendente |
| Reintegro compartido | Reimbursement | Rimborso | Remboursement | Reembolso |

## Validación registrada

Base recién ejecutada: 440 unitarias; lint/build y 301 resultados Chromium de las 22 suites anteriores correctos. No se usan referencias históricas como sustituto de pruebas.

Primera extracción: 443 unitarias correctas (incluye tres pruebas nuevas de slots, escape de datos y claves de módulos); lint y build correctos. Chromium focalizado: carteras 14/14 y eliminación segura 23/23; batería financiera ampliada 57/57. Total focalizado: 94 resultados, cero fallos, omisiones o cancelaciones. La batería anterior se conserva íntegra.

Los 136 grupos incompletos axe de referencia se mantienen como **pendientes de revisión manual**, separados de violaciones y de resultados verificados. Sus cifras se volverán a medir. No se afirma uso de lector de pantalla ni dispositivos físicos.

### Checkpoint de diccionarios validado localmente

La [primera ejecución de Actions](https://github.com/dlopezteruel-rgb/Finanzas-pro/actions/runs/43409428078), SHA 4109a04f273117fc3c53f28e2b19d2e96107cde0, terminó con los tres checks verdes. Los 136 grupos incompletos axe siguen siendo revisión manual pendiente, no violaciones ni accesibilidad certificada.

Durante el desarrollo una prueba nueva construyó mal su resultado esperado usando String.replace con `$&`; se corrigió el oráculo para comparar literalmente. La interpolación de producción ya preservaba esos caracteres y no cambió para ocultar un fallo.

Checkpoint de diccionarios: **454 unitarias**, lint/build y **10 resultados Chromium** del selector/preferencias correctos, sin omisiones ni cancelaciones. Son pruebas de las claves, variantes, plurales, slots, seguridad y bloqueo de idiomas no verificados. **No son pruebas de la interfaz completa en los otros cuatro idiomas**. Sus flujos siguen pendientes y bloqueados.

Los tres checks de cada checkpoint se conservan como evidencia de regresión del código publicado; un check verde no certifica por sí solo cobertura lingüística integral.

### Checkpoint de inicio, histórico, cuentas, recuperación y periodos

Se extraen 149 mensajes adicionales de App, DashboardView, TransactionsView, WalletsView, ConfirmClearModal y PeriodSelector; se añaden diez variantes plurales y dos metadatos. Total registrado: 425 claves por diccionario, todavía sin cobertura integral de UI. Las cabeceras y marcadores CSV permanecen como formato de intercambio fijo; el idioma no reescribe sus datos.

El título del documento y las descripciones HTML/Open Graph se actualizan mediante el proveedor existente, junto con lang. El HTML inicial sigue en español como idioma predeterminado; la preferencia local se aplica en el cliente.

Incidencia **5B-001 — Overlay**: el cambio de idioma cross-tab con un borrador de cuenta abierto conservaba el valor pero reinicializaba el foco porque title formaba parte del efecto de apertura. Reproducida en los cinco idiomas en un build de prueba: cinco casos fallidos, sin pérdida de datos. Se separa la actualización aria-label del ciclo de apertura; pasan los cinco casos, la devolución del foco y el guardado posterior con importe 1234.56. No se cambia el guardado ni los validadores.

Pruebas nuevas: scripts/translatedBanking.browser.ts, añadido al final de test:ui, conserva las 22 suites anteriores. Para verificar idiomas previstos sin habilitarlos se compila una **vista previa exclusivamente de prueba** en un directorio temporal: mismo proveedor, diccionarios y aplicación, con guardas de disponibilidad sustituidas solo en memoria por un plugin de test. No se reescriben registros ni archivos de disponibilidad de producción. Cuando todos los idiomas estén activos se utilizará directamente el build de producción. Estos resultados focalizados **no autorizan a marcar completos los flujos ni a activar idiomas**.

Verificado localmente: 457 unitarias, lint/build; 92 resultados Chromium de regresión española (sharedUx 12, deletion 23, phase1 57) y seis resultados de la nueva suite en los cinco idiomas, 1280 px/tema oscuro. Diez superficies axe del formulario de cuenta sin violaciones y sin grupos incompletos nuevos en esa prueba. El informe distingue esos datos de los **136 grupos incompletos de referencia** de la auditoría general, que siguen pendientes de revisión manual. La regresión completa y el check de GitHub de este checkpoint se registrarán al cerrar la ejecución.

Pendiente: resto de planificación/catálogo/automatizaciones, contactos/compartidos/asistente/gráficos y utilidades que producen UI; fechas/importes de todos los módulos mediante Intl preservando exactamente céntimos; matriz completa 390/768/1280 claro/oscuro, ausencia de residuales, restauración por idioma e imágenes de landing. Por eso uiComplete y flowsVerified siguen en false para en/it/fr/pt.

El inventario v2 incorpora fronteras server/config y distingue errores dentro de callbacks de atributos puramente técnicos. El análisis completo detectó y corrigió un error del propio recorrido: Array.flatMap pasaba su índice como segundo argumento del analizador. Dos pruebas nuevas cubren la clasificación de callbacks y el recorrido completo; no se ha traducido código interno para resolverlo. El informe señala también metadatos HTML, estilos e imágenes, y localiza llamadas de presentación por archivo. Todavía quedan candidatos visibles pendientes; no se deduce una cobertura integral de los recuentos automáticos.
