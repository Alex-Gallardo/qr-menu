# Cómo verificar qr-menu (Fases 0 a 3)

Guía paso a paso para probar en local (rama `develop`) todo lo construido hasta v0.2.x, y para revisar que un entorno de Vercel esté bien configurado.

## 1. Levantar el proyecto en local

Requisitos: Node 22, pnpm 10 y el archivo `.env.local` en la raíz (ya existe en tu PC; nunca se sube a git).

```bash
git checkout develop
git pull
pnpm install
pnpm check      # lint + typecheck + formato + pruebas unitarias
pnpm dev        # http://localhost:3000
```

> Si ya tienes `npm run dev` abierto en otra terminal, usa ese: Next no permite dos servidores de desarrollo en la misma carpeta. Si ves errores raros tras cambiar de rama, detenlo y vuelve a ejecutar `pnpm dev`.

**Revisa primero `http://localhost:3000/api/health`.** Debe responder `"ok": true`. Cada pieza dice si está bien y qué falta (nunca muestra valores).

### Datos de prueba

Los datos del negocio demo se pueden restaurar cuando quieras. El comando borra y vuelve a crear **solo** "Café El Portal" y los usuarios de prueba:

```bash
pnpm db:seed
```

## 2. Usuarios de prueba

Los tres usan la **misma contraseña**: el valor de `SEED_USERS_PASSWORD` en tu `.env.local`.

| Rol                 | Correo                  | Qué puede hacer                                                                    |
| ------------------- | ----------------------- | ---------------------------------------------------------------------------------- |
| Dueño               | `duenio@qrmenu.test`    | Todo el panel de Café El Portal (las 2 sucursales)                                 |
| Encargado           | `encargado@qrmenu.test` | Solo la sucursal Antigua, y sin las secciones de dueño                             |
| Admin de plataforma | `admin@qrmenu.test`     | `/admin`. Pide 2FA con una app de autenticación (Google Authenticator, 1Password…) |

> Para el admin: si el código de 6 dígitos falla, revisa que la hora de tu PC esté sincronizada (Windows → Configuración → Hora → _Sincronizar ahora_).

El negocio demo es **Café El Portal** (link `cafe-el-portal`), con sucursales **Zona 1** y **Antigua**, 25 productos y 5 categorías.

## 3. Mapa de rutas

| Ruta                                    | Qué es                                                                   | Quién entra                                              |
| --------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------- |
| `/`                                     | Portada                                                                  | Todos                                                    |
| `/styleguide`                           | Sistema de diseño (botones, colores, cargas…)                            | Todos en local y previews; en producción solo el equipo  |
| `/entrar`                               | Entrar con contraseña o enlace por correo                                | Sin sesión                                               |
| `/registro`                             | Crear cuenta de dueño                                                    | Sin sesión                                               |
| `/recuperar`                            | Recuperar contraseña                                                     | Sin sesión                                               |
| `/onboarding`                           | Crear el primer negocio (cuenta nueva)                                   | Con sesión                                               |
| `/panel`                                | Te lleva al panel de tu negocio                                          | Dueño o encargado                                        |
| `/panel/{negocio}`                      | **Inicio** del panel                                                     | Dueño o encargado                                        |
| `/panel/{negocio}/productos`            | Catálogo, búsqueda y disponibilidad                                      | Dueño o encargado                                        |
| `/panel/{negocio}/productos/nuevo`      | Nuevo producto                                                           | Dueño o encargado                                        |
| `/panel/{negocio}/productos/categorias` | Categorías                                                               | Dueño o encargado                                        |
| `/panel/{negocio}/menus`                | Menús: crear, duplicar, predeterminado, pausar                           | Dueño o encargado                                        |
| `/panel/{negocio}/menus/{menú}`         | Editor del menú (se guarda solo)                                         | Dueño o encargado                                        |
| `/panel/{negocio}/programacion`         | Franjas, semana (días × franjas) y fechas especiales                     | Franjas y "Todas": dueño. Sucursal: dueño o su encargado |
| `/panel/{negocio}/sucursales`           | Sucursales (horario, entregas, mapa)                                     | Dueño (encargado: solo las suyas)                        |
| `/panel/{negocio}/ajustes/negocio`      | Logo, portada, nombre, link y redes                                      | Solo dueño                                               |
| `/panel/{negocio}/ajustes/pagos`        | Cuentas para transferencia                                               | Solo dueño                                               |
| `/panel/{negocio}/ajustes/licencia`     | Mi plan                                                                  | Solo dueño                                               |
| `/admin`                                | Super admin (provisional)                                                | Equipo de la plataforma con 2FA                          |
| `/{negocio}`                            | Menú público: selector de sucursal (o el menú directo si tiene una sola) | Todos                                                    |
| `/{negocio}/{sucursal}`                 | Menú público de la sucursal                                              | Todos                                                    |
| `/demo`                                 | Lleva al negocio demo                                                    | Todos                                                    |
| `/api/health`                           | Estado de la configuración                                               | Todos (solo sí/no)                                       |

`{negocio}` es el id del negocio. No hace falta copiarlo: entra a `/panel` y te lleva solo. Pedidos, QR, Reseñas, Analíticas, Equipo, Apariencia y Notificaciones aparecen en la navegación, pero son de fases siguientes y muestran "Muy pronto".

## 4. Lista de verificación

Marca cada punto. Prueba en el celular (o con DevTools a 390 px) y en escritorio.

### Fase 0: base

- [ ] `/` muestra el logo y el lema.
- [ ] `/styleguide`: en "Carga", el botón _Normal (1.5 s)_ muestra el modal "Cargando…". _Con progreso (subida)_ muestra la barra de avance. _Lenta (20 s)_ ofrece **Reintentar** y **Cancelar** a los 15 s.
- [ ] Una ruta que no existe (`/no-existe`) muestra la página 404 en español.

### Acceso (QRM-007)

- [ ] `/panel` sin sesión → te manda a `/entrar`.
- [ ] Entrar como **dueño** → llegas a Inicio de Café El Portal ("¡Hola, Dueño!").
- [ ] Contraseña incorrecta → mensaje claro, sin entrar.
- [ ] **Cerrar sesión** (pestaña **Más** en el celular, o _Salir_ en la barra lateral) → `/panel` vuelve a pedir entrar.
- [ ] (Opcional) Admin: `/admin` pide 2FA. Escanea el QR con tu app, escribe el código y entras.

### Panel y selector de sucursal (QRM-009)

- [ ] En el celular: 4 pestañas abajo (**Pedidos, Menú, Inicio, Más**). En escritorio: barra lateral.
- [ ] Selector de sucursal arriba: **Todas / Zona 1 / Antigua**. Al cambiarlo se recuerda al recargar.

### Ajustes → Negocio (QRM-011, QRM-013)

- [ ] En _Link de tu menú_ escribe `admin` → avisa que está **reservado**. Escribe otro libre → dice que está disponible. No guardes (o vuelve a `cafe-el-portal`).
- [ ] **Subir logo** con una foto de tu celular → recorte redondo → modal "Subiendo tu foto…" con **barra de avance** → aparece el logo.
- [ ] **Subir portada** (recorte 16:9). Una foto de 5–10 MB debe subir sin problema (queda en ≤ 300 KB).
- [ ] **Quitar** el logo → mensaje "Quitamos la imagen."

### Sucursales (QRM-012a/b)

- [ ] Abre **Antigua**: cambia el horario del lunes y usa _Copiar lunes a todos_. Guarda → "¡Listo!".
- [ ] Mueve el **pin del mapa** o usa _Usar mi ubicación_. Guarda y recarga: el pin quedó donde lo dejaste.
- [ ] Activa _A domicilio_: aparecen costo, radio y pedido mínimo.

> Las sucursales del seed tienen un WhatsApp de ejemplo inválido. Para guardar, escribe uno de 8 dígitos (p. ej. `5555-1234`).

### Ajustes → Pagos (QRM-012c)

- [ ] _Agregar cuenta_ (banco, tipo, número, titular) → aparece en la lista.
- [ ] **Copiar** el número → el botón cambia a "Copiado".
- [ ] _Eliminar_ → toast con **Deshacer** (6 s) → al deshacer vuelve.

### Productos (QRM-014): criterio "agotar solo en Antigua no afecta Zona 1"

- [ ] Selector en **Antigua** → **Productos** → apaga **"Aquí"** en _Huevos rancheros_ → toast "agotado solo en Antigua".
- [ ] Cambia el selector a **Zona 1** → _Huevos rancheros_ sigue **disponible**.
- [ ] Selector en **Todas** → el producto dice "Agotado en Antigua". Vuelve a encenderlo.
- [ ] _Desayuno chapín_ cuesta **Q45** en Zona 1 y **Q48** en Antigua (precio propio de la sucursal).
- [ ] **Buscar** "cafe" encuentra "Café frío" (sin importar tildes). Filtra por categoría.
- [ ] Menú **⋮** de un producto: **Duplicar** (aparece "(copia)" debajo), **Subir/Bajar**, **Eliminar** + **Deshacer**.
- [ ] **Agregar producto** con foto (recorte 4:3), precio, precio tachado y precio distinto en Antigua → aparece en su categoría.
- [ ] **Categorías**: agregar, renombrar, ordenar y eliminar (+ Deshacer). Un nombre repetido se rechaza.

### Opciones (QRM-015): criterio "Tamaño obligatorio y Extras 0–3"

- [ ] En un producto sin opciones, en la sección **Opciones**, toca **Tamaño (obligatorio)** → dice "Obligatorio · elige 1".
- [ ] Toca **Extras (hasta 3)** → dice "Opcional · hasta 3".
- [ ] Pon **Máximo 5** en Extras con menos opciones → error "Solo hay N opciones…".
- [ ] Guarda → en la lista el producto dice "Con opciones". Vuelve a abrirlo: todo quedó igual.

### Franjas horarias (QRM-016): criterio "Desayuno, Almuerzo, Cena editables"

- [ ] **Más → Programación**: la línea de 24 h muestra Desayunos, Almuerzo y Cena; cada una con su horario y duración.
- [ ] **Editar** Desayunos (lápiz): cambia el nombre o la hora → se actualiza la línea de tiempo y la lista.
- [ ] **Personalizada** 10:00–12:30 → error "Se cruza con Desayunos…" (no se permiten choques).
- [ ] **Personalizada** 22:00–02:00 → "termina al día siguiente"; en la línea de tiempo aparece al final y al inicio del día.
- [ ] Interruptor **Activa** → "En pausa" (no se muestra en el menú). Una franja pausada no bloquea a otras.
- [ ] **Eliminar** Cena → toast con **Deshacer** → vuelve con su programación.
- [ ] Como encargado: ve las franjas, pero sin botones para editarlas.
- [ ] Deja las franjas como estaban (o corre `pnpm db:seed` al final).

### Menús (QRM-017): criterio "Menú de 4 secciones en < 3 min"

- [ ] **Menús**: escribe un nombre y toca **Crear menú** → abre el editor.
- [ ] Toca **+ Entradas**, **+ Platos fuertes**, **+ Bebidas** y **+ Postres**: cada una abre el catálogo; marca productos y toca **Agregar N productos**.
- [ ] Arriba dice "Guardando…" → "Guardado". Recarga la página: todo sigue ahí.
- [ ] Escribe un **precio especial** en un producto (vacío = precio del catálogo) y toca la **estrella** para destacarlo.
- [ ] Ordena con **⋯ → Subir / Bajar** (secciones y productos). ⚠️ Arrastrar con la manija ⠿ todavía **no funciona** (ver "Pendientes conocidos").
- [ ] **⋯ → Mover a** lleva un producto a otra sección. **⋯ → Eliminar sección** → **Deshacer**.
- [ ] En la lista: **Duplicar** (queda "en pausa"), **Hacer predeterminado** (el interruptor del predeterminado no se puede apagar) y **Eliminar** → **Deshacer**.
- [ ] Deja los menús como estaban: Cena y carta como predeterminado y borra tus menús de prueba.

### Programación (QRM-018): criterio "Regla de sucursal gana a la general"

- [ ] **Más → Programación → Todas las sucursales**: la cuadrícula muestra Desayunos todos los días, Almuerzo ejecutivo L–V y Cena y carta en la cena.
- [ ] Pestaña **Antigua**: el almuerzo L–V es **Cena y carta** en celdas sólidas (propio de Antigua) y el resto aparece punteado (viene de la general).
- [ ] Pestaña **Zona 1**: el almuerzo del martes es **Almuerzo ejecutivo** punteado (hereda la general) → la regla de Antigua no afecta a Zona 1.
- [ ] Toca una celda y elige otro menú → "Guardando… → Guardado". Vuelve a dejarla con **Igual que la general**.
- [ ] **⋯** de una franja → "Toda la semana" o vaciarla.
- [ ] **Fechas especiales**: **Cerrado hoy** (el botón cambia a "Hoy ya está cerrado"), **Agregar fecha especial** (fecha, todo el día o una franja, Cerrado o un menú) y eliminar → **Deshacer**.
- [ ] Deja la programación como estaba (o corre `pnpm db:seed` al final).

### Menú del día (QRM-019): criterio "Pasan medianoche, feriados, empates, sucursal vs. general"

- [ ] **Inicio** con el selector en **Todas**: la tarjeta **Menú del día** muestra cada sucursal. Fuera de franja dice el próximo ("El almuerzo empieza a las 11:30"); dentro, "Ahora · Almuerzo hasta las 15:30" y "Sigue: … a las 17:30".
- [ ] Al almuerzo de lunes a viernes, **Zona 1** muestra Almuerzo ejecutivo y **Antigua** Cena y carta (su regla gana).
- [ ] En **Programación → Zona 1** toca **Cerrado hoy** → en Inicio, Zona 1 dice "Cerrado: Cerrado hoy" y Antigua sigue normal. Elimina la fecha especial al terminar.
- [ ] Las 31 pruebas de `tests/unit/resolve-active-menu.test.ts` cubren medianoche, feriados, empates y sucursal vs. general (`pnpm test`).

### Menú público (QRM-020): criterio "Cambio visible en < 5 s; selector ordena por cercanía"

- [ ] Abre `/demo` → te lleva a `/cafe-el-portal` (selector): Zona 1 y Antigua con "Abierto · cierra 21:00" o "Cerrado · abre…".
- [ ] **Ordenar por cercanía** → permite tu ubicación: la sucursal más cercana sube con "La más cercana" y la distancia. Si no das permiso, la lista sigue igual con un aviso amable.
- [ ] Entra a una sucursal: portada, logo, nombre, sucursal, estado de horario y **Cambiar sucursal**. Al volver al selector, esa sucursal aparece primero como "Tu última sucursal".
- [ ] El menú que se ve es el que toca a esta hora (el mismo que la tarjeta "Menú del día" de Inicio). Los chips de franja (Desayunos, Almuerzo, Cena) muestran los otros menús de hoy.
- [ ] En **Antigua**, "Pasta con mariscos" dice **Agotado**; en **Zona 1**, no. "Desayuno chapín" cuesta Q48 en Antigua y Q45 en Zona 1.
- [ ] **Cambio en < 5 s**: en el panel cambia el precio de un producto y guarda; recarga el menú público: ya aparece el precio nuevo. Devuélvelo a como estaba.
- [ ] Un link que no existe (`/no-existe/x`) muestra la página de no encontrado.

### Plantilla Clásico (QRM-021): criterio "Idéntico al styleguide; CLS 0"

- [ ] Abre `/styleguide#publico` y el menú real de una sucursal en un celular (o con el ancho en 390 px): mismo encabezado, chips, pestañas y tarjetas.
- [ ] En el styleguide cambia entre las 8 paletas: todo el texto se lee bien sobre cada color.
- [ ] Al bajar, las pestañas de secciones quedan fijas arriba y se marca la sección en pantalla; tocar una lleva a ella.
- [ ] Las fotos muestran un borroso mientras cargan y no empujan el contenido (nada "salta" al cargar).

### Hoja de producto (QRM-022): criterio "Precio correcto con precio de sucursal"

- [ ] En **Antigua**, franja **Desayunos**, toca "Desayuno chapín": se abre la hoja (en Chrome y Safari la foto de la tarjeta se expande) con foto grande, descripción, "Listo en unos 15 min" y el botón **Agregar · Q48.00**.
- [ ] Huevos y Frijoles (obligatorios) ya vienen con la primera opción. Elige **Aguacate** → **Agregar · Q54.00**; sube la cantidad a 2 → **Q108.00**.
- [ ] Toca **Agregar**: se cierra la hoja, la foto vuela a la barra del carrito y aparece **2 productos · Q108.00**.
- [ ] En **Zona 1** el mismo platillo empieza en **Agregar · Q45.00** (sin precio de sucursal).
- [ ] Con la hoja abierta, el botón **atrás** del celular la cierra sin salir del menú. El link con `?producto=…` abre la hoja directo.
- [ ] El **+** de "Parrillada para compartir" agrega directo (sin opciones obligatorias); el de "Americano" abre la hoja para elegir el tamaño.
- [ ] En **Antigua**, "Pasta con mariscos" (agotada) no tiene **+**; su hoja dice "Este se nos acabó aquí. ¿Te animas con…?" con un botón al platillo sugerido.
- [ ] En el panel agota una opción (p. ej. "Queso extra" de Desayuno chapín) → en la hoja aparece deshabilitada con "Agotado". Devuélvela a como estaba.

### Bienvenida (QRM-023): criterio "60 fps; tocar salta; respeta configuración"

- [ ] En una ventana privada (o tras cerrar la pestaña) abre `/cafe-el-portal/antigua`: el panel con el color del negocio, la inicial y el nombre aparece desde el primer instante, se levanta (~1.8 s) y deja el menú, que llega con un movimiento corto.
- [ ] Recarga: ya no aparece (frecuencia "una vez por sesión"). Abre **Zona 1**: tampoco (se cuenta por negocio, no por sucursal).
- [ ] Nueva sesión: toca el panel mientras está → se va enseguida, sin saltos.
- [ ] En el celular con "Reducir movimiento" activado (iOS: Accesibilidad → Movimiento; Android: Quitar animaciones) es solo un fundido.
- [ ] En `/styleguide#bienvenida` prueba los 4 estilos, las 3 curvas, los 3 fondos, los 3 tamaños de logo y la duración (1.2–3.0 s) con **Reproducir**. "Sin bienvenida" muestra el menú directo.
- [ ] Rendimiento: en Chrome DevTools → Performance (CPU 4× más lenta), graba la carga del menú: la bienvenida solo anima `transform` y `opacity` (sin "Layout" ni "Paint" largos).
- [ ] La configuración se edita en Apariencia → Bienvenida (QRM-033). Sin la función "bienvenida personalizada" del plan se usa la estándar.

### Carrito (QRM-024): criterio "Sobrevive a recargar; se vacía al cambiar de sucursal con aviso"

- [ ] En **Antigua** toca el **+** de dos platillos: la barra "N productos · Q… · Ver pedido" sube con un pequeño rebote, la foto vuela a ella y el contador rebota con cada uno.
- [ ] Recarga la página: la barra sigue con lo mismo.
- [ ] **Ver pedido** abre "Tu pedido · Antigua": cambia cantidades (el total se actualiza), quita uno con el bote de basura. El botón **atrás** del celular cierra la hoja.
- [ ] **Vaciar** → aviso "Vaciamos tu pedido" con **Deshacer**, que lo recupera.
- [ ] Con productos en el carrito, entra a **Zona 1**: el carrito se vacía y aparece "Vaciamos tu pedido de Antigua" con **Volver a Antigua**, que te regresa con tu pedido.
- [ ] En el panel agota en Antigua algo que está en el carrito → en "Tu pedido" aparece "Se nos acabó aquí." con **Quitar**, y no cuenta en el total. Devuélvelo a como estaba.
- [ ] El carrito vence a las 12 horas. Ver o borrar lo guardado: DevTools → Application → Local Storage → `qrm:carrito`.

### Hoja de pedido (QRM-025): criterio "Mesa precargada desde QR; horarios programables según reglas"

- [ ] Abre `/cafe-el-portal/zona-1?mesa=4` (como si escanearas el QR de la Mesa 4), toca **+** en un platillo y **Ver pedido**: la hoja ya dice "Zona 1 · Comer aquí · Mesa 4".
- [ ] Toca **Pedir por WhatsApp** sin llenar nada: marca "Escribe tu nombre." y "Elige cómo vas a pagar." y lleva al primero.
- [ ] Elige **Transferencia**: aparecen las cuentas (de la sucursal y del negocio) con **Copiar**.
- [ ] Escribe tu nombre y pide: aviso "¡Todo listo!". Recarga y abre la hoja: tu nombre, el tipo y el pago ya vienen puestos. (El envío por WhatsApp llega en QRM-027/028.)
- [ ] **A domicilio**: pide dirección y teléfono, muestra el envío y, si el pedido no llega al mínimo, "Te faltan Q… para el pedido a domicilio mínimo.".
- [ ] **¿Para cuándo?** con la sucursal abierta: "Lo antes posible" o "Programar" con día y hora cada 15 min, desde ahora + la anticipación mínima de la sucursal (Sucursales → pedidos fuera de horario).
- [ ] Con la sucursal cerrada y "Para cuando abra": arriba del menú "Ahorita estamos cerrados, pero puedes dejar tu pedido para mañana desde las 7:00." y la hoja ya trae el primer horario. Con "No permitir": "Ahorita estamos cerrados. Abrimos…" y el botón de pedir desactivado. Sin la función "pedidos programados" en el plan se comporta como "No permitir".
- [ ] Una fecha especial **Cerrado** (Programación) no aparece entre los días para programar.
- [ ] Borrar los datos guardados: DevTools → Application → Local Storage → `qrm:comensal`.

### Ubicación a domicilio (QRM-026): criterio "Funciona con permiso, sin permiso y en navegador de Instagram"

Hazlo en el celular (la ubicación necesita HTTPS: usa el preview de Vercel o producción). En **Zona 1** agrega más de Q50 y en "Ver pedido" elige **A domicilio**:

- [ ] Dice "Compartiremos tu ubicación solo con Café El Portal para entregar tu pedido."
- [ ] **Con permiso**: "Usar mi ubicación actual" → modal "Buscando tu ubicación…" → mapa con el pin, "Precisión ±N m" (si es peor que 150 m pide arrastrar el pin) y "A X km de Zona 1".
- [ ] **Sin permiso** (niégalo cuando el navegador pregunte): "Sin problema: marca el lugar en el mapa o escribe la dirección." → **Elegir en el mapa**: el pin empieza en la sucursal; arrástralo o toca el mapa.
- [ ] **Instagram**: manda el link por un mensaje de Instagram y ábrelo ahí. Aparece "Estás en el navegador de Instagram…" con **Copiar link**; "Elegir en el mapa" funciona aunque la ubicación esté bloqueada.
- [ ] **Fuera de cobertura** (pin a más de 5 km de Zona 1, por ejemplo en Mixco): "Estás a 10.1 km y esta sucursal entrega hasta 5 km. ¿Pasas a recoger?" con **Pasar a recoger** (cambia a Para llevar). Si otra sucursal sí llega, también ofrece **Pedir a …**.
- [ ] La dirección y el **punto de referencia** son obligatorios. Pide; recarga; elige A domicilio otra vez: aparece **Usar mi dirección guardada**.
- [ ] Si la sucursal no exige ubicación (Sucursales → entregas), aparece "Prefiero solo escribir la dirección".
- [ ] En producción el mapa necesita la llave de MapTiler o Stadia (`NEXT_PUBLIC_MAP_TILE_URL`); sin ella usa las teselas de OpenStreetMap (solo para desarrollo).

### Encargado (permisos)

- [ ] Sal y entra como **encargado** → el selector solo muestra **Antigua** (sin "Todas").
- [ ] En **Más** no aparecen _Apariencia_, _Negocio_, _Pagos_ ni _Mi plan_. Abrir esas rutas a mano → 404.
- [ ] En Productos solo ve el interruptor **"Aquí"** (no puede agotar en todas las sucursales).

### Al terminar

```bash
pnpm db:seed    # deja los datos de demo como estaban
```

## 5. Verificar un entorno de Vercel (preview o producción)

1. Abre `https://<dominio>/api/health`.
2. Si responde `"ok": false`, cada pieza con `"ok": false` y `"required": true` dice qué falta:

| Pieza                   | Qué hacer                                                                                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `supabase`              | En Vercel → Settings → Environment Variables: `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`. **Haz un Redeploy** después: las `NEXT_PUBLIC_*` se incrustan al compilar. |
| `supabase_service_role` | `SUPABASE_SERVICE_ROLE_KEY` (marcada como Sensitive).                                                                                                                                  |
| `database`              | `DATABASE_URL` (pooler, puerto 6543) y `DIRECT_URL` (puerto 5432).                                                                                                                     |
| `plans`                 | La base está vacía: desde tu PC con las variables de ese entorno, `pnpm db:deploy && SEED_SCOPE=base pnpm db:seed`.                                                                    |

3. Opcionales: `app_url` (`NEXT_PUBLIC_APP_URL`), `map_tiles` (llave de MapTiler o Stadia; OSM solo sirve para desarrollo) y `sentry` (`NEXT_PUBLIC_SENTRY_DSN`, **sin** marcar Sensitive).
4. En **Supabase → Authentication → URL Configuration** de ese proyecto: _Site URL_ = el dominio, y en _Redirect URLs_ agrega `https://<dominio>/auth/callback`.

Mientras falte Supabase, el sitio no se cae: la portada funciona, `/entrar` muestra "El acceso todavía no está configurado en este entorno" y las rutas privadas piden entrar.

## 6. Pendientes conocidos

Fallas detectadas en la revisión que se corrigen al final del MVP. No bloquean el uso: cada una tiene una alternativa.

| #   | Dónde                    | Qué pasa                                                                                                                                                                                                                                                       | Alternativa mientras tanto                                    | Detectado                       |
| --- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------- |
| 1   | Menús → editor (QRM-017) | **Arrastrar** secciones y productos con la manija ⠿ (dedo, mouse o teclado) no los mueve.                                                                                                                                                                      | **⋯ → Subir / Bajar** sí funciona y se guarda solo.           | 2026-10-21, revisión de QRM-017 |
| 2   | Menú público (QRM-020)   | El JS inicial pesa **~225 KB gzip** (presupuesto de la guía: ~130 KB). La página de inicio `/` ya pesa ~216 KB: el menú solo agrega ~9 KB. El peso viene de lo común a todas las páginas (Next 16 + React 19, layout raíz con Sentry, sonner, Radix y lucide). | Funciona bien; afecta el tiempo de carga en celulares lentos. | 2026-10-21, revisión de QRM-020 |

Para corregir el #2: analizar el bundle (`next build` con análisis de chunks) y revisar qué entra en el layout raíz: confirmar que Sentry se cargue de verdad diferido (`lib/sentry.ts`) y llevar `LoadingOverlay`/`Toaster` solo a las rutas que los usan.

Para corregir el #1: revisar la integración de `@dnd-kit` en `features/menus/components/menu-editor.tsx` (sensores, `DndContext` anidados de secciones e ítems y `touch-action` de las manijas) en un navegador real, porque el navegador de pruebas automáticas no permite arrastrar.
