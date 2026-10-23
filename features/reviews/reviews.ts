/**
 * Reseñas (guía §7, "Reseñas y Google"), puro: el comensal califica su
 * pedido y a TODOS se les ofrece publicar en Google (no se filtra por
 * calificación: Google prohíbe pedir reseñas de forma selectiva).
 */

export const MAX_REVIEW_COMMENT = 500;
/** Sin "Entregado" en la bandeja, se puede calificar 2 h después de pedir. */
export const REVIEW_AFTER_MS = 2 * 60 * 60 * 1000;

const PLACE_ID = /^[A-Za-z0-9_-]{10,200}$/;

/** Formulario de reseña de Google de la ficha de esa sucursal; null sin Place ID válido. */
export function googleReviewUrl(placeId: string | null | undefined) {
  if (!placeId || !PLACE_ID.test(placeId)) return null;
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`;
}

/** ¿Ya se puede calificar? Al entregarse, o 2 h después de pedir si nadie lo marcó; nunca cancelado. */
export function canReview(status: string, createdAt: Date, now: Date = new Date()) {
  if (status === "cancelled") return false;
  if (status === "delivered") return true;
  return now.getTime() - createdAt.getTime() >= REVIEW_AFTER_MS;
}

/** El agradecimiento sí puede cambiar según la calificación (la invitación a Google, no). */
export function reviewThanks(rating: number) {
  if (rating >= 4) return "¡Gracias! Nos alegra mucho que te haya gustado.";
  if (rating === 3) return "¡Gracias! Vamos a seguir mejorando.";
  return "Gracias por contarnos. Lo vamos a revisar para mejorar.";
}

export const STAR_LABELS = ["Muy mal", "Mal", "Regular", "Bien", "¡Excelente!"] as const;

export type ReviewSummary = {
  count: number;
  /** Promedio con un decimal; null sin reseñas. */
  average: number | null;
  /** Cuántas de 5, 4, 3, 2 y 1 estrellas (en ese orden). */
  distribution: [number, number, number, number, number];
  /** % que tocó "Publicar en Google" (meta de la guía: ≥ 30 %). */
  googleRate: number | null;
};

/** Resumen de una sucursal o del negocio (incluye las ocultas: ocultar solo quita el comentario de la lista). */
export function summarizeReviews(
  reviews: { rating: number; clicked_google: boolean }[],
): ReviewSummary {
  const distribution: ReviewSummary["distribution"] = [0, 0, 0, 0, 0];
  let sum = 0;
  let google = 0;
  for (const r of reviews) {
    const rating = Math.min(5, Math.max(1, Math.round(r.rating)));
    distribution[5 - rating]! += 1;
    sum += rating;
    if (r.clicked_google) google += 1;
  }
  const count = reviews.length;
  return {
    count,
    average: count ? Math.round((sum / count) * 10) / 10 : null,
    distribution,
    googleRate: count ? Math.round((google / count) * 100) : null,
  };
}
