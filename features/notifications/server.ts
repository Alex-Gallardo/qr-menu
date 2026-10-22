import "server-only";
import { captureException } from "@sentry/nextjs";
import type { OrderType } from "@/features/orders/checkout";
import { BRAND } from "@/lib/brand";
import { db } from "@/lib/db";
import { sendPush, type PushOptions, type PushResult } from "@/lib/push/web-push";
import {
  MAX_REMINDERS,
  newOrderText,
  orderUrl,
  PREORDER_LEAD_MIN,
  preorderText,
  receives,
  REMINDER_EVERY_MIN,
  REMINDER_WINDOW_MIN,
  reminderText,
  type PushMessage,
  type PushOrder,
  type PushRecipientKind,
} from "./messages";

/**
 * Push web a la sucursal (guía §6 Paso 3). Cada dispositivo (panel o tablet
 * del staff) guarda su suscripción en push_subscriptions; al crear un pedido
 * se avisa a los de esa sucursal y a los del dueño (branch_id null). El cron
 * (/api/cron/push) repite el aviso si sigue "nuevo" y avisa 30 min antes de
 * los programados. Sin llaves VAPID no se envía nada y todo lo demás sigue igual.
 */

/** Llaves y contacto VAPID del entorno, o null si falta configurarlas. */
export function pushConfig(): Omit<PushOptions, "topic"> | null {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return {
    vapid: { publicKey, privateKey },
    // Contacto para los servicios de push (Apple exige https: o mailto:).
    subject:
      process.env.VAPID_SUBJECT ||
      (BRAND.url.startsWith("https:") ? BRAND.url : "mailto:avisos@qrmenu.test"),
  };
}

export const pushEnabled = () => pushConfig() !== null;

/** Una suscripción por navegador (endpoint): si ya existía, pasa a quien la activa ahora. */
export async function saveSubscription(input: {
  businessId: string;
  branchId: string | null;
  userId: string | null;
  staffMemberId: string | null;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent: string | null;
}) {
  const data = {
    business_id: input.businessId,
    branch_id: input.branchId,
    user_id: input.userId,
    staff_member_id: input.staffMemberId,
    p256dh: input.p256dh,
    auth: input.auth,
    user_agent: input.userAgent?.slice(0, 300) ?? null,
  };
  return db().push_subscriptions.upsert({
    where: { endpoint: input.endpoint },
    create: { endpoint: input.endpoint, ...data },
    update: data,
    select: { id: true },
  });
}

export type SubscriptionOwner = { userId: string } | { staffMemberId: string };

const ownerWhere = (owner: SubscriptionOwner) =>
  "userId" in owner ? { user_id: owner.userId } : { staff_member_id: owner.staffMemberId };

export async function removeSubscription(endpoint: string, owner: SubscriptionOwner) {
  const { count } = await db().push_subscriptions.deleteMany({
    where: { endpoint, ...ownerWhere(owner) },
  });
  return count > 0;
}

/** Dispositivos con avisos de este usuario en el negocio (Ajustes → Notificaciones). */
export function listUserSubscriptions(businessId: string, userId: string) {
  return db().push_subscriptions.findMany({
    where: { business_id: businessId, user_id: userId },
    orderBy: { created_at: "asc" },
    select: {
      id: true,
      endpoint: true,
      branch_id: true,
      user_agent: true,
      last_success_at: true,
      created_at: true,
    },
  });
}

async function loadPushOrders(ids: string[]): Promise<PushOrder[]> {
  if (ids.length === 0) return [];
  const rows = await db().orders.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      business_id: true,
      branch_id: true,
      number: true,
      total_cents: true,
      customer_name: true,
      order_type: true,
      table_label: true,
      scheduled_for: true,
      branch: { select: { name: true } },
    },
  });
  return rows.map((o) => ({
    id: o.id,
    businessId: o.business_id,
    branchId: o.branch_id,
    branchName: o.branch.name,
    number: o.number,
    totalCents: o.total_cents,
    customerName: o.customer_name,
    orderType: o.order_type as OrderType,
    tableLabel: o.table_label,
    scheduledFor: o.scheduled_for,
  }));
}

type Recipient = {
  id: string;
  kind: PushRecipientKind;
  endpoint: string;
  p256dh: string;
  auth: string;
};

/** Dispositivos que deben recibir el aviso de un pedido de esta sucursal. */
async function recipientsFor(order: Pick<PushOrder, "businessId" | "branchId">) {
  const subs = await db().push_subscriptions.findMany({
    where: {
      business_id: order.businessId,
      OR: [{ branch_id: null }, { branch_id: order.branchId }],
    },
    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      auth: true,
      branch_id: true,
      user_id: true,
      staff: { select: { branch_id: true, is_active: true, hidden_by_license: true } },
    },
  });
  const userIds = [...new Set(subs.flatMap((s) => (s.user_id ? [s.user_id] : [])))];
  const members =
    userIds.length === 0
      ? []
      : await db().business_members.findMany({
          where: { business_id: order.businessId, user_id: { in: userIds } },
          select: {
            user_id: true,
            role: true,
            all_branches: true,
            branches: { select: { branch_id: true } },
          },
        });
  const memberOf = new Map(members.map((m) => [m.user_id, m]));

  return subs.flatMap((s): Recipient[] => {
    const member = s.user_id ? memberOf.get(s.user_id) : undefined;
    const ok = receives(
      {
        branchId: s.branch_id,
        member: member
          ? {
              role: member.role,
              allBranches: member.all_branches,
              branchIds: member.branches.map((b) => b.branch_id),
            }
          : null,
        staff: s.staff
          ? { branchId: s.staff.branch_id, active: s.staff.is_active && !s.staff.hidden_by_license }
          : null,
      },
      order.branchId,
    );
    if (!ok) return [];
    const { id, endpoint, p256dh, auth } = s;
    return [{ id, endpoint, p256dh, auth, kind: s.staff ? "staff" : "user" }];
  });
}

export type DeliveryReport = { sent: number; removed: number; failed: number };

/**
 * Envía a cada dispositivo (en paralelo). Las suscripciones vencidas (404/410)
 * se borran; los demás errores van a Sentry sin detener al resto.
 */
async function deliver(
  recipients: Recipient[],
  message: (kind: PushRecipientKind) => PushMessage,
  topic?: string,
): Promise<DeliveryReport> {
  const config = pushConfig();
  const report: DeliveryReport = { sent: 0, removed: 0, failed: 0 };
  if (!config || recipients.length === 0) return report;

  const results = await Promise.allSettled(
    recipients.map((r) => sendPush(r, message(r.kind), { ...config, topic })),
  );
  const ok: string[] = [];
  const gone: string[] = [];
  results.forEach((result, i) => {
    const id = recipients[i]!.id;
    const value: PushResult | null = result.status === "fulfilled" ? result.value : null;
    if (value?.ok) ok.push(id);
    else if (value?.gone) gone.push(id);
    else {
      report.failed++;
      const reason =
        result.status === "rejected"
          ? result.reason
          : new Error(`Push ${value?.status}: ${value && !value.ok ? value.detail : ""}`);
      captureException(reason, { tags: { feature: "web_push" } });
      console.error("[push]", reason instanceof Error ? reason.message : reason);
    }
  });
  report.sent = ok.length;
  report.removed = gone.length;
  await Promise.all([
    ok.length > 0 &&
      db().push_subscriptions.updateMany({
        where: { id: { in: ok } },
        data: { last_success_at: new Date() },
      }),
    gone.length > 0 && db().push_subscriptions.deleteMany({ where: { id: { in: gone } } }),
  ]);
  return report;
}

/** Topic del servicio de push: un aviso nuevo del pedido reemplaza al pendiente. */
const topicOf = (orderId: string) => orderId.replace(/-/g, "");

async function notifyOrders(orders: PushOrder[], text: (o: PushOrder) => Omit<PushMessage, "url">) {
  const total: DeliveryReport = { sent: 0, removed: 0, failed: 0 };
  for (const order of orders) {
    const t = text(order);
    const r = await deliver(
      await recipientsFor(order),
      (kind) => ({ ...t, url: orderUrl(kind, order) }),
      topicOf(order.id),
    );
    total.sent += r.sent;
    total.removed += r.removed;
    total.failed += r.failed;
  }
  return total;
}

/**
 * "Nuevo pedido #0042 · Q131.00". Corre después de responder al comensal
 * (after): nunca lo hace esperar ni falla su pedido.
 */
export async function notifyNewOrder(orderId: string): Promise<DeliveryReport | null> {
  if (!pushEnabled()) return null;
  try {
    return await notifyOrders(await loadPushOrders([orderId]), (o) => newOrderText(o));
  } catch (error) {
    captureException(error, { tags: { feature: "web_push" } });
    console.error("[push] aviso de pedido nuevo", error instanceof Error ? error.message : error);
    return null;
  }
}

/**
 * Pedidos que siguen "nuevos": a los 3, 6 y 9 min se repite el aviso. Se
 * marcan antes de enviar (UPDATE … RETURNING, con la hora de la base) para
 * que dos corridas del cron nunca manden el mismo recordatorio.
 */
async function claimReminders(businessId: string | null) {
  const rows = await db().$queryRaw<{ id: string }[]>`
    WITH due AS (
      SELECT id FROM orders
      WHERE status = 'new'
        AND (${businessId}::uuid IS NULL OR business_id = ${businessId}::uuid)
        AND push_reminders_sent < ${MAX_REMINDERS}
        AND created_at > now() - make_interval(mins => ${REMINDER_WINDOW_MIN})
        AND created_at <= now() - make_interval(mins => ${REMINDER_EVERY_MIN} * (push_reminders_sent + 1))
      ORDER BY created_at
      LIMIT 50
      FOR UPDATE SKIP LOCKED
    )
    UPDATE orders o SET push_reminders_sent = o.push_reminders_sent + 1
    FROM due WHERE o.id = due.id
    RETURNING o.id`;
  return rows.map((r) => r.id);
}

/**
 * Programados: un aviso 30 min antes de la hora (si se pidió con más
 * anticipación; si no, basta el aviso de cuando se creó). Sin cancelados ni
 * entregados.
 */
async function claimPreorderReminders(businessId: string | null) {
  const rows = await db().$queryRaw<{ id: string }[]>`
    WITH due AS (
      SELECT id FROM orders
      WHERE scheduled_for IS NOT NULL
        AND (${businessId}::uuid IS NULL OR business_id = ${businessId}::uuid)
        AND preorder_reminder_sent_at IS NULL
        AND status IN ('new', 'accepted', 'preparing')
        AND scheduled_for > now()
        AND scheduled_for <= now() + make_interval(mins => ${PREORDER_LEAD_MIN})
        AND scheduled_for - created_at > make_interval(mins => ${PREORDER_LEAD_MIN})
      ORDER BY scheduled_for
      LIMIT 50
      FOR UPDATE SKIP LOCKED
    )
    UPDATE orders o SET preorder_reminder_sent_at = now()
    FROM due WHERE o.id = due.id
    RETURNING o.id`;
  return rows.map((r) => r.id);
}

/** Lo que hace el cron cada minuto. `businessId` limita a un negocio (pruebas). */
export async function sendDueReminders(scope: { businessId?: string } = {}) {
  const businessId = scope.businessId ?? null;
  const [reminderIds, preorderIds] = await Promise.all([
    claimReminders(businessId),
    claimPreorderReminders(businessId),
  ]);
  const [reminders, preorders] = await Promise.all([
    notifyOrders(await loadPushOrders(reminderIds), (o) => reminderText(o)),
    notifyOrders(await loadPushOrders(preorderIds), (o) => preorderText(o)),
  ]);
  return {
    reminders: { orders: reminderIds.length, ...reminders },
    preorders: { orders: preorderIds.length, ...preorders },
  };
}

/** "Enviar aviso de prueba" a este dispositivo, para confirmar que llega. */
export async function sendTestPush(
  endpoint: string,
  owner: SubscriptionOwner,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const config = pushConfig();
  if (!config) return { ok: false, message: "Los avisos no están configurados en este servidor." };
  const sub = await db().push_subscriptions.findFirst({
    where: { endpoint, ...ownerWhere(owner) },
    select: { id: true, endpoint: true, p256dh: true, auth: true, business_id: true },
  });
  if (!sub) return { ok: false, message: "Este dispositivo no tiene los avisos activados." };
  const staff = "staffMemberId" in owner;
  const result = await sendPush(
    sub,
    {
      title: "Avisos activados ✓",
      body: "Así te avisaremos de cada pedido nuevo, aunque tengas la app cerrada.",
      url: staff ? "/staff/pedidos" : `/panel/${sub.business_id}/pedidos`,
      tag: "test",
    } satisfies PushMessage,
    { ...config, ttlSec: 60 },
  ).catch((error: unknown) => {
    captureException(error, { tags: { feature: "web_push" } });
    return null;
  });
  if (result?.ok) {
    await db().push_subscriptions.update({
      where: { id: sub.id },
      data: { last_success_at: new Date() },
    });
    return { ok: true };
  }
  if (result && !result.ok && result.gone) {
    await db().push_subscriptions.delete({ where: { id: sub.id } });
    return { ok: false, message: "La suscripción venció. Vuelve a activar los avisos." };
  }
  return { ok: false, message: "El servicio de avisos no respondió. Probemos otra vez." };
}
