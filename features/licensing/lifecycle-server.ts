import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { audit } from "@/lib/audit";
import { BRAND } from "@/lib/brand";
import { db } from "@/lib/db";
import { emailEnabled, sendEmail } from "@/lib/email";
import { parseLimits } from "./entitlements";
import {
  FREE_PLAN,
  idsOverLimit,
  nextTransition,
  reminderDue,
  reminderText,
  type FreeLimits,
  type LifecycleLicense,
} from "./lifecycle";

type Tx = Prisma.TransactionClient;

async function freeLimits(): Promise<FreeLimits> {
  const plan = await db().plans.findUnique({ where: { id: FREE_PLAN }, select: { limits: true } });
  const l = parseLimits(plan?.limits);
  return { branches: l.branches, products: l.products, menus: l.menus, qr: l.qr, staff: l.staff };
}

/**
 * Bajar a Gratis: se ocultan (hidden_by_license) las sucursales, productos,
 * menús, QR y staff que pasan los límites; se conservan los primeros por orden
 * (la sucursal principal, el menú predeterminado…). Nada se borra.
 */
export async function hideOverLimits(tx: Tx, businessId: string, limits: FreeLimits) {
  const ids = async <T extends { id: string }>(rows: Promise<T[]>) => (await rows).map((r) => r.id);
  const [branches, products, menus, qr, staff] = await Promise.all([
    ids(
      tx.branches.findMany({
        where: { business_id: businessId },
        orderBy: [{ sort: "asc" }, { created_at: "asc" }],
        select: { id: true },
      }),
    ),
    ids(
      tx.products.findMany({
        where: { business_id: businessId, deleted_at: null },
        orderBy: [{ sort: "asc" }, { created_at: "asc" }],
        select: { id: true },
      }),
    ),
    ids(
      tx.menus.findMany({
        where: { business_id: businessId },
        orderBy: [{ is_default: "desc" }, { created_at: "asc" }],
        select: { id: true },
      }),
    ),
    ids(
      tx.qr_codes.findMany({
        where: { business_id: businessId },
        orderBy: { created_at: "asc" },
        select: { id: true },
      }),
    ),
    ids(
      tx.staff_members.findMany({
        where: { business_id: businessId },
        orderBy: { created_at: "asc" },
        select: { id: true },
      }),
    ),
  ]);
  const hide = {
    branches: idsOverLimit(branches, limits.branches),
    products: idsOverLimit(products, limits.products),
    menus: idsOverLimit(menus, limits.menus),
    qr: idsOverLimit(qr, limits.qr),
    staff: idsOverLimit(staff, limits.staff),
  };
  await Promise.all([
    tx.branches.updateMany({
      where: { id: { in: hide.branches } },
      data: { hidden_by_license: true },
    }),
    tx.products.updateMany({
      where: { id: { in: hide.products } },
      data: { hidden_by_license: true },
    }),
    tx.menus.updateMany({ where: { id: { in: hide.menus } }, data: { hidden_by_license: true } }),
    tx.qr_codes.updateMany({ where: { id: { in: hide.qr } }, data: { hidden_by_license: true } }),
    tx.staff_members.updateMany({
      where: { id: { in: hide.staff } },
      data: { hidden_by_license: true },
    }),
  ]);
  return Object.fromEntries(Object.entries(hide).map(([k, v]) => [k, v.length]));
}

/** Al volver a un plan pagado: todo lo oculto por la licencia vuelve a verse. */
export async function restoreHidden(tx: Tx, businessId: string) {
  const where = { business_id: businessId, hidden_by_license: true };
  const data = { hidden_by_license: false };
  await Promise.all([
    tx.branches.updateMany({ where, data }),
    tx.products.updateMany({ where, data }),
    tx.menus.updateMany({ where, data }),
    tx.qr_codes.updateMany({ where, data }),
    tx.staff_members.updateMany({ where, data }),
  ]);
}

async function ownerEmails(businessId: string) {
  return db().$queryRaw<{ email: string }[]>`
    SELECT u.email FROM business_members m JOIN auth.users u ON u.id = m.user_id
    WHERE m.business_id = ${businessId}::uuid AND m.role = 'owner' AND u.email IS NOT NULL`;
}

/**
 * Cron diario: aplica transiciones (gracia, bajar a Gratis) y manda los
 * recordatorios de 7, 3 y 1 día. Cada cambio queda en license_events y en la
 * auditoría (actor "system"). Idempotente: correrlo dos veces no repite nada.
 */
export async function runLicenseLifecycle(
  now: Date = new Date(),
  /** Solo estos negocios (las pruebas: la base es compartida con producción). */
  onlyBusinessIds?: string[],
) {
  const licenses = await db().licenses.findMany({
    where: {
      plan_id: { not: FREE_PLAN },
      status: { in: ["trial", "active", "grace"] },
      ...(onlyBusinessIds ? { business_id: { in: onlyBusinessIds } } : {}),
    },
    select: {
      id: true,
      business_id: true,
      plan_id: true,
      status: true,
      ends_at: true,
      grace_days: true,
      plan: { select: { name: true } },
      business: { select: { name: true } },
      events: {
        where: { type: "reminder" },
        select: { data: true },
      },
    },
  });
  const limits = await freeLimits();
  const result = { grace: 0, downgraded: 0, reminders: 0 };

  for (const l of licenses) {
    const lic = l as LifecycleLicense & typeof l;
    const t = nextTransition(lic, now);
    if (t) {
      const hidden = await db().$transaction(async (tx) => {
        await tx.licenses.update({
          where: { id: l.id },
          data: t.kind === "grace" ? { status: "grace" } : { status: "active", plan_id: FREE_PLAN },
        });
        const counts =
          t.kind === "downgraded" ? await hideOverLimits(tx, l.business_id, limits) : null;
        await tx.license_events.create({
          data: {
            license_id: l.id,
            type: t.kind,
            data:
              t.kind === "downgraded"
                ? { from: t.from, hidden: counts }
                : { ends_at: l.ends_at.toISOString() },
          },
        });
        return counts;
      });
      await audit({
        actorId: null,
        actorKind: "system",
        businessId: l.business_id,
        action: t.kind === "grace" ? "license.grace" : "license.downgrade",
        entity: "licenses",
        entityId: l.id,
        diff: t.kind === "downgraded" ? { from: t.from, hidden } : { status: "grace" },
      });
      result[t.kind === "grace" ? "grace" : "downgraded"] += 1;
      continue;
    }

    // Recordatorios del periodo actual (por su ends_at).
    const period = l.ends_at.toISOString();
    const sent = l.events
      .map((e) => e.data as { days?: number; ends_at?: string } | null)
      .filter((d) => d?.ends_at === period && typeof d.days === "number")
      .map((d) => d!.days!);
    const days = reminderDue(lic, sent, now);
    if (days === null) continue;
    await db().license_events.create({
      data: { license_id: l.id, type: "reminder", data: { days, ends_at: period } },
    });
    result.reminders += 1;
    if (emailEnabled()) {
      const text = reminderText(days, l.plan.name);
      const link = new URL(`/panel/${l.business_id}/ajustes/licencia`, BRAND.url).toString();
      for (const { email } of await ownerEmails(l.business_id)) {
        await sendEmail({
          to: email,
          fromName: BRAND.name,
          subject: `${text} · ${l.business.name}`,
          text: `${text} Para seguir con todo, paga por transferencia y sube la boleta en Mi plan: ${link}`,
          html: `<p>${text} Para seguir con todo, paga por transferencia y sube la boleta en <a href="${link}">Mi plan</a>.</p>`,
        }).catch((error: unknown) => console.error("[licencias] Recordatorio no enviado:", error));
      }
    }
  }
  return result;
}
