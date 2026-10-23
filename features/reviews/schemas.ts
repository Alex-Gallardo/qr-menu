import { z } from "zod";
import { MAX_REVIEW_COMMENT } from "./reviews";

export const reviewSchema = z.object({
  orderId: z.uuid(),
  rating: z.number().int().min(1, "Elige de 1 a 5 estrellas.").max(5, "Elige de 1 a 5 estrellas."),
  comment: z
    .string()
    .trim()
    .max(MAX_REVIEW_COMMENT, `Usa como máximo ${MAX_REVIEW_COMMENT} caracteres.`)
    .transform((v) => v || null)
    .optional()
    .nullable(),
});

export type ReviewInput = z.infer<typeof reviewSchema>;

export const reviewVisibilitySchema = z.object({
  businessId: z.uuid(),
  reviewId: z.uuid(),
  hidden: z.boolean(),
});
