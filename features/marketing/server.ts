import "server-only";
import { cacheLife } from "next/cache";
import { db } from "@/lib/db";
import { todayInGuatemala } from "@/lib/gt-time";

/**
 * Datos de la landing, cacheados una hora (la página queda estática): precios
 * de los planes (editables en el super admin) y pedidos del mes en toda la
 * plataforma (prueba social). Si la base no responde, la landing sale igual.
 */
export async function getLandingData() {
  "use cache";
  cacheLife("hours");
  try {
    // Día 1 del mes en Guatemala (UTC−6): 06:00 UTC.
    const monthStart = new Date(`${todayInGuatemala().slice(0, 8)}01T06:00:00Z`);
    const [plans, ordersThisMonth, businesses] = await Promise.all([
      db().plans.findMany({ select: { id: true, price_gtq: true } }),
      db().orders.count({ where: { created_at: { gte: monthStart } } }),
      db().businesses.count({ where: { published: true } }),
    ]);
    return {
      prices: Object.fromEntries(plans.map((p) => [p.id, p.price_gtq])) as Record<string, number>,
      ordersThisMonth,
      businesses,
    };
  } catch (error) {
    console.error("[landing] Sin datos de la base:", error);
    return { prices: {} as Record<string, number>, ordersThisMonth: 0, businesses: 0 };
  }
}

/** La prueba social se muestra solo con números que dicen algo. */
export const SOCIAL_PROOF_MIN_ORDERS = 50;
