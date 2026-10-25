import { describe, expect, it } from "vitest";
import {
  canReview,
  googleReviewUrl,
  REVIEW_AFTER_MS,
  reviewThanks,
  summarizeReviews,
} from "@/features/reviews/reviews";
import { reviewSchema } from "@/features/reviews/schemas";

/** QRM-037: reseñas por sucursal y botón de Google. */

const ORDER = "6f1c2b9e-3a4d-4e5f-8a7b-1c2d3e4f5a6b";

describe("googleReviewUrl", () => {
  it("arma el formulario de reseña de Google con el Place ID", () => {
    expect(googleReviewUrl("ChIJN1t_tDeuEmsRUsoyG83frY4")).toBe(
      "https://search.google.com/local/writereview?placeid=ChIJN1t_tDeuEmsRUsoyG83frY4",
    );
  });
  it("sin Place ID o con uno inválido no hay botón", () => {
    expect(googleReviewUrl(null)).toBeNull();
    expect(googleReviewUrl("")).toBeNull();
    expect(googleReviewUrl("corto")).toBeNull();
    expect(googleReviewUrl("ChIJ<script>alert(1)</script>")).toBeNull();
  });
});

describe("canReview", () => {
  const created = new Date("2026-10-23T12:00:00Z");
  const later = (ms: number) => new Date(created.getTime() + ms);
  it("entregado: sí, de inmediato", () => {
    expect(canReview("delivered", created, created)).toBe(true);
  });
  it("cancelado: nunca", () => {
    expect(canReview("cancelled", created, later(10 * REVIEW_AFTER_MS))).toBe(false);
  });
  it("sin marcar entregado: a las 2 h de pedir", () => {
    expect(canReview("preparing", created, later(REVIEW_AFTER_MS - 1))).toBe(false);
    expect(canReview("new", created, later(REVIEW_AFTER_MS))).toBe(true);
  });
});

describe("reviewThanks", () => {
  it("el agradecimiento cambia según la calificación", () => {
    expect(reviewThanks(5)).toMatch(/alegra/);
    expect(reviewThanks(3)).toMatch(/mejorando/);
    expect(reviewThanks(1)).toMatch(/revisar/);
  });
});

describe("summarizeReviews", () => {
  it("sin reseñas: todo en cero", () => {
    expect(summarizeReviews([])).toEqual({
      count: 0,
      average: null,
      distribution: [0, 0, 0, 0, 0],
      googleRate: null,
    });
  });
  it("promedio con un decimal, distribución de 5 a 1 y % que pasó a Google", () => {
    const s = summarizeReviews([
      { rating: 5, clicked_google: true },
      { rating: 5, clicked_google: false },
      { rating: 4, clicked_google: true },
      { rating: 1, clicked_google: false },
    ]);
    expect(s.count).toBe(4);
    expect(s.average).toBe(3.8);
    expect(s.distribution).toEqual([2, 1, 0, 0, 1]);
    expect(s.googleRate).toBe(50);
  });
});

describe("reviewSchema", () => {
  it("de 1 a 5 estrellas, enteras", () => {
    expect(reviewSchema.safeParse({ orderId: ORDER, rating: 0 }).success).toBe(false);
    expect(reviewSchema.safeParse({ orderId: ORDER, rating: 6 }).success).toBe(false);
    expect(reviewSchema.safeParse({ orderId: ORDER, rating: 4.5 }).success).toBe(false);
    expect(reviewSchema.safeParse({ orderId: ORDER, rating: 5 }).success).toBe(true);
  });
  it("el comentario es opcional: vacío se guarda como null; máximo 500", () => {
    expect(reviewSchema.parse({ orderId: ORDER, rating: 4, comment: "   " }).comment).toBeNull();
    expect(reviewSchema.parse({ orderId: ORDER, rating: 4, comment: " Rico " }).comment).toBe(
      "Rico",
    );
    expect(
      reviewSchema.safeParse({ orderId: ORDER, rating: 4, comment: "a".repeat(501) }).success,
    ).toBe(false);
  });
});
