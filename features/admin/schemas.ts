import { z } from "@/lib/zod";
import { FEATURES } from "@/features/licensing/plan-catalog";
import { parseQ } from "@/lib/money";
import { toE164 } from "@/lib/phone";

const businessId = z.uuid();
const reason = z.string().trim().min(3, "Escribe el motivo.").max(300);

export const changePlanSchema = z.object({
  businessId,
  planId: z.enum(["gratis", "pro", "negocio"]),
});
export const extendSchema = z.object({
  businessId,
  days: z.number().int().min(1, "Al menos 1 día.").max(730, "Como máximo 2 años."),
});
export const termsSchema = z.object({
  businessId,
  priceOverride: z
    .string()
    .trim()
    .refine(
      (v) => v === "" || /^\d{1,5}$/.test(v),
      "Escribe el precio en quetzales enteros o déjalo vacío.",
    ),
  graceDays: z.number().int().min(0).max(60),
  notes: z.string().trim().max(500),
});
export const overridesSchema = z.object({
  businessId,
  limits: z.record(z.string(), z.string().max(10)),
  features: z.record(z.enum(FEATURES), z.enum(["plan", "on", "off"])),
});
export const statusSchema = z.object({
  businessId,
  status: z.enum(["suspended", "active", "cancelled"]),
  reason,
});
export const paymentIdSchema = z.object({ paymentId: z.uuid() });
export const rejectSchema = z.object({ paymentId: z.uuid(), reason });
export const manualPaymentSchema = z.object({
  businessId,
  planId: z.enum(["pro", "negocio"]),
  period: z.enum(["monthly", "annual"]),
  amount: z.string().refine((v) => (parseQ(v) ?? 0) > 0, "Escribe el monto."),
  reference: z.string().trim().min(2, "Escribe una referencia (ej. depósito 12/10).").max(60),
});
export const impersonateSchema = z.object({ businessId, reason });
export const businessOnlySchema = z.object({ businessId });

export const assistedBusinessSchema = z
  .object({
    name: z.string().trim().min(2, "Escribe el nombre.").max(80),
    slug: z.string().trim().toLowerCase().min(1, "Escribe el link."),
    branchName: z.string().trim().min(2, "Escribe la sucursal.").max(60),
    whatsapp: z.string(),
    ownerEmail: z.string().trim().toLowerCase().pipe(z.email("Ese correo no parece válido.")),
    planId: z.enum(["gratis", "pro", "negocio"]),
    trialDays: z.number().int().min(0).max(365),
    priceOverride: z.string().trim(),
    notes: z.string().trim().max(500),
  })
  .superRefine((v, ctx) => {
    if (!toE164(v.whatsapp))
      ctx.addIssue({ code: "custom", path: ["whatsapp"], message: "WhatsApp de 8 dígitos." });
    if (v.priceOverride && !/^\d{1,5}$/.test(v.priceOverride))
      ctx.addIssue({
        code: "custom",
        path: ["priceOverride"],
        message: "Precio en quetzales enteros.",
      });
  });

const account = z.object({
  bank: z.string().trim().min(2).max(60),
  type: z.string().trim().max(40),
  number: z.string().trim().min(4).max(40),
  holder: z.string().trim().max(80),
});
export const settingsSchema = z.object({
  maintenanceEnabled: z.boolean(),
  maintenanceMessage: z.string().trim().max(300),
  trialDays: z.number().int().min(1).max(90),
  founderTrialDays: z.number().int().min(1).max(365),
  graceDays: z.number().int().min(0).max(60),
  reservedSlugs: z.string().max(5000),
  paymentAccounts: z.array(account).max(10),
});
export const planPriceSchema = z.object({
  planId: z.enum(["pro", "negocio"]),
  priceGtq: z.number().int().min(1).max(100_000),
});
export const announcementSchema = z.object({
  id: z.uuid().optional(),
  title: z.string().trim().min(2, "Escribe un título.").max(80),
  body: z.string().trim().min(2, "Escribe el texto.").max(300),
  audience: z
    .string()
    .regex(/^(all|plan:(gratis|pro|negocio)|business:[0-9a-f-]{36})$/i, "Audiencia inválida."),
  startsAt: z.iso.date(),
  endsAt: z.iso.date().or(z.literal("")),
  isActive: z.boolean(),
});
