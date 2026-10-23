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

| Ruta                                      | Qué es                                                                   | Quién entra                                              |
| ----------------------------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------- |
| `/`                                       | Portada                                                                  | Todos                                                    |
| `/styleguide`                             | Sistema de diseño (botones, colores, cargas…)                            | Todos en local y previews; en producción solo el equipo  |
| `/entrar`                                 | Entrar con contraseña o enlace por correo                                | Sin sesión                                               |
| `/registro`                               | Crear cuenta de dueño                                                    | Sin sesión                                               |
| `/recuperar`                              | Recuperar contraseña                                                     | Sin sesión                                               |
| `/onboarding`                             | Crear el primer negocio (cuenta nueva)                                   | Con sesión                                               |
| `/panel`                                  | Te lleva al panel de tu negocio                                          | Dueño o encargado                                        |
| `/panel/{negocio}`                        | **Inicio** del panel                                                     | Dueño o encargado                                        |
| `/panel/{negocio}/productos`              | Catálogo, búsqueda y disponibilidad                                      | Dueño o encargado                                        |
| `/panel/{negocio}/productos/nuevo`        | Nuevo producto                                                           | Dueño o encargado                                        |
| `/panel/{negocio}/productos/categorias`   | Categorías                                                               | Dueño o encargado                                        |
| `/panel/{negocio}/menus`                  | Menús: crear, duplicar, predeterminado, pausar                           | Dueño o encargado                                        |
| `/panel/{negocio}/menus/{menú}`           | Editor del menú (se guarda solo)                                         | Dueño o encargado                                        |
| `/panel/{negocio}/programacion`           | Franjas, semana (días × franjas) y fechas especiales                     | Franjas y "Todas": dueño. Sucursal: dueño o su encargado |
| `/panel/{negocio}/sucursales`             | Sucursales (horario, entregas, mapa)                                     | Dueño (encargado: solo las suyas)                        |
| `/panel/{negocio}/ajustes/negocio`        | Logo, portada, nombre, link y redes                                      | Solo dueño                                               |
| `/panel/{negocio}/ajustes/pagos`          | Cuentas para transferencia                                               | Solo dueño                                               |
| `/panel/{negocio}/ajustes/licencia`       | Mi plan                                                                  | Solo dueño                                               |
| `/panel/{negocio}/ajustes/notificaciones` | Avisos push en este dispositivo y sucursal que escucha                   | Dueño o encargado                                        |
| `/admin`                                  | Super admin (provisional)                                                | Equipo de la plataforma con 2FA                          |
| `/{negocio}`                              | Menú público: selector de sucursal (o el menú directo si tiene una sola) | Todos                                                    |
| `/{negocio}/{sucursal}`                   | Menú público de la sucursal                                              | Todos                                                    |
| `/demo`                                   | Lleva al negocio demo                                                    | Todos                                                    |
| `/api/health`                             | Estado de la configuración                                               | Todos (solo sí/no)                                       |
| `/api/cron/push`                          | Escalamiento de avisos y aviso de programados (cada minuto)              | Solo con `Authorization: Bearer <CRON_SECRET>`           |

`{negocio}` es el id del negocio. No hace falta copiarlo: entra a `/panel` y te lleva solo. Reseñas y Analíticas aparecen en la navegación, pero son de fases siguientes y muestran "Muy pronto".

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
- [ ] Ordena **arrastrando la manija ⠿** y con **⋯ → Subir / Bajar** (secciones y productos).
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
- [ ] La configuración se edita en Apariencia → Bienvenida (QRM-033, ver abajo). Sin la función "bienvenida personalizada" del plan se usa la estándar.

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
- [ ] Elige **Transferencia**: aparecen las cuentas (de la sucursal y del negocio) con **Copiar**, y la hoja **no se mueve**: la cabecera "Tu pedido" sigue arriba y el botón abajo, sin hueco en blanco.
- [ ] **En el iPhone (Safari, Brave o Chrome; todos usan WebKit)**: la hoja de un producto y "Tu pedido" muestran su contenido completo (foto, descripción, productos, datos, pago) y se desplazan con el dedo; la cabecera y el botón quedan fijos. Igual en Chrome de Android.
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

### Crear pedido (QRM-027): criterio "50 pedidos simultáneos sin números repetidos; precio manipulado se ignora"

- [ ] `pnpm test:integration` → `tests/integration/orders.test.ts` (crea un negocio de prueba y lo borra): 50 pedidos a la vez con números 2–51 sin repetir, precio enviado por el cliente ignorado, agotado / fuera del menú / opción inválida rechazados diciendo cuál, cobertura, horario y límite por dispositivo.
- [ ] En el menú: arma un pedido, llena tus datos y toca **Pedir por WhatsApp** → modal "Preparando tu pedido…" → "Pedido #0021 recibido. Total: Q…". El carrito se vacía. (WhatsApp se abre en QRM-028.)
- [ ] En Supabase (Table Editor → orders) aparece el pedido con su número, sus líneas (order_items) y el evento "new". **Bórralo al terminar** y devuelve `branches.next_order_number` a como estaba (la base es la misma de producción).
- [ ] Con el panel agota algo que está en tu carrito y pide: "Revisa tu pedido: … (se nos acabó). Quítalo para continuar." Devuélvelo a como estaba.
- [ ] Más de 5 pedidos en 10 minutos desde el mismo teléfono: "Ya enviaste varios pedidos seguidos. Intenta de nuevo en N minutos."

### WhatsApp y confirmación (QRM-028): criterio "Funciona en Safari, Chrome e Instagram"

Hazlo en el celular con producción o un preview (y luego borra el pedido de prueba, ver QRM-027). Pon tu propio número como WhatsApp de la sucursal en Sucursales si quieres recibir el mensaje.

- [ ] Pide desde el menú: modal "Preparando tu pedido…" → se abre WhatsApp con el chat de la sucursal y el mensaje listo: "🧾 _Pedido #0021_ — Café El Portal · Zona 1", tu nombre, tipo y hora (o "🕒 … Programado para mañana 7:30"), productos con opciones, total, pago y, a domicilio, dirección, referencia y links de **Google Maps** y **Waze**. Los emojis se ven bien (no "�").
- [ ] Regresa al navegador: estás en "¡Pedido #0021 recibido!" con el check y el confeti, el estado "Recibido", el resumen y, si pagas por transferencia, las cuentas con **Copiar**.
- [ ] **Reenviar por WhatsApp** vuelve a abrir el chat; **Copiar pedido** copia el texto; **WhatsApp Web** abre la versión web (computadora sin la app).
- [ ] Recarga la confirmación: ya no reabre WhatsApp sola.
- [ ] Repite en **Safari (iPhone)**, **Chrome (Android)** y dentro de **Instagram** (manda el link por mensaje de Instagram y ábrelo ahí).
- [ ] El link "Detalle" del mensaje abre la misma confirmación.

### Correo de confirmación (QRM-029): criterio "Llega a Gmail sin spam; no se envía si no hay email; nunca al negocio"

Requiere la cuenta de Resend (ver "Activar el correo" abajo). Sin `RESEND_API_KEY` no se envía nada y todo lo demás funciona igual.

- [ ] Vista previa sin enviar nada: `/styleguide#correos` (la plantilla real con un pedido de ejemplo, HTML y texto).
- [ ] Pide con tu correo de Gmail en "¿Quieres el resumen por correo?": en menos de un minuto llega "Recibimos tu pedido #00XX en Café El Portal · Zona 1" a la **bandeja de entrada** (no a spam), con el resumen, el total, el pago (y las cuentas si elegiste transferencia), "Ver mi pedido" y "WhatsApp de la sucursal". La confirmación dice "Te enviamos el resumen a tu correo.".
- [ ] Repite en Outlook/Hotmail.
- [ ] Pide **sin** correo: no se envía nada.
- [ ] El correo nunca llega al del negocio; si respondes, la respuesta va al correo del negocio (Ajustes → Negocio).
- [ ] Borra los pedidos de prueba (ver QRM-027).

**Activar el correo (una vez):**

1. En Resend → Domains, agrega el dominio de la app y copia en el DNS los registros que da Resend (SPF, DKIM) y un DMARC (`_dmarc` TXT `v=DMARC1; p=none;`). Espera a que diga "Verified".
2. Resend → API Keys: crea una llave con permiso "Sending access".
3. En Vercel (Production y Preview) y en `.env.local`: `RESEND_API_KEY=…` y `EMAIL_FROM=pedidos@tu-dominio`. Redeploy.

### Bandeja de pedidos (QRM-030): criterio "Pedido aparece en < 2 s; otra sucursal no lo recibe"

- [ ] Entra como **dueño** → Pedidos ("Todas"): arriba dice **En vivo**. Toca **Activar sonido** (los navegadores solo dejan sonar después de un toque).
- [ ] En otro teléfono haz un pedido en Zona 1: la tarjeta aparece sola en menos de 2 s, suena, vibra, aparece "Nuevo pedido #00XX · Q…" y el título de la pestaña parpadea "(1) Pedido nuevo" hasta que alguien lo acepta.
- [ ] En la tarjeta: **Aceptar** → **Empezar a preparar** → **Listo** → **Entregado** (o **Servido** si es para comer aquí). El comensal ve el estado nuevo en su confirmación (se actualiza sola cada 15 s).
- [ ] Filtros: Activos, Programados (con hora a futuro), Entregados, Cancelados; y por tipo.
- [ ] Toca la tarjeta → detalle: cliente con **Llamar** y **Responder por WhatsApp**, productos con opciones y notas, totales, historial; a domicilio, el **mapa** con el pin y **Abrir en Google Maps**, **Abrir en Waze** y **Copiar coordenadas**. **Cancelar** pide confirmación.
- [ ] Entra como **encargado** (solo Antigua): un pedido de **Zona 1** no aparece ni suena; uno de **Antigua** sí. Abrir a mano el link del detalle de un pedido de Zona 1 → "Esta sección no está disponible".
- [ ] Borra los pedidos de prueba y devuelve `next_order_number` (ver QRM-027).

### Staff con PIN (QRM-031): criterio "PIN no funciona en dispositivo no autorizado; 5 fallos bloquean 5 min"

Requiere **Anonymous Sign-Ins** activado en Supabase (Authentication → Sign In / Providers). En desarrollo el seed crea a "Rosa - caja" (Zona 1, PIN 1234) y "Luis - cocina" (Antigua, PIN 5678).

- [ ] En un teléfono sin sesión abre `/staff`: te pide entrar. Entra como dueño → **Autorizar este dispositivo** (sucursal Zona 1, "Tablet de caja") → tu sesión se cierra en ese teléfono y aparece el **teclado de PIN** con el logo.
- [ ] PIN de Antigua (5678) en la tablet de Zona 1 → "PIN incorrecto. Te quedan 4 intentos.". PIN 1234 → modal "Abriendo tu turno…" → bandeja de **Zona 1** con "Turno de Rosa - caja".
- [ ] Haz un pedido en Antigua: no aparece. Uno en Zona 1: aparece al instante y suena. Rosa puede Aceptar/Listo/Entregado; en el historial queda quién lo hizo.
- [ ] Con el turno abierto, abrir `/panel` → pide entrar (el staff no tiene acceso al panel).
- [ ] **Cerrar turno** → vuelve al teclado.
- [ ] 5 PIN incorrectos seguidos → "Demasiados intentos. Espera 5 minutos…"; ni el PIN correcto entra hasta que pasen.
- [ ] En otro teléfono (no autorizado) `/staff` no muestra el teclado: pide entrar. El PIN no sirve ahí.
- [ ] Panel → Más → **Equipo**: aparece "Tablet de caja"; **Revocar** → la tablet vuelve a decir "Este dispositivo no está autorizado" y su turno termina.
- [ ] El plan Gratis no incluye staff con PIN: al autorizar, aviso de la función.

### App del panel/staff y avisos push (QRM-032): criterio "Push llega en Android e iPhone instalado; repite a los 3 min"

Requiere las llaves de push en `.env.local` (`pnpm push:keys --write`) y, en Vercel, las mismas tres variables (ver §5). El push real solo se puede probar en un teléfono y con un dominio https (Vercel): en `localhost` funciona en Chrome de la PC.

**En la PC (Chrome, localhost):**

- [ ] Entra como dueño → **Más → Notificaciones** → **Activar avisos de pedidos** (con "Todas las sucursales") → Chrome pide permiso → "Avisos activados en este dispositivo".
- [ ] **Enviar aviso de prueba** → llega "Avisos activados ✓" y se queda en pantalla hasta tocarlo; al tocarlo abre la bandeja.
- [ ] En otra pestaña haz un pedido en Zona 1 → llega **"Nuevo pedido #00XX · QXX.00"** / "Nombre · Para llevar · Zona 1". Tocarlo abre el **detalle del pedido** en el panel.
- [ ] No lo aceptes: si el cron está programado (`pnpm push:cron --status`), a los 3 min llega **"#00XX sigue esperando"**, otra vez a los 6 y a los 9, y ya no más. Aceptarlo detiene los avisos. (Sin cron en local, simúlalo: `curl -H "Authorization: Bearer <CRON_SECRET>" http://localhost:3000/api/cron/push` después de 3 minutos.)
- [ ] Elige "Solo Antigua" → **Guardar sucursal** → un pedido de Zona 1 ya no avisa en este dispositivo; uno de Antigua sí.
- [ ] Entra como **encargado** (Antigua): con "Todas mis sucursales" solo recibe los de Antigua.
- [ ] **Desactivar** → ya no llegan avisos. La franja "Recibe un aviso con cada pedido" vuelve a aparecer en Pedidos.

**En Android (Chrome, con el dominio de Vercel):**

- [ ] Abre `/panel` → menú ⋮ → **Instalar app** (o "Agregar a pantalla principal"): queda el ícono de la app. Ábrela.
- [ ] Notificaciones → Activar → permitir. Bloquea el teléfono y haz un pedido desde otro dispositivo: suena, vibra y aparece en la pantalla bloqueada. Tocarlo abre el pedido **dentro de la app**.

**En iPhone (iOS 16.4 o más, Safari):**

- [ ] En Safari, Notificaciones muestra la guía "Compartir → Agregar a inicio" (no el botón): en Safari no hay push.
- [ ] Agrega a inicio y abre la app desde el ícono → ahora sí aparece **Activar avisos de pedidos** → permitir. Prueba con la app cerrada y el teléfono bloqueado.

**Staff con PIN (tablet de caja):**

- [ ] En la tablet autorizada, abre turno → en la bandeja aparece **"Recibe un aviso con cada pedido" → Activar avisos de pedidos** → llega la prueba. (Instala `/staff` como app para que el iPhone/iPad reciba avisos.)
- [ ] Un pedido de Zona 1 avisa en la tablet de Zona 1 y tocarlo abre `/staff/pedidos/…`; uno de Antigua no.
- [ ] Si otra persona abre turno en la misma tablet, los avisos siguen llegando (se asocian al turno nuevo). Al desactivar a esa persona en Equipo, su tablet deja de recibirlos hasta que otro active los avisos.

**Programados:**

- [ ] Haz un pedido programado para dentro de 1 h o más → avisa al crearse ("Pedido programado #00XX…") y otra vez **30 min antes** ("Programado #00XX en 30 min").

**Al terminar:** borra los pedidos de prueba como en QRM-027 y deja `next_order_number` como estaba. Las suscripciones de tus dispositivos pueden quedarse (Notificaciones → Desactivar para quitarlas).

### Apariencia (QRM-033): criterio "Vista previa < 100 ms; «Reproducir» bienvenida; aviso de contraste"

El demo tiene el plan **Negocio** (todo habilitado). Antes de empezar, anota que está en **Tomate**, fondo **Color**, Bricolage Grotesque + Inter, radio 16, loader **logo** y la bienvenida estándar; al terminar déjalo igual (o corre `pnpm db:seed`).

- [ ] Entra como dueño → **Más → Apariencia**. En la computadora la vista previa (marco de celular) queda fija a la derecha; en el celular, el botón **Vista previa** la abre.
- [ ] Toca otra paleta (p. ej. **Mar**): la vista previa cambia en el mismo instante y arriba pasa "Guardando… → Guardado". Abre **Ver mi menú** en otra pestaña y recarga: el menú ya tiene esos colores.
- [ ] **Personalizar color por color** → pon el texto en `#B0A8A0` → aparece "Hay colores que cuestan leer" con el motivo y **Usar #…** → al tocarlo el aviso cambia a "Buen contraste".
- [ ] Con logo (Ajustes → Negocio): **Extraer de mi logo** propone 3 paletas (clara, segundo color y oscura) que ya cumplen el contraste.
- [ ] **Fondo**: Degradado (dos colores) se ve en la portada si el negocio no tiene foto de portada, y a los lados del menú en la computadora. **Imagen**: recorta y sube. **Video**: MP4 ≤ 6 MB y ≤ 10 s (uno más largo o pesado se rechaza con el motivo); en el menú se reproduce sin sonido en la portada, y con "reducir movimiento" o ahorro de datos queda el primer cuadro. La **capa oscura** se ajusta con el control.
- [ ] **Fuentes**: cada opción se ve escrita con su fuente; al elegir, cambian el nombre y los títulos de la vista previa y del menú real (y el nombre en la bienvenida).
- [ ] **Bordes**: Rectos / Suaves / Redondos o el control de 0 a 28 px → cambian las fotos y tarjetas.
- [ ] **Bienvenida**: **Reproducir** la muestra en el marco (en el celular abre la vista previa). Cambia estilo, fondo (color, degradado o imagen), tamaño del logo, nombre y frase, duración, curva y frecuencia: cada cambio la vuelve a reproducir. En el menú real se ve igual (con la frecuencia elegida).
- [ ] **Indicador de carga**: elige **Puntos** → en el menú, al enviar un pedido, el modal "Preparando tu pedido…" usa puntos con el color principal del negocio.
- [ ] **Pie "Hecho con …"**: con el plan Negocio se puede apagar y desaparece del final del menú.
- [ ] **Plan Gratis** (con un negocio de prueba o cambiando la licencia desde /admin): las 8 paletas, fuentes, bordes y loader funcionan; _Extraer de mi logo_, _color por color_, fondo con imagen o video, la bienvenida y quitar el pie aparecen con candado y "Ver mi plan". Un negocio que bajó de plan con algo personalizado puede seguir cambiando lo demás; su menú muestra la versión estándar.
- [ ] **Encargado**: Apariencia no aparece y la ruta da 404.

**Al terminar:** vuelve a **Tomate**, fondo **Color**, Bricolage Grotesque + Inter, Suaves (16), loader **Tu logo latiendo**, pie visible y la bienvenida Levantar / Color / Mediano / 1.8 s / Suave / Una vez por visita.

### Plantillas (QRM-034): criterio "Las 4 plantillas pasan el mismo test visual"

- [ ] `/styleguide` → **Menú público**: el selector **Plantilla** cambia el marco de 390 px entre **Clásico** (foto a la derecha), **Galería** (foto grande arriba, nombre como título), **Minimal** (sin fotos, "nombre · · · precio") y **Tarjetas** (2 columnas, foto cuadrada). Combínalo con 3 paletas (p. ej. Tomate, Noche y Minimal): todo se lee, el "+" queda sobre la foto (o a la derecha en Minimal), "Agotado" y las etiquetas se ven igual en las 4.
- [ ] **Menús → Cena y carta → Plantilla: Tarjetas** → abre el menú real: se ve en 2 columnas. Tocar un producto abre su hoja; el "+" agrega y la miniatura vuela al carrito (en Minimal no hay foto que vuele). Vuelve a **Clásico** al terminar.
- [ ] **Apariencia**: la vista previa usa la plantilla del menú predeterminado.
- [ ] Plan **Gratis**: en el editor de menús solo aparece Clásico; un menú guardado en otra plantilla (de cuando tenía Pro) se muestra en Clásico.
- Automático: `tests/unit/templates.test.tsx` corre la misma prueba a las 4 (título y orden, precio una sola vez, tachado, Agotado, etiquetas, Destacado, abrir, "+" que nunca agrega un agotado y `alt` de las fotos).

### QR y compartir (QRM-035): criterio "QR A6 escanea a 1 m; escaneo se cuenta"

El demo trae 8 QR del seed (`demo01`…`demo08`, con escaneos de ejemplo). Anota sus escaneos antes de probar y déjalos igual al terminar (o corre `pnpm db:seed`).

- [ ] **Más → QR y compartir** (dueño o encargado; el encargado solo ve sus sucursales): el QR de **Zona 1** y sus mesas, con vista previa en el color del negocio (o frijol si el color no contrasta con blanco), la inicial o el logo al centro y "N escaneos".
- [ ] **Agregar QR → Mesas**, del 5 al 8 → aparecen Mesa 5…8 en orden. Repetir del 1 al 6 → "Creamos 2 QR (4 ya existían)": no hay dos QR para la misma mesa.
- [ ] **Campaña** "Volante" → aparece con tipo Campaña. Con la sucursal que ya tiene su QR, la opción "Toda la sucursal" no aparece.
- [ ] **PDF A6** de una mesa → abre un PDF de 105 × 148 mm: nombre del negocio, "Escanea y pide 📱", QR de 88 mm con el logo, "Mesa N", "Menú del día · Pedidos por WhatsApp" y el link corto. **Imprímelo al 100 %** y escanéalo con 3 celulares (iPhone y Android) a **1 m**: abre el menú con "Mesa N" en la hoja de pedido.
- [ ] **⋯ → PDF tamaño carta** (para la puerta), **PNG** (1200 px) y **SVG** (imprenta). **Todas las mesas en un PDF (A6)**: una página por mesa.
- [ ] Escanear (o abrir `/q/{código}` en el celular) suma **1 escaneo** en el panel. Pegar el link en un chat de WhatsApp **no** suma (la vista previa no cuenta). Un código inventado muestra "Este código QR ya no está activo".
- [ ] **⋯ → Eliminar** → toast con **Deshacer** → vuelve con el **mismo código** (lo impreso sigue sirviendo) y sus escaneos.
- [ ] **Compartir**: el link del menú de la sucursal y 4 textos listos (estado, publicación, porta-QR, difusión) con el nombre y el link ya puestos; **Copiar** los copia.
- [ ] Plan **Gratis**: después del primer QR aparece la tarjeta "Tu plan incluye 1 QR…".
- [ ] En Vercel, `NEXT_PUBLIC_APP_URL` debe ser el dominio de producción (los QR impresos llevan ese dominio). `/api/health` lo revisa (`app_url`).

### App instalable del menú (QRM-036): criterio "Se instala con nombre e ícono del restaurante"

Hace falta el dominio https de Vercel (en `localhost` Chrome también deja instalar). Para que el ícono use el logo, el logo debe estar subido en **PNG**: desde QRM-036 se sube así; uno subido antes (WebP) da el ícono con la inicial hasta volver a subirlo en Ajustes → Negocio.

- [ ] Abre `/{negocio}/{sucursal}/manifest.webmanifest`: nombre del negocio (con la sucursal si hay varias), `start_url` con `?source=pwa`, colores de Apariencia y 3 íconos. `/app-icon/192`, `512`, `maskable` y `apple` son PNG con el logo (o la inicial sobre el color principal).
- [ ] **Android (Chrome):** al final del menú aparece "Ten {negocio} en tu celular → **Instalar**" → el diálogo del navegador → queda el ícono con el logo y el nombre del negocio. Ábrela: se ve sin la barra del navegador, con el color del negocio arriba. La tarjeta ya no aparece dentro de la app.
- [ ] **iPhone (Safari o Chrome):** **Instalar** abre la guía "Compartir → Agregar a inicio". El ícono de inicio es el del negocio (apple-touch-icon).
- [ ] La **X** ("Ahora no") la oculta en ese negocio (`localStorage` `qrm:instalar:{id}`). En el navegador de Instagram o Facebook no se ofrece.
- [ ] **Sin conexión:** abre el menú una vez con internet, activa el modo avión y vuelve a abrir la app → se ve el último menú guardado con "Sin conexión: este es el último menú que guardamos. Para pedir, conéctate otra vez.". Una sucursal nunca abierta muestra "Sin conexión y todavía no guardamos este menú".
- [ ] La confirmación del pedido (`/pedido/…`) nunca se guarda sin conexión (tiene datos del cliente). Los avisos push del panel siguen funcionando: su service worker (`/sw.js`, alcance `/`) es otro.

### Reseñas (QRM-037): criterio "Botón de Google con el Place ID de la sucursal"

Las sucursales del demo no tienen Place ID: para probar el botón, pon uno en Sucursales → la sucursal → **Google Place ID** (búscalo en el [buscador de Place ID](https://developers.google.com/maps/documentation/places/web-service/place-id#find-id)) y quítalo al terminar.

- [ ] En Sucursales, con un Place ID válido aparece "**Probar el enlace de reseñas**" → abre `https://search.google.com/local/writereview?placeid=…` en la ficha de esa sucursal.
- [ ] Abre la confirmación de un pedido **Entregado** (o de hace más de 2 h) → "¿Qué tal estuvo todo?" con 5 estrellas (Muy mal … ¡Excelente!). Uno recién hecho o **Cancelado** no muestra la tarjeta.
- [ ] Califica con comentario → agradecimiento según la nota y "**Publicar también en Google**" para **cualquier** calificación (Google prohíbe pedir reseñas solo a los contentos). Sin Place ID se agradece sin botón. Al recargar se ve la reseña enviada; no se puede calificar dos veces.
- [ ] Panel → **Reseñas**: promedio, total y barras de 5 a 1 por sucursal (o "Todas"); % que tocó Google contra la meta del 30 %; enlace de cada sucursal (Copiar / Probar) o "Agregarlo en Sucursales".
- [ ] **Ocultar** un comentario lo quita de la lista (con "Deshacer" y "Ver los ocultos"), pero sigue contando en el promedio; queda en la auditoría (`review.hide` / `review.show`). El encargado solo ve y oculta las de su sucursal.
- [ ] Al terminar, borra la reseña de prueba (y su evento `review_submitted`) y quita el Place ID.

### Analíticas (QRM-038): criterio "Embudo cuadra con la DB"

Las visitas, productos vistos, carrito y "abrir pedido" se registran desde este ticket (`/api/ev`, con `sendBeacon`); pedidos y ventas salen de la tabla de pedidos, así que cuadran con la bandeja desde siempre.

- [ ] Abre el menú desde un QR (`/q/{código}`) → llega con `?origen=qr`, que desaparece de la barra. En DevTools → Red se ve `POST /api/ev` (204) al abrir un producto, agregarlo y abrir "Ver pedido", y al cambiar de pestaña.
- [ ] Recargar el menú en la misma pestaña no suma otra visita (una cada 30 min por sucursal).
- [ ] Panel → **Analíticas** (plan Pro o Negocio): Hoy / 7 días / 30 días con el cambio contra la semana anterior (▲/▼); visitas, escaneos, pedidos, conversión, ventas, ticket, % domicilio y % programados.
- [ ] **Embudo**: vieron el menú → abrieron un producto → agregaron → abrieron su pedido → pidieron. "Pedidos" del resumen es igual a la cuenta de la bandeja en ese periodo; "Pidieron" son los celulares que vieron el menú y además pidieron (mismo id de dispositivo que el pedido).
- [ ] El selector de sucursal de arriba filtra todo (como en Inicio). El encargado solo ve sus sucursales.
- [ ] Pedidos por hora (hora de Guatemala), productos más pedidos (sin cancelados) y más vistos, escaneos por QR.
- [ ] **Negocio**: con "Todas" aparece la comparación por sucursal y **Exportar por día (CSV)** abre bien en Excel (separador `;`, acentos correctos). Pro muestra el aviso del plan Negocio; **Gratis** solo ve hoy (visitas, escaneos, pedidos, ventas) y el aviso del plan Pro.
- [ ] Al terminar en el demo, borra los eventos creados (`analytics_events` con id mayor al anotado) y las filas `rate_limits` con clave `ev:%`.

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

3. Opcionales: `app_url` (`NEXT_PUBLIC_APP_URL`), `map_tiles` (llave de MapTiler o Stadia; OSM solo sirve para desarrollo), `sentry` (`NEXT_PUBLIC_SENTRY_DSN`, **sin** marcar Sensitive), `web_push` y `cron_secret` (avisos de pedidos, abajo).
4. **Avisos push (QRM-032).** Copia de tu `.env.local` a Vercel (Production y Preview) las líneas `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` y `CRON_SECRET` (las dos últimas como Sensitive) y haz un **Redeploy**. Usa las **mismas** llaves VAPID en todos los entornos: la base es compartida y una suscripción solo acepta avisos firmados con la llave con que se creó. Opcional: `VAPID_SUBJECT` (por defecto, el dominio de la app).
5. **Cron del escalamiento (cada minuto).** Vercel Hobby solo permite crons diarios (y un cron más frecuente en `vercel.json` hace fallar el deploy), así que corre en Supabase con pg_cron + pg_net. Una sola vez, desde tu PC, cuando producción ya tenga `/api/cron/push`:

   ```bash
   pnpm push:cron https://<dominio>/api/cron/push
   pnpm push:cron --status   # debe mostrar status_code 200 cada minuto
   ```

   La URL y `CRON_SECRET` quedan cifrados en Supabase Vault. `pnpm push:cron --off` lo apaga. Con el plan Pro de Vercel se puede usar Vercel Cron en su lugar (`"crons": [{ "path": "/api/cron/push", "schedule": "* * * * *" }]` en `vercel.json`): manda el mismo encabezado.

6. En **Supabase → Authentication → URL Configuration** de ese proyecto: _Site URL_ = el dominio, y en _Redirect URLs_ agrega `https://<dominio>/auth/callback`.

Mientras falte Supabase, el sitio no se cae: la portada funciona, `/entrar` muestra "El acceso todavía no está configurado en este entorno" y las rutas privadas piden entrar.

## 6. Pendientes conocidos

Fallas detectadas en la revisión que se corrigen al final del MVP. No bloquean el uso: cada una tiene una alternativa.

| #   | Dónde                    | Qué pasa                                                                                                                                                                                                                                                                                                                                                         | Alternativa mientras tanto                                                           | Detectado                           |
| --- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------- |
| 1   | Menús → editor (QRM-017) | ~~**Arrastrar** secciones y productos con la manija ⠿ no los mueve.~~ **Resuelto**: confirmado en un navegador real el 2026-10-22 (el navegador de pruebas automáticas no permite arrastrar).                                                                                                                                                                    | —                                                                                    | 2026-10-21, revisión de QRM-017     |
| 2   | Menú público (QRM-020)   | El JS inicial pesa **~225 KB gzip** (presupuesto de la guía: ~130 KB). La página de inicio `/` ya pesa ~216 KB: el menú solo agrega ~9 KB. El peso viene de lo común a todas las páginas (Next 16 + React 19, layout raíz con Sentry, sonner, Radix y lucide).                                                                                                   | Funciona bien; afecta el tiempo de carga en celulares lentos.                        | 2026-10-21, revisión de QRM-020     |
| 3   | Producción (mapa)        | Falta `NEXT_PUBLIC_MAP_TILE_URL` (MapTiler o Stadia): se usan teselas de OpenStreetMap, no aptas para producción.                                                                                                                                                                                                                                                | El mapa funciona, pero OSM puede bloquearlo.                                         | 2026-10-20                          |
| 4   | Producción (seguridad)   | ~~Solo se envía HSTS.~~ **Resuelto** (2026-10-22): `X-Frame-Options: DENY`, `frame-ancestors 'none'`, `nosniff`, `Referrer-Policy` y `Permissions-Policy` (ubicación solo para la app) en todas las rutas (`lib/security-headers.ts`). Falta una CSP completa para scripts.                                                                                      | Ninguna: corregir antes del release de la Fase 3.                                    | 2026-10-22, reporte de verificación |
| 5   | SEO                      | ~~No hay robots.txt ni sitemap.xml.~~ **Resuelto** (2026-10-22): `app/robots.ts` y `app/sitemap.ts` (menús publicados, caché de 1 h). Sigue: las páginas inexistentes responden 200 (soft 404), mitigado con `noindex`.                                                                                                                                          | No afecta a usuarios; afecta a Google.                                               | 2026-10-22, reporte de verificación |
| 6   | Menú público (QRM-022)   | ~~`Uncaught (in promise) InvalidStateError` al interrumpirse la transición de la foto.~~ **Resuelto** (2026-10-22): las promesas de la transición se atrapan.                                                                                                                                                                                                    | La hoja se abre igual.                                                               | 2026-10-22, reporte de verificación |
| 7   | Menú público (QRM-025)   | ~~Dos avisos que se contradicen con la sucursal cerrada.~~ **Resuelto** (2026-10-22): cerrada, solo se muestra su aviso. (La franja de desayuno del demo, 06:30, sigue antes de la apertura, 07:00.)                                                                                                                                                             | Ajustar la franja del demo a 07:00.                                                  | 2026-10-22, reporte de verificación |
| 8   | Demo                     | El WhatsApp de las sucursales del demo es `+502 0000-0000`: los pedidos de la demo no llegan a nadie.                                                                                                                                                                                                                                                            | Poner un número real en Panel → Sucursales.                                          | 2026-10-22, reporte de verificación |
| 9   | Avisos push (QRM-032)    | Sin probar en teléfonos reales: Android con la app instalada, iPhone instalado (iOS 16.4+) y la tablet del staff. En local se probó el cifrado contra el RFC, los destinatarios y el escalamiento con un servicio de push simulado.                                                                                                                              | Probar con el dominio de Vercel siguiendo §4 (QRM-032).                              | 2026-10-22, QRM-032                 |
| 10  | Avisos push (QRM-032)    | El escalamiento cada 3 min y el aviso de programados necesitan el cron de Supabase (`pnpm push:cron …`), que se programa cuando producción tenga `/api/cron/push`. Hasta entonces solo llega el primer aviso.                                                                                                                                                    | La bandeja abierta sigue sonando y parpadeando.                                      | 2026-10-22, QRM-032                 |
| 11  | Avisos push (QRM-032)    | Si el navegador renueva la suscripción por su cuenta (`pushsubscriptionchange`, poco común), el dispositivo deja de recibir avisos hasta que se vuelvan a activar. La tablet del staff se re-asocia sola al abrir la bandeja; el panel no.                                                                                                                       | Notificaciones → Activar otra vez.                                                   | 2026-10-22, QRM-032                 |
| 12  | Apariencia (QRM-033)     | ~~Fuentes y fondos solo en Clásico.~~ **Resuelto** (QRM-034): las 4 plantillas comparten `MenuShell` y `MenuHeader`. Pendiente: capturas de pantalla automáticas (4 plantillas × 3 paletas) con Playwright en QRM-045; hoy la prueba común es de contenido y comportamiento, y la revisión visual es en `/styleguide`.                                           | —                                                                                    | 2026-10-22, QRM-033                 |
| 13  | Apariencia (QRM-033)     | Sin probar en teléfonos reales: el video de fondo en la portada (Safari iOS, Chrome Android, navegador de Instagram) y "Extraer de mi logo" con un logo real subido (el demo no tiene logo).                                                                                                                                                                     | Probar con el dominio de Vercel siguiendo §4 (QRM-033).                              | 2026-10-22, QRM-033                 |
| 14  | Pruebas de integración   | `audit_logs` no tiene FK (la auditoría sobrevive al negocio): las pruebas anteriores dejaron ~1,100 filas de negocios `zz-test-*` ya borrados. La de QRM-033 limpia las suyas.                                                                                                                                                                                   | No afecta a usuarios; limpiar con un DELETE y hacer que cada prueba borre las suyas. | 2026-10-22, QRM-033                 |
| 15  | Menú público (hojas)     | Arreglado el 2026-10-22: en el iPhone las hojas de producto y de pedido salían sin contenido (WebKit resolvía a 0 la base `flex-1` del cuerpo) y elegir Transferencia desplazaba toda la hoja (los radios ocultos desbordaban el `<dialog>`). En Chromium se verificó la medida; **falta confirmarlo en un iPhone real** (el navegador de pruebas no es WebKit). | Probar §4 (QRM-025) en el iPhone.                                                    | 2026-10-22, pruebas del usuario     |
| 16  | QR (QRM-035)             | Sin probar impreso: escanear un A6 a 1 m con 3 celulares (criterio del ticket). Lo medido: QR de 88 mm, versión 4 (33 módulos), **2.1 mm por módulo**, nivel Q con logo < 5 % del área.                                                                                                                                                                          | Probar §4 (QRM-035) con una impresión al 100 %.                                      | 2026-10-23, QRM-035                 |
| 17  | App del menú (QRM-036)   | Sin probar en teléfonos reales: instalar en Android (botón) e iPhone (guía), el ícono con el logo y abrir sin conexión. En local se verificó el manifiesto, los 4 íconos, el registro del service worker y la copia sin conexión (servidor apagado). Los logos subidos antes en WebP dan el ícono con la inicial.                                                | Probar §4 (QRM-036) con el dominio de Vercel; volver a subir el logo.                | 2026-10-23, QRM-036                 |
| 18  | Reseñas (QRM-037)        | Sin probar con una ficha real de Google: el demo no tiene Place ID. En local se verificó con un Place ID de ejemplo: la reseña se guarda con su sucursal, el botón abre el formulario de Google y el toque se cuenta (meta 30 %); ocultar/mostrar queda auditado.                                                                                                | Poner el Place ID real de cada sucursal y probar §4 (QRM-037) en el teléfono.        | 2026-10-23, QRM-037                 |
| 19  | Analíticas (QRM-038)     | Sin probar en teléfonos: que sendBeacon llegue desde Safari, Chrome Android y el navegador de Instagram, y la vista de los planes Gratis y Pro (el demo es Negocio). Las visitas empiezan a contarse con este deploy: la conversión de periodos anteriores sale como "—" o baja.                                                                                 | Probar §4 (QRM-038) con el dominio de Vercel y un negocio en Gratis.                 | 2026-10-23, QRM-038                 |

El detalle de los puntos 4 a 8 y lo que se verificó está en [reporte-verificacion-2026-10-22.md](reporte-verificacion-2026-10-22.md).

Para corregir el #2: analizar el bundle (`next build` con análisis de chunks) y revisar qué entra en el layout raíz: confirmar que Sentry se cargue de verdad diferido (`lib/sentry.ts`) y llevar `LoadingOverlay`/`Toaster` solo a las rutas que los usan.
