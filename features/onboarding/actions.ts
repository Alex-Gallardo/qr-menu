"use server";

import { updateTag } from "next/cache";
import { validationError, z } from "@/lib/zod";
import { slugProblem } from "@/features/businesses/server";
import { SLUG_MESSAGES } from "@/features/businesses/slug";
import { hasFeature } from "@/features/licensing/entitlements";
import { actionError, type ActionResult } from "@/lib/action-result";
import { requireAccess } from "@/lib/auth/require-access";
import { getAuthUser } from "@/lib/auth/session";
import { tags } from "@/lib/cache-tags";
import { AccessError, AppError } from "@/lib/errors";
import { hitRateLimit, retryLabel } from "@/lib/rate-limit";
import {
  businessIdSchema,
  businessStepSchema,
  productsStepSchema,
  templateStepSchema,
} from "./schemas";
import {
  addFirstProducts,
  createBusinessFromOnboarding,
  getOnboarding,
  publishBusiness,
  setDefaultTemplate,
} from "./server";

async function requireSignedIn() {
  const user = await getAuthUser();
  if (!user || user.isAnonymous)
    throw new AccessError("unauthenticated", "Tu sesión terminó. Vuelve a entrar.");
  return user;
}

/** ¿El link está libre? (mientras escribe el nombre del negocio). */
export async function checkOnboardingSlug(
  input: unknown,
): Promise<{ available: boolean; message: string }> {
  const parsed = z.object({ slug: z.string().trim().toLowerCase().max(100) }).safeParse(input);
  if (!parsed.success) return { available: false, message: SLUG_MESSAGES.format };
  try {
    const user = await requireSignedIn();
    const own = await getOnboarding(user.id);
    const problem = await slugProblem(parsed.data.slug, own?.id ?? "");
    return problem
      ? { available: false, message: SLUG_MESSAGES[problem] }
      : { available: true, message: "¡Disponible!" };
  } catch {
    return { available: false, message: "No pudimos revisar el link. Inténtalo otra vez." };
  }
}

/** Paso 1: crea el negocio (o lo corrige si volvió atrás). */
export async function saveBusinessStep(
  input: unknown,
): Promise<ActionResult<{ businessId: string }>> {
  const parsed = businessStepSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const user = await requireSignedIn();
    const hit = await hitRateLimit(`onboarding:${user.id}`, { limit: 20, windowSec: 3600 });
    if (!hit.ok)
      throw new AppError(
        "rate_limited",
        `Hiciste muchos cambios seguidos. Inténtalo ${retryLabel(hit.retryAfterSec)}.`,
      );
    const { businessId } = await createBusinessFromOnboarding(user.id, parsed.data);
    updateTag(tags.business(businessId));
    return { ok: true, data: { businessId } };
  } catch (error) {
    return actionError(error);
  }
}

/** Paso 2: plantilla del menú principal. */
export async function saveTemplateStep(input: unknown): Promise<ActionResult> {
  const parsed = templateStepSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  const { businessId, template } = parsed.data;
  try {
    const { entitlements } = await requireAccess(businessId, { roles: ["owner"], write: true });
    await setDefaultTemplate(businessId, template, {
      allTemplates: hasFeature(entitlements, "all_templates"),
    });
    updateTag(tags.business(businessId));
    return { ok: true };
  } catch (error) {
    return actionError(error);
  }
}

/** Paso 3: los primeros productos, ya puestos en el menú principal. */
export async function saveProductsStep(input: unknown): Promise<ActionResult> {
  const parsed = productsStepSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { user } = await requireAccess(parsed.data.businessId, {
      roles: ["owner"],
      write: true,
    });
    const { created } = await addFirstProducts(parsed.data, { actorId: user.id });
    updateTag(tags.business(parsed.data.businessId));
    return {
      ok: true,
      message: `¡Listo! Agregamos ${created} ${created === 1 ? "producto" : "productos"}.`,
    };
  } catch (error) {
    return actionError(error);
  }
}

/** Paso 4: publicar (y el QR de la sucursal). */
export async function publishStep(input: unknown): Promise<ActionResult> {
  const parsed = businessIdSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { user } = await requireAccess(parsed.data.businessId, {
      roles: ["owner"],
      write: true,
    });
    await publishBusiness(parsed.data.businessId, { actorId: user.id });
    updateTag(tags.business(parsed.data.businessId));
    return { ok: true, message: "¡Tu menú está publicado!" };
  } catch (error) {
    return actionError(error);
  }
}
