"use server";

import { cookies } from "next/headers";
import { z } from "@/lib/zod";
import { getStaffSession } from "@/features/staff/server";
import { STAFF_DEVICE_COOKIE } from "@/lib/auth/route-rules";
import { getAuthUser } from "@/lib/auth/session";
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
 * encargado de esa sucursal o staff con turno en ella; con la licencia suspendida no se puede.
 * El comensal ve el estado nuevo en su página de confirmación.
 */
export async function updateOrderStatusAction(input: unknown): Promise<ActionResult> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "No pudimos cambiar el pedido." };
  const { businessId, orderId, to } = parsed.data;
  try {
    const order = await orderBranch(businessId, orderId);
    if (!order) return { ok: false, message: "Ese pedido ya no existe." };
    const current = await getAuthUser();
    if (current?.isAnonymous) {
      // Staff con PIN: solo pedidos de la sucursal de su turno, en su dispositivo.
      const session = await getStaffSession(
        current.id,
        (await cookies()).get(STAFF_DEVICE_COOKIE)?.value,
      );
      if (!session || session.business_id !== businessId || session.branch_id !== order.branch_id)
        return { ok: false, message: "Tu turno terminó o este pedido es de otra sucursal." };
      await updateOrderStatus(businessId, orderId, to as OrderStatus, {
        staffId: session.staff.id,
      });
    } else {
      const { user } = await requireAccess(businessId, { branchId: order.branch_id, write: true });
      await updateOrderStatus(businessId, orderId, to as OrderStatus, { userId: user.id });
    }
    return { ok: true, message: `Pedido ${STATUS_LABELS[to as OrderStatus].toLowerCase()}.` };
  } catch (error) {
    return actionError(error);
  }
}
