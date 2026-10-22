# Reporte de verificación — 22 de octubre de 2026

Revisión de todo lo construido hasta **QRM-031** (Fases 0 a 3 en `develop`, commit `138a7a7`) y de lo que está en **producción** (`master`, v0.3.0 = Fases 0 a 2, https://qr-menu-sooty-xi.vercel.app).

**Resultado:** todo lo construido funciona. No hay errores que bloqueen. Se encontraron **9 puntos a corregir o decidir**: 1 de seguridad, 2 de SEO, 3 de UX, 1 de datos de la demo y 2 de rendimiento ya conocidos. Están abajo, ordenados por prioridad.

> Datos: la base es la misma de producción. Todo lo que se creó para probar (1 pedido, sesión de prueba) se borró y los contadores quedaron igual que antes: Zona 1 con 20 pedidos (siguiente #21) y Antigua con 10 (siguiente #11). Sin dispositivos, turnos ni límites guardados.

---

## 1. Qué se verificó

### Pruebas automáticas (en `develop`)

| Prueba                                             | Resultado                                                |
| -------------------------------------------------- | -------------------------------------------------------- |
| `pnpm check` (formato, lint, tipos, unitarias)     | ✅ 46 archivos, **422 pruebas**                          |
| `pnpm test:integration` (contra Supabase)          | ✅ 15 archivos, **92 pruebas**                           |
| `pnpm db:verify` (esquema, RLS, Storage, Realtime) | ✅ 38 tablas, RLS activo en todas, políticas y funciones |
| `pnpm build` (producción)                          | ✅ sin errores                                           |
| CI de GitHub en `develop`                          | ✅ verde (`138a7a7`)                                     |

### Producción (solo lectura)

| Revisión                                     | Resultado                                                                              |
| -------------------------------------------- | -------------------------------------------------------------------------------------- |
| `/api/health`                                | ✅ Supabase, base de datos, planes, Sentry y URL de la app. ⚠️ Falta la llave del mapa |
| `/`, `/demo` → `/cafe-el-portal`, sucursales | ✅ 200; `/demo` redirige al selector                                                   |
| Tiempo de respuesta del menú                 | ✅ ~0.4–0.7 s con caché. ⚠️ 4.4 s en la primera visita (arranque en frío)              |
| `/panel`, `/staff` sin sesión                | ✅ Redirigen a `/entrar`                                                               |
| `/styleguide` en producción                  | ✅ Protegido (muestra "no encontrado")                                                 |
| Encabezados de seguridad                     | ⚠️ Solo HSTS (ver hallazgo 1)                                                          |
| `robots.txt`, `sitemap.xml`, manifest        | ⚠️ No existen (ver hallazgo 2)                                                         |

### Recorrido completo en el navegador (build de producción de `develop`, 360–390 px)

| Flujo                                                                                                                               | Resultado                                   |
| ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `/demo` → selector con estado de cada sucursal ("Cerrado · abre a las 07:00")                                                       | ✅                                          |
| Menú de Zona 1 con bienvenida, aviso de cerrado y menú de la próxima franja                                                         | ✅ (ver hallazgo 5)                         |
| Hoja de producto: opciones y precio dinámico (Q45 → Q53 con extra)                                                                  | ✅                                          |
| Carrito: "+", barra "1 producto · Q53.00"                                                                                           | ✅                                          |
| Hoja de pedido con `?mesa=4`: "Comer aquí · Mesa 4"; cerrada → programado para las 7:00                                             | ✅                                          |
| Pedido real → mensaje de WhatsApp con emojis, opciones, mesa y "Programado para hoy 7:00"                                           | ✅                                          |
| Confirmación del pedido (#0021) con estado                                                                                          | ✅                                          |
| Panel: Inicio, Pedidos, Productos (25), Menús, Programación, Sucursales, Pagos, Equipo, Más                                         | ✅ sin errores en consola ni en el servidor |
| Bandeja: el pedido programado aparece en "Programados"; "En vivo" conectado                                                         | ✅                                          |
| Aceptar en el panel → el cliente ve "Estado: Aceptado" en su confirmación                                                           | ✅                                          |
| Accesibilidad básica (menú, hoja de pedido, confirmación): imágenes con `alt`, botones y campos con nombre, un `h1`, `lang="es-GT"` | ✅                                          |
| Sin scroll horizontal a 360 px                                                                                                      | ✅                                          |
| Logs del servidor durante todo el recorrido                                                                                         | ✅ sin errores                              |
| Staff con PIN (autorizar, PIN, bandeja de su sucursal, cerrar turno)                                                                | ✅ verificado en QRM-031 (21 oct)           |

---

## 2. Hallazgos

### Prioridad alta

**1. Seguridad: faltan encabezados HTTP de seguridad.** Producción solo envía `Strict-Transport-Security`.

- Sin `X-Frame-Options` / `Content-Security-Policy: frame-ancestors`, otra página puede meter el panel o la bandeja del staff en un `<iframe>` y engañar a alguien para que toque botones ("clickjacking": aceptar o cancelar pedidos, revocar dispositivos).
- También faltan `X-Content-Type-Options: nosniff`, `Referrer-Policy` y `Permissions-Policy`. Esta última debe permitir `geolocation=(self)`, porque la usa el pedido a domicilio.
- **Arreglo:** `headers()` en `next.config.ts` (unas 15 líneas) con:
  - `X-Frame-Options: DENY` y `frame-ancestors 'none'`. El styleguide usa un iframe propio con `srcDoc`, que no se ve afectado.
  - `nosniff`, `Referrer-Policy: strict-origin-when-cross-origin` y `Permissions-Policy: geolocation=(self), camera=(), microphone=()`.

### Prioridad media

**2. SEO: no hay `robots.txt` ni `sitemap.xml`.** Esas rutas caen en `/{negocio}` y responden **200 con la página "Menú no encontrado"** en HTML.

- La guía pide `robots.ts` y `sitemap.ts` (sección SEO de la landing), y el manifest por sucursal (QRM-036).
- Mientras no existan, Google recibe HTML donde espera texto y XML.
- **Arreglo:** `app/robots.ts` (permitir menús, bloquear `/panel`, `/staff`, `/admin`, `/api`) y `app/sitemap.ts` con los negocios publicados y sus sucursales.

**3. Las páginas que no existen responden 200 en lugar de 404.** `/no-existe`, `/cafe-el-portal/no-existe` y `/styleguide` en producción muestran "No encontramos esta página" pero con estado 200 ("soft 404").

- Ya estaba anotado. Para Google cuentan como páginas reales con contenido duplicado.
- **Causa:** `notFound()` dentro de `Suspense` con streaming envía el 200 antes de saber que no existe.
- **Mitigado:** comprobé en producción que todas estas respuestas llevan `<meta name="robots" content="noindex">` (el styleguide, `noindex, nofollow`), así que Google no las indexa.
- **Arreglo de fondo:** validar el `slug` antes del `Suspense` (lectura cacheada) para responder 404 de verdad.

**4. Error no manejado al abrir la hoja de producto.** Si la transición de la foto se interrumpe (el cliente cambia de app o la pestaña se oculta justo en ese momento), queda en consola `Uncaught (in promise) InvalidStateError: Transition was aborted because of invalid state`.

- No rompe nada: la hoja se abre igual.
- Pero con Sentry activo, cada caso llegaría como error.
- **Arreglo:** en `features/public-menu/photo-transition.ts`, atrapar `transition.ready` y `transition.finished` (`.catch(() => {})`).

**5. Avisos que se contradicen cuando la sucursal está cerrada.** A las 00:30, Zona 1 muestra a la vez:

- "Ahorita estamos cerrados, pero puedes dejar tu pedido para hoy desde las 7:00."
- "El desayuno empieza a las 06:30. Mientras tanto, mira lo que viene."

La franja de desayuno del demo empieza a las 06:30, pero la sucursal abre a las 07:00.

- **Arreglo:** con la sucursal cerrada, mostrar solo el aviso de cerrado. También conviene ajustar la franja del demo a 07:00.
- Además, el panel podría avisar cuando una franja empieza antes de que abra la sucursal.

### Prioridad baja

**6. Datos del demo: el WhatsApp de las dos sucursales es `+502 0000-0000`.** En producción, quien pruebe la demo y toque "Pedir por WhatsApp" abre un chat con un número que no existe. Para usar la demo con prospectos, pon un número real en Panel → Sucursales.

**7. Aviso de consola por la vibración.** Si entra un pedido antes de que alguien toque la página, el navegador bloquea `navigator.vibrate` y deja un error en consola. Es inofensivo. **Arreglo:** vibrar solo si `navigator.userActivation?.hasBeenActive`.

**8. Peso del JS del menú (pendiente conocido #2).** El menú descarga **~259 KB gzip**, incluidas las hojas que se cargan después; la meta es 130 KB. Sentry ocupa ~51 KB gzip en su propio chunk, y está activo en producción porque hay DSN. Además, la primera visita en frío tardó 4.4 s.

**9. Mapa en producción (pendiente conocido #3).** Falta `NEXT_PUBLIC_MAP_TILE_URL` (MapTiler o Stadia). Sin ella se usan las teselas de OpenStreetMap, que no permiten uso en producción.

### Detalles menores (no requieren acción ahora)

- La pestaña de Inicio del panel se titula solo "QR Menu" (las demás secciones tienen su nombre).
- La confirmación dice "¡Pedido #0021 recibido!" aunque ya esté "Aceptado" o "Listo". El estado sí se actualiza abajo.
- `/panel/{negocio}/ajustes` (sin subsección) da 404, pero nada enlaza ahí.

---

## 3. Lo que no se pudo verificar aquí

| Qué                                                                                            | Por qué / cómo verificarlo                                                                                                                                                         |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Correo de confirmación real (QRM-029)                                                          | Resend ya está configurado en `.env.local`; falta un pedido con un correo real y confirmar el dominio verificado (SPF/DKIM/DMARC) en Resend. Pasos en `verificacion.md` → QRM-029. |
| WhatsApp, ubicación y PIN en teléfonos reales (Safari, Chrome Android, navegador de Instagram) | El navegador de pruebas es Chrome de escritorio; la ubicación real necesita HTTPS. Pasos en `verificacion.md` (QRM-026, QRM-028, QRM-031).                                         |
| Arrastrar en el editor de menús                                                                | Pendiente conocido #1 (el navegador de pruebas no permite arrastrar).                                                                                                              |
| 60 fps de la bienvenida en un Android de gama media                                            | Requiere un teléfono o DevTools → Performance con CPU 4× más lenta.                                                                                                                |
| Push a la sucursal                                                                             | Aún no existe (QRM-032).                                                                                                                                                           |

> Nota sobre el navegador de pruebas: en una pestaña en segundo plano no se pintan cuadros, así que el menú no termina de hidratarse y los toques no responden. Con la pestaña al frente todo funciona. No es un problema de la app.

---

## 4. Estado de las versiones

- **Producción (`master`)**: v0.3.0, Fases 0 a 2. El menú público, la bienvenida y la hoja de producto funcionan. **No tiene** el carrito, la hoja de pedido, los pedidos, la bandeja ni el staff.
- **`develop`**: hasta QRM-031 (Fase 3 sin QRM-032). Para pasar la Fase 3 a producción hace falta el PR de release cuando se cierre la fase. Antes conviene corregir al menos los hallazgos 1 y 4, y decidir el 6.

## 5. Recomendación

Un PR corto de correcciones antes de seguir con QRM-032: hallazgos **1** (encabezados), **4** (promesa de la transición), **5** (avisos) y **7** (vibración). Son cambios pequeños y con pruebas. Los hallazgos 2 y 3 (SEO) pueden ir con el ticket de la landing/SEO, y el 8 con el pendiente #2.

---

## 6. Actualización (22 de octubre, tarde)

**Corrección a este reporte:** atribuí el error de React #418 a una pestaña con JavaScript de un build anterior. El PR #42 encontró que **sí había errores de hidratación reales**, y los corrigió:

- Las horas: Node escribe "a. m." con espacio duro y Chrome con espacio normal.
- Los `id` de `DndContext` en el editor de menús.

El PR #42 también resolvió las acciones que fallaban con "respuesta inesperada" (el proxy redirigía Server Actions cuando `getClaims` fallaba por la red) y el pendiente #1 (arrastrar en el editor).

**Resueltos en el PR de hallazgos (rama `fix/hallazgos-verificacion`):**

| Hallazgo                               | Cambio                                                                                            |
| -------------------------------------- | ------------------------------------------------------------------------------------------------- |
| 1. Encabezados de seguridad            | `next.config.ts` + `lib/security-headers.ts` en todas las rutas                                   |
| 2. `robots.txt` y `sitemap.xml`        | `app/robots.ts` (bloquea panel, staff, cuenta y confirmaciones) y `app/sitemap.ts` (caché de 1 h) |
| 4. Promesa de la transición de la foto | `photo-transition.ts` atrapa `ready`/`finished` y limpia el nombre de la foto                     |
| 5. Avisos que se contradicen           | Con la sucursal cerrada no se muestra el aviso de la próxima franja                               |
| 7. Vibración sin toque previo          | Solo vibra si `navigator.userActivation.hasBeenActive`                                            |

**Siguen pendientes:** 3 (soft 404, mitigado con `noindex`), 6 (WhatsApp del demo: decisión tuya), 8 (peso del JS) y 9 (llave del mapa).
