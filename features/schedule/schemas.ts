import { z } from "@/lib/zod";
import { slotTimeProblem } from "./slots";

export const slotKeySchema = z.enum(["breakfast", "lunch", "dinner", "custom"]);

/** Franja horaria (agregar o editar). */
export const slotFormSchema = z
  .object({
    businessId: z.uuid(),
    slotId: z.uuid().optional(),
    key: slotKeySchema,
    name: z
      .string()
      .trim()
      .min(2, "Escribe el nombre de la franja.")
      .max(30, "Usa como máximo 30 caracteres."),
    start_time: z.string(),
    end_time: z.string(),
    is_active: z.boolean(),
  })
  .superRefine((v, ctx) => {
    const problem = slotTimeProblem(v);
    if (problem) ctx.addIssue({ code: "custom", path: ["end_time"], message: problem });
  });

export type SlotFormInput = z.input<typeof slotFormSchema>;
export type SlotFormOutput = z.output<typeof slotFormSchema>;

const CELL_KEY = /^[0-9a-f-]{36}:[0-6]$/;

/** Cuadrícula semanal de un alcance (sucursal o null = todas). */
export const scheduleGridSchema = z.object({
  businessId: z.uuid(),
  branchId: z.uuid().nullable(),
  cells: z
    .record(z.string().regex(CELL_KEY), z.uuid())
    .refine((cells) => Object.keys(cells).length <= 7 * 24, "Demasiadas celdas."),
});

export type ScheduleGridInput = z.input<typeof scheduleGridSchema>;

/** Fecha especial: un menú distinto o "Cerrado", todo el día o en una franja. */
export const overrideSchema = z.object({
  businessId: z.uuid(),
  branchId: z.uuid().nullable(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Elige una fecha."),
  slotId: z.uuid().nullable(),
  /** null = Cerrado. */
  menuId: z.uuid().nullable(),
  note: z
    .string()
    .trim()
    .max(80, "Usa como máximo 80 caracteres.")
    .transform((v) => v || null),
});

export type OverrideInput = z.input<typeof overrideSchema>;
export type OverrideOutput = z.output<typeof overrideSchema>;
