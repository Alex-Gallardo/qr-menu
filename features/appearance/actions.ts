"use server";

import { updateTag } from "next/cache";
import { actionError, type ActionResult } from "@/lib/action-result";
import { validationError } from "@/lib/zod";
import { requireAccess } from "@/lib/auth/require-access";
import { tags } from "@/lib/cache-tags";
import type { AppearanceDoc } from "./appearance";
import { appearanceSchema } from "./schemas";
import { updateAppearance } from "./server";

/**
 * Apariencia → guardado automático de colores, fondo, fuentes, bordes,
 * bienvenida y loader. Solo el dueño; lo que su plan no incluye se rechaza.
 */
export async function saveAppearance(input: unknown): Promise<ActionResult> {
  const parsed = appearanceSchema.safeParse(input);
  if (!parsed.success) {
    return validationError(parsed.error);
  }
  const { businessId, ...doc } = parsed.data;
  try {
    const { user } = await requireAccess(businessId, { roles: ["owner"], write: true });
    await updateAppearance(businessId, doc as AppearanceDoc, { actorId: user.id });
    updateTag(tags.business(businessId));
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}
