import { z } from "zod";
import { isValidCoords } from "@/features/location/lib/coords";
import { MENU_TEMPLATES } from "@/features/menus/structure";
import { parseQ } from "@/lib/money";
import { toE164 } from "@/lib/phone";
import { MAX_FIRST_PRODUCTS } from "./onboarding";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Usa como máximo ${max} caracteres.`)
    .transform((v) => v || null);

/** Paso 1: negocio y primera sucursal (dirección con pin y WhatsApp). */
export const businessStepSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Escribe el nombre de tu negocio.")
      .max(80, "Usa como máximo 80 caracteres."),
    slug: z.string().trim().toLowerCase().min(1, "Escribe el link de tu negocio."),
    branchName: z
      .string()
      .trim()
      .min(2, "Escribe el nombre de la sucursal.")
      .max(60, "Usa como máximo 60 caracteres."),
    address: z
      .string()
      .trim()
      .min(5, "Escribe la dirección de la sucursal.")
      .max(160, "Usa como máximo 160 caracteres."),
    addressReference: optionalText(160),
    city: optionalText(60),
    location: z
      .object({ lat: z.number(), lng: z.number() })
      .nullable()
      .refine((v) => v === null || isValidCoords(v), "Esa ubicación no es válida."),
    whatsapp: z.string(),
  })
  .superRefine((v, ctx) => {
    if (!toE164(v.whatsapp))
      ctx.addIssue({
        code: "custom",
        path: ["whatsapp"],
        message: "Escribe un WhatsApp de 8 dígitos, por ejemplo 5555-1234.",
      });
  })
  .transform((v) => ({ ...v, whatsapp: toE164(v.whatsapp)! }));

export type BusinessStepInput = z.input<typeof businessStepSchema>;
export type BusinessStep = z.output<typeof businessStepSchema>;

/** Paso 2: plantilla del menú principal. */
export const templateStepSchema = z.object({
  businessId: z.uuid(),
  template: z.enum(MENU_TEMPLATES.map((t) => t.value)),
});

/** Paso 3: hasta 5 productos (nombre, precio y foto opcional). */
export const productsStepSchema = z.object({
  businessId: z.uuid(),
  products: z
    .array(
      z.object({
        name: z
          .string()
          .trim()
          .min(2, "Escribe el nombre del producto.")
          .max(80, "Usa como máximo 80 caracteres."),
        price: z.string().refine((v) => {
          const cents = parseQ(v);
          return cents !== null && cents > 0;
        }, "Escribe un precio como 45 o 45.50."),
        imageUrl: z.url().nullable(),
        imageBlurhash: z.string().max(100).nullable(),
      }),
    )
    .min(1, "Agrega al menos un producto.")
    .max(MAX_FIRST_PRODUCTS, `Aquí puedes agregar hasta ${MAX_FIRST_PRODUCTS}.`),
});

export type ProductsStep = z.output<typeof productsStepSchema>;

export const businessIdSchema = z.object({ businessId: z.uuid() });
