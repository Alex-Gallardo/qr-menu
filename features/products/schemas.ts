import { z } from "zod";
import { parseQ } from "@/lib/money";
import { TAG_VALUES } from "./catalog";

const MAX_PRICE_CENTS = 10_000_00; // Q10,000

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Usa como máximo ${max} caracteres.`)
    .transform((v) => v || null);

const branchSetting = z.object({
  branchId: z.uuid(),
  is_available: z.boolean(),
  /** Vacío = usa el precio del catálogo. */
  price: z.string(),
});

/** Ficha del producto (valores como los escribe el usuario). */
export const productFormSchema = z
  .object({
    businessId: z.uuid(),
    productId: z.uuid().optional(),
    name: z
      .string()
      .trim()
      .min(2, "Escribe el nombre del producto.")
      .max(80, "Usa como máximo 80 caracteres."),
    description: optionalText(300),
    category_id: z.union([z.uuid(), z.literal("")]),
    price: z.string(),
    compare_at: z.string(),
    tags: z.array(z.enum(TAG_VALUES)).max(TAG_VALUES.length),
    prep_minutes: z.string(),
    image_url: z.url().nullable(),
    image_blurhash: z.string().max(100).nullable(),
    is_available: z.boolean(),
    branches: z.array(branchSetting).max(100),
  })
  .superRefine((v, ctx) => {
    const issue = (path: (string | number)[], message: string) =>
      ctx.addIssue({ code: "custom", path, message });

    const price = parseQ(v.price);
    if (!v.price.trim()) issue(["price"], "Escribe el precio.");
    else if (price === null) issue(["price"], "Escribe un precio como 45 o 45.50.");
    else if (price > MAX_PRICE_CENTS) issue(["price"], "Ese precio parece demasiado alto.");

    if (v.compare_at.trim()) {
      const compare = parseQ(v.compare_at);
      if (compare === null) issue(["compare_at"], "Escribe un precio como 55 o 55.50.");
      else if (price !== null && compare <= price)
        issue(["compare_at"], "El precio tachado debe ser mayor que el precio.");
    }

    const prep = v.prep_minutes.trim();
    if (prep && !(/^\d+$/.test(prep) && Number(prep) >= 1 && Number(prep) <= 240)) {
      issue(["prep_minutes"], "Escribe los minutos entre 1 y 240, o déjalo vacío.");
    }

    v.branches.forEach((b, i) => {
      if (!b.price.trim()) return;
      const own = parseQ(b.price);
      if (own === null)
        issue(["branches", i, "price"], "Escribe un precio como 45 o déjalo vacío.");
      else if (own > MAX_PRICE_CENTS)
        issue(["branches", i, "price"], "Ese precio parece demasiado alto.");
    });
  })
  .transform((v) => ({
    businessId: v.businessId,
    productId: v.productId,
    data: {
      name: v.name,
      description: v.description,
      category_id: v.category_id || null,
      price_cents: parseQ(v.price)!,
      compare_at_cents: v.compare_at.trim() ? parseQ(v.compare_at) : null,
      tags: [...new Set(v.tags)],
      prep_minutes: v.prep_minutes.trim() ? Number(v.prep_minutes) : null,
      image_url: v.image_url,
      image_blurhash: v.image_url ? v.image_blurhash : null,
      is_available: v.is_available,
    },
    branches: v.branches.map((b) => ({
      branchId: b.branchId,
      is_available: b.is_available,
      price_override_cents: b.price.trim() ? parseQ(b.price) : null,
    })),
  }));

export type ProductFormInput = z.input<typeof productFormSchema>;
export type ProductFormOutput = z.output<typeof productFormSchema>;
export type ProductData = ProductFormOutput["data"];

export const categoryNameSchema = z
  .string()
  .trim()
  .min(2, "Escribe el nombre de la categoría.")
  .max(40, "Usa como máximo 40 caracteres.");
