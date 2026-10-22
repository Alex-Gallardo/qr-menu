import "server-only";
import { distanceKm } from "@/features/location/lib/haversine";
import { getEntitlements } from "@/features/licensing/server";
import { hasFeature } from "@/features/licensing/entitlements";
import { queryBranchMenu } from "@/features/public-menu/data";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { toE164 } from "@/lib/phone";
import { hashIp, hitRateLimit, retryLabel } from "@/lib/rate-limit";
import {
  CHECKOUT_FIELD_ORDER,
  checkoutProblems,
  orderTotals,
  type CheckoutBranch,
} from "./checkout";
import { itemProblemsMessage, menuAt, priceOrderItems } from "./pricing";
import { orderTiming, validateScheduledFor, type TimingRules } from "./preorder";
import type { CreateOrderInput } from "./schemas";

/** Límites contra pedidos falsos (guía): por dispositivo y por IP. */
export const ORDER_LIMITS = {
  session: { limit: 5, windowSec: 10 * 60 },
  ip: { limit: 30, windowSec: 60 * 60 },
};

const coordsOf = (b: { lat: number | null; lng: number | null }) =>
  b.lat !== null && b.lng !== null ? { lat: b.lat, lng: b.lng } : null;

/**
 * Crea un pedido. Todo se valida aquí con los datos de este momento, sin
 * confiar en el celular: sucursal y licencia, horario (¿para cuándo?),
 * disponibilidad y precios (producto → menú → sucursal), datos y cobertura a
 * domicilio. El número es el consecutivo de la sucursal, tomado con un UPDATE
 * atómico dentro de la transacción (nunca MAX+1): 50 pedidos simultáneos no
 * repiten número.
 */
export async function createOrder(
  input: CreateOrderInput,
  ctx: { now?: Date; ip?: string | null } = {},
) {
  const now = ctx.now ?? new Date();
  const branch = await db().branches.findUnique({
    where: { id: input.branchId },
    select: {
      id: true,
      business_id: true,
      name: true,
      lat: true,
      lng: true,
      is_active: true,
      hidden_by_license: true,
      accepts_dine_in: true,
      accepts_takeout: true,
      accepts_delivery: true,
      accepts_transfer: true,
      delivery_fee_cents: true,
      delivery_radius_km: true,
      min_order_cents: true,
      delivery_requires_location: true,
      preorder_mode: true,
      preorder_min_lead_min: true,
      preorder_max_days: true,
      hours: { select: { weekday: true, opens: true, closes: true } },
    },
  });
  if (!branch || branch.hidden_by_license)
    throw new AppError("branch_unavailable", "Esta sucursal ya no está disponible.");

  const businessId = branch.business_id;
  const [entitlements, payload, bankAccounts] = await Promise.all([
    getEntitlements(businessId),
    queryBranchMenu(businessId, branch.id),
    db().bank_accounts.count({
      where: {
        business_id: businessId,
        is_active: true,
        OR: [{ branch_id: null }, { branch_id: branch.id }],
      },
    }),
  ]);
  if (!entitlements.menuOnline)
    throw new AppError("menu_offline", "Este menú no está disponible temporalmente.");
  if (!branch.is_active)
    throw new AppError("branch_paused", "Esta sucursal no recibe pedidos por ahora.");

  // ¿Para cuándo? (horario, fechas especiales "Cerrado", modo y plan)
  const rules: TimingRules = {
    hours: branch.hours,
    closedDates: payload.resolver.overrides
      .filter(
        (o) =>
          o.menu_id === null &&
          o.time_slot_id === null &&
          (o.branch_id === null || o.branch_id === branch.id),
      )
      .map((o) => o.date),
    mode: branch.preorder_mode,
    minLeadMin: branch.preorder_min_lead_min,
    maxDays: branch.preorder_max_days,
    preordersEnabled: hasFeature(entitlements, "preorders"),
  };
  const scheduledFor = input.scheduledFor ? new Date(input.scheduledFor) : null;
  const timingProblem = validateScheduledFor(rules, scheduledFor, now);
  if (timingProblem) throw new AppError("order_time", timingProblem);

  // Precios y disponibilidad con el menú que toca a la hora del pedido.
  const menuId = menuAt(payload, branch.id, scheduledFor ?? now);
  const priced = priceOrderItems(input.items, payload, menuId);
  if (priced.problems.length > 0)
    throw new AppError("order_items", itemProblemsMessage(priced.problems));

  const checkoutBranch: CheckoutBranch = {
    acceptsDineIn: branch.accepts_dine_in,
    acceptsTakeout: branch.accepts_takeout,
    acceptsDelivery: branch.accepts_delivery,
    acceptsTransfer: branch.accepts_transfer,
    deliveryFeeCents: branch.delivery_fee_cents,
    minOrderCents: branch.min_order_cents,
    hasBankAccounts: bankAccounts > 0,
    requiresLocation: branch.delivery_requires_location,
    location: coordsOf(branch),
    radiusKm: branch.delivery_radius_km,
  };
  const timing = orderTiming(rules, now);
  const problems = checkoutProblems(
    { ...input, scheduledFor: input.scheduledFor },
    {
      branch: checkoutBranch,
      subtotalCents: priced.subtotalCents,
      asap: timing.asap,
      validTimes: timing.days.flatMap((d) => d.times.map((t) => t.at)),
    },
  );
  const firstProblem = CHECKOUT_FIELD_ORDER.find((f) => problems[f]);
  if (firstProblem) throw new AppError("order_invalid", problems[firstProblem]!);

  const delivery = input.orderType === "delivery";
  const coords = delivery ? (input.location?.coords ?? null) : null;
  const origin = coordsOf(branch);
  const totals = orderTotals(priced.subtotalCents, input.orderType, checkoutBranch);

  // Al final, para no gastar intentos en pedidos con datos por corregir.
  const session = await hitRateLimit(
    `order:session:${input.clientSessionId}`,
    ORDER_LIMITS.session,
  );
  if (!session.ok)
    throw new AppError(
      "rate_limited",
      `Ya enviaste varios pedidos seguidos. Intenta de nuevo ${retryLabel(session.retryAfterSec)}.`,
    );
  if (ctx.ip) {
    const ip = await hitRateLimit(`order:ip:${hashIp(ctx.ip)}`, ORDER_LIMITS.ip);
    if (!ip.ok)
      throw new AppError(
        "rate_limited",
        `Recibimos muchos pedidos desde esta conexión. Intenta de nuevo ${retryLabel(ip.retryAfterSec)}.`,
      );
  }

  // Una sola sentencia (atómica): tomar el número y guardar pedido, líneas y
  // evento. El candado de la fila de la sucursal dura solo esta sentencia, así
  // que muchos pedidos a la vez hacen fila rápido y nunca repiten número.
  const items = priced.lines.map((l) => ({
    product_id: l.productId,
    name_snapshot: l.name,
    unit_price_cents: l.unitCents,
    quantity: l.quantity,
    options_snapshot: l.options,
    notes: l.note,
    line_total_cents: l.lineCents,
  }));
  const rows = await db().$queryRaw<
    { id: string; number: number; total_cents: number; scheduled_for: Date | null }[]
  >`
    WITH n AS (
      UPDATE branches SET next_order_number = next_order_number + 1
      WHERE id = ${branch.id}::uuid
      RETURNING next_order_number - 1 AS number
    ), o AS (
      INSERT INTO orders (
        business_id, branch_id, number, menu_id, customer_name, customer_phone, customer_email,
        order_type, table_label, scheduled_for, address, address_reference,
        delivery_lat, delivery_lng, delivery_accuracy_m, location_source, distance_km,
        payment_method, notes, subtotal_cents, delivery_fee_cents, total_cents, client_session_id
      )
      SELECT
        ${businessId}::uuid, ${branch.id}::uuid, n.number, ${menuId}::uuid,
        ${input.name.trim()}, ${toE164(input.phone)}, ${input.email.trim().toLowerCase() || null},
        ${input.orderType}::"OrderType",
        ${input.orderType === "dine_in" ? input.table.trim() || null : null},
        ${scheduledFor}::timestamptz,
        ${delivery ? input.address.trim() : null}, ${delivery ? input.addressReference.trim() : null},
        ${coords?.lat ?? null}::float8, ${coords?.lng ?? null}::float8,
        ${delivery ? (input.location?.accuracyM ?? null) : null}::float8,
        ${delivery ? (input.location?.source ?? null) : null},
        ${coords && origin ? distanceKm(origin, coords) : null}::float8,
        ${input.payment}::"PayMethod", ${input.note.trim() || null},
        ${totals.subtotalCents}, ${totals.deliveryFeeCents}, ${totals.totalCents},
        ${input.clientSessionId}
      FROM n
      RETURNING id, number, total_cents, scheduled_for
    ), i AS (
      INSERT INTO order_items (
        order_id, product_id, name_snapshot, unit_price_cents, quantity,
        options_snapshot, notes, line_total_cents
      )
      SELECT o.id, x.product_id, x.name_snapshot, x.unit_price_cents, x.quantity,
        x.options_snapshot, x.notes, x.line_total_cents
      FROM o, jsonb_to_recordset(${JSON.stringify(items)}::jsonb) AS x(
        product_id uuid, name_snapshot text, unit_price_cents int, quantity int,
        options_snapshot jsonb, notes text, line_total_cents int
      )
    ), e AS (
      INSERT INTO order_status_events (order_id, status)
      SELECT o.id, 'new'::"OrderStatus" FROM o
    )
    SELECT id, number, total_cents, scheduled_for FROM o`;
  const created = rows[0];
  if (!created) throw new AppError("branch_unavailable", "Esta sucursal ya no está disponible.");
  return { ...created, number: Number(created.number) };
}
