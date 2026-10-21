import { z } from "zod";
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
