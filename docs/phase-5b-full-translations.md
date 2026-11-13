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
| Español | es-ES | Disponible | Referencia canónica, UI previa en español | Regresión española en ejecución |
| English | en-GB | Próximamente, deshabilitado | Pendiente | No verificados |
| Italiano | it-IT | Próximamente, deshabilitado | Pendiente | No verificados |
| Français | fr-FR | Próximamente, deshabilitado | Pendiente | No verificados |
| Português | pt-PT | Próximamente, deshabilitado | Pendiente | No verificados |

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
| Familia presupuestaria | Budget family | Famiglia di bilancio | Famille budgétaire | Família orçamental |
| Partida | Budget item | Voce di bilancio | Poste budgétaire | Rubrica orçamental |
| Traspaso | Transfer | Trasferimento | Virement | Transferência |
| Tramitado/pendiente | Processed/Pending | Contabilizzato/In sospeso | Comptabilisé/En attente | Processado/Pendente |
| Reintegro compartido | Reimbursement | Rimborso | Remboursement | Reembolso |

## Validación registrada

Base recién ejecutada: 440 unitarias; lint/build y 301 resultados Chromium de las 22 suites anteriores correctos. No se usan referencias históricas como sustituto de pruebas.

Primera extracción: 443 unitarias correctas (incluye tres pruebas nuevas de slots, escape de datos y claves de módulos); lint y build correctos. Chromium focalizado: carteras 14/14 y eliminación segura 23/23; batería financiera ampliada 57/57. Total focalizado: 94 resultados, cero fallos, omisiones o cancelaciones. La batería anterior se conserva íntegra.

Los 136 grupos incompletos axe de referencia se mantienen como **pendientes de revisión manual**, separados de violaciones y de resultados verificados. Sus cifras se volverán a medir. No se afirma uso de lector de pantalla ni dispositivos físicos.
