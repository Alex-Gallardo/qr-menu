import { z } from "zod";
import { MAX_TABLE_NUMBER, MAX_TABLES_AT_ONCE } from "./codes";

const tableNumber = z.coerce
  .number("Escribe un número.")
  .int("Usa números enteros.")
  .min(1, "Las mesas empiezan en 1.")
  .max(MAX_TABLE_NUMBER, `Hasta la mesa ${MAX_TABLE_NUMBER}.`);

/** Nuevo QR: de toda la sucursal, mesas "desde–hasta" o una campaña con nombre. */
export const createQrSchema = z.discriminatedUnion("kind", [
  z.object({ businessId: z.uuid(), branchId: z.uuid(), kind: z.literal("branch") }),
  z
    .object({
      businessId: z.uuid(),
      branchId: z.uuid(),
      kind: z.literal("table"),
      from: tableNumber,
      to: tableNumber,
    })
    .refine((v) => v.to >= v.from, {
      path: ["to"],
      message: "La última mesa va después de la primera.",
    })
    .refine((v) => v.to - v.from + 1 <= MAX_TABLES_AT_ONCE, {
      path: ["to"],
      message: `Crea hasta ${MAX_TABLES_AT_ONCE} mesas a la vez.`,
    }),
  z.object({
    businessId: z.uuid(),
    branchId: z.uuid(),
    kind: z.literal("campaign"),
    label: z
      .string()
      .trim()
      .min(2, "Ponle un nombre, p. ej. Volante.")
      .max(40, "Usa como máximo 40 caracteres."),
  }),
]);

export type CreateQrInput = z.infer<typeof createQrSchema>;

export const qrIdSchema = z.object({ businessId: z.uuid(), qrId: z.uuid() });

/** Deshacer un borrado: vuelve con el mismo código (los impresos siguen sirviendo) y sus escaneos. */
export const restoreQrSchema = z.object({
  businessId: z.uuid(),
  qr: z.object({
    branch_id: z.uuid(),
    label: z.string().max(60),
    short_code: z.string().max(20),
    table_label: z.string().max(20).nullable(),
    style: z.object({ kind: z.enum(["branch", "table", "campaign"]) }).nullable(),
    scans: z.number().int().min(0),
  }),
});
