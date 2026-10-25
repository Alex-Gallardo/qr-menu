# qr-menu

Menú digital QR **multi-negocio y multi-sucursal**: cada restaurante obtiene un menú (link + QR por sucursal) instalable como app, donde el comensal arma su pedido en 3 toques y lo envía por WhatsApp a la sucursal. Mercado inicial: Guatemala (GTQ, español, `America/Guatemala`).

> El nombre comercial visible se configura con `NEXT_PUBLIC_BRAND_NAME` (ver `lib/brand.ts`).

## Stack

Next.js 16 (App Router) · TypeScript strict · Tailwind CSS v4 + shadcn/ui · Supabase (Postgres, Auth, Storage, Realtime) · Prisma · Zustand · TanStack Query · React Hook Form + Zod · Vitest · Playwright.

## Requisitos

- Node.js 22 (`.nvmrc`)
- pnpm 10 (`npm i -g pnpm` o `corepack enable pnpm`)

## Primeros pasos

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Abre <http://localhost:3000>. Para probar todo lo construido (usuarios de prueba, rutas y lista de verificación) sigue [docs/verificacion.md](docs/verificacion.md).

## Supabase y base de datos

Hay dos proyectos de Supabase: **dev** (desarrollo y previews) y **prod** (producción). Cada uno tiene sus propias llaves; nunca se mezclan.

1. Crea el proyecto en [supabase.com](https://supabase.com) (región más cercana a Guatemala, p. ej. `us-east-1`).
2. En **Project Settings → API Keys** copia la URL, la _publishable key_ y la _secret key_ a `.env.local`.
3. En **Connect → ORMs** copia las cadenas de conexión:
   - `DATABASE_URL`: _Transaction pooler_ (puerto 6543, con `?pgbouncer=true`). La usa la app en runtime.
   - `DIRECT_URL`: _Session pooler_ o conexión directa (puerto 5432). La usan las migraciones.
4. Crea el esquema y verifica:

```bash
pnpm db:migrate    # aplica las migraciones de Prisma (37 tablas)
pnpm db:sql        # aplica el SQL de Supabase (funciones, triggers, RLS, Storage, Realtime)
pnpm db:verify     # comprueba tablas, RLS, políticas, triggers, bucket y Realtime
pnpm db:seed       # planes, ajustes, negocio demo y usuarios de prueba
```

En producción: `pnpm db:deploy` (= `prisma migrate deploy` + `db:sql`) y `SEED_SCOPE=demo pnpm db:seed`.

### Datos semilla

`pnpm db:seed` es idempotente: actualiza planes y ajustes (sin pisar los que ya editó el super admin) y vuelve a crear el negocio demo.

| Alcance (`SEED_SCOPE`) | Crea                                                                                                                                                                                                                                                                                           | ¿Producción?              |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------- |
| `base`                 | 3 planes (Gratis Q0, Pro Q149, Negocio Q299) y `platform_settings` (slugs reservados, días de prueba y gracia, fuentes, paletas, bienvenida)                                                                                                                                                   | Sí                        |
| `demo`                 | `base` + **Café El Portal** (`/cafe-el-portal`): 2 sucursales (Zona 1 y Antigua), licencia de prueba Negocio, 3 franjas, 3 menús con programación, 25 productos con foto, "Pasta con mariscos" agotada solo en Antigua, 2 cuentas bancarias, 8 QR y 30 pedidos (5 a domicilio con coordenadas) | Sí (es la demo de ventas) |
| `dev` (por defecto)    | `demo` + usuarios de prueba (admin de plataforma, dueño, encargado solo de Antigua) y 1 staff con PIN por sucursal                                                                                                                                                                             | **No** (el seed se niega) |

Los usuarios de prueba usan `SEED_USERS_PASSWORD` de `.env.local`; si no existe, el seed la genera y la guarda ahí. Pon tu número en `SEED_DEMO_WHATSAPP` para recibir los pedidos del demo; por defecto es un número inválido para no escribirle a un desconocido.

`lib/env.ts` valida las variables con Zod en el primer uso y muestra cuáles faltan, sin imprimir sus valores. El cliente Prisma se genera en `generated/` (ignorado por git) al instalar dependencias.

### Dónde vive cada cosa del esquema

| Qué                                                                              | Dónde                                         | Por qué                                                                     |
| -------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------- |
| Tablas, enums, relaciones e índices                                              | `prisma/schema.prisma` → `prisma/migrations/` | Prisma los genera y versiona                                                |
| Índices parciales y `CHECK` (p. ej. `one_default_menu`, `rating_range`)          | Migración SQL manual en `prisma/migrations/`  | Postgres estándar que Prisma no modela; se replica en la base _shadow_      |
| Funciones con `auth.uid()`, triggers sobre `auth.users`, RLS, Storage y Realtime | `prisma/sql/*.sql` (idempotentes, en orden)   | Dependen de Supabase; la base _shadow_ de Prisma no tiene el esquema `auth` |

**Regla de RLS:** RLS está activo en **todas** las tablas. Prisma se conecta como dueño y no pasa por RLS (la protección en servidor es `requireAccess`). Solo se abren políticas para lo que el navegador toca directo con la llave pública: pedidos (Realtime) y archivos (Storage). Una tabla nueva sin política queda cerrada por defecto: al agregar tablas, corre `pnpm db:sql` para activar su RLS.

## Autenticación y acceso

| Ruta                                 | Quién entra                                                      | Cómo se protege                                                                       |
| ------------------------------------ | ---------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| `/entrar`, `/registro`, `/recuperar` | Cualquiera (con sesión, `/entrar` y `/registro` llevan al panel) | —                                                                                     |
| `/panel/**`, `/onboarding`           | Usuario con email                                                | `proxy.ts` (sin sesión → `/entrar?next=…`) + verificación de membresía en el servidor |
| `/admin/**`                          | Equipo de la plataforma **con 2FA** (TOTP)                       | `proxy.ts` + `requirePlatformUser()` (sin rol → 404, sin 2FA → `/entrar/2fa`)         |
| `/staff/**`                          | Dispositivo autorizado, turno con PIN o dueño/encargado          | `proxy.ts` (cookie del dispositivo o sesión)                                          |
| Menú público                         | Cualquiera                                                       | —                                                                                     |

- **Proxy** (`proxy.ts`, el antiguo `middleware`): refresca la sesión de Supabase y decide con `lib/auth/route-rules.ts` (función pura, con pruebas). Los permisos finos se validan siempre en el servidor.
- **Modo mantenimiento**: `platform_settings.maintenance_mode = {"enabled": true, "message": "…"}`. Todo responde 503 con el mensaje, salvo `/admin`, `/entrar`, `/auth` y `/api`. Se lee con caché de 30 s.

**Configuración en Supabase** (_Authentication → URL Configuration_):

- _Site URL_: la URL de producción.
- _Redirect URLs_: `http://localhost:3000/auth/callback` y `https://*-alexgallardos-projects.vercel.app/auth/callback` (previews).
- _Emails_: el SMTP por defecto de Supabase envía pocos correos por hora; para producción se configura Resend como SMTP (QRM-029).
- _MFA_: TOTP habilitado (viene activo por defecto).

### Permisos y licencias en el servidor

Nada se habilita solo en el frontend. Toda Server Action sigue este orden:

```ts
"use server";
export async function createBranch(input: unknown): Promise<ActionResult> {
  const parsed = branchSchema.safeParse(input); // 1. Zod
  if (!parsed.success) return { ok: false, message: "Revisa los datos." };
  try {
    await requireAccess(businessId, { roles: ["owner"], write: true }); // 2. sesión, rol, sucursal, licencia
    await assertWithinLimit(businessId, "branches"); // 3. límite del plan
    // 4. escribir con Prisma → 5. audit_logs → 6. revalidateTag
    return { ok: true };
  } catch (error) {
    return actionError(error); // AccessError / LimitExceededError → mensaje amable
  }
}
```

| Pieza                                                            | Archivo                                                                 | Qué hace                                                                                                                                                     |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `getEntitlements(businessId)`                                    | `features/licensing/server.ts`                                          | Plan + ajustes del super admin + estado efectivo (prueba, activa, gracia, gratis, suspendida, cancelada). Aplica vencimientos aunque el cron no haya corrido |
| `assertWithinLimit(businessId, recurso)`                         | `features/licensing/server.ts`                                          | Sucursales, productos, menús, franjas, QR, encargados, staff y MB. Mensaje: "Tu plan incluye 1 sucursal. Pasa a Negocio para agregar más."                   |
| `requireAccess(businessId, { roles, branchId, feature, write })` | `lib/auth/require-access.ts`                                            | Sesión → membresía → sucursal del negocio → rol → licencia → función                                                                                         |
| Lógica pura                                                      | `features/licensing/entitlements.ts`, `limits.ts`, `lib/auth/access.ts` | Sin base de datos: con pruebas unitarias                                                                                                                     |

## Deploy (Vercel) y errores (Sentry)

**Vercel** (plan Pro: el gratuito no permite uso comercial):

1. _Add New → Project_ e importa `Alex-Gallardo/qr-menu`. Framework: Next.js (detectado); comando de instalación `pnpm install`.
2. _Settings → Git_: **Production Branch = `master`**. Cada PR y la rama `develop` generan una URL de _preview_.
3. _Settings → Environment Variables_, separadas por entorno:
   - **Production** → valores del proyecto Supabase **prod**.
   - **Preview** y **Development** → valores del proyecto Supabase **dev**.
4. Las funciones corren en `iad1` (`vercel.json`), la misma región que Supabase `us-east-1`.
5. Revisa el entorno en `https://<dominio>/api/health`: dice qué variable o paso falta (solo sí/no, nunca valores). Al cambiar una `NEXT_PUBLIC_*` hay que volver a desplegar, porque se incrusta al compilar.

**Sentry** (plan gratuito):

1. Crea un proyecto _Next.js_ en sentry.io.
2. En Vercel agrega `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_ORG`, `SENTRY_PROJECT` y `SENTRY_AUTH_TOKEN` (_Settings → Auth Tokens_ en Sentry, con permiso de releases y source maps). El token va **solo** en Vercel.
3. Sentry se activa solo en builds de producción con DSN. En el navegador se carga diferido (cuando el hilo principal está libre) para no sumar ~50 KB al JS inicial del menú. Los eventos pasan por el túnel `/api/monitoring` para que los bloqueadores no los descarten.
4. Privacidad: `sendDefaultPii: false` (sin IPs, cookies ni datos del comensal).

## Scripts

| Script                  | Qué hace                                                                        |
| ----------------------- | ------------------------------------------------------------------------------- |
| `pnpm dev`              | Servidor de desarrollo                                                          |
| `pnpm build`            | Build de producción                                                             |
| `pnpm lint`             | ESLint (sin warnings permitidos)                                                |
| `pnpm typecheck`        | Genera tipos de rutas y corre `tsc`                                             |
| `pnpm format`           | Formatea con Prettier                                                           |
| `pnpm test`             | Pruebas unitarias con Vitest                                                    |
| `pnpm test:integration` | Pruebas contra Supabase dev (requiere `pnpm db:seed`)                           |
| `pnpm test:e2e`         | E2E con Playwright (C1–C3, D1, S1, S2, A2) contra el build (`pnpm build` antes) |
| `pnpm test:lighthouse`  | Lighthouse CI móvil (landing, precios, legal; `LHCI_MENU=1` suma el menú)       |
| `pnpm check`            | Lint + typecheck + formato + tests                                              |
| `pnpm db:migrate`       | Crea y aplica migraciones (dev)                                                 |
| `pnpm db:sql`           | Aplica el SQL de Supabase (RLS, etc.)                                           |
| `pnpm db:verify`        | Verifica tablas, RLS y políticas                                                |
| `pnpm db:deploy`        | Migraciones + SQL en producción                                                 |
| `pnpm db:seed`          | Datos semilla (planes, demo, usuarios)                                          |
| `pnpm db:status`        | Estado de las migraciones                                                       |
| `pnpm db:studio`        | Explorador visual de la base de datos                                           |

## Flujo de trabajo con Git

| Rama                  | Uso                                                        |
| --------------------- | ---------------------------------------------------------- |
| `master`              | Producción. Solo recibe merges desde `develop` por release |
| `develop`             | Integración y pruebas                                      |
| `feat/QRM-0XX-nombre` | Una rama por ticket, sale de `develop` y vuelve por PR     |

- Commits con [Conventional Commits](https://www.conventionalcommits.org/es/): `feat(branches): crear sucursal con horarios`. Lo valida `commitlint` en el hook `commit-msg`.
- `pre-commit` corre ESLint + Prettier sobre los archivos en stage; `pre-push` corre el typecheck.
- Cada PR apunta a `develop` y debe pasar el CI (lint, typecheck, formato, tests, build y detección de secretos).
- Al cerrar cada fase se abre un PR de release `develop → master` y se etiqueta la versión.

## Convenciones

- Archivos en `kebab-case`, componentes en `PascalCase`, rutas visibles en español.
- Lógica por dominio en `features/<dominio>/` (componentes, `actions.ts`, `queries.ts`, `schemas.ts`).
- Precios en centavos enteros (`*_cents`).
- Ningún secreto en el código: todo por variables de entorno (`.env.example` documenta cada una).
