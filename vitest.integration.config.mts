import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = (path: string) => fileURLToPath(new URL(path, import.meta.url));

/**
 * Pruebas de integración contra la base de Supabase dev (DATABASE_URL de .env.local).
 * Requieren el seed (`pnpm db:seed`). No corren en CI: no hay credenciales ahí.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": root("./"),
      "server-only": root("./tests/support/empty.ts"),
    },
  },
  test: {
    include: ["tests/integration/**/*.test.ts"],
    environment: "node",
    setupFiles: ["tests/support/load-env.ts"],
    testTimeout: 60_000,
    hookTimeout: 60_000,
    fileParallelism: false,
  },
});
