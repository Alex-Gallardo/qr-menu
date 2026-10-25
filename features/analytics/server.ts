import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import type { Range } from "./metrics";
import type { EventBatch } from "./schemas";

/**
 * Guarda un lote del menú público. La sucursal debe ser de ese negocio (si
 * no, se descarta en silencio: es un endpoint anónimo). Devuelve cuántos guardó.
 */
export async function recordEvents(batch: EventBatch) {
  const branch = await db().branches.findFirst({
    where: { id: batch.branchId, business_id: batch.businessId },
    select: { id: true },
  });
  if (!branch) return 0;
  const { count } = await db().analytics_events.createMany({
    data: batch.events.map((e) => ({
      business_id: batch.businessId,
      branch_id: batch.branchId,
      event: e.event,
      session_id: batch.sessionId,
      product_id: e.productId ?? null,
      menu_id: e.menuId ?? null,
      meta:
        e.source || e.quantity
          ? {
              ...(e.source ? { source: e.source } : {}),
              ...(e.quantity ? { qty: e.quantity } : {}),
            }
          : undefined,
    })),
  });
  return count;
}

const ids = (branchIds: string[]) => Prisma.sql`${branchIds}::uuid[]`;

export type Summary = {
  visits: number;
  visitors: number;
  scans: number;
  viewedProduct: number;
  addedToCart: number;
  startedCheckout: number;
  /** Pedidos creados en el periodo (todos los estados: cuadra con la bandeja). */
  orders: number;
  /** Celulares que vieron el menú en el periodo y pidieron (último paso del embudo). */
  orderedVisitors: number;
  cancelled: number;
  /** Ventas y ticket sin los cancelados. */
  revenueCents: number;
  validOrders: number;
  delivery: number;
  scheduled: number;
  whatsappOpened: number;
};

/** Números del periodo para unas sucursales (una lectura de eventos y una de pedidos). */
export async function getSummary(
  businessId: string,
  branchIds: string[],
  range: Range,
): Promise<Summary> {
  if (branchIds.length === 0) return emptySummary();
  const [events, orders] = await Promise.all([
    db().$queryRaw<
      {
        visits: number;
        visitors: number;
        scans: number;
        viewed: number;
        added: number;
        checkout: number;
      }[]
    >`
      SELECT
        count(*) FILTER (WHERE event = 'page_view')::int AS visits,
        count(DISTINCT session_id) FILTER (WHERE event = 'page_view')::int AS visitors,
        count(*) FILTER (WHERE event = 'qr_scan')::int AS scans,
        count(DISTINCT session_id) FILTER (WHERE event = 'product_view')::int AS viewed,
        count(DISTINCT session_id) FILTER (WHERE event = 'add_to_cart')::int AS added,
        count(DISTINCT session_id) FILTER (WHERE event = 'checkout_start')::int AS checkout
      FROM analytics_events
      WHERE business_id = ${businessId}::uuid AND branch_id = ANY(${ids(branchIds)})
        AND created_at >= ${range.from} AND created_at < ${range.to}`,
    db().$queryRaw<
      {
        orders: number;
        cancelled: number;
        revenue: number;
        valid: number;
        delivery: number;
        scheduled: number;
        whatsapp: number;
        ordered: number;
      }[]
    >`
      SELECT
        count(*)::int AS orders,
        count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
        coalesce(sum(total_cents) FILTER (WHERE status <> 'cancelled'), 0)::int AS revenue,
        count(*) FILTER (WHERE status <> 'cancelled')::int AS valid,
        count(*) FILTER (WHERE order_type = 'delivery')::int AS delivery,
        count(*) FILTER (WHERE scheduled_for IS NOT NULL)::int AS scheduled,
        count(*) FILTER (WHERE whatsapp_opened_at IS NOT NULL)::int AS whatsapp,
        count(DISTINCT client_session_id) FILTER (WHERE client_session_id IN (
          SELECT session_id FROM analytics_events
          WHERE business_id = ${businessId}::uuid AND branch_id = ANY(${ids(branchIds)})
            AND event = 'page_view' AND created_at >= ${range.from} AND created_at < ${range.to}
        ))::int AS ordered
      FROM orders
      WHERE business_id = ${businessId}::uuid AND branch_id = ANY(${ids(branchIds)})
        AND created_at >= ${range.from} AND created_at < ${range.to}`,
  ]);
  const e = events[0]!;
  const o = orders[0]!;
  return {
    visits: e.visits,
    visitors: e.visitors,
    scans: e.scans,
    viewedProduct: e.viewed,
    addedToCart: e.added,
    startedCheckout: e.checkout,
    orders: o.orders,
    orderedVisitors: o.ordered,
    cancelled: o.cancelled,
    revenueCents: o.revenue,
    validOrders: o.valid,
    delivery: o.delivery,
    scheduled: o.scheduled,
    whatsappOpened: o.whatsapp,
  };
}

function emptySummary(): Summary {
  return {
    visits: 0,
    visitors: 0,
    scans: 0,
    viewedProduct: 0,
    addedToCart: 0,
    startedCheckout: 0,
    orders: 0,
    orderedVisitors: 0,
    cancelled: 0,
    revenueCents: 0,
    validOrders: 0,
    delivery: 0,
    scheduled: 0,
    whatsappOpened: 0,
  };
}

/** Detalle del periodo: pedidos por hora, productos más vistos y pedidos, escaneos por QR. */
export async function getBreakdown(businessId: string, branchIds: string[], range: Range) {
  if (branchIds.length === 0) return { byHour: [], topViewed: [], topOrdered: [], qrScans: [] };
  const where = Prisma.sql`business_id = ${businessId}::uuid AND branch_id = ANY(${ids(branchIds)})
    AND created_at >= ${range.from} AND created_at < ${range.to}`;
  const [byHour, topViewed, topOrdered, qrScans] = await Promise.all([
    db().$queryRaw<{ hour: number; orders: number }[]>`
      SELECT extract(hour FROM created_at AT TIME ZONE 'America/Guatemala')::int AS hour,
        count(*)::int AS orders
      FROM orders WHERE ${where} AND status <> 'cancelled'
      GROUP BY 1`,
    db().$queryRaw<{ name: string; count: number }[]>`
      SELECT p.name, count(*)::int AS count
      FROM analytics_events e JOIN products p ON p.id = e.product_id
      WHERE e.business_id = ${businessId}::uuid AND e.branch_id = ANY(${ids(branchIds)})
        AND e.created_at >= ${range.from} AND e.created_at < ${range.to}
        AND e.event = 'product_view'
      GROUP BY p.id, p.name ORDER BY 2 DESC, 1 LIMIT 8`,
    db().$queryRaw<{ name: string; quantity: number; revenue: number }[]>`
      SELECT max(i.name_snapshot) AS name, sum(i.quantity)::int AS quantity,
        sum(i.line_total_cents)::int AS revenue
      FROM order_items i JOIN orders o ON o.id = i.order_id
      WHERE o.business_id = ${businessId}::uuid AND o.branch_id = ANY(${ids(branchIds)})
        AND o.created_at >= ${range.from} AND o.created_at < ${range.to}
        AND o.status <> 'cancelled'
      GROUP BY coalesce(i.product_id::text, i.name_snapshot) ORDER BY 2 DESC, 1 LIMIT 8`,
    db().$queryRaw<{ label: string; branch: string; count: number }[]>`
      SELECT q.label, b.name AS branch, count(*)::int AS count
      FROM analytics_events e
      JOIN qr_codes q ON q.id = e.qr_code_id
      JOIN branches b ON b.id = q.branch_id
      WHERE e.business_id = ${businessId}::uuid AND e.branch_id = ANY(${ids(branchIds)})
        AND e.created_at >= ${range.from} AND e.created_at < ${range.to}
        AND e.event = 'qr_scan'
      GROUP BY q.id, q.label, b.name ORDER BY 3 DESC, 1 LIMIT 10`,
  ]);
  return { byHour, topViewed, topOrdered, qrScans };
}

/** Comparación por sucursal (plan Negocio). */
export async function getBranchSummaries(
  businessId: string,
  branches: { id: string; name: string }[],
  range: Range,
) {
  return Promise.all(
    branches.map(async (b) => ({
      ...b,
      summary: await getSummary(businessId, [b.id], range),
    })),
  );
}

/** Filas diarias por sucursal para exportar (hora de Guatemala). */
export async function getDailyRows(businessId: string, branchIds: string[], range: Range) {
  if (branchIds.length === 0) return [];
  return db().$queryRaw<
    {
      day: string;
      branch: string;
      visits: number;
      visitors: number;
      scans: number;
      orders: number;
      cancelled: number;
      revenue: number;
    }[]
  >`
    WITH ev AS (
      SELECT (created_at AT TIME ZONE 'America/Guatemala')::date AS day, branch_id,
        count(*) FILTER (WHERE event = 'page_view')::int AS visits,
        count(DISTINCT session_id) FILTER (WHERE event = 'page_view')::int AS visitors,
        count(*) FILTER (WHERE event = 'qr_scan')::int AS scans
      FROM analytics_events
      WHERE business_id = ${businessId}::uuid AND branch_id = ANY(${ids(branchIds)})
        AND created_at >= ${range.from} AND created_at < ${range.to}
      GROUP BY 1, 2
    ), od AS (
      SELECT (created_at AT TIME ZONE 'America/Guatemala')::date AS day, branch_id,
        count(*)::int AS orders,
        count(*) FILTER (WHERE status = 'cancelled')::int AS cancelled,
        coalesce(sum(total_cents) FILTER (WHERE status <> 'cancelled'), 0)::int AS revenue
      FROM orders
      WHERE business_id = ${businessId}::uuid AND branch_id = ANY(${ids(branchIds)})
        AND created_at >= ${range.from} AND created_at < ${range.to}
      GROUP BY 1, 2
    )
    SELECT to_char(coalesce(ev.day, od.day), 'YYYY-MM-DD') AS day, b.name AS branch,
      coalesce(ev.visits, 0)::int AS visits, coalesce(ev.visitors, 0)::int AS visitors,
      coalesce(ev.scans, 0)::int AS scans, coalesce(od.orders, 0)::int AS orders,
      coalesce(od.cancelled, 0)::int AS cancelled, coalesce(od.revenue, 0)::int AS revenue
    FROM ev FULL JOIN od ON od.day = ev.day AND od.branch_id = ev.branch_id
    JOIN branches b ON b.id = coalesce(ev.branch_id, od.branch_id)
    ORDER BY 1, 2`;
}
