import { config as loadEnv } from "dotenv";
import { defineConfig } from "prisma/config";

// Prisma 7 no carga .env por sí solo: primero .env.local (local), luego .env.
loadEnv({ path: ".env.local", quiet: true });
loadEnv({ quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Las migraciones usan la conexión directa (sin pooler). En runtime la app
  // usa DATABASE_URL (pooler en modo transacción) desde lib/db.ts.
  datasource: {
    url: process.env.DIRECT_URL,
  },
});
