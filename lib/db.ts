import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";
import { serverEnv } from "@/lib/env";

/**
 * Cliente Prisma del servidor. Usa el pooler de Supabase (modo transacción,
 * puerto 6543). Prisma omite RLS: la protección en servidor es requireAccess.
 */
function createPrismaClient() {
  const { DATABASE_URL, NODE_ENV } = serverEnv();
  const adapter = new PrismaPg({ connectionString: DATABASE_URL });
  return new PrismaClient({
    adapter,
    log: NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

/** Instancia única (evita abrir conexiones nuevas en cada recarga en desarrollo). */
export function db(): PrismaClient {
  globalForPrisma.prisma ??= createPrismaClient();
  return globalForPrisma.prisma;
}
