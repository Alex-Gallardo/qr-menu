"use server";

import { cookies } from "next/headers";
import { validationError, z } from "@/lib/zod";
import { requireAccess } from "@/lib/auth/require-access";
import { STAFF_DEVICE_COOKIE } from "@/lib/auth/route-rules";
import { getAuthUser } from "@/lib/auth/session";
import { actionError, type ActionResult } from "@/lib/action-result";
import { db } from "@/lib/db";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  authorizeDevice,
  DEVICE_COOKIE_MAX_AGE,
  endStaffSession,
  revokeDevice,
  startStaffSession,
  verifyStaffPin,
} from "./server";

const authorizeSchema = z.object({
  businessId: z.uuid(),
  branchId: z.uuid(),
  name: z.string().trim().min(2, "Ponle un nombre, por ejemplo “Tablet de caja”.").max(40),
});

/**
 * "Autorizar este dispositivo": dueño o encargado de la sucursal, con la
 * función de staff con PIN en su plan. Guarda la cookie del dispositivo y
 * cierra la sesión del dueño en esa tablet (desde ahora muestra el teclado).
 */
export async function authorizeDeviceAction(input: unknown): Promise<ActionResult> {
  const parsed = authorizeSchema.safeParse(input);
  if (!parsed.success) return validationError(parsed.error);
  try {
    const { businessId, branchId, name } = parsed.data;
    const { user } = await requireAccess(businessId, {
      branchId,
      write: true,
      feature: "staff_pin",
    });
    const { token } = await authorizeDevice({ businessId, branchId, name, approvedBy: user.id });
    (await cookies()).set(STAFF_DEVICE_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: DEVICE_COOKIE_MAX_AGE,
    });
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    return { ok: true, message: `Listo: “${name}” ya puede abrir turnos con PIN.` };
  } catch (error) {
    return actionError(error);
  }
}

/** Teclado de PIN: abre el turno con una sesión anónima vinculada a este dispositivo. */
export async function staffPinLoginAction(pin: unknown): Promise<ActionResult<{ name: string }>> {
  if (typeof pin !== "string") return { ok: false, message: "Escribe tu PIN." };
  const token = (await cookies()).get(STAFF_DEVICE_COOKIE)?.value;
  const result = await verifyStaffPin(token, pin);
  if (!result.ok) return result;

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInAnonymously();
  if (error || !data.user)
    return {
      ok: false,
      message: "No pudimos abrir tu turno. Revisa el internet e inténtalo otra vez.",
    };
  await startStaffSession(data.user.id, result.staff.id, result.device);
  return { ok: true, message: `¡Hola, ${result.staff.name}!`, data: { name: result.staff.name } };
}

/** "Cerrar turno": termina la sesión y vuelve al teclado (el dispositivo sigue autorizado). */
export async function endShiftAction(): Promise<ActionResult> {
  const user = await getAuthUser();
  if (user?.isAnonymous) {
    await endStaffSession(user.id);
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
    // El usuario anónimo ya no sirve: se borra para no acumularlos.
    await createSupabaseAdminClient()
      .auth.admin.deleteUser(user.id)
      .catch(() => {});
  }
  return { ok: true, message: "Turno cerrado." };
}

const revokeSchema = z.object({ businessId: z.uuid(), deviceId: z.uuid() });

/** Revocar una tablet: vuelve a pedir autorización y su turno abierto termina. */
export async function revokeDeviceAction(input: unknown): Promise<ActionResult> {
  const parsed = revokeSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "No pudimos revocar el dispositivo." };
  try {
    const device = await db().staff_devices.findFirst({
      where: { id: parsed.data.deviceId, business_id: parsed.data.businessId },
      select: { branch_id: true, name: true },
    });
    if (!device) return { ok: false, message: "Ese dispositivo ya no existe." };
    await requireAccess(parsed.data.businessId, { branchId: device.branch_id, write: true });
    await revokeDevice(parsed.data.businessId, parsed.data.deviceId);
    return { ok: true, message: `“${device.name}” ya no puede abrir turnos.` };
  } catch (error) {
    return actionError(error);
  }
}
