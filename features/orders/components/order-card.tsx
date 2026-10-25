"use client";

import { ChevronRightIcon, ClockIcon, MapPinIcon } from "lucide-react";
import Link from "next/link";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { formatQ } from "@/lib/money";
import { ORDER_TYPE_LABELS, PAY_METHOD_LABELS } from "../checkout";
import type { InboxOrder } from "../inbox";
import { scheduledLabel } from "../preorder";
import { ago, primaryAction, STATUS_LABELS, type OrderStatus } from "../status";
import { orderNumberLabel } from "../whatsapp";

export const STATUS_STYLES: Record<OrderStatus, string> = {
  new: "bg-primary text-primary-foreground",
  accepted: "bg-maiz text-frijol",
  preparing: "bg-maiz text-frijol",
  ready: "bg-success text-white",
  delivered: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground line-through",
};

/**
 * Tarjeta de un pedido en la bandeja (panel y staff): número, estado, tipo,
 * hora, cliente, resumen, total y el siguiente paso ("Aceptar", "Listo"…).
 */
export function OrderCard({
  order,
  href,
  showBranch,
  now,
  busy = false,
  onAdvance,
}: {
  order: Pick<
    InboxOrder,
    | "number"
    | "status"
    | "orderType"
    | "tableLabel"
    | "scheduledFor"
    | "createdAt"
    | "branch"
    | "address"
    | "customerName"
    | "summary"
    | "totalCents"
    | "payment"
  >;
  href: string;
  showBranch: boolean;
  /** Hora actual (null antes de hidratar: no se muestra "hace X min"). */
  now: Date | null;
  busy?: boolean;
  onAdvance?: (to: OrderStatus) => void;
}) {
  const next = primaryAction(order.status, order.orderType);
  return (
    <li
      className={cn(
        "grid gap-2 rounded-lg border bg-card p-4 shadow-1",
        order.status === "new" ? "border-primary ring-2 ring-primary/20" : "border-border",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <Link href={href} className="type-h3 hover:underline">
          {orderNumberLabel(order.number)}
        </Link>
        <span
          className={cn(
            "type-caption rounded-full px-2.5 py-1 font-semibold",
            STATUS_STYLES[order.status],
            order.status === "new" && "animate-latido",
          )}
        >
          {STATUS_LABELS[order.status]}
        </span>
      </div>
      <p className="type-small flex flex-wrap items-center gap-x-2 gap-y-1 text-muted-foreground">
        <span className="font-semibold text-foreground">
          {ORDER_TYPE_LABELS[order.orderType]}
          {order.orderType === "dine_in" && order.tableLabel ? ` · ${order.tableLabel}` : ""}
        </span>
        {order.scheduledFor ? (
          <span className="inline-flex items-center gap-1 font-semibold text-foreground">
            <ClockIcon aria-hidden className="size-3.5" />
            {scheduledLabel(new Date(order.scheduledFor).toISOString(), now ?? new Date(0))}
          </span>
        ) : null}
        {now ? <span>{ago(order.createdAt, now)}</span> : null}
        {showBranch ? <span>· {order.branch.name}</span> : null}
      </p>
      {order.orderType === "delivery" && order.address ? (
        <p className="type-small flex items-start gap-1 text-muted-foreground">
          <MapPinIcon aria-hidden className="mt-0.5 size-3.5 shrink-0" />
          <span className="line-clamp-1">{order.address}</span>
        </p>
      ) : null}
      <p className="type-body">
        <span className="font-semibold">{order.customerName}</span>
        <span className="line-clamp-2 text-muted-foreground">{order.summary}</span>
      </p>
      <div className="mt-1 flex items-center justify-between gap-2">
        <p className="type-small">
          <span className="type-price">{formatQ(order.totalCents)}</span>
          <span className="text-muted-foreground"> · {PAY_METHOD_LABELS[order.payment]}</span>
        </p>
        <div className="flex items-center gap-1">
          {next && onAdvance ? (
            <Button type="button" size="sm" loading={busy} onClick={() => onAdvance(next.to)}>
              {next.label}
            </Button>
          ) : null}
          <Button asChild variant="ghost" size="icon-sm" aria-label="Ver detalle">
            <Link href={href}>
              <ChevronRightIcon />
            </Link>
          </Button>
        </div>
      </div>
    </li>
  );
}
