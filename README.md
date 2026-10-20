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

Abre <http://localhost:3000>.

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
```

En producción: `pnpm db:deploy` (= `prisma migrate deploy` + `db:sql`).

`lib/env.ts` valida las variables con Zod en el primer uso y muestra cuáles faltan, sin imprimir sus valores. El cliente Prisma se genera en `generated/` (ignorado por git) al instalar dependencias.

### Dónde vive cada cosa del esquema

| Qué                                                                              | Dónde                                         | Por qué                                                                     |
| -------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------------------------- |
| Tablas, enums, relaciones e índices                                              | `prisma/schema.prisma` → `prisma/migrations/` | Prisma los genera y versiona                                                |
| Índices parciales y `CHECK` (p. ej. `one_default_menu`, `rating_range`)          | Migración SQL manual en `prisma/migrations/`  | Postgres estándar que Prisma no modela; se replica en la base _shadow_      |
| Funciones con `auth.uid()`, triggers sobre `auth.users`, RLS, Storage y Realtime | `prisma/sql/*.sql` (idempotentes, en orden)   | Dependen de Supabase; la base _shadow_ de Prisma no tiene el esquema `auth` |

**Regla de RLS:** RLS está activo en **todas** las tablas. Prisma se conecta como dueño y no pasa por RLS (la protección en servidor es `requireAccess`). Solo se abren políticas para lo que el navegador toca directo con la llave pública: pedidos (Realtime) y archivos (Storage). Una tabla nueva sin política queda cerrada por defecto: al agregar tablas, corre `pnpm db:sql` para activar su RLS.

## Scripts

| Script            | Qué hace                              |
| ----------------- | ------------------------------------- |
| `pnpm dev`        | Servidor de desarrollo                |
| `pnpm build`      | Build de producción                   |
| `pnpm lint`       | ESLint (sin warnings permitidos)      |
| `pnpm typecheck`  | Genera tipos de rutas y corre `tsc`   |
| `pnpm format`     | Formatea con Prettier                 |
| `pnpm test`       | Pruebas unitarias con Vitest          |
| `pnpm check`      | Lint + typecheck + formato + tests    |
| `pnpm db:migrate` | Crea y aplica migraciones (dev)       |
| `pnpm db:sql`     | Aplica el SQL de Supabase (RLS, etc.) |
| `pnpm db:verify`  | Verifica tablas, RLS y políticas      |
| `pnpm db:deploy`  | Migraciones + SQL en producción       |
| `pnpm db:status`  | Estado de las migraciones             |
| `pnpm db:studio`  | Explorador visual de la base de datos |

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
