import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { LimitExceededError } from "@/lib/errors";
import { computeEntitlements, type Entitlements, type LicenseStatus } from "./entitlements";
import { checkLimit } from "./limits";
import type { LimitedResource } from "./plan-catalog";

const FREE_PLAN_ID = "gratis";

/** Permisos efectivos del negocio (plan + ajustes + estado). Una lectura por request. */
export const getEntitlements = cache(async (businessId: string): Promise<Entitlements> => {
  const [license, freePlan] = await Promise.all([
    db().licenses.findUnique({
      where: { business_id: businessId },
      select: {
        plan_id: true,
        status: true,
        ends_at: true,
        grace_days: true,
        limit_overrides: true,
        feature_overrides: true,
        plan: { select: { id: true, limits: true, features: true } },
      },
    }),
    db().plans.findUnique({
      where: { id: FREE_PLAN_ID },
      select: { id: true, limits: true, features: true },
    }),
  ]);
  if (!freePlan) throw new Error("Falta el plan 'gratis' (corre pnpm db:seed).");

  return computeEntitlements({
    license: license && { ...license, status: license.status as LicenseStatus },
    plan: license?.plan ?? null,
    freePlan,
  });
});

/** Uso actual de un recurso. Lo oculto por degradación no cuenta (no se usa). */
export async function getUsage(businessId: string, resource: LimitedResource): Promise<number> {
  const visible = { business_id: businessId, hidden_by_license: false };
  switch (resource) {
    case "branches":
      return db().branches.count({ where: visible });
    case "products":
      return db().products.count({ where: { ...visible, deleted_at: null } });
    case "menus":
      return db().menus.count({ where: visible });
    case "time_slots":
      return db().time_slots.count({ where: { business_id: businessId } });
    case "qr":
      return db().qr_codes.count({ where: visible });
    case "managers":
      return db().business_members.count({ where: { business_id: businessId, role: "manager" } });
    case "staff":
      return db().staff_members.count({ where: { ...visible, is_active: true } });
    case "storage_mb": {
      const { _sum } = await db().media.aggregate({
        where: { business_id: businessId },
        _sum: { bytes: true },
      });
      return Math.ceil((_sum.bytes ?? 0) / (1024 * 1024));
    }
  }
}

/**
 * Antes de crear una sucursal, producto, menú, QR o staff: lanza
 * LimitExceededError con un mensaje amable si el plan no lo permite.
 */
export async function assertWithinLimit(businessId: string, resource: LimitedResource, adding = 1) {
  const [entitlements, used] = await Promise.all([
    getEntitlements(businessId),
    getUsage(businessId, resource),
  ]);
  const result = checkLimit(entitlements.limits, resource, used, adding);
  if (!result.ok) throw new LimitExceededError(resource, result.limit, result.message);
  return result;
}
