import "server-only";
import { receiptViewUrl } from "@/features/billing/server";
import { computeEntitlements, type LicenseStatus } from "@/features/licensing/entitlements";
import { getUsage } from "@/features/licensing/server";
import type { LimitedResource } from "@/features/licensing/plan-catalog";
import { db } from "@/lib/db";
import { mrrCents } from "./admin";

const DAY = 24 * 60 * 60 * 1000;

/** Licencia → estado efectivo (lo que ve el negocio hoy). */
async function effectiveStatuses() {
  const [licenses, free] = await Promise.all([
    db().licenses.findMany({
      select: {
        business_id: true,
        plan_id: true,
        status: true,
        ends_at: true,
        grace_days: true,
        limit_overrides: true,
        feature_overrides: true,
        price_override_gtq: true,
        plan: { select: { id: true, limits: true, features: true, price_gtq: true } },
      },
    }),
    db().plans.findUnique({
      where: { id: "gratis" },
      select: { id: true, limits: true, features: true },
    }),
  ]);
  return licenses.map((l) => ({
    ...l,
    effective: computeEntitlements({
      license: { ...l, status: l.status as LicenseStatus },
      plan: l.plan,
      freePlan: free ?? { id: "gratis", limits: {}, features: [] },
    }),
  }));
}

/** Tablero (guía "Uso y métricas" → globales). */
export async function getDashboard(now: Date = new Date()) {
  const weekAgo = new Date(now.getTime() - 7 * DAY);
  const inWeek = new Date(now.getTime() + 7 * DAY);
  const [licenses, pendingPayments, signups, downgraded, ordersByDay, quiet] = await Promise.all([
    effectiveStatuses(),
    db().payments.count({ where: { status: "pending" } }),
    db().businesses.count({ where: { created_at: { gte: weekAgo } } }),
    db().license_events.findMany({
      where: { type: "downgraded", created_at: { gte: weekAgo } },
      select: {
        created_at: true,
        license: { select: { business: { select: { id: true, name: true } } } },
      },
      orderBy: { created_at: "desc" },
    }),
    db().$queryRaw<{ day: string; orders: number }[]>`
      SELECT to_char((created_at AT TIME ZONE 'America/Guatemala')::date, 'YYYY-MM-DD') AS day,
        count(*)::int AS orders
      FROM orders WHERE created_at >= ${weekAgo}
      GROUP BY 1 ORDER BY 1`,
    db().$queryRaw<{ id: string; name: string }[]>`
      SELECT b.id::text AS id, b.name FROM businesses b
      WHERE b.published AND NOT EXISTS (
        SELECT 1 FROM orders o WHERE o.business_id = b.id AND o.created_at >= ${weekAgo})
      ORDER BY b.name LIMIT 20`,
  ]);
  const byStatus: Record<string, number> = {};
  for (const l of licenses) byStatus[l.effective.status] = (byStatus[l.effective.status] ?? 0) + 1;
  const names = await db().businesses.findMany({
    where: { id: { in: licenses.map((l) => l.business_id) } },
    select: { id: true, name: true },
  });
  const nameOf = (id: string) => names.find((n) => n.id === id)?.name ?? id;
  return {
    total: licenses.length,
    byStatus,
    mrrCents: mrrCents(
      licenses.map((l) => ({
        status: l.effective.status,
        plan_id: l.plan_id,
        price_gtq: l.plan.price_gtq,
        price_override_gtq: l.price_override_gtq,
      })),
    ),
    expiring: licenses
      .filter(
        (l) =>
          (l.effective.status === "active" || l.effective.status === "trial") &&
          l.ends_at >= now &&
          l.ends_at <= inWeek,
      )
      .map((l) => ({
        id: l.business_id,
        name: nameOf(l.business_id),
        endsAt: l.ends_at,
        status: l.effective.status,
      })),
    inGrace: licenses
      .filter((l) => l.effective.status === "grace")
      .map((l) => ({
        id: l.business_id,
        name: nameOf(l.business_id),
        until: l.effective.graceEndsAt,
      })),
    downgraded: downgraded.map((d) => ({ ...d.license.business, at: d.created_at })),
    pendingPayments,
    signups,
    ordersByDay,
    quiet,
  };
}

/** Negocios con búsqueda por nombre, link o correo del dueño. */
export async function listBusinesses(q: string) {
  const term = q.trim();
  const rows = await db().$queryRaw<
    {
      id: string;
      name: string;
      slug: string;
      published: boolean;
      created_at: Date;
      plan_id: string | null;
      status: string | null;
      ends_at: Date | null;
      owner_email: string | null;
      orders_30d: number;
    }[]
  >`
    SELECT b.id::text AS id, b.name, b.slug, b.published, b.created_at,
      l.plan_id, l.status::text AS status, l.ends_at,
      (SELECT u.email FROM business_members m JOIN auth.users u ON u.id = m.user_id
        WHERE m.business_id = b.id AND m.role = 'owner' ORDER BY m.created_at LIMIT 1) AS owner_email,
      (SELECT count(*)::int FROM orders o WHERE o.business_id = b.id
        AND o.created_at >= now() - interval '30 days') AS orders_30d
    FROM businesses b LEFT JOIN licenses l ON l.business_id = b.id
    WHERE ${term} = '' OR b.name ILIKE ${`%${term}%`} OR b.slug ILIKE ${`%${term}%`}
      OR EXISTS (SELECT 1 FROM business_members m JOIN auth.users u ON u.id = m.user_id
        WHERE m.business_id = b.id AND u.email ILIKE ${`%${term}%`})
    ORDER BY b.created_at DESC LIMIT 100`;
  return rows;
}

const RESOURCES: LimitedResource[] = [
  "branches",
  "products",
  "menus",
  "time_slots",
  "qr",
  "managers",
  "staff",
  "storage_mb",
];

/** Ficha de un negocio: licencia, uso, equipo, pedidos, pagos e historial. */
export async function getBusinessDetail(businessId: string) {
  const business = await db().businesses.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      slug: true,
      published: true,
      created_at: true,
      branches: {
        orderBy: [{ sort: "asc" }, { created_at: "asc" }],
        select: { id: true, name: true, slug: true, hidden_by_license: true },
      },
      license: {
        select: {
          id: true,
          plan_id: true,
          status: true,
          ends_at: true,
          grace_days: true,
          price_override_gtq: true,
          limit_overrides: true,
          feature_overrides: true,
          notes: true,
          payments: {
            orderBy: { created_at: "desc" },
            take: 20,
            select: {
              id: true,
              amount_cents: true,
              method: true,
              bank: true,
              reference: true,
              status: true,
              rejection_reason: true,
              period_start: true,
              period_end: true,
              created_at: true,
            },
          },
          events: {
            orderBy: { created_at: "desc" },
            take: 30,
            select: { id: true, type: true, data: true, created_at: true, actor_id: true },
          },
        },
      },
    },
  });
  if (!business) return null;
  const [usage, members, orders30, scans30, hidden, openStaffSessions] = await Promise.all([
    Promise.all(RESOURCES.map((r) => getUsage(businessId, r))),
    db().$queryRaw<
      { role: string; name: string | null; email: string | null; last_sign_in_at: Date | null }[]
    >`
      SELECT m.role::text AS role, p.full_name AS name, u.email, u.last_sign_in_at
      FROM business_members m JOIN profiles p ON p.id = m.user_id
      LEFT JOIN auth.users u ON u.id = m.user_id
      WHERE m.business_id = ${businessId}::uuid ORDER BY m.role, m.created_at`,
    db().$queryRaw<{ branch: string; orders: number }[]>`
      SELECT b.name AS branch, count(o.id)::int AS orders
      FROM branches b LEFT JOIN orders o ON o.branch_id = b.id AND o.created_at >= now() - interval '30 days'
      WHERE b.business_id = ${businessId}::uuid GROUP BY b.id, b.name, b.sort ORDER BY b.sort`,
    db().analytics_events.count({
      where: {
        business_id: businessId,
        event: "qr_scan",
        created_at: { gte: new Date(Date.now() - 30 * DAY) },
      },
    }),
    Promise.all([
      db().branches.count({ where: { business_id: businessId, hidden_by_license: true } }),
      db().products.count({ where: { business_id: businessId, hidden_by_license: true } }),
      db().menus.count({ where: { business_id: businessId, hidden_by_license: true } }),
      db().qr_codes.count({ where: { business_id: businessId, hidden_by_license: true } }),
      db().staff_members.count({ where: { business_id: businessId, hidden_by_license: true } }),
    ]),
    db().staff_sessions.count({ where: { business_id: businessId, ended_at: null } }),
  ]);
  const plans = await db().plans.findMany({
    orderBy: { sort: "asc" },
    select: { id: true, name: true, price_gtq: true, limits: true, features: true },
  });
  const free = plans.find((p) => p.id === "gratis") ?? { id: "gratis", limits: {}, features: [] };
  const plan = plans.find((p) => p.id === business.license?.plan_id) ?? null;
  const entitlements = computeEntitlements({
    license: business.license
      ? { ...business.license, status: business.license.status as LicenseStatus }
      : null,
    plan,
    freePlan: free,
  });
  return {
    business,
    entitlements,
    plans,
    usage: Object.fromEntries(RESOURCES.map((r, i) => [r, usage[i]!])) as Record<
      LimitedResource,
      number
    >,
    members,
    orders30,
    scans30,
    hidden: {
      branches: hidden[0],
      products: hidden[1],
      menus: hidden[2],
      qr: hidden[3],
      staff: hidden[4],
    },
    openStaffSessions,
  };
}

/** Pagos por estado, con el link firmado de la boleta (10 min). */
export async function listPayments(status: "pending" | "verified" | "rejected") {
  const rows = await db().payments.findMany({
    where: { status },
    orderBy: { created_at: status === "pending" ? "asc" : "desc" },
    take: 100,
    select: {
      id: true,
      amount_cents: true,
      method: true,
      bank: true,
      reference: true,
      receipt_url: true,
      status: true,
      rejection_reason: true,
      period_start: true,
      period_end: true,
      created_at: true,
      license: {
        select: {
          plan_id: true,
          price_override_gtq: true,
          business: { select: { id: true, name: true } },
          events: {
            where: { type: "payment_submitted" },
            select: { data: true },
          },
        },
      },
    },
  });
  return Promise.all(
    rows.map(async (r) => {
      const submitted = r.license.events
        .map((e) => e.data as { payment_id?: string; plan?: string; period?: string } | null)
        .find((d) => d?.payment_id === r.id);
      return {
        ...r,
        plan: submitted?.plan ?? r.license.plan_id,
        period: submitted?.period ?? null,
        receiptLink: r.receipt_url ? await receiptViewUrl(r.receipt_url) : null,
      };
    }),
  );
}

/** Auditoría con filtros (negocio y prefijo de acción), de 50 en 50. */
export async function listAudit(filters: { businessId?: string; action?: string; page: number }) {
  const where = {
    ...(filters.businessId ? { business_id: filters.businessId } : {}),
    ...(filters.action ? { action: { startsWith: filters.action } } : {}),
  };
  const [rows, total] = await Promise.all([
    db().audit_logs.findMany({
      where,
      orderBy: { created_at: "desc" },
      skip: filters.page * 50,
      take: 50,
      select: {
        id: true,
        actor_id: true,
        actor_kind: true,
        business_id: true,
        action: true,
        entity: true,
        entity_id: true,
        diff: true,
        created_at: true,
      },
    }),
    db().audit_logs.count({ where }),
  ]);
  const actorIds = [...new Set(rows.map((r) => r.actor_id).filter((x): x is string => Boolean(x)))];
  const businessIds = [
    ...new Set(rows.map((r) => r.business_id).filter((x): x is string => Boolean(x))),
  ];
  const [actors, businesses] = await Promise.all([
    db().profiles.findMany({
      where: { id: { in: actorIds } },
      select: { id: true, full_name: true },
    }),
    db().businesses.findMany({
      where: { id: { in: businessIds } },
      select: { id: true, name: true },
    }),
  ]);
  return {
    total,
    rows: rows.map((r) => ({
      ...r,
      id: String(r.id),
      actor:
        actors.find((a) => a.id === r.actor_id)?.full_name ??
        (r.actor_kind === "system" ? "Sistema" : null),
      business: businesses.find((b) => b.id === r.business_id)?.name ?? null,
    })),
  };
}
