# Fondos interiores de partidas más claros

Rama `fix/partida-card-surfaces`, desde `main` remoto `a83154522286b0dc0a27e7e50a80cd886d390f28`. Código de estilos validado: `3c97f31aa8d78f33b4bedf58431c614873501b90`.

## Ajuste

El interior de las familias del Catálogo conservaba `bg-[#0c0f17]/40`: una capa negra al 40 % sobre la superficie blanca, que producía un gris pesado y reducía la legibilidad de los metadatos.

Se añade **una regla CSS acotada al interior del Catálogo**, compartida por Gastos e Ingresos. El fondo mezcla el 96 % de la superficie existente con el 4 % del texto principal: aproximadamente **`#F6F7F8` en claro** y **`#24334A` en oscuro**. Usa los tokens existentes, con `var(--surface)` como alternativa para navegadores sin `color-mix`.

Se conservan el marco, contorno, dimensiones, tipografía, controles laterales y colores de estados. No cambia el gris global del resto de la aplicación. La misma tarjeta comparte el ajuste en móvil y escritorio.

Se revisaron Planificación y el Detalle de partida: no utilizan esa capa al 40 % y sus superficies ya eran claras. Las capturas y medidas confirman que conservan su aspecto y geometría. No se cambian componentes React, lógica financiera, rutas, almacenamiento, formato JSON ni comportamiento de los módulos.

## Comparativas móviles reales

Chromium, viewport **390 × 844**, tema claro/oscuro, reloj fijo `2026-11-11T09:00:00Z` y `visualFixture` JSON 3.1 exclusivamente ficticia. Cada tema utiliza un contexto nuevo. Las consultas y capturas producen **0 escrituras**, **0 errores de consola** y **0 solicitudes externas**. Los datos personales y el almacenamiento de otras sesiones no se abren.

| Vista | Claro: antes / después | Oscuro: antes / después |
| --- | --- | --- |
| Catálogo: Gastos | [Antes](assets/partida-surfaces/before/light-catalogo-gastos.jpg) · [Después](assets/partida-surfaces/after/light-catalogo-gastos.jpg) | [Antes](assets/partida-surfaces/before/dark-catalogo-gastos.jpg) · [Después](assets/partida-surfaces/after/dark-catalogo-gastos.jpg) |
| Catálogo: Ingresos | [Antes](assets/partida-surfaces/before/light-catalogo-ingresos.jpg) · [Después](assets/partida-surfaces/after/light-catalogo-ingresos.jpg) | [Antes](assets/partida-surfaces/before/dark-catalogo-ingresos.jpg) · [Después](assets/partida-surfaces/after/dark-catalogo-ingresos.jpg) |
| Planificación: partidas | [Antes](assets/partida-surfaces/before/light-planificacion.jpg) · [Después](assets/partida-surfaces/after/light-planificacion.jpg) | [Antes](assets/partida-surfaces/before/dark-planificacion.jpg) · [Después](assets/partida-surfaces/after/dark-planificacion.jpg) |
| Detalle de partida | [Antes](assets/partida-surfaces/before/light-detalle.jpg) · [Después](assets/partida-surfaces/after/light-detalle.jpg) | [Antes](assets/partida-surfaces/before/dark-detalle.jpg) · [Después](assets/partida-surfaces/after/dark-detalle.jpg) |

[Medidas anteriores](assets/partida-surfaces/before/measurements.json) · [Medidas finales](assets/partida-surfaces/after/measurements.json). Estos JSON son informes de captura, no respaldos ni cambios del modelo financiero.

| Elemento | Claro antes | Claro después | Oscuro después |
| --- | --- | --- | --- |
| Metadatos de partida | 2,27:1 | **5,59:1** | **7,44:1** |
| Controles laterales | 5,01:1 | **5,01:1** | **6,86:1** |
| Estados revisados | — | **mínimo 5,56:1** | **mínimo 5,94:1** |

Las ocho parejas conservan exactamente las dimensiones y estilos de borde/marco medidos. Se inspeccionaron las capturas de ambos temas. La verificación se limita a Chromium y los elementos descritos; no constituye una certificación integral de accesibilidad ni una prueba en dispositivos físicos o Safari/Firefox.

## Validación ejecutada

- `npm ci --cache /workspace/work/npm-cache-card-surfaces`: correcto, 187 paquetes, lockfile intacto.
- `npm test`: **271 superadas, 0 fallos, 0 omitidas**.
- `npm run lint`: correcto (`tsc --noEmit`).
- `npm run build`: correcto; permanece el aviso existente de configuración futura de Vite por `__dirname`.
- Chromium relevante: **43 resultados superados, 0 fallos, 0 omitidos**: `budgetUx.browser.ts` **15**, `responsive.browser.ts` **16**, `visualUx.browser.ts` **12**. Son 40 casos y 3 contenedores. No se presenta esta selección como la batería completa `test:ui`.
- Captura: **8 imágenes antes + 8 después**, conservación de datos, contraste y ausencia de desbordamiento global.
- `git diff origin/main...HEAD --check`: correcto.
- Comparación con la base: el único archivo de producción modificado es `src/styles/experience.css`. El resto de `src/`, servidor, rutas/configuración, paquetes, lockfile y activos de producción están intactos.

## Archivos de la entrega y reproducción

- `src/styles/experience.css`: única modificación de producción, una regla de fondo.
- `scripts/capturePartidaSurfaces.ts`: automatización aislada de capturas y comprobaciones visuales; reutiliza las fixtures y utilidades existentes.
- `docs/assets/partida-surfaces/before/` y `after/`: 16 JPEG y dos informes de medidas.
- `docs/partida-card-surfaces.md`: esta documentación.

```sh
npm ci
npm run build
CHROMIUM_PATH=/usr/bin/chromium node --import tsx scripts/capturePartidaSurfaces.ts --stage=after
npm test
npm run lint
GEMINI_API_KEY='' GOOGLE_API_KEY='' CHROMIUM_PATH=/usr/bin/chromium node --import tsx scripts/budgetUx.browser.ts
GEMINI_API_KEY='' GOOGLE_API_KEY='' CHROMIUM_PATH=/usr/bin/chromium node --import tsx scripts/responsive.browser.ts
GEMINI_API_KEY='' GOOGLE_API_KEY='' CHROMIUM_PATH=/usr/bin/chromium node --import tsx scripts/visualUx.browser.ts
git diff origin/main...HEAD --check
```

Para repetir el antes, compilar la base indicada en un checkout separado y pasar su directorio `dist` mediante `--stage=before --dist=/ruta/al/build/anterior`. En esta validación se comprobó que el build anterior disponible tenía el mismo árbol que la base y la misma huella CSS que la captura inicial. No se modificó `main` para obtener la referencia.
