"use server";

import { cookies, headers } from "next/headers";
import { z } from "@/lib/zod";
import { getStaffSession } from "@/features/staff/server";
import { actionError, type ActionResult } from "@/lib/action-result";
import { audit } from "@/lib/audit";
import { requireAccess } from "@/lib/auth/require-access";
import { STAFF_DEVICE_COOKIE } from "@/lib/auth/route-rules";
import { getAuthUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { isPushEndpoint } from "./messages";
import {
  pushEnabled,
  removeSubscription,
  saveSubscription,
  sendTestPush,
  type SubscriptionOwner,
} from "./server";

const NOT_CONFIGURED = "Los avisos todavía no están configurados. Escríbenos para activarlos.";

/** base64url (algunos navegadores agregan "=" al final). */
const b64key = (min: number, max: number) =>
  z
    .string()
    .regex(/^[A-Za-z0-9_-]+={0,2}$/)
    .transform((s) => s.replace(/=+$/, ""))
    .refine((s) => s.length >= min && s.length <= max);

/** Lo que entrega PushSubscription.toJSON() en el navegador. */
const subscriptionSchema = z.object({
  endpoint: z.string().max(1000).refine(isPushEndpoint),
  keys: z.object({ p256dh: b64key(86, 88), auth: b64key(21, 24) }),
});

const endpointSchema = z.object({ endpoint: z.string().max(1000) });

const userAgent = async () => (await headers()).get("user-agent");

/** Dueño/encargado con sesión, o el staff con turno en este dispositivo. */
async function currentOwner(): Promise<SubscriptionOwner | null> {
  const user = await getAuthUser();
  if (!user) return null;
  if (!user.isAnonymous) return { userId: user.id };
  const session = await getStaffSession(user.id, (await cookies()).get(STAFF_DEVICE_COOKIE)?.value);
  return session ? { staffMemberId: session.staff.id } : null;
}

/**
 * Ajustes → Notificaciones: activa los avisos en este dispositivo para una
 * sucursal o para todas (null: todas las del dueño, o todas las asignadas al encargado).
 */
export async function subscribePanelPushAction(input: unknown): Promise<ActionResult> {
  const parsed = z
    .object({
      businessId: z.uuid(),
      branchId: z.uuid().nullable(),
      subscription: subscriptionSchema,
    })
    .safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Este navegador no entregó una suscripción válida." };
  if (!pushEnabled()) return { ok: false, message: NOT_CONFIGURED };
  try {
    const { businessId, branchId, subscription } = parsed.data;
    const { user } = await requireAccess(businessId, branchId ? { branchId } : {});
    const saved = await saveSubscription({
      businessId,
      branchId,
      userId: user.id,
      staffMemberId: null,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: await userAgent(),
    });
    await audit({
      actorId: user.id,
      actorKind: "user",
      businessId,
      action: "push.subscribe",
      entity: "push_subscription",
      entityId: saved.id,
      diff: { branch_id: branchId },
    });
    return { ok: true, message: "Listo: este dispositivo te avisará de cada pedido nuevo." };
  } catch (error) {
    return actionError(error);
  }
}

/** Bandeja del staff: avisos de la sucursal del turno en esta tablet o celular. */
export async function subscribeStaffPushAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ subscription: subscriptionSchema }).safeParse(input);
  if (!parsed.success)
    return { ok: false, message: "Este navegador no entregó una suscripción válida." };
  if (!pushEnabled()) return { ok: false, message: NOT_CONFIGURED };
  try {
    const user = await getAuthUser();
    const session = user?.isAnonymous
      ? await getStaffSession(user.id, (await cookies()).get(STAFF_DEVICE_COOKIE)?.value)
      : null;
    if (!session) return { ok: false, message: "Tu turno terminó. Vuelve a escribir tu PIN." };
    const { subscription } = parsed.data;
    await saveSubscription({
      businessId: session.business_id,
      branchId: session.branch_id,
      userId: null,
      staffMemberId: session.staff.id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys.p256dh,
      auth: subscription.keys.auth,
      userAgent: await userAgent(),
    });
    return {
      ok: true,
      message: `Listo: este dispositivo sonará con cada pedido de ${session.branch.name}.`,
    };
  } catch (error) {
    return actionError(error);
  }
}

/** Desactiva los avisos de este dispositivo (solo si son de quien lo pide). */
export async function unsubscribePushAction(input: unknown): Promise<ActionResult> {
  const parsed = endpointSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "No pudimos desactivar los avisos." };
  try {
    const owner = await currentOwner();
    if (!owner) return { ok: false, message: "Tu sesión terminó. Vuelve a entrar." };
    await removeSubscription(parsed.data.endpoint, owner);
    return { ok: true, message: "Avisos desactivados en este dispositivo." };
  } catch (error) {
    return actionError(error);
  }
}

/** Quitar otro dispositivo de la lista de Ajustes → Notificaciones. */
export async function removePushDeviceAction(input: unknown): Promise<ActionResult> {
  const parsed = z.object({ businessId: z.uuid(), id: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, message: "No pudimos quitar ese dispositivo." };
  try {
    const { user } = await requireAccess(parsed.data.businessId);
    await db().push_subscriptions.deleteMany({
      where: { id: parsed.data.id, business_id: parsed.data.businessId, user_id: user.id },
    });
    return { ok: true, message: "Dispositivo quitado: ya no recibirá avisos." };
  } catch (error) {
    return actionError(error);
  }
}

/** "Enviar aviso de prueba" a este dispositivo. */
export async function sendTestPushAction(input: unknown): Promise<ActionResult> {
  const parsed = endpointSchema.safeParse(input);
  if (!parsed.success) return { ok: false, message: "No pudimos enviar la prueba." };
  try {
    const owner = await currentOwner();
    if (!owner) return { ok: false, message: "Tu sesión terminó. Vuelve a entrar." };
    const result = await sendTestPush(parsed.data.endpoint, owner);
    return result.ok
      ? { ok: true, message: "Enviamos un aviso de prueba: debería llegar en unos segundos." }
      : result;
  } catch (error) {
    return actionError(error);
  }
}
