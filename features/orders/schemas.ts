import { z } from "zod";
import { MAX_LINES } from "@/features/cart/cart";
import { MAX_NOTE, MAX_QUANTITY } from "@/features/public-menu/cart-line";
import { MAX_ADDRESS, MAX_NAME, MAX_ORDER_NOTE, MAX_TABLE } from "./checkout";

/**
 * Lo que manda el celular al pedir. Solo producto, opciones y cantidad: un
 * precio enviado por el cliente se descarta (z.object quita llaves de más) y
 * el servidor lo recalcula.
 */
export const createOrderSchema = z.object({
  branchId: z.uuid(),
  /** Id aleatorio del dispositivo (localStorage) para el límite por sesión. */
  clientSessionId: z
    .string()
    .min(8)
    .max(64)
    .regex(/^[\w-]+$/),
  items: z
    .array(
      z.object({
        productId: z.uuid(),
        optionIds: z.array(z.uuid()).max(30).default([]),
        quantity: z.number().int().min(1).max(MAX_QUANTITY),
        note: z.string().max(MAX_NOTE).default(""),
      }),
    )
    .min(1, "Tu pedido está vacío.")
    .max(MAX_LINES),
  orderType: z.enum(["dine_in", "takeout", "delivery"]),
  table: z.string().max(MAX_TABLE).default(""),
  name: z.string().max(MAX_NAME),
  phone: z.string().max(20).default(""),
  email: z.string().max(120).default(""),
  address: z.string().max(MAX_ADDRESS).default(""),
  addressReference: z.string().max(MAX_ADDRESS).default(""),
  location: z
    .object({
      coords: z
        .object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) })
        .nullable(),
      accuracyM: z.number().min(0).max(100_000).nullable(),
      source: z.enum(["gps", "mapa", "manual"]),
    })
    .nullable()
    .default(null),
  scheduledFor: z.iso.datetime().nullable().default(null),
  payment: z.enum(["cash", "card_on_site", "transfer"]),
  note: z.string().max(MAX_ORDER_NOTE).default(""),
});

export type CreateOrderInput = z.infer<typeof createOrderSchema>;
