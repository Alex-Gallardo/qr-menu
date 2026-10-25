import { z } from "@/lib/zod";
import { parseQ } from "@/lib/money";
import { BILLING_PERIODS, PAID_PLANS, PAYMENT_METHODS } from "./billing";

export const RECEIPT_TYPES = ["image/webp", "image/jpeg", "image/png", "application/pdf"] as const;
export const MAX_RECEIPT_BYTES = 8 * 1024 * 1024;

/** Pedir dónde subir la boleta (URL firmada al bucket privado). */
export const receiptUploadSchema = z.object({
  businessId: z.uuid(),
  type: z.enum(RECEIPT_TYPES),
  bytes: z.number().int().positive().max(MAX_RECEIPT_BYTES, "La boleta pesa más de 8 MB."),
});

/** Boleta de pago de la licencia (Ajustes → Mi plan). */
export const paymentSchema = z.object({
  businessId: z.uuid(),
  planId: z.enum(PAID_PLANS),
  period: z.enum(BILLING_PERIODS.map((p) => p.value)),
  method: z.enum(PAYMENT_METHODS.map((m) => m.value)),
  bank: z
    .string()
    .trim()
    .min(2, "Escribe el banco desde donde pagaste.")
    .max(60, "Usa como máximo 60 caracteres."),
  reference: z
    .string()
    .trim()
    .min(3, "Escribe el número de boleta o de transferencia.")
    .max(60, "Usa como máximo 60 caracteres."),
  amount: z.string().refine((v) => {
    const cents = parseQ(v);
    return cents !== null && cents > 0;
  }, "Escribe el monto como 149 o 149.00."),
  receiptPath: z.string().min(10, "Sube la foto de la boleta.").max(200),
});

export type PaymentInput = z.infer<typeof paymentSchema>;
