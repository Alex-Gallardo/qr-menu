import "server-only";
import type { Entitlements } from "@/features/licensing/entitlements";
import { assertWithinLimit } from "@/features/licensing/server";
import { audit, diffFields } from "@/lib/audit";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import type { BranchFormOutput } from "./schemas";

const SLUG_TAKEN = "Ya tienes una sucursal con ese link. Prueba con otro.";

export async function listBranches(businessId: string, visibleIds: string[]) {
  return db().branches.findMany({
    where: { business_id: businessId, id: { in: visibleIds } },
    orderBy: [{ sort: "asc" }, { created_at: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      address: true,
      city: true,
      whatsapp_e164: true,
      is_active: true,
      hidden_by_license: true,
      accepts_dine_in: true,
      accepts_takeout: true,
      accepts_delivery: true,
      hours: { select: { weekday: true, opens: true, closes: true } },
    },
  });
}

export async function getBranch(businessId: string, branchId: string) {
  return db().branches.findFirst({
    where: { id: branchId, business_id: businessId },
    include: { hours: { select: { weekday: true, opens: true, closes: true } } },
  });
}

/** Pedidos fuera de horario requieren la función "preorders" del plan. */
function assertPreorders(data: BranchFormOutput["data"], entitlements: Entitlements) {
  if (data.preorder_mode !== "off" && !entitlements.features.includes("preorders")) {
    throw new AppError(
      "feature_unavailable",
      "Tu plan no incluye los pedidos fuera de horario. Mejora tu plan para usarlos.",
    );
  }
}

async function assertSlugFree(businessId: string, slug: string, exceptId?: string) {
  const other = await db().branches.findFirst({
    where: { business_id: businessId, slug, ...(exceptId ? { id: { not: exceptId } } : {}) },
    select: { id: true },
  });
  if (other) throw new AppError("slug_taken", SLUG_TAKEN);
}

function isUniqueViolation(error: unknown) {
  return (error as { code?: string }).code === "P2002";
}

/** Alta de sucursal: límite del plan → link libre → sucursal + horarios → auditoría. */
export async function createBranchForBusiness(
  input: BranchFormOutput,
  ctx: { actorId: string; entitlements: Entitlements },
) {
  const { businessId, data, hours } = input;
  await assertWithinLimit(businessId, "branches");
  assertPreorders(data, ctx.entitlements);
  await assertSlugFree(businessId, data.slug);

  const count = await db().branches.count({ where: { business_id: businessId } });
  try {
    const branch = await db().branches.create({
      data: { ...data, business_id: businessId, sort: count, hours: { create: hours } },
      select: { id: true },
    });
    await audit({
      actorId: ctx.actorId,
      actorKind: "user",
      businessId,
      action: "branch.create",
      entity: "branches",
      entityId: branch.id,
      diff: { name: data.name, slug: data.slug },
    });
    return branch;
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError("slug_taken", SLUG_TAKEN);
    throw error;
  }
}

/** Edición: link libre → datos y horarios en una transacción → auditoría de lo que cambió. */
export async function updateBranchForBusiness(
  input: BranchFormOutput & { branchId: string },
  ctx: { actorId: string; entitlements: Entitlements },
) {
  const { businessId, branchId, data, hours } = input;
  const before = await getBranch(businessId, branchId);
  if (!before) throw new AppError("not_found", "No encontramos esa sucursal.");
  // Se puede dejar como estaba aunque el plan ya no lo incluya; no se puede activar.
  if (data.preorder_mode !== before.preorder_mode) assertPreorders(data, ctx.entitlements);
  await assertSlugFree(businessId, data.slug, branchId);

  try {
    await db().$transaction([
      db().branches.update({ where: { id: branchId }, data }),
      db().branch_hours.deleteMany({ where: { branch_id: branchId } }),
      db().branch_hours.createMany({
        data: hours.map((h) => ({ ...h, branch_id: branchId })),
      }),
    ]);
  } catch (error) {
    if (isUniqueViolation(error)) throw new AppError("slug_taken", SLUG_TAKEN);
    throw error;
  }

  const { hours: beforeHours, ...beforeData } = before;
  const changes = diffFields(beforeData, data);
  const hoursChanged =
    JSON.stringify(beforeHours.sort((a, b) => a.weekday - b.weekday)) !== JSON.stringify(hours);
  if (Object.keys(changes).length > 0 || hoursChanged) {
    await audit({
      actorId: ctx.actorId,
      actorKind: "user",
      businessId,
      action: "branch.update",
      entity: "branches",
      entityId: branchId,
      diff: hoursChanged ? { ...changes, hours: "actualizado" } : changes,
    });
  }
}
