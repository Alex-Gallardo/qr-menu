import { z } from "zod";
import { slugFormatProblem, SLUG_MESSAGES } from "@/features/businesses/slug";
import { parseQ } from "@/lib/money";
import { toE164 } from "@/lib/phone";
import { dayProblem, type DayHours } from "./hours";

const NO_RESERVED = new Set<string>();

const text = (max: number) =>
  z
    .string()
    .trim()
    .max(max, `Usa como máximo ${max} caracteres.`)
    .transform((v) => v || null);

const dayHours = z.object({
  weekday: z.number().int().min(0).max(6),
  open: z.boolean(),
  opens: z.string(),
  closes: z.string(),
}) satisfies z.ZodType<DayHours>;

/** Formulario de sucursal (valores como los escribe el usuario: texto y casillas). */
export const branchFormSchema = z
  .object({
    businessId: z.uuid(),
    branchId: z.uuid().optional(),
    name: z
      .string()
      .trim()
      .min(2, "Escribe el nombre de la sucursal.")
      .max(60, "Usa como máximo 60 caracteres."),
    slug: z.string().trim().toLowerCase(),
    address: text(160),
    address_reference: text(160),
    city: text(60),
    whatsapp: z.string(),
    phone: z.string(),
    google_place_id: z
      .string()
      .trim()
      .refine(
        (v) => v === "" || /^[A-Za-z0-9_-]{10,200}$/.test(v),
        "Ese Place ID no parece válido.",
      )
      .transform((v) => v || null),
    accepts_dine_in: z.boolean(),
    accepts_takeout: z.boolean(),
    accepts_delivery: z.boolean(),
    accepts_transfer: z.boolean(),
    delivery_fee: z.string(),
    delivery_radius_km: z.string(),
    min_order: z.string(),
    delivery_requires_location: z.boolean(),
    preorder_mode: z.enum(["off", "next_open", "always"]),
    preorder_min_lead_min: z.coerce.number<string | number>().int().min(0).max(1440),
    preorder_max_days: z.coerce.number<string | number>().int().min(0).max(14),
    is_active: z.boolean(),
    hours: z.array(dayHours).length(7),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: "custom", path: [path], message });

    const slug = slugFormatProblem(v.slug, NO_RESERVED);
    if (slug)
      issue("slug", slug === "empty" ? "Escribe el link de la sucursal." : SLUG_MESSAGES[slug]);

    if (!toE164(v.whatsapp))
      issue("whatsapp", "Escribe un WhatsApp de 8 dígitos, por ejemplo 5555-1234.");
    if (v.phone.trim() && !toE164(v.phone)) issue("phone", "Ese teléfono no parece válido.");

    if (!v.accepts_dine_in && !v.accepts_takeout && !v.accepts_delivery) {
      issue("accepts_dine_in", "Activa al menos un tipo de pedido.");
    }
    if (v.accepts_delivery) {
      if (parseQ(v.delivery_fee || "0") === null)
        issue("delivery_fee", "Escribe un monto como 15 o 15.50.");
      if (parseQ(v.min_order || "0") === null) issue("min_order", "Escribe un monto como 50.");
      const radius = v.delivery_radius_km.trim();
      if (radius && !(Number(radius) > 0 && Number(radius) <= 100)) {
        issue("delivery_radius_km", "Escribe un radio entre 0.5 y 100 km, o déjalo vacío.");
      }
    }

    v.hours.forEach((day, i) => {
      const problem = dayProblem(day);
      if (problem) ctx.addIssue({ code: "custom", path: ["hours", i, "closes"], message: problem });
    });
    if (!v.hours.some((d) => d.open)) issue("hours", "Abre al menos un día de la semana.");
  })
  .transform((v) => ({
    businessId: v.businessId,
    branchId: v.branchId,
    data: {
      name: v.name,
      slug: v.slug,
      address: v.address,
      address_reference: v.address_reference,
      city: v.city,
      whatsapp_e164: toE164(v.whatsapp)!,
      phone: toE164(v.phone),
      google_place_id: v.google_place_id,
      accepts_dine_in: v.accepts_dine_in,
      accepts_takeout: v.accepts_takeout,
      accepts_delivery: v.accepts_delivery,
      accepts_transfer: v.accepts_transfer,
      delivery_fee_cents: v.accepts_delivery ? (parseQ(v.delivery_fee || "0") ?? 0) : 0,
      delivery_radius_km:
        v.accepts_delivery && v.delivery_radius_km.trim() ? Number(v.delivery_radius_km) : null,
      min_order_cents: v.accepts_delivery ? (parseQ(v.min_order || "0") ?? 0) : 0,
      delivery_requires_location: v.delivery_requires_location,
      preorder_mode: v.preorder_mode,
      preorder_min_lead_min: v.preorder_min_lead_min,
      preorder_max_days: v.preorder_max_days,
      is_active: v.is_active,
    },
    hours: v.hours
      .filter((d) => d.open)
      .map((d) => ({ weekday: d.weekday, opens: d.opens, closes: d.closes })),
  }));

export type BranchFormInput = z.input<typeof branchFormSchema>;
export type BranchFormOutput = z.output<typeof branchFormSchema>;
export type BranchData = BranchFormOutput["data"];
