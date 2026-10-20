import { z } from "zod";
import { normalizeHandle } from "./slug";

/** Texto opcional: vacío → null. */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => v || null)
    .nullable()
    .optional();

const handle = z
  .string()
  .trim()
  .max(80, "Ese usuario es muy largo.")
  .transform((v) => normalizeHandle(v))
  .nullable()
  .optional();

export const businessSettingsSchema = z.object({
  businessId: z.uuid(),
  name: z
    .string()
    .trim()
    .min(2, "Escribe el nombre de tu negocio.")
    .max(80, "Usa como máximo 80 caracteres."),
  slug: z.string().trim().toLowerCase().min(1, "Escribe el link de tu negocio."),
  description: optionalText(280, "Usa como máximo 280 caracteres."),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .refine((v) => v === "" || z.email().safeParse(v).success, "Ese correo no parece válido.")
    .transform((v) => v || null)
    .nullable()
    .optional(),
  instagram: handle,
  facebook: handle,
  tiktok: handle,
  whatsapp_greeting: optionalText(120, "Usa como máximo 120 caracteres."),
  whatsapp_farewell: optionalText(120, "Usa como máximo 120 caracteres."),
});

export type BusinessSettingsInput = z.input<typeof businessSettingsSchema>;
export type BusinessSettings = z.output<typeof businessSettingsSchema>;

export const slugCheckSchema = z.object({
  businessId: z.uuid(),
  slug: z.string().trim().toLowerCase().max(100),
});
