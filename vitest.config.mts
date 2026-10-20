import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const root = (path: string) => fileURLToPath(new URL(path, import.meta.url));

export default defineConfig({
  resolve: {
    alias: {
      "@": root("./"),
      // "server-only" lanza fuera de React Server Components; en pruebas es un módulo vacío.
      "server-only": root("./tests/support/empty.ts"),
    },
  },
  test: {
    include: ["**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "generated", "tests/e2e/**", "tests/integration/**"],
    environment: "node",
  },
});
