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

## Scripts

| Script           | Qué hace                            |
| ---------------- | ----------------------------------- |
| `pnpm dev`       | Servidor de desarrollo              |
| `pnpm build`     | Build de producción                 |
| `pnpm lint`      | ESLint (sin warnings permitidos)    |
| `pnpm typecheck` | Genera tipos de rutas y corre `tsc` |
| `pnpm format`    | Formatea con Prettier               |
| `pnpm test`      | Pruebas unitarias con Vitest        |
| `pnpm check`     | Lint + typecheck + formato + tests  |

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
