"use server";

import { headers } from "next/headers";
import { actionError, type ActionResult } from "@/lib/action-result";
import { markWhatsAppOpened, orderPath } from "./queries";
import { createOrderSchema } from "./schemas";
import { createOrder } from "./server";

/** IP del cliente detrás del proxy de Vercel (solo para el límite; se guarda como hash). */
async function clientIp() {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
}

/**
 * "Pedir por WhatsApp": guarda el pedido antes de abrir WhatsApp (guía), así
 * el negocio lo tiene aunque el comensal no envíe el mensaje. Público: no hay
 * sesión; los límites son por dispositivo e IP.
 */
export async function createOrderAction(
  input: unknown,
): Promise<
  ActionResult<{ orderId: string; number: number; totalCents: number; confirmationPath: string }>
> {
  const parsed = createOrderSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Revisa los datos de tu pedido e inténtalo otra vez." };
  try {
    const order = await createOrder(parsed.data, { ip: await clientIp() });
    return {
      ok: true,
      message: `Pedido #${String(order.number).padStart(4, "0")} recibido.`,
      data: {
        orderId: order.id,
        number: order.number,
        totalCents: order.total_cents,
        confirmationPath: orderPath(order.businessSlug, order.branchSlug, order.id),
      },
    };
  } catch (error) {
    return actionError(error);
  }
}

/** Se abrió WhatsApp con el pedido (para el registro y las analíticas). */
export async function markWhatsAppOpenedAction(orderId: unknown): Promise<void> {
  if (typeof orderId === "string") await markWhatsAppOpened(orderId);
}
