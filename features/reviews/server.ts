import "server-only";
import { audit } from "@/lib/audit";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { canReview, googleReviewUrl } from "./reviews";
import type { ReviewInput } from "./schemas";

export type OrderReview = {
  /** Ya se puede calificar (entregado o pasaron 2 h). */
  open: boolean;
  /** La reseña que dejó, si ya calificó. */
  review: { rating: number; comment: string | null } | null;
  /** Formulario de Google de esa sucursal; null si la sucursal no tiene Place ID. */
  googleUrl: string | null;
};

/** Estado de la reseña para la página de confirmación del pedido. */
export async function getOrderReview(orderId: string): Promise<OrderReview | null> {
  const order = await db().orders.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      created_at: true,
      review: { select: { rating: true, comment: true } },
      branch: { select: { google_place_id: true } },
    },
  });
  if (!order) return null;
  return {
    open: canReview(order.status, order.created_at),
    review: order.review,
    googleUrl: googleReviewUrl(order.branch.google_place_id),
  };
}

/**
 * Reseña del comensal (anónimo: tener el link del pedido es la prueba, igual
 * que para ver la confirmación). Una por pedido; se guarda con su sucursal.
 */
export async function submitReview(input: ReviewInput) {
  const order = await db().orders.findUnique({
    where: { id: input.orderId },
    select: {
      id: true,
      status: true,
      created_at: true,
      business_id: true,
      branch_id: true,
      customer_name: true,
      branch: { select: { google_place_id: true } },
    },
  });
  if (!order) throw new AppError("not_found", "No encontramos tu pedido.");
  if (!canReview(order.status, order.created_at))
    throw new AppError(
      "too_early",
      order.status === "cancelled"
        ? "Este pedido se canceló: no se puede calificar."
        : "Podrás calificar cuando recibas tu pedido.",
    );

  try {
    await db().$transaction([
      db().reviews.create({
        data: {
          business_id: order.business_id,
          branch_id: order.branch_id,
          order_id: order.id,
          rating: input.rating,
          comment: input.comment ?? null,
          customer_name: order.customer_name,
        },
      }),
      db().analytics_events.create({
        data: {
          business_id: order.business_id,
          branch_id: order.branch_id,
          event: "review_submitted",
          session_id: order.id,
          meta: { rating: input.rating },
        },
      }),
    ]);
  } catch (error) {
    if ((error as { code?: string }).code === "P2002")
      throw new AppError("already_reviewed", "Ya calificaste este pedido. ¡Gracias!");
    throw error;
  }
  return { googleUrl: googleReviewUrl(order.branch.google_place_id) };
}

/** "Publicar también en Google": se cuenta el toque (meta: ≥ 30 % de las reseñas). */
export async function markGoogleClick(orderId: string) {
  await db().reviews.updateMany({ where: { order_id: orderId }, data: { clicked_google: true } });
}

export type PanelReview = {
  id: string;
  branchId: string;
  rating: number;
  comment: string | null;
  customerName: string | null;
  orderNumber: number | null;
  hidden: boolean;
  clickedGoogle: boolean;
  createdAt: Date;
};

/** Reseñas de unas sucursales (las visibles para quien mira el panel); las últimas 500. */
export async function listReviews(businessId: string, branchIds: string[]) {
  const rows = await db().reviews.findMany({
    where: { business_id: businessId, branch_id: { in: branchIds } },
    orderBy: { created_at: "desc" },
    take: 500,
    select: {
      id: true,
      branch_id: true,
      rating: true,
      comment: true,
      customer_name: true,
      clicked_google: true,
      is_hidden: true,
      created_at: true,
      order: { select: { number: true } },
    },
  });
  const reviews: PanelReview[] = rows.map((r) => ({
    id: r.id,
    branchId: r.branch_id,
    rating: r.rating,
    comment: r.comment,
    customerName: r.customer_name,
    orderNumber: r.order?.number ?? null,
    hidden: r.is_hidden,
    clickedGoogle: r.clicked_google,
    createdAt: r.created_at,
  }));
  return reviews;
}

/** Ocultar (o volver a mostrar) un comentario en el panel; sigue contando en el promedio. */
export async function setReviewHidden(
  businessId: string,
  reviewId: string,
  hidden: boolean,
  { actorId }: { actorId: string },
) {
  const review = await db().reviews.findFirst({
    where: { id: reviewId, business_id: businessId },
    select: { id: true, is_hidden: true },
  });
  if (!review) throw new AppError("not_found", "Esa reseña ya no existe.");
  if (review.is_hidden === hidden) return;
  await db().reviews.update({ where: { id: reviewId }, data: { is_hidden: hidden } });
  await audit({
    actorId,
    actorKind: "user",
    businessId,
    action: hidden ? "review.hide" : "review.show",
    entity: "reviews",
    entityId: reviewId,
  });
}

/** Sucursal de una reseña (para validar el acceso del encargado antes de ocultarla). */
export async function reviewBranch(businessId: string, reviewId: string) {
  const review = await db().reviews.findFirst({
    where: { id: reviewId, business_id: businessId },
    select: { branch_id: true },
  });
  return review?.branch_id ?? null;
}

/** Formulario de Google de cada sucursal (null si no tiene Place ID). */
export async function branchGoogleUrls(businessId: string, branchIds: string[]) {
  const rows = await db().branches.findMany({
    where: { business_id: businessId, id: { in: branchIds } },
    select: { id: true, google_place_id: true },
  });
  return Object.fromEntries(rows.map((b) => [b.id, googleReviewUrl(b.google_place_id)]));
}
