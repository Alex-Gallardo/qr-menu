# Cómo verificar qr-menu (Fases 0, 1 y 2)

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

| Ruta                                    | Qué es                                                      | Quién entra                                             |
| --------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------- |
| `/`                                     | Portada                                                     | Todos                                                   |
| `/styleguide`                           | Sistema de diseño (botones, colores, cargas…)               | Todos en local y previews; en producción solo el equipo |
| `/entrar`                               | Entrar con contraseña o enlace por correo                   | Sin sesión                                              |
| `/registro`                             | Crear cuenta de dueño                                       | Sin sesión                                              |
| `/recuperar`                            | Recuperar contraseña                                        | Sin sesión                                              |
| `/onboarding`                           | Crear el primer negocio (cuenta nueva)                      | Con sesión                                              |
| `/panel`                                | Te lleva al panel de tu negocio                             | Dueño o encargado                                       |
| `/panel/{negocio}`                      | **Inicio** del panel                                        | Dueño o encargado                                       |
| `/panel/{negocio}/productos`            | Catálogo, búsqueda y disponibilidad                         | Dueño o encargado                                       |
| `/panel/{negocio}/productos/nuevo`      | Nuevo producto                                              | Dueño o encargado                                       |
| `/panel/{negocio}/productos/categorias` | Categorías                                                  | Dueño o encargado                                       |
| `/panel/{negocio}/programacion`         | Franjas horarias (y, más adelante, la programación semanal) | Dueño edita; encargado solo ve                          |
| `/panel/{negocio}/sucursales`           | Sucursales (horario, entregas, mapa)                        | Dueño (encargado: solo las suyas)                       |
| `/panel/{negocio}/ajustes/negocio`      | Logo, portada, nombre, link y redes                         | Solo dueño                                              |
| `/panel/{negocio}/ajustes/pagos`        | Cuentas para transferencia                                  | Solo dueño                                              |
| `/panel/{negocio}/ajustes/licencia`     | Mi plan                                                     | Solo dueño                                              |
| `/admin`                                | Super admin (provisional)                                   | Equipo de la plataforma con 2FA                         |
| `/api/health`                           | Estado de la configuración                                  | Todos (solo sí/no)                                      |

`{negocio}` es el id del negocio. No hace falta copiarlo: entra a `/panel` y te lleva solo. Pedidos, Menús, QR, Reseñas, Analíticas, Equipo, Apariencia y Notificaciones aparecen en la navegación, pero son de fases siguientes y muestran "Muy pronto".

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
