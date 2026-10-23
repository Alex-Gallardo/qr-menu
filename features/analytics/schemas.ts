import { z } from "zod";
import { CLIENT_EVENTS } from "./metrics";

/** Lote de eventos del menú público (POST /api/ev con sendBeacon). */
export const eventBatchSchema = z.object({
  businessId: z.uuid(),
  branchId: z.uuid(),
  sessionId: z.string().regex(/^[\w-]{8,64}$/),
  events: z
    .array(
      z.object({
        event: z.enum(CLIENT_EVENTS),
        productId: z.uuid().optional(),
        menuId: z.uuid().optional(),
        /** De dónde llegó la visita: la app instalada o un QR. */
        source: z.enum(["pwa", "qr"]).optional(),
        quantity: z.number().int().min(1).max(99).optional(),
      }),
    )
    .min(1)
    .max(25),
});

export type EventBatch = z.infer<typeof eventBatchSchema>;
