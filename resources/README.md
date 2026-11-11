# Activos de apertura de FinanZas

- `app-icon.svg`: original vectorial de 1024 × 1024 para preparar iconos de aplicación.
- `splash.svg`: original vectorial de 2732 × 2732 con fondo marfil y marca granate/marino.
- La marca utilizada en web está en `public/brand/finanzas-mark.svg`.

Son originales para una futura adaptación con Capacitor. Esta rama no instala Capacitor, no genera proyectos Android/iOS y no implementa un splash nativo, una PWA ni publicación en tiendas. Al empaquetar habrá que generar los tamaños por plataforma, comprobar las zonas seguras, configurar la apertura nativa y probar dispositivos reales.

La apertura web en `/app` aparece durante la descarga real del módulo React mediante `Suspense`; no hay un temporizador que retrase la entrada. Respeta la preferencia de reducción de movimiento. La propuesta utiliza una marca tipográfica y una F vectorial provisional: no se ha facilitado el archivo maestro de la propuesta visual aprobada.
