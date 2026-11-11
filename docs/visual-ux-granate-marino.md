# FinanZas: preparación visual granate y marino

Rama independiente `feature/visual-ux-granate-marino`, creada desde `main` en `66a045e17e310527c790a15ff2fe5dceaaba48a3`. Referencia: auditoría del 11/11/2026, commit `51346494805e8cc4bc609da38326a31c7b7c010f`. Esta propuesta requiere revisión visual antes de autorizar la fusión.

## Alcance y separación financiera

La rama cambia presentación, navegación, rutas de entrada y preparación de idiomas. No cambia el modelo JSON 3.1, cálculos, saldos, préstamos, planes, funciones de dominio, Web Locks, copias recuperables ni el servidor. No incorpora autenticación, nube, pagos ni subítems. La corrección del catálogo está exclusivamente en la PR #17; esta rama no presupone su fusión. Antes de fusionar ambas se debe validar su combinación, especialmente `App.tsx`, navegación y las pruebas del catálogo.

`/` presenta una landing breve; `/app` y `/app/` abren la aplicación. La navegación usa el mismo origen y la misma clave `DATA_KEY`: no se exportan, trasladan ni transforman los datos para introducir rutas. El servidor existente sirve ambas rutas mediante su fallback SPA. Los enlaces internos a liquidaciones, orígenes de tesorería y ocurrencias mantienen sus identificadores y los controladores existentes. No se incorporan nuevas rutas para cada módulo.

## Tokens y componentes

| Token | Claro | Oscuro | Uso |
| --- | --- | --- | --- |
| Marca | `#A63D4D` | `#A63D4D` | Acciones principales, marca |
| Fondo | `#F7F4EF` | `#111D30` | Lienzo |
| Superficie | `#FFFFFF` | `#1B2B43` | Tarjetas y formularios |
| Texto | `#172B4D` | `#F3F1ED` | Contenido principal |
| Secundario | `#5A6472` | `#BCC7D4` | Etiquetas y contexto |
| Borde de control | `#7C8795` | `#91A3B9` | Campos y controles |
| Foco | `#172B4D` | `#F5D5DC` | Contorno visible de 3 px |

`src/styles/tokens.css` define la fuente de verdad. `experience.css` aplica tokens a componentes nuevos y traduce las clases de presentación anteriores mediante un puente explícito; el diseño de tablas y planificación permanece en `index.css` y `responsive.css`. Se han eliminado las anteriores sobrescrituras de tema que competían con los tokens. No se han reemplazado indiscriminadamente componentes financieros para cambiar su aspecto.

Tipografía del sistema, títulos con peso 700 como máximo en el puente, texto auxiliar de al menos 12 px, campos móviles de 16 px, tarjetas sobrias de radio 16 px y sombras discretas. Las acciones usan granate y los estados conservan colores semánticos accesibles; los degradados decorativos existentes se convierten en superficies suaves. Los iconos Lucide se conservan y no se añaden emojis decorativos.

Las iniciales de las cuentas utilizan texto y superficie neutros de contraste estable; el color elegido por el usuario se conserva en el borde y en la franja de la tarjeta. No se cambia el color guardado. El encabezado de su modal usa el mismo tratamiento. Se corrige también el color auxiliar de «Presupuesto base (€)», que antes mantenía un gris insuficiente sobre blanco.

`Brand` comparte la marca entre cabecera, landing, apertura y recuperación. Se utiliza una F vectorial original provisional y la escritura FinanZas porque no se ha adjuntado la imagen maestra aprobada. Los activos originales para una futura adaptación nativa y sus límites están en [resources/README.md](../resources/README.md).

## Navegación y estados

- Escritorio conserva los siete módulos. Móvil muestra Inicio, Movimientos, Presupuestos, Cuentas y Más.
- Las columnas móviles reservan más espacio para las etiquetas largas; las cinco se muestran completas en una línea incluso a 320 px, sin reducir el texto por debajo de 12 px.
- Más abre un diálogo accesible con Contactos, Deudas y Asistente. Usa el mismo `Overlay`: foco inicial, contención del foco, Escape, fondo inerte y devolución del foco. `aria-current` distingue el destino seleccionado; Más permanece seleccionado al consultar un módulo secundario.
- Elegir un destino sigue pasando por la guardia de planificación. Seguir editando conserva el borrador; guardar y descartar mantienen sus comportamientos previos. Se añade protección `beforeunload` para salir del documento con un borrador pendiente.
- Splash web: carga real del módulo diferido, sin espera artificial. Se prueba con la respuesta de red retenida; desaparece al completarse la carga. `prefers-reduced-motion` elimina la animación.
- Error de carga: salida con reintento y acceso a la landing. Error de recuperación financiera: conserva el bloqueo de edición y permite descargar el contenido local sin modificarlo. Si el almacenamiento está bloqueado, explica el fallo de descarga y no sustituye datos por demo.
- Se mantienen selección, filtros, confirmaciones y navegación a movimientos concretos. Los scripts existentes ahora esperan la aplicación cargada y utilizan Más cuando corresponde, conservando sus aserciones financieras.

La landing muestra una captura real con datos ficticios, tres beneficios, el acceso a la aplicación y los límites del almacenamiento local. Explica que no existen cuentas de usuario, sincronización bancaria o nube. También informa de la posible integración externa del asistente si el servidor se configura; durante estas pruebas esa integración permanece desactivada.

## Internacionalización preparada

`src/i18n/index.tsx` aporta contexto, claves tipadas, diccionario español y catálogo de idiomas. Solo español está disponible. Inglés, italiano, francés y portugués figuran como pendientes y vuelven a español mientras no tengan diccionarios completos y QA. No hay un selector que prometa traducciones inexistentes. La interfaz financiera previa sigue teniendo textos en español que deberán extraerse progresivamente.

Los formateadores de presentación usan `Intl`, EUR y la zona `Europe/Madrid`; no se utilizan para interpretar ni persistir cantidades. Las funciones contables y los formatos de fecha de dominio permanecen intactos. Se comprueba el cambio de día según la zona y que el formato no cambia la cantidad ni la fecha de entrada. No se añaden preferencias al respaldo financiero por razones visuales.

## Comparativas reales y reproducción

Las imágenes de [antes](assets/visual-ux/before/manifest.json) corresponden al build de `main` `66a045e…`; las de [después](assets/visual-ux/after/manifest.json) a esta propuesta. Ambas usan `scripts/visualFixture.ts`: datos exclusivamente ficticios, JSON 3.1 validado, reloj fijo `2026-11-11T09:00:00Z`, tres carteras y saldo líquido **5.544,65 €**. Nunca se abre un perfil personal. Los contextos son nuevos, la red externa y `/api/` se bloquean y se comprueba que consultar no modifica el JSON guardado, no produce errores y no desborda horizontalmente.

Se repitió la captura final en otros contextos nuevos y otro directorio: las **12 imágenes resultaron idénticas byte a byte**. Los manifiestos registran el HEAD del código capturado (`0dc656c…` para la propuesta); el commit de entrega posterior solo incorpora documentación y estas imágenes.

| Pantalla | Móvil claro: antes / después | Móvil oscuro: antes / después | Escritorio claro: antes / después | Escritorio oscuro: antes / después |
| --- | --- | --- | --- | --- |
| Inicio | [Antes](assets/visual-ux/before/390-light-inicio.jpg) · [Después](assets/visual-ux/after/390-light-inicio.jpg) | [Antes](assets/visual-ux/before/390-dark-inicio.jpg) · [Después](assets/visual-ux/after/390-dark-inicio.jpg) | [Antes](assets/visual-ux/before/1440-light-inicio.jpg) · [Después](assets/visual-ux/after/1440-light-inicio.jpg) | [Antes](assets/visual-ux/before/1440-dark-inicio.jpg) · [Después](assets/visual-ux/after/1440-dark-inicio.jpg) |
| Movimientos | [Antes](assets/visual-ux/before/390-light-movimientos.jpg) · [Después](assets/visual-ux/after/390-light-movimientos.jpg) | [Antes](assets/visual-ux/before/390-dark-movimientos.jpg) · [Después](assets/visual-ux/after/390-dark-movimientos.jpg) | [Antes](assets/visual-ux/before/1440-light-movimientos.jpg) · [Después](assets/visual-ux/after/1440-light-movimientos.jpg) | [Antes](assets/visual-ux/before/1440-dark-movimientos.jpg) · [Después](assets/visual-ux/after/1440-dark-movimientos.jpg) |
| Planificación | [Antes](assets/visual-ux/before/390-light-planificacion.jpg) · [Después](assets/visual-ux/after/390-light-planificacion.jpg) | [Antes](assets/visual-ux/before/390-dark-planificacion.jpg) · [Después](assets/visual-ux/after/390-dark-planificacion.jpg) | [Antes](assets/visual-ux/before/1440-light-planificacion.jpg) · [Después](assets/visual-ux/after/1440-light-planificacion.jpg) | [Antes](assets/visual-ux/before/1440-dark-planificacion.jpg) · [Después](assets/visual-ux/after/1440-dark-planificacion.jpg) |

Requisitos comprobados en este entorno: Node 24.22.1, Chromium `/usr/bin/chromium`, Playwright Core instalado por `npm ci`. No se necesitan API keys.

```sh
npm ci
CHROMIUM_PATH=/usr/bin/chromium npm run capture:visual
npm test
npm run lint
npm run build
GEMINI_API_KEY='' GOOGLE_API_KEY='' CHROMIUM_PATH=/usr/bin/chromium npm run test:ui
git diff --check
```

Para volver a capturar un build anterior, compilarlo en un checkout separado y ejecutar `node --import tsx scripts/visualCapture.ts --dist=/ruta/al/dist --output=/ruta/de/comparativas`. El manifiesto identifica la base, el HEAD del automatizador y si hay código sin confirmar. No sobrescribir la referencia anterior con el build actual.

## Validación

Validación local definitiva del 11/11/2026 sobre el código `0dc656c…`, sin modificar el código durante la ejecución. El commit de entrega posterior añade únicamente esta documentación y las comparativas.

| Comando / comprobación | Resultado |
| --- | --- |
| `npm ci --cache /workspace/work/npm-cache-visual` | Correcto, 187 paquetes; caché escribible del entorno, sin cambios del lockfile |
| `npm test` | **258 superadas, 0 fallos, 0 omitidas** (255 de base + 3 de internacionalización) |
| `npm run lint` | Correcto: `tsc --noEmit` |
| `npm run build` | Correcto; permanece el aviso de configuración futura de Vite por `__dirname` |
| `GEMINI_API_KEY='' GOOGLE_API_KEY='' CHROMIUM_PATH=/usr/bin/chromium npm run test:ui` | **192 resultados superados, 0 fallos, 0 omitidos**: 182 casos + 10 contenedores |
| `git diff --check` | Correcto |
| Comparación de `src/utils/`, `src/types/`, `server.ts` y `package-lock.json` con la base | Idénticos |
| Captura y repetición en contextos aislados | 12 imágenes finales + 12 de referencia; repetición de las 12 finales idéntica byte a byte |

Desglose Chromium por script: phase1 **57**, sharedUx **12**, deletion **23**, planning **13**, budgetUx **11**, charts **8**, automation **15**, responsive **16**, intelligent **25**, visualUx **12**. La ejecución completa final se repitió después de cerrar las correcciones de contraste y las etiquetas móviles. Las ejecuciones exploratorias con fallos no se cuentan como aprobadas.

El build separa aproximadamente 232 kB de entrada, 400 kB del módulo financiero y 34 kB de gráficos (antes de gzip). En esta rama no aparece el aviso de chunk superior a 500 kB observado en la base; sigue pendiente medir rendimiento real. La PR financiera, que conserva el empaquetado anterior, documenta sus propios avisos.

Módulos afectados: `App.tsx` (guardia al abandonar el documento y recuperación), `Root.tsx`/`main.tsx` (rutas y carga), `Brand`, `Header`, `Navigation`, `LandingPage`, `DashboardView` (etiqueta del saldo), `WalletsView`/`WalletModal` (iniciales), `src/styles/`, `index.css`, `responsive.css`, `src/i18n/`, activos `public/` y `resources/`. Los nueve scripts anteriores de navegador se adaptan a `/app`; se añaden captura, fixture, navegación de pruebas, comprobación de contraste y suite visual, más las comparativas y esta documentación. `package.json` añade comandos sin dependencias nuevas; `package-lock.json`, `src/utils/`, `src/types/` y `server.ts` no cambian.

Las nuevas pruebas de navegador comprueban landing sin lectura financiera, conservación del origen, carga real y navegación posterior en móvil/escritorio, siete módulos y cinco destinos, guardias, recuperación, almacenamiento bloqueado, pantalla de 320 px y contraste calculado de controles de periodo, navegación y acción principal en ambos temas. La batería previa conserva pruebas de zoom nativo 125 %/200 %, foco/modal, borradores, transferencias, liquidaciones, recurrencias y consulta sin escrituras. Se detectaron y corrigieron colores heredados de bajo contraste y esperas insuficientes de los tests ante la nueva carga diferida; no se corrigió el dominio financiero para acomodar una prueba visual.

## Límites de revisión y lanzamiento

- Propuesta visual pendiente de revisión del propietario; marca provisional hasta recibir el original aprobado.
- Solo español completo en esta versión; no se han traducido los siete módulos a los otros idiomas.
- No hay splash nativo, empaquetado Capacitor ni pruebas en Android/iOS físicos.
- Chromium verificado; Firefox, Safari y lectores de pantalla reales no verificados. Las comprobaciones de contraste son de tokens y controles críticos; no constituyen una certificación WCAG integral de todos los estados posibles.
- No se midieron Core Web Vitals en producción. La carga diferida reduce el paquete de entrada pero no equivale a una medición comercial de rendimiento.
- El puente de estilos depende de las clases de los componentes anteriores: al refactorizarlos se deben revisar tokens, contraste y capturas. No sustituye una futura normalización completa de componentes.
- Se conserva la aproximación histórica de préstamos de la Fase 5. El rediseño no migra ni reconstruye historias.
- Pendiente validar la combinación con la PR financiera #17 antes de cualquier fusión futura. Ninguna de las dos PR autoriza una fusión automática.
