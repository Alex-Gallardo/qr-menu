import { ORDER_TYPE_LABELS, type OrderType } from "@/features/orders/checkout";
import { scheduledLabel } from "@/features/orders/preorder";
import { orderNumberLabel } from "@/features/orders/whatsapp";
import { formatQ } from "@/lib/money";

/**
 * Avisos push de pedidos (guía §6 Paso 3), como funciones puras: textos, a
 * quién le llega cada aviso y a dónde lleva al tocarlo.
 */

/** Escalamiento: si sigue "nuevo", se repite cada 3 min, hasta 3 veces. */
export const REMINDER_EVERY_MIN = 3;
export const MAX_REMINDERS = 3;
/** Pedidos más viejos ya no se escalan (p. ej. al activar el cron con pedidos olvidados). */
export const REMINDER_WINDOW_MIN = 30;
/** Programados: otro aviso 30 min antes de la hora. */
export const PREORDER_LEAD_MIN = 30;

export type PushOrder = {
  id: string;
  businessId: string;
  branchId: string;
  branchName: string;
  number: number;
  totalCents: number;
  customerName: string;
  orderType: OrderType;
  tableLabel: string | null;
  scheduledFor: Date | null;
};

export type PushRecipientKind = "user" | "staff";

/** Lo que recibe el service worker (public/sw.js). */
export type PushMessage = {
  title: string;
  body: string;
  /** Detalle del pedido: en el panel o en /staff/pedidos según quién lo recibe. */
  url: string;
  /** Un aviso del mismo pedido reemplaza al anterior (y vuelve a sonar). */
  tag: string;
};

/** "María · A domicilio · Zona 10" (+ mesa o la hora si es programado). */
export function orderSummary(order: PushOrder, now: Date = new Date()) {
  const parts = [order.customerName, ORDER_TYPE_LABELS[order.orderType]];
  if (order.orderType === "dine_in" && order.tableLabel) parts.push(`Mesa ${order.tableLabel}`);
  parts.push(order.branchName);
  if (order.scheduledFor)
    parts.push(`Para ${scheduledLabel(order.scheduledFor.toISOString(), now)}`);
  return parts.join(" · ");
}

export function orderUrl(kind: PushRecipientKind, order: Pick<PushOrder, "id" | "businessId">) {
  return kind === "staff"
    ? `/staff/pedidos/${order.id}`
    : `/panel/${order.businessId}/pedidos/${order.id}`;
}

type Text = Omit<PushMessage, "url">;

/** "Nuevo pedido #0042 · Q131.00" / "María · A domicilio · Zona 10". */
export function newOrderText(order: PushOrder, now: Date = new Date()): Text {
  const kind = order.scheduledFor ? "Pedido programado" : "Nuevo pedido";
  return {
    title: `${kind} ${orderNumberLabel(order.number)} · ${formatQ(order.totalCents)}`,
    body: orderSummary(order, now),
    tag: `order-${order.id}`,
  };
}

/** "#0042 sigue esperando" (escalamiento n de 3). */
export function reminderText(order: PushOrder, now: Date = new Date()): Text {
  return {
    title: `${orderNumberLabel(order.number)} sigue esperando`,
    body: `${orderSummary(order, now)} · ${formatQ(order.totalCents)}. Tócalo para aceptarlo.`,
    tag: `order-${order.id}`,
  };
}

/** "Programado #0042 en 30 min" (30 min antes de la hora). */
export function preorderText(order: PushOrder, now: Date = new Date()): Text {
  return {
    title: `Programado ${orderNumberLabel(order.number)} en ${PREORDER_LEAD_MIN} min`,
    body: orderSummary(order, now),
    tag: `order-${order.id}`,
  };
}

/** Servicios de push de los navegadores. Evita que el servidor haga POST a cualquier URL. */
const PUSH_HOSTS = [
  "fcm.googleapis.com", // Chrome, Edge Android, Samsung, Opera
  "push.services.mozilla.com", // Firefox
  "push.apple.com", // Safari / iPhone con la app instalada
  "notify.windows.com", // Edge en Windows
];

export function isPushEndpoint(endpoint: string) {
  try {
    const url = new URL(endpoint);
    if (url.protocol !== "https:" || url.port) return false;
    return PUSH_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

/** Suscripción con lo necesario para decidir si le toca un aviso. */
export type SubscriptionAudience = {
  /** null = todas (las del dueño, o todas las asignadas al encargado). */
  branchId: string | null;
  member: { role: "owner" | "manager"; allBranches: boolean; branchIds: string[] } | null;
  staff: { branchId: string; active: boolean } | null;
};

/**
 * ¿Este dispositivo recibe el aviso de un pedido de esta sucursal?
 * - Dueño o encargado: debe seguir en el negocio y ver esa sucursal; si eligió
 *   una sucursal en Ajustes → Notificaciones, solo esa.
 * - Staff: activo y de esa sucursal.
 */
export function receives(sub: SubscriptionAudience, branchId: string) {
  if (sub.staff) return sub.staff.active && sub.staff.branchId === branchId;
  if (!sub.member) return false;
  const sees =
    sub.member.role === "owner" ||
    sub.member.allBranches ||
    sub.member.branchIds.includes(branchId);
  return sees && (sub.branchId === null || sub.branchId === branchId);
}

/** Etiqueta corta del dispositivo para la lista ("Chrome en Android", "iPhone"). */
export function deviceLabel(userAgent: string | null | undefined) {
  const ua = userAgent ?? "";
  const os = /iPhone|iPad|iPod/.test(ua)
    ? "iPhone"
    : /Android/.test(ua)
      ? "Android"
      : /Windows/.test(ua)
        ? "Windows"
        : /Mac OS X|Macintosh/.test(ua)
          ? "Mac"
          : /Linux/.test(ua)
            ? "Linux"
            : null;
  const browser = /EdgA?\//.test(ua)
    ? "Edge"
    : /SamsungBrowser/.test(ua)
      ? "Samsung Internet"
      : /Firefox|FxiOS/.test(ua)
        ? "Firefox"
        : /Chrome|CriOS/.test(ua)
          ? "Chrome"
          : /Safari/.test(ua)
            ? "Safari"
            : null;
  if (os === "iPhone") return "iPhone";
  if (browser && os) return `${browser} en ${os}`;
  return browser ?? os ?? "Dispositivo";
}
