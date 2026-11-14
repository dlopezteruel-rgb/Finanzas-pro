# Fase 5E — Rendimiento, carga diferida y estabilidad móvil

## Estado de partida y alcance

Base verificada: `c9d70bf85f20ad983d13f5652b26f7fe91c231a8`, merge de la PR #28. `origin/main` no contiene commits posteriores. Árbol limpio antes de crear `perf/phase-5e-performance-optimization`. Se conserva la rama 5D y no se modifica main.

Se han revisado package.json, Vite 8.3, los tres trabajos del workflow y los informes 5A–5D. Node 24.22.1, Chromium local 156.0.8078.79; playwright-core 1.64.1. npm ci: 188 paquetes con caché del workspace, sin cambios de dependencias/lockfile. Unitarias iniciales: 585/585, sin fallos, omisiones, cancelaciones o pendientes; lint y build correctos. La batería Chromium inicial está en ejecución; no se declara aprobada todavía.

## Checkpoints

1. Línea base de producción, recursos, CPU/red móviles y volúmenes ficticios; ninguna optimización funcional.
2. Diccionarios asíncronos validados, caché, errores, carreras, preferencia/cross-tab y contratos síncronos auditados.
3. División selectiva por módulos, estados accesibles y conservación de borradores; repetir mediciones.
4. Optimización localizada únicamente donde el perfil demuestre coste, con invariantes y volúmenes.
5. Regresión completa, comparación, evidencias, documentación y PR Draft con CI verificable.

Cada checkpoint se publicará en la rama independiente. Esta versión registra trabajo en curso, no aceptación final.

## Arquitectura inicial y riesgos observados

Root ya difiere App y ChartSlot ya difiere FinancialCharts. messages.ts importa estáticamente los cinco diccionarios. La comprobación isLanguageAvailable valida el diccionario completo en cada llamada, incluso renderizados del selector y lecturas de preferencia. App importa estáticamente los módulos secundarios. BudgetWorkspace mantiene ambos paneles montados para conservar sus borradores: una separación debe diferir la primera visita, sin desmontar después el panel visitado.

Se conserva el contrato booleano de setLanguage. Ningún consumidor actual espera una promesa. translatorFor y los helpers de presentación se usan también en pruebas/SSR síncronas; se deberá conservar su disponibilidad en ese entorno mediante preparación explícita, sin incluir los cuatro diccionarios en la carga inicial del navegador.

FinanceStore, Web Locks, validadores financieros, cálculos, parsers, API/prompts, JSON 2.5–3.5, catalogNames y APP_BASE_PATH/DISABLE_HMR quedan protegidos. Los 944 grupos axe incompletos de 5D (51 conjuntos equivalentes) continúan pendientes de revisión contextual, no son violaciones ni aprobaciones manuales. No se afirma prueba en dispositivos físicos ni lector de pantalla.

## Checkpoint 1 — Inventario medido

Build real de la base: entrada 1.181.075 bytes minificados / 321.042 gzip (zlib nivel 6); App 532.661 / 133.919; FinancialCharts 40.779 / 12.567. El gzip se mide con el mismo algoritmo en ambas versiones; puede diferir ligeramente del estimador de Vite. Los cuatro diccionarios adicionales aparecen en el grafo estático inicial. El inventario completo conserva imports y tamaños de módulos antes de minificar: no atribuye porcentajes gzip exactos a módulos individuales. React DOM y los diccionarios dominan la entrada.

El procedimiento scripts/performance/measure.ts sirve gzip de producción, conserva caché HTTP en recarga y usa contextos aislados para carga fría. Perfiles: móvil390/CPU4×/80ms/1,6Mbps; tablet768/CPU2×/40ms/5Mbps; escritorio1280/CPU1×/20ms/10Mbps. Captura FCP, último LCP observado, CLS sin interacción reciente, long tasks, ejecución acumulada CDP, recursos reales gzip, heap aproximado y latencia con dos frames. Las medidas no equivalen a INP de campo ni dispositivo físico. 100/1.000/5.000 registros se validan con el parser real y conservan el grafo de transferencias/compartidos y JSON3.5.

Piloto exploratorio concurrente con regresión (no comparación causal final): landing móvil es321.042 bytes gzip; App454.961; primer listado1.000≈5,5s con CPU4×. El procedimiento se repetirá secuencialmente sobre ambos builds, sin pruebas concurrentes, con tres muestras y mediana/rango. Los tiempos del piloto no se usarán para aceptar la optimización. La batería inicial continúa en el checkout base inmutable; herramientas de CI22/22 aprobadas.

## Checkpoint 2 — Idiomas diferidos

Los cuatro diccionarios extranjeros tienen imports dinámicos explícitos, caché de promesas simultáneas, validación exhaustiva antes de publicarlos y objetos inmutables. Se conserva el registro/readiness y los validadores de claves/duplicados/placeholders/plurales existentes; las pruebas de fuentes siguen verificando los cinco diccionarios completos. La disponibilidad declarada se separa del estado cargado. La validación de objetos ya validados se memoriza por identidad, evitando repetir las 2.037 claves en cada render del selector. En SSR/Node se preparan los diccionarios antes de exponer los traductores síncronos; la rama SSR desaparece en el build del navegador. translatorFor exige diccionario cargado en vez de producir interfaz mezclada silenciosamente.

setLanguage sigue devolviendo booleano: true significa selección válida aceptada, no descarga completada. Todos sus consumidores actuales son manejadores de selección que no esperaban una promesa. El idioma activo, lang y metadatos cambian juntos al completarse la carga; mientras tanto se conserva el contenido anterior y se anuncia un estado en ese idioma. En arranque extranjero se muestra un estado español coherente antes de montar la interfaz extranjera. Una generación creciente descarta respuestas/errores obsoletos y evita persistir selecciones antiguas. Los eventos storage no generan escrituras. Un fallo conserva contenido/preferencia y ofrece reintento; cuota denegada conserva el comportamiento anterior en memoria. Cambiar de idioma no desmonta formularios.

Pruebas focalizadas: 587/587 unitarias; lint y build correctos. Nueva suite Chromium: 15/15 resultados (14 escenarios y contenedor), incluye cinco arranques fríos, tres anchuras con foco/axe, arranque lento, respuestas invertidas, descarga abortada y reintento real, desconexión/caché, cross-tab con borrador y preferencia corrupta. Cero violaciones axe en los estados nuevos. Todas las aserciones anteriores se conservan. El inventario de fuentes se regenera y revisa, sin relajar su prueba.

La prueba exploratoria de 5.000 registros alcanzó el límite de acción de 30s al abrir Movimientos en CPU4×. Se conserva el informe parcial; no es una medida completa ni una aprobación. Para medir ese caso se utilizará una ventana exploratoria de 120s, documentada a partir del límite observado; no se modifica ningún timeout de regresión ni de CI.
