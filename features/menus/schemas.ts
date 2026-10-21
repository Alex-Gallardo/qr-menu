import { z } from "zod";
import { parseQ } from "@/lib/money";
import { MAX_ITEMS_PER_SECTION, MAX_SECTIONS, MENU_TEMPLATES } from "./structure";

const MAX_PRICE_CENTS = 10_000_00;

export const menuNameSchema = z
  .string()
  .trim()
  .min(2, "Escribe el nombre del menú.")
  .max(60, "Usa como máximo 60 caracteres.");

export const templateSchema = z.enum(MENU_TEMPLATES.map((t) => t.value) as [string, ...string[]]);

const itemField = z.object({
  key: z.string().max(60),
  productId: z.uuid(),
  price: z.string().max(20),
  isFeatured: z.boolean(),
});

const sectionField = z.object({
  key: z.string().max(60),
  name: z
    .string()
    .trim()
    .min(1, "Ponle nombre a la sección.")
    .max(60, "Usa como máximo 60 caracteres."),
  description: z.string().trim().max(160, "Usa como máximo 160 caracteres."),
  items: z
    .array(itemField)
    .max(MAX_ITEMS_PER_SECTION, `Usa como máximo ${MAX_ITEMS_PER_SECTION} productos por sección.`),
});

/** Menú completo tal como lo tiene el editor (se guarda solo, cada cambio). */
export const menuDocumentSchema = z
  .object({
    businessId: z.uuid(),
    menuId: z.uuid(),
    name: menuNameSchema,
    description: z.string().trim().max(160, "Usa como máximo 160 caracteres."),
    template: templateSchema,
    sections: z.array(sectionField).max(MAX_SECTIONS, `Usa como máximo ${MAX_SECTIONS} secciones.`),
  })
  .superRefine((v, ctx) => {
    v.sections.forEach((section, i) =>
      section.items.forEach((item, j) => {
        if (!item.price.trim()) return;
        const cents = parseQ(item.price);
        if (cents === null || cents > MAX_PRICE_CENTS) {
          ctx.addIssue({
            code: "custom",
            path: ["sections", i, "items", j, "price"],
            message: "Escribe un precio como 45 o déjalo vacío.",
          });
        }
      }),
    );
  })
  .transform((v) => ({
    businessId: v.businessId,
    menuId: v.menuId,
    data: {
      name: v.name,
      description: v.description || null,
      template: v.template as (typeof MENU_TEMPLATES)[number]["value"],
    },
    sections: v.sections.map((s, sort) => ({
      name: s.name,
      description: s.description || null,
      sort,
      // Un producto una sola vez por sección (la base lo exige).
      items: s.items
        .filter((item, j, all) => all.findIndex((x) => x.productId === item.productId) === j)
        .map((item, itemSort) => ({
          product_id: item.productId,
          price_override_cents: item.price.trim() ? parseQ(item.price) : null,
          is_featured: item.isFeatured,
          sort: itemSort,
        })),
    })),
  }));

export type MenuDocumentInput = z.input<typeof menuDocumentSchema>;
export type MenuDocumentOutput = z.output<typeof menuDocumentSchema>;
