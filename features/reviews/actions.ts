"use server";

import { headers } from "next/headers";
import { actionError, type ActionResult } from "@/lib/action-result";
import { requireAccess } from "@/lib/auth/require-access";
import { hashIp, hitRateLimit, retryLabel } from "@/lib/rate-limit";
import { reviewSchema, reviewVisibilitySchema } from "./schemas";
import { markGoogleClick, reviewBranch, setReviewHidden, submitReview } from "./server";

function firstIssue(error: { issues: { message: string }[] }) {
  return { ok: false as const, message: error.issues[0]?.message ?? "Revisa los datos." };
}

async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

/** Calificar el pedido. Público (el link del pedido es la prueba); 10 por IP cada hora. */
export async function submitReviewAction(
  input: unknown,
): Promise<ActionResult<{ googleUrl: string | null }>> {
  const parsed = reviewSchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  try {
    const ip = await clientIp();
    if (ip) {
      const hit = await hitRateLimit(`review:ip:${hashIp(ip)}`, { limit: 10, windowSec: 3600 });
      if (!hit.ok)
        return {
          ok: false,
          message: `Enviaste muchas reseñas seguidas. Inténtalo ${retryLabel(hit.retryAfterSec)}.`,
        };
    }
    const result = await submitReview(parsed.data);
    return { ok: true, data: result };
  } catch (error) {
    return actionError(error);
  }
}

/** Tocó "Publicar también en Google" (solo cuenta para la meta del panel). */
export async function markGoogleClickAction(orderId: unknown): Promise<void> {
  if (typeof orderId === "string" && /^[0-9a-f-]{36}$/i.test(orderId))
    await markGoogleClick(orderId);
}

/** Ocultar o mostrar un comentario: el dueño, o el encargado de esa sucursal. */
export async function setReviewHiddenAction(input: unknown): Promise<ActionResult> {
  const parsed = reviewVisibilitySchema.safeParse(input);
  if (!parsed.success) return firstIssue(parsed.error);
  const { businessId, reviewId, hidden } = parsed.data;
  try {
    const branchId = await reviewBranch(businessId, reviewId);
    if (!branchId) return { ok: false, message: "Esa reseña ya no existe." };
    const { user } = await requireAccess(businessId, {
      roles: ["owner", "manager"],
      branchId,
      write: true,
    });
    await setReviewHidden(businessId, reviewId, hidden, { actorId: user.id });
    return {
      ok: true,
      message: hidden ? "Ocultamos el comentario." : "El comentario se ve otra vez.",
    };
  } catch (error) {
    return actionError(error);
  }
}
