@AGENTS.md

# qr-menu — notas para agentes

- Fuente de requisitos: guía MVP "Menú digital QR con pedidos por WhatsApp" (proyecto renombrado de "Cartita" a "qr-menu"; tickets `QRM-0XX` en lugar de `CAR-0XX`).
- La marca visible nunca se escribe directo: usar `BRAND` de `lib/brand.ts`.
- Ramas: `feat/QRM-0XX-slug` desde `develop`; PR siempre a `develop`. `master` es producción.
- Antes de commitear: `pnpm check`. Repo público: nunca commitear secretos.
- Cambios de esquema: editar `prisma/schema.prisma` → `pnpm db:migrate`; luego `pnpm db:sql` (activa RLS en tablas nuevas) y `pnpm db:verify`. SQL de Supabase (auth, RLS, Storage, Realtime) solo en `prisma/sql/`, idempotente.
- Server Actions: Zod → `requireAccess` (lib/auth/require-access.ts) → `assertWithinLimit` (features/licensing/server.ts) → Prisma → audit → revalidateTag; errores con `actionError` (lib/action-result.ts). Lógica pura con pruebas unitarias; lo que toca la base, en `pnpm test:integration`.
- Esperas: páginas → `loading.tsx`/`Skeleton`; acciones que bloquean (pedido, foto, publicar, turno) → `withLoading("Mensaje…", (signal) => accion())` de `lib/loading/store.ts`; botones → `<Button loading>`; guardado automático → `<SaveIndicator>`.
