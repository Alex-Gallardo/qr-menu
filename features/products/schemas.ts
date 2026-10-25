import { z } from "@/lib/zod";
import { parseQ } from "@/lib/money";
import { TAG_VALUES } from "./catalog";
import { groupRuleProblem, MAX_DELTA_CENTS, MAX_GROUPS, MAX_OPTIONS, parseDelta } from "./options";

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

const optionField = z.object({
  /** Sin id = opción nueva. Se conserva al editar para no romper carritos abiertos. */
  optionId: z.uuid().optional(),
  name: z
    .string()
    .trim()
    .min(1, "Escribe el nombre de la opción.")
    .max(60, "Usa como máximo 60 caracteres."),
  /** Lo que suma (o resta) al precio: "5", "-2.50"; vacío = sin costo. */
  price: z.string(),
  is_available: z.boolean(),
});

const groupField = z.object({
  groupId: z.uuid().optional(),
  name: z
    .string()
    .trim()
    .min(2, "Escribe el nombre del grupo, por ejemplo Tamaño.")
    .max(40, "Usa como máximo 40 caracteres."),
  required: z.boolean(),
  /** Solo cuenta si es obligatorio. */
  min: z.string(),
  max: z.string(),
  options: z
    .array(optionField)
    .max(MAX_OPTIONS, `Usa como máximo ${MAX_OPTIONS} opciones por grupo.`),
});

const whole = (text: string) => (/^\d{1,2}$/.test(text.trim()) ? Number(text) : NaN);

/** Regla del grupo como la guarda la base: opcional = mínimo 0. */
const toRule = (g: { required: boolean; min: string; max: string }) => ({
  min_select: g.required ? whole(g.min) : 0,
  max_select: whole(g.max),
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
    groups: z
      .array(groupField)
      .max(MAX_GROUPS, `Usa como máximo ${MAX_GROUPS} grupos de opciones.`)
      .default([]),
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

    const groupNames = new Set<string>();
    v.groups.forEach((g, i) => {
      const key = g.name.trim().toLowerCase();
      if (key && groupNames.has(key))
        issue(["groups", i, "name"], "Ya tienes un grupo con ese nombre.");
      groupNames.add(key);

      const rule = toRule(g);
      if (g.required && !(rule.min_select >= 1))
        issue(["groups", i, "min"], "Escribe cuántas debe elegir como mínimo (1 o más).");
      else if (!(rule.max_select >= 1))
        issue(["groups", i, "max"], "Escribe cuántas puede elegir (1 o más).");
      else {
        const problem = groupRuleProblem(rule, g.options.length);
        if (problem) issue(["groups", i, g.options.length === 0 ? "options" : "max"], problem);
      }

      const optionNames = new Set<string>();
      g.options.forEach((o, j) => {
        const name = o.name.trim().toLowerCase();
        if (name && optionNames.has(name))
          issue(["groups", i, "options", j, "name"], "Esa opción ya está en el grupo.");
        optionNames.add(name);
        const delta = parseDelta(o.price);
        if (delta === null)
          issue(["groups", i, "options", j, "price"], "Escribe un monto como 5, o -5 para restar.");
        else if (Math.abs(delta) > MAX_DELTA_CENTS)
          issue(["groups", i, "options", j, "price"], "Ese monto parece demasiado alto.");
      });
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
    groups: v.groups.map((g, sort) => ({
      id: g.groupId,
      name: g.name,
      ...toRule(g),
      sort,
      options: g.options.map((o, optionSort) => ({
        id: o.optionId,
        name: o.name,
        price_delta_cents: parseDelta(o.price)!,
        is_available: o.is_available,
        sort: optionSort,
      })),
    })),
  }));

export type OptionGroupsOutput = ProductFormOutput["groups"];

export type ProductFormInput = z.input<typeof productFormSchema>;
export type ProductFormOutput = z.output<typeof productFormSchema>;
export type ProductData = ProductFormOutput["data"];

export const categoryNameSchema = z
  .string()
  .trim()
  .min(2, "Escribe el nombre de la categoría.")
  .max(40, "Usa como máximo 40 caracteres.");
