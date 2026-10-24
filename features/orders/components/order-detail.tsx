"use client";

import { ArrowLeftIcon, MessageCircleIcon, PhoneIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { runAction } from "@/lib/action-client";
import { formatTimeGT, formatWhenGT, todayInGuatemala } from "@/lib/gt-time";
import { formatQ } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { ORDER_TYPE_LABELS, PAY_METHOD_LABELS } from "../checkout";
import type { OrderDetail as OrderDetailData } from "../inbox";
import { updateOrderStatusAction } from "../inbox-actions";
import { scheduledLabel } from "../preorder";
import { canTransition, primaryAction, STATUS_LABELS, type OrderStatus } from "../status";
import { orderNumberLabel } from "../whatsapp";
import { DeliveryInfo } from "./delivery-info";
import { STATUS_STYLES } from "./order-card";
import { LiveBadge } from "./order-inbox";
import { useOrdersRealtime } from "./use-orders-realtime";

/**
 * Detalle del pedido en el panel: el siguiente paso, cliente con "Llamar" y
 * "Responder por WhatsApp", productos, totales y, a domicilio, el mapa con
 * Google Maps, Waze y "Copiar coordenadas" para el repartidor.
 */
export function OrderDetail({
  businessId,
  order,
  backHref,
}: {
  businessId: string;
  order: OrderDetailData;
  backHref: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmCancel, setConfirmCancel] = useState(false);
  const live = useOrdersRealtime({
    businessId,
    branchIds: [order.branch.id],
    onInsert: () => {},
    onUpdate: (row) => {
      if (row.id === order.id) router.refresh();
    },
  });

  const createdAt = new Date(order.createdAt);
  const next = primaryAction(order.status, order.orderType);
  const customerChat = order.customer.phone
    ? `https://api.whatsapp.com/send?phone=${order.customer.phone.replace(/\D/g, "")}&text=${encodeURIComponent(
        `Hola ${order.customer.name}, te escribimos por tu pedido ${orderNumberLabel(order.number)}.`,
      )}`
    : null;

  function move(to: OrderStatus) {
    startTransition(async () => {
      const result = await runAction(() =>
        updateOrderStatusAction({ businessId, orderId: order.id, to }),
      );
      if (result.ok)
        toast.success(`${orderNumberLabel(order.number)}: ${STATUS_LABELS[to].toLowerCase()}.`);
      else toast.error(result.message);
      setConfirmCancel(false);
      router.refresh();
    });
  }

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href={backHref}>
            <ArrowLeftIcon />
            Pedidos
          </Link>
        </Button>
        <LiveBadge state={live} />
      </div>

      <header className="grid gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="type-h1">{orderNumberLabel(order.number)}</h1>
          <span
            className={cn(
              "type-small rounded-full px-3 py-1 font-semibold",
              STATUS_STYLES[order.status],
            )}
          >
            {STATUS_LABELS[order.status]}
          </span>
        </div>
        <p className="type-body text-muted-foreground">
          {ORDER_TYPE_LABELS[order.orderType]}
          {order.orderType === "dine_in" && order.tableLabel ? ` · ${order.tableLabel}` : ""}
          {" · "}
          {order.scheduledFor
            ? `Programado para ${scheduledLabel(new Date(order.scheduledFor).toISOString())}`
            : "Lo antes posible"}
          {" · "}
          {order.branch.name} ·{" "}
          {todayInGuatemala(createdAt) === todayInGuatemala()
            ? `pedido a las ${formatTimeGT(createdAt)}`
            : `pedido el ${formatWhenGT(createdAt)}`}
        </p>
        {!order.whatsappOpened ? (
          <p className="type-small text-muted-foreground">
            El cliente todavía no abrió WhatsApp con este pedido.
          </p>
        ) : null}
      </header>

      {next || canTransition(order.status, "cancelled") ? (
        <div className="flex flex-wrap gap-2">
          {next ? (
            <Button type="button" size="lg" loading={pending} onClick={() => move(next.to)}>
              {next.label}
            </Button>
          ) : null}
          {canTransition(order.status, "cancelled") ? (
            confirmCancel ? (
              <>
                <Button
                  type="button"
                  variant="destructive"
                  size="lg"
                  disabled={pending}
                  onClick={() => move("cancelled")}
                >
                  Sí, cancelar pedido
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="lg"
                  onClick={() => setConfirmCancel(false)}
                >
                  No
                </Button>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="lg"
                onClick={() => setConfirmCancel(true)}
              >
                Cancelar
              </Button>
            )
          ) : null}
        </div>
      ) : null}

      <section className="grid gap-2 rounded-lg border border-border bg-card p-4">
        <h2 className="type-h3">{order.customer.name}</h2>
        {order.customer.phone ? (
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" size="sm">
              <a href={`tel:${order.customer.phone}`}>
                <PhoneIcon />
                {formatPhone(order.customer.phone)}
              </a>
            </Button>
            {customerChat ? (
              <Button asChild variant="whatsapp" size="sm">
                <a href={customerChat} target="_blank" rel="noopener noreferrer">
                  <MessageCircleIcon />
                  Responder por WhatsApp
                </a>
              </Button>
            ) : null}
          </div>
        ) : (
          <p className="type-small text-muted-foreground">Sin teléfono: escribió por WhatsApp.</p>
        )}
        {order.customer.email ? (
          <p className="type-small text-muted-foreground">{order.customer.email}</p>
        ) : null}
      </section>

      {order.orderType === "delivery" ? (
        <DeliveryInfo
          address={order.address}
          addressReference={order.addressReference}
          location={order.location}
        />
      ) : null}

      <section className="grid gap-3 rounded-lg border border-border bg-card p-4">
        <h2 className="type-h3">Productos</h2>
        <ul className="grid gap-2">
          {order.items.map((item) => (
            <li key={item.id} className="flex justify-between gap-3">
              <div>
                <p className="type-body font-semibold">
                  {item.quantity}× {item.name}
                </p>
                {item.options.map((o) => (
                  <p key={`${o.group}-${o.name}`} className="type-small text-muted-foreground">
                    {o.deltaCents > 0
                      ? `${o.name} (+${formatQ(o.deltaCents)})`
                      : `${o.group}: ${o.name}`}
                  </p>
                ))}
                {item.note ? <p className="type-small font-semibold">📝 {item.note}</p> : null}
              </div>
              <span className="type-body tabular-nums">{formatQ(item.lineCents)}</span>
            </li>
          ))}
        </ul>
        {order.note ? (
          <p className="type-body rounded-md bg-maiz/20 p-3">
            <strong>Nota:</strong> {order.note}
          </p>
        ) : null}
        <dl className="type-body grid gap-1 border-t border-border pt-3">
          {order.deliveryFeeCents > 0 ? (
            <>
              <div className="flex justify-between">
                <dt>Subtotal</dt>
                <dd className="tabular-nums">{formatQ(order.subtotalCents)}</dd>
              </div>
              <div className="flex justify-between">
                <dt>Envío</dt>
                <dd className="tabular-nums">{formatQ(order.deliveryFeeCents)}</dd>
              </div>
            </>
          ) : null}
          <div className="type-h3 flex justify-between">
            <dt>Total</dt>
            <dd className="tabular-nums">{formatQ(order.totalCents)}</dd>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <dt>Pago</dt>
            <dd>{PAY_METHOD_LABELS[order.payment]}</dd>
          </div>
        </dl>
      </section>

      <section className="grid gap-2">
        <h2 className="type-h3">Historial</h2>
        <ol className="grid gap-1">
          {order.events.map((e, i) => (
            <li key={i} className="type-small flex gap-3 text-muted-foreground">
              <span className="shrink-0 whitespace-nowrap tabular-nums">
                {formatWhenGT(new Date(e.at))}
              </span>
              <span className="font-semibold text-foreground">{STATUS_LABELS[e.status]}</span>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
