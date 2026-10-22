"use server";

import { z } from "zod";
import { requireAccess } from "@/lib/auth/require-access";
import { actionError, type ActionResult } from "@/lib/action-result";
import { orderBranch, updateOrderStatus } from "./inbox";
import { STATUS_LABELS, type OrderStatus } from "./status";

const schema = z.object({
  businessId: z.uuid(),
  orderId: z.uuid(),
  to: z.enum(["accepted", "preparing", "ready", "delivered", "cancelled"]),
});

/**
 * Bandeja: Aceptar → En preparación → Listo → Entregado (o Cancelar). Dueño,
 * o encargado de esa sucursal; con la licencia suspendida no se puede.
 * El comensal ve el estado nuevo en su página de confirmación.
 */
export async function updateOrderStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "No pudimos cambiar el pedido." };
  const { businessId, orderId, to } = parsed.data;
  try {
    const order = await orderBranch(businessId, orderId);
    if (!order) return { ok: false, message: "Ese pedido ya no existe." };
    const { user } = await requireAccess(businessId, { branchId: order.branch_id, write: true });
    await updateOrderStatus(businessId, orderId, to as OrderStatus, { userId: user.id });
    return { ok: true, message: `Pedido ${STATUS_LABELS[to as OrderStatus].toLowerCase()}.` };
  } catch (error) {
    return actionError(error);
  }
}
