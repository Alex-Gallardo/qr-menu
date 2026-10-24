"use server";

import { actionError, type ActionResult } from "@/lib/action-result";
import { validationError } from "@/lib/zod";
import { requireAccess } from "@/lib/auth/require-access";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { createQrSchema, qrIdSchema, restoreQrSchema } from "./schemas";
import { createQrCodes, deleteQrCode, restoreQrCode } from "./server";

const ROLES = ["owner", "manager"] as const;

/** QR y compartir → crear QR de la sucursal, de mesas o de una campaña. */
export async function createQrAction(input: unknown): Promise<ActionResult> {
  const parsed = createQrSchema.safeParse(input);
  if (!parsed.success) {
    return validationError(parsed.error);
  }
  try {
    const { user } = await requireAccess(parsed.data.businessId, {
      roles: [...ROLES],
      branchId: parsed.data.branchId,
      write: true,
    });
    const { created, skipped } = await createQrCodes(parsed.data, { actorId: user.id });
    if (created === 0) return { ok: true, message: "Esas mesas ya tenían su QR." };
    const extra = skipped > 0 ? ` (${skipped} ya existían)` : "";
    return {
      ok: true,
      message: created === 1 ? "¡Listo! Creamos tu QR." : `¡Listo! Creamos ${created} QR${extra}.`,
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function deleteQrAction(
  input: unknown,
): Promise<ActionResult<{ restore: Awaited<ReturnType<typeof deleteQrCode>> }>> {
  const parsed = qrIdSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "No pudimos borrar el QR." };
  const { businessId, qrId } = parsed.data;
  try {
    const row = await db().qr_codes.findFirst({
      where: { id: qrId, business_id: businessId },
      select: { branch_id: true },
    });
    if (!row) throw new AppError("not_found", "Ese QR ya no existe.");
    const { user } = await requireAccess(businessId, {
      roles: [...ROLES],
      branchId: row.branch_id,
      write: true,
    });
    return {
      ok: true,
      data: { restore: await deleteQrCode(businessId, qrId, { actorId: user.id }) },
    };
  } catch (error) {
    return actionError(error);
  }
}

export async function restoreQrAction(input: unknown): Promise<ActionResult> {
  const parsed = restoreQrSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "No pudimos deshacer." };
  const { businessId, qr } = parsed.data;
  try {
    await requireAccess(businessId, { roles: [...ROLES], branchId: qr.branch_id, write: true });
    await restoreQrCode(businessId, qr);
    return { ok: true, message: "Recuperamos el QR." };
  } catch (error) {
    return actionError(error);
  }
}
