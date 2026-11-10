# Fase 5 — Gestión financiera inteligente

## Auditoría inicial

Issue #14 y sus tres comentarios leídos el 10/11/2026. Clon nuevo, sin recuperar ni inspeccionar el entorno anterior por instrucción del usuario. `main` y `feature/phase-5-intelligent-finance` parten de `cb27fa9ff7f360e49185795d49b3314fa8f46af1`; árbol limpio, sin commits de implementación remotos.

## Diseño e invariantes

Se conserva FinanceStore y su única clave activa, Web Locks, revisión optimista, validación antes de persistir y copia recuperable verificada. Consultar, navegar, calcular y previsualizar no escribe. Solo las confirmaciones explícitas modifican el estado.

El esquema 3.1 añadirá `intelligentFinance`: reglas de movimientos (distintas de PlanningRule), registro de identidades de ocurrencias y compromisos personales con liquidaciones en céntimos. Es opcional: los formatos 2.5–3.0 mantienen su validación y no se migran al abrirlos. La primera escritura con nuevos metadatos usa el mecanismo existente de recuperación antes de cambiar la clave activa. Los históricos y fotografías de planificación se conservan.

Principales riesgos: pérdida de identidad al editar/borrar movimientos, doble cobro/pago entre proyecciones y banco, referencias huérfanas, cambios concurrentes y cuota de almacenamiento. Se protegen en el dominio, en el validador y en las mutaciones, además de en la UI.

## Calendario

Periodo inicial desde Europe/Madrid. Selector accesible con meses con actividad, entrada independiente de mes y año (sin depender del soporte de input month), flechas y Hoy. Rango 0001–9999; cálculo de meses y bisiestos sin conversiones locales de Date. Los cambios pasan por la guardia de planificación existente y no escriben preferencias.

## Estado de validación

En desarrollo. Los resultados se incorporarán después de ejecutar las comprobaciones.
