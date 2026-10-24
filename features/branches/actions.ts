"use server";

import { updateTag } from "next/cache";
import { actionError, type ActionResult } from "@/lib/action-result";
import { validationError } from "@/lib/zod";
import { requireAccess } from "@/lib/auth/require-access";
import { tags } from "@/lib/cache-tags";
import { branchFormSchema } from "./schemas";
import { createBranchForBusiness, updateBranchForBusiness } from "./server";

/** Agregar sucursal: solo el dueño y dentro del límite del plan. */
export async function createBranch(input: unknown): Promise<ActionResult<{ branchId: string }>> {
  const parsed = branchFormSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { user, entitlements } = await requireAccess(parsed.data.businessId, {
      roles: ["owner"],
      write: true,
    });
    const branch = await createBranchForBusiness(parsed.data, { actorId: user.id, entitlements });
    updateTag(tags.business(parsed.data.businessId));
    return { ok: true, message: "¡Listo! Tu sucursal está creada.", data: { branchId: branch.id } };
  } catch (error) {
    return actionError(error);
  }
}

/** Editar sucursal: el dueño, o el encargado si es una de sus sucursales. */
export async function updateBranch(input: unknown): Promise<ActionResult> {
  const parsed = branchFormSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { businessId, branchId } = parsed.data;
  if (!branchId) return { ok: false, message: "Falta la sucursal." };

  try {
    const { user, entitlements } = await requireAccess(businessId, { branchId, write: true });
    await updateBranchForBusiness({ ...parsed.data, branchId }, { actorId: user.id, entitlements });
    updateTag(tags.branch(branchId));
    updateTag(tags.business(businessId));
    return { ok: true, message: "¡Listo! Guardamos los cambios de la sucursal." };
  } catch (error) {
    return actionError(error);
  }
}
