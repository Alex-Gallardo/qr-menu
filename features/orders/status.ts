import type { OrderType } from "./checkout";

/**
 * Estados del pedido (puro): nuevo → aceptado → en preparación → listo →
 * entregado, o cancelado mientras no se haya entregado. La bandeja muestra el
 * siguiente paso como botón grande; el servidor valida la transición.
 */

export type OrderStatus = "new" | "accepted" | "preparing" | "ready" | "delivered" | "cancelled";

export const STATUS_LABELS: Record<OrderStatus, string> = {
  new: "Nuevo",
  accepted: "Aceptado",
  preparing: "En preparación",
  ready: "Listo",
  delivered: "Entregado",
  cancelled: "Cancelado",
};

const NEXT: Record<OrderStatus, OrderStatus[]> = {
  new: ["accepted", "cancelled"],
  accepted: ["preparing", "ready", "cancelled"],
  preparing: ["ready", "cancelled"],
  ready: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

export const ACTIVE_STATUSES: OrderStatus[] = ["new", "accepted", "preparing", "ready"];

export const canTransition = (from: OrderStatus, to: OrderStatus) => NEXT[from].includes(to);

export const isFinal = (status: OrderStatus) => NEXT[status].length === 0;

/** Botón principal de la tarjeta: "Aceptar", "Empezar a preparar", "Listo", "Entregado". */
export function primaryAction(
  status: OrderStatus,
  type: OrderType,
): { to: OrderStatus; label: string } | null {
  switch (status) {
    case "new":
      return { to: "accepted", label: "Aceptar" };
    case "accepted":
      return { to: "preparing", label: "Empezar a preparar" };
    case "preparing":
      return { to: "ready", label: type === "delivery" ? "Listo para enviar" : "Listo" };
    case "ready":
      return { to: "delivered", label: type === "dine_in" ? "Servido" : "Entregado" };
    default:
      return null;
  }
}

export type InboxFilter = "activos" | "programados" | "entregados" | "cancelados";

export const INBOX_FILTERS: { value: InboxFilter; label: string }[] = [
  { value: "activos", label: "Activos" },
  { value: "programados", label: "Programados" },
  { value: "entregados", label: "Entregados" },
  { value: "cancelados", label: "Cancelados" },
];

/** ¿El pedido entra en este filtro? Programados = activos con hora a futuro. */
export function matchesFilter(
  order: { status: OrderStatus; scheduledFor: Date | string | null },
  filter: InboxFilter,
  now: Date,
) {
  const scheduledAhead =
    order.scheduledFor !== null && new Date(order.scheduledFor).getTime() > now.getTime();
  switch (filter) {
    case "activos":
      return ACTIVE_STATUSES.includes(order.status) && !scheduledAhead;
    case "programados":
      return ACTIVE_STATUSES.includes(order.status) && scheduledAhead;
    case "entregados":
      return order.status === "delivered";
    case "cancelados":
      return order.status === "cancelled";
  }
}

/** "hace 3 min", "hace 1 h", "hace 2 días". */
export function ago(date: Date | string, now: Date) {
  const minutes = Math.max(0, Math.floor((now.getTime() - new Date(date).getTime()) / 60_000));
  if (minutes < 1) return "ahora";
  if (minutes < 60) return `hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `hace ${hours} h`;
  const days = Math.floor(hours / 24);
  return `hace ${days} ${days === 1 ? "día" : "días"}`;
}
