# Pruebas manuales comunicadas por el propietario — 24–25 de noviembre de 2026

## Procedencia y entorno

Este registro incorpora las observaciones comunicadas por el propietario. Codex no ejecutó ni reprodujo independientemente estos recorridos. No son resultados automatizados ni sustituyen las evidencias de CI anteriores, que se conservan sin cambios.

- PR Draft #36; rama `feature/phase-7a2-auth0`.
- SHA de referencia probado según el propietario: `79b33d6f83533931c1b29fe515d01199c1434276`.
- Auth0 Free; tenant de desarrollo `finanzas-pro-dev`, región EU-2, Regular Web Application.
- Express local en `127.0.0.1:3000`.
- Fechas comunicadas: 24–25/11/2026; referencia de calendario Europe/Madrid. No se aportan horas ni duraciones cronometradas.

La región se registra como configuración comunicada, sin certificar por ello toda la residencia efectiva de datos. No se aportaron a este registro logs, capturas, versión del navegador o del sistema operativo para verificación independiente. No se incluyen correos personales, contraseñas, secretos ni tokens.

## Resultados manuales

| Recorrido | Resultado comunicado | Alcance de la observación |
| --- | --- | --- |
| Registro real con correo y contraseña | Correcto | Recorrido manual contra Auth0 de desarrollo |
| Verificación de correo mediante Auth0 | Correcta | Verificación comunicada por el propietario |
| Inicio de sesión y regreso a Finanzas Pro | Correcto | Retorno observado a la aplicación local |
| Cierre de sesión | Correcto | Logout observado; no demuestra revocación global |
| Nuevo inicio de sesión | Correcto | Reingreso tras el cierre de sesión |
| Actualizar y reabrir la pestaña | Persistencia correcta | No implica cierre/reinicio completo del navegador, servidor o dispositivo |
| Recuperación y cambio de contraseña | Correctos | Recorrido de correo comunicado; no prueba revocación de todas las sesiones |
| Superar el periodo de sesión y actualizar | Reaparecieron las opciones de acceso, como se esperaba | Expiración observada cualitativamente; sin medición de duración exacta ni prueba de revocación global |

El límite configurado de sesión documentado en la arquitectura no se convierte por estas observaciones en una duración exacta cronometrada. Tampoco se infiere que las sesiones de otros navegadores o dispositivos quedaran revocadas tras logout o cambio de contraseña.

## Evidencia automatizada anterior y actualización documental

La CI del SHA de referencia está en [44831549621](https://github.com/dlopezteruel-rgb/Finanzas-pro/actions/runs/44831549621): 796 unitarias, 54 de infraestructura, 1.044 resultados Chromium en 46 suites y cero violaciones axe automatizadas. Sus pruebas de protocolo Auth0 utilizan un proveedor ficticio; no se reclasifican como pruebas remotas por este registro. Se conservan asimismo el timeout local inicial y el complemento secuencial documentados en la PR.

Esta actualización modifica únicamente documentación. No cambia código, configuración, dependencias, credenciales ni mecanismos financieros. Se comprueban el diff y su alcance documental; los resultados históricos no se atribuyen al nuevo commit documental y cualquier ejecución nueva de CI se identifica por su propio SHA.

## Pendientes y restricciones conservados

- Google y Apple reales.
- Reautenticación con otra identidad.
- Aislamiento financiero multiusuario, autorización y propiedad de perfiles.
- Validación nativa Android/iOS, incluido el manejo de credenciales en sus runtimes.
- Revocación global y sus ventanas; duración exacta medida con evidencia adicional.

El acceso local heredado no se convierte en acceso multiusuario protegido. No se vinculan, migran ni suben perfiles financieros automáticamente. La demo continúa aislada y deshabilitada; los bloqueos de producción y de datos reales móviles permanecen. Estas observaciones no autorizan beta, distribución o despliegue. No se fusiona la PR ni se sincroniza Google AI Studio.
