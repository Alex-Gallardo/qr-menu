import "server-only";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { OrderType, PayMethod } from "./checkout";
import { ACTIVE_STATUSES, canTransition, STATUS_LABELS, type OrderStatus } from "./status";

/**
 * Bandeja del panel: pedidos de las sucursales que el usuario puede ver. Los
 * activos siempre; los terminados de los últimos 2 días. El navegador se
 * entera de cambios por Realtime (RLS) y vuelve a pedir esta lista.
 */

const RECENT_MS = 2 * 24 * 60 * 60 * 1000;

export async function listInboxOrders(branchIds: string[], now: Date = new Date()) {
  if (branchIds.length === 0) return [];
  const rows = await db().orders.findMany({
    where: {
      branch_id: { in: branchIds },
      OR: [
        { status: { in: ACTIVE_STATUSES } },
        { created_at: { gte: new Date(now.getTime() - RECENT_MS) } },
      ],
    },
    orderBy: { created_at: "desc" },
    take: 200,
    select: {
      id: true,
      number: true,
      status: true,
      order_type: true,
      table_label: true,
      scheduled_for: true,
      customer_name: true,
      total_cents: true,
      payment_method: true,
      address: true,
      created_at: true,
      branch: { select: { id: true, name: true } },
      items: { select: { name_snapshot: true, quantity: true }, orderBy: { id: "asc" } },
    },
  });
  return rows.map((o) => ({
    id: o.id,
    number: o.number,
    status: o.status as OrderStatus,
    orderType: o.order_type as OrderType,
    tableLabel: o.table_label,
    scheduledFor: o.scheduled_for,
    customerName: o.customer_name,
    totalCents: o.total_cents,
    payment: o.payment_method as PayMethod,
    address: o.address,
    createdAt: o.created_at,
    branch: o.branch,
    summary: o.items.map((i) => `${i.quantity}× ${i.name_snapshot}`).join(", "),
  }));
}

export type InboxOrder = Awaited<ReturnType<typeof listInboxOrders>>[number];

/** Detalle para el panel (null si no existe o es de una sucursal que no ve). */
export async function getOrderDetail(businessId: string, orderId: string, branchIds: string[]) {
  const o = await db().orders.findFirst({
    where: { id: orderId, business_id: businessId, branch_id: { in: branchIds } },
    select: {
      id: true,
      number: true,
      status: true,
      order_type: true,
      table_label: true,
      scheduled_for: true,
      customer_name: true,
      customer_phone: true,
      customer_email: true,
      address: true,
      address_reference: true,
      delivery_lat: true,
      delivery_lng: true,
      delivery_accuracy_m: true,
      location_source: true,
      distance_km: true,
      payment_method: true,
      notes: true,
      subtotal_cents: true,
      delivery_fee_cents: true,
      total_cents: true,
      whatsapp_opened_at: true,
      created_at: true,
      branch: { select: { id: true, name: true, lat: true, lng: true } },
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          name_snapshot: true,
          quantity: true,
          unit_price_cents: true,
          line_total_cents: true,
          options_snapshot: true,
          notes: true,
        },
      },
      events: { orderBy: { created_at: "asc" }, select: { status: true, created_at: true } },
    },
  });
  if (!o) return null;
  return {
    id: o.id,
    number: o.number,
    status: o.status as OrderStatus,
    orderType: o.order_type as OrderType,
    tableLabel: o.table_label,
    scheduledFor: o.scheduled_for,
    customer: { name: o.customer_name, phone: o.customer_phone, email: o.customer_email },
    address: o.address,
    addressReference: o.address_reference,
    location:
      o.delivery_lat !== null && o.delivery_lng !== null
        ? {
            lat: o.delivery_lat,
            lng: o.delivery_lng,
            accuracyM: o.delivery_accuracy_m,
            source: o.location_source,
            distanceKm: o.distance_km,
          }
        : null,
    payment: o.payment_method as PayMethod,
    note: o.notes,
    subtotalCents: o.subtotal_cents,
    deliveryFeeCents: o.delivery_fee_cents,
    totalCents: o.total_cents,
    whatsappOpened: o.whatsapp_opened_at !== null,
    createdAt: o.created_at,
    branch: { id: o.branch.id, name: o.branch.name },
    items: o.items.map((i) => ({
      id: i.id,
      name: i.name_snapshot,
      quantity: i.quantity,
      unitCents: i.unit_price_cents,
      lineCents: i.line_total_cents,
      options: Array.isArray(i.options_snapshot)
        ? (i.options_snapshot as { group: string; name: string; deltaCents: number }[])
        : [],
      note: i.notes,
    })),
    events: o.events.map((e) => ({ status: e.status as OrderStatus, at: e.created_at })),
  };
}

export type OrderDetail = NonNullable<Awaited<ReturnType<typeof getOrderDetail>>>;

/** Sucursal de un pedido del negocio (para validar el acceso antes de cambiarlo). */
export async function orderBranch(businessId: string, orderId: string) {
  return db().orders.findFirst({
    where: { id: orderId, business_id: businessId },
    select: { branch_id: true, status: true },
  });
}

/**
 * Cambia el estado si la transición es válida y nadie lo cambió antes (dos
 * tablets que tocan "Aceptar" a la vez: gana la primera).
 */
export async function updateOrderStatus(
  businessId: string,
  orderId: string,
  to: OrderStatus,
  actor: { userId?: string; staffId?: string },
) {
  const current = await orderBranch(businessId, orderId);
  if (!current) throw new AppError("order_not_found", "Ese pedido ya no existe.");
  const from = current.status as OrderStatus;
  if (!canTransition(from, to))
    throw new AppError(
      "order_transition",
      `Este pedido ya está "${STATUS_LABELS[from]}": no se puede pasar a "${STATUS_LABELS[to]}".`,
    );

  return db().$transaction(async (tx) => {
    const changed = await tx.orders.updateMany({
      where: { id: orderId, business_id: businessId, status: from },
      data: { status: to },
    });
    if (changed.count === 0)
      throw new AppError(
        "order_changed",
        "Alguien más acaba de cambiar este pedido. Revísalo de nuevo.",
      );
    // Con la hora de la base (como el evento "new" de createOrder): el
    // @default(now()) de Prisma usa el reloj del servidor de la app.
    await tx.$executeRaw`
      INSERT INTO order_status_events (order_id, status, by_user_id, by_staff_id)
      VALUES (${orderId}::uuid, ${to}::"OrderStatus", ${actor.userId ?? null}::uuid, ${actor.staffId ?? null}::uuid)`;
    return { from, to };
  });
}
