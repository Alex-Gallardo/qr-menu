"use server";

import { updateTag } from "next/cache";
import { actionError, type ActionResult } from "@/lib/action-result";
import { validationError } from "@/lib/zod";
import { audit, diffFields } from "@/lib/audit";
import { requireAccess } from "@/lib/auth/require-access";
import { tags } from "@/lib/cache-tags";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { businessSettingsSchema, slugCheckSchema } from "./schemas";
import { getBusinessSettings, slugProblem } from "./server";
import { SLUG_MESSAGES } from "./slug";

export type SlugCheck = { available: boolean; message: string };

/** Revisión en vivo del link mientras el dueño escribe. */
export async function checkSlugAvailability(input: unknown): Promise<SlugCheck> {
  const parsed = slugCheckSchema.safeParse(input);
  if (!parsed.success) return { available: false, message: SLUG_MESSAGES.format };
  try {
    await requireAccess(parsed.data.businessId, { roles: ["owner"] });
  } catch (error) {
    return { available: false, message: actionError(error).message };
  }
  const problem = await slugProblem(parsed.data.slug, parsed.data.businessId);
  return problem
    ? { available: false, message: SLUG_MESSAGES[problem] }
    : { available: true, message: "¡Disponible!" };
}

/** Ajustes → Negocio: nombre, link, descripción, redes, correo y mensaje de WhatsApp. */
export async function updateBusinessSettings(input: unknown): Promise<ActionResult> {
  const parsed = businessSettingsSchema.safeParse(input);
  if (!parsed.success) {
    return validationError(parsed.error);
  }
  const { businessId, ...data } = parsed.data;

  try {
    const { user } = await requireAccess(businessId, { roles: ["owner"], write: true });

    const problem = await slugProblem(data.slug, businessId);
    if (problem) throw new AppError(`slug_${problem}`, SLUG_MESSAGES[problem]);

    const before = await getBusinessSettings(businessId);
    if (!before) throw new AppError("not_found", "No encontramos tu negocio.");

    try {
      await db().businesses.update({ where: { id: businessId }, data });
    } catch (error) {
      // Otro negocio tomó el mismo link entre la revisión y el guardado.
      if ((error as { code?: string }).code === "P2002") {
        throw new AppError("slug_taken", SLUG_MESSAGES.taken);
      }
      throw error;
    }

    const changes = diffFields(before, data);
    if (Object.keys(changes).length > 0) {
      await audit({
        actorId: user.id,
        actorKind: "user",
        businessId,
        action: "business.update",
        entity: "businesses",
        entityId: businessId,
        diff: changes,
      });
    }

    updateTag(tags.business(businessId));
    if (before.slug !== data.slug) {
      updateTag(tags.slug(before.slug));
      updateTag(tags.slug(data.slug));
    }
    return { ok: true, message: "¡Listo! Guardamos los datos de tu negocio." };
  } catch (error) {
    return actionError(error);
  }
}
