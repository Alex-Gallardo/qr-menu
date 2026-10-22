import "server-only";
import { normalizeTheme } from "@/features/public-menu/theme";
import { BRAND } from "@/lib/brand";
import { db } from "@/lib/db";
import type { OrderType, PayMethod } from "./checkout";
import { buildWhatsAppMessage, whatsappUrl, type MessageOrder } from "./whatsapp";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const ORDER_STATUS_LABELS = {
  new: "Recibido",
  accepted: "Aceptado",
  preparing: "En preparación",
  ready: "Listo",
  delivered: "Entregado",
  cancelled: "Cancelado",
} as const;

export const orderPath = (businessSlug: string, branchSlug: string, orderId: string) =>
  `/${businessSlug}/${branchSlug}/pedido/${orderId}`;

/**
 * Pedido para la página de confirmación del comensal. El id (UUID) es el
 * secreto del link: no se puede adivinar. Debe ser de ese negocio y sucursal.
 */
export async function getCustomerOrder(businessSlug: string, branchSlug: string, orderId: string) {
  if (!UUID.test(orderId)) return null;
  const order = await db().orders.findUnique({
    where: { id: orderId },
    select: {
      id: true,
      number: true,
      status: true,
      customer_name: true,
      customer_phone: true,
      customer_email: true,
      order_type: true,
      table_label: true,
      scheduled_for: true,
      address: true,
      address_reference: true,
      delivery_lat: true,
      delivery_lng: true,
      delivery_accuracy_m: true,
      payment_method: true,
      notes: true,
      subtotal_cents: true,
      delivery_fee_cents: true,
      total_cents: true,
      created_at: true,
      items: {
        orderBy: { id: "asc" },
        select: {
          name_snapshot: true,
          quantity: true,
          line_total_cents: true,
          options_snapshot: true,
          notes: true,
        },
      },
      branch: { select: { id: true, slug: true, name: true, whatsapp_e164: true } },
      business: {
        select: {
          id: true,
          slug: true,
          name: true,
          logo_url: true,
          whatsapp_greeting: true,
          whatsapp_farewell: true,
          theme: {
            select: {
              color_primary: true,
              color_accent: true,
              color_bg: true,
              color_surface: true,
              color_text: true,
              radius: true,
              show_powered_by: true,
            },
          },
        },
      },
    },
  });
  if (!order || order.business.slug !== businessSlug || order.branch.slug !== branchSlug)
    return null;

  const bankAccounts =
    order.payment_method === "transfer"
      ? await db().bank_accounts.findMany({
          where: {
            business_id: order.business.id,
            is_active: true,
            OR: [{ branch_id: null }, { branch_id: order.branch.id }],
          },
          orderBy: [{ branch_id: { sort: "asc", nulls: "last" } }, { sort: "asc" }],
          select: {
            id: true,
            bank_name: true,
            account_type: true,
            account_number: true,
            holder_name: true,
            instructions: true,
          },
        })
      : [];

  const items = order.items.map((i) => ({
    name: i.name_snapshot,
    quantity: i.quantity,
    lineCents: i.line_total_cents,
    options: Array.isArray(i.options_snapshot)
      ? (i.options_snapshot as { group: string; name: string; deltaCents: number }[])
      : [],
    note: i.notes,
  }));
  const path = orderPath(order.business.slug, order.branch.slug, order.id);
  const messageOrder: MessageOrder = {
    number: order.number,
    businessName: order.business.name,
    branchName: order.branch.name,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    orderType: order.order_type as OrderType,
    tableLabel: order.table_label,
    scheduledFor: order.scheduled_for,
    items,
    subtotalCents: order.subtotal_cents,
    deliveryFeeCents: order.delivery_fee_cents,
    totalCents: order.total_cents,
    payment: order.payment_method as PayMethod,
    bankName: bankAccounts[0]?.bank_name ?? null,
    address: order.address,
    addressReference: order.address_reference,
    location:
      order.delivery_lat !== null && order.delivery_lng !== null
        ? { lat: order.delivery_lat, lng: order.delivery_lng, accuracyM: order.delivery_accuracy_m }
        : null,
    note: order.notes,
    detailUrl: new URL(path, BRAND.url).toString(),
    greeting: order.business.whatsapp_greeting,
    farewell: order.business.whatsapp_farewell,
  };
  const message = buildWhatsAppMessage(messageOrder);

  return {
    id: order.id,
    number: order.number,
    status: order.status,
    statusLabel: ORDER_STATUS_LABELS[order.status],
    createdAt: order.created_at,
    hasEmail: Boolean(order.customer_email),
    order: messageOrder,
    business: {
      slug: order.business.slug,
      name: order.business.name,
      logoUrl: order.business.logo_url,
      theme: normalizeTheme(order.business.theme),
    },
    branch: {
      slug: order.branch.slug,
      name: order.branch.name,
      whatsapp: order.branch.whatsapp_e164,
    },
    bankAccounts: bankAccounts.map((a) => ({
      id: a.id,
      bankName: a.bank_name,
      accountType: a.account_type,
      accountNumber: a.account_number,
      holderName: a.holder_name,
      instructions: a.instructions,
    })),
    message,
    whatsappUrl: whatsappUrl(order.branch.whatsapp_e164, message),
  };
}

export type CustomerOrder = NonNullable<Awaited<ReturnType<typeof getCustomerOrder>>>;

/** El comensal tocó "Pedir por WhatsApp" (o reenviar): se guarda la primera vez. */
export async function markWhatsAppOpened(orderId: string) {
  if (!UUID.test(orderId)) return;
  await db().orders.updateMany({
    where: { id: orderId, whatsapp_opened_at: null },
    data: { whatsapp_opened_at: new Date() },
  });
}
