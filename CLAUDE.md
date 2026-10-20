@AGENTS.md

# qr-menu — notas para agentes

- Fuente de requisitos: guía MVP "Menú digital QR con pedidos por WhatsApp" (proyecto renombrado de "Cartita" a "qr-menu"; tickets `QRM-0XX` en lugar de `CAR-0XX`).
- La marca visible nunca se escribe directo: usar `BRAND` de `lib/brand.ts`.
- Ramas: `feat/QRM-0XX-slug` desde `develop`; PR siempre a `develop`. `master` es producción.
- Antes de commitear: `pnpm check`. Repo público: nunca commitear secretos.
