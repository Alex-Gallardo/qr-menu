import { mapLinks } from "@/features/location/lib/coords";
import { formatQ } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { PAY_METHOD_LABELS, ORDER_TYPE_LABELS, type OrderType, type PayMethod } from "./checkout";
import { scheduledLabel } from "./preorder";

/**
 * Mensaje de WhatsApp del pedido (puro), con el formato de la guía. Lo envía
 * el comensal con wa.me al WhatsApp de la sucursal; el negocio puede poner su
 * saludo y despedida. Se mantiene por debajo de ~1,500 caracteres: si el
 * pedido es enorme, se resume y queda el link al detalle.
 */

export const MAX_MESSAGE = 1500;

export type MessageOrder = {
  number: number;
  businessName: string;
  branchName: string;
  customerName: string;
  customerPhone: string | null;
  orderType: OrderType;
  tableLabel: string | null;
  scheduledFor: Date | null;
  items: {
    name: string;
    quantity: number;
    lineCents: number;
    options: { group: string; name: string; deltaCents: number }[];
    note: string | null;
  }[];
  subtotalCents: number;
  deliveryFeeCents: number;
  totalCents: number;
  payment: PayMethod;
  /** Banco de la primera cuenta, para "Transferencia (Banco Industrial)". */
  bankName: string | null;
  address: string | null;
  addressReference: string | null;
  location: { lat: number; lng: number; accuracyM: number | null } | null;
  note: string | null;
  detailUrl: string;
  greeting: string | null;
  farewell: string | null;
};

export const orderNumberLabel = (n: number) => `#${String(n).padStart(4, "0")}`;

const TYPE_ICON: Record<OrderType, string> = { dine_in: "🍽️", takeout: "🥡", delivery: "🛵" };

function itemLines(item: MessageOrder["items"][number], withOptions: boolean) {
  const lines = [`${item.quantity}× ${item.name} — ${formatQ(item.lineCents)}`];
  if (withOptions) {
    for (const o of item.options)
      lines.push(
        o.deltaCents > 0
          ? `   • ${o.name} (+${formatQ(o.deltaCents)})`
          : `   • ${o.group}: ${o.name}`,
      );
    if (item.note) lines.push(`   📝 ${item.note}`);
  }
  return lines;
}

export function buildWhatsAppMessage(order: MessageOrder, now: Date = new Date()) {
  const when = order.scheduledFor
    ? `Programado para ${scheduledLabel(order.scheduledFor.toISOString(), now)}`
    : "Lo antes posible";
  const type = [
    ORDER_TYPE_LABELS[order.orderType],
    order.orderType === "dine_in" && order.tableLabel ? order.tableLabel : null,
    when,
  ]
    .filter(Boolean)
    .join(" · ");

  const head = [
    order.greeting?.trim() || null,
    `🧾 *Pedido ${orderNumberLabel(order.number)}* — ${order.businessName} · ${order.branchName}`,
    `👤 ${order.customerName}${order.customerPhone ? ` · ${formatPhone(order.customerPhone)}` : ""}`,
    `${order.scheduledFor ? "🕒" : TYPE_ICON[order.orderType]} ${type}`,
  ].filter((l): l is string => l !== null);

  const totals = [
    ...(order.deliveryFeeCents > 0
      ? [`Subtotal: ${formatQ(order.subtotalCents)}`, `Envío: ${formatQ(order.deliveryFeeCents)}`]
      : []),
    `*Total: ${formatQ(order.totalCents)}*`,
    `💳 Pago: ${PAY_METHOD_LABELS[order.payment]}${order.payment === "transfer" && order.bankName ? ` (${order.bankName})` : ""}`,
  ];

  const where: string[] = [];
  if (order.orderType === "delivery") {
    if (order.address) where.push(`📍 ${order.address}`);
    if (order.addressReference) where.push(`Referencia: ${order.addressReference}`);
    if (order.location) {
      const links = mapLinks(order.location);
      where.push(`Google Maps: ${links.google}`, `Waze: ${links.waze}`);
      if (order.location.accuracyM !== null)
        where.push(`(precisión ±${Math.round(order.location.accuracyM)} m)`);
    }
  }

  const tail = [
    ...(order.note ? [`📝 Nota: ${order.note}`] : []),
    `Detalle: ${order.detailUrl}`,
    ...(order.farewell?.trim() ? [order.farewell.trim()] : []),
  ];

  const compose = (items: string[]) =>
    [head.join("\n"), items.join("\n"), totals.join("\n"), where.join("\n"), tail.join("\n")]
      .filter((block) => block.length > 0)
      .join("\n\n");

  // Completo; si no cabe, sin opciones; si aún no cabe, los primeros y "… y N más".
  const full = compose(order.items.flatMap((i) => itemLines(i, true)));
  if (full.length <= MAX_MESSAGE) return full;
  const compact = compose(order.items.flatMap((i) => itemLines(i, false)));
  if (compact.length <= MAX_MESSAGE) return compact;
  for (let shown = order.items.length - 1; shown >= 1; shown--) {
    const rest = order.items.slice(shown).reduce((n, i) => n + i.quantity, 0);
    const text = compose([
      ...order.items.slice(0, shown).flatMap((i) => itemLines(i, false)),
      `… y ${rest} ${rest === 1 ? "producto" : "productos"} más (mira el detalle)`,
    ]);
    if (text.length <= MAX_MESSAGE) return text;
  }
  return compact.slice(0, MAX_MESSAGE);
}

/**
 * Link para abrir el chat de la sucursal con el mensaje. Se usa
 * api.whatsapp.com/send y no wa.me: la redirección de wa.me convierte los
 * emojis (🧾 🛵 💳) en "�" (comprobado en el navegador). En el celular este
 * link también abre la app de WhatsApp.
 */
export function whatsappUrl(e164: string, text: string) {
  return `https://api.whatsapp.com/send?phone=${e164.replace(/\D/g, "")}&text=${encodeURIComponent(text)}`;
}
