"use client";

import { BellIcon, BellOffIcon, ChevronRightIcon, ClockIcon, MapPinIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { useNowMinute } from "@/features/public-menu/use-now";
import { formatQ } from "@/lib/money";
import { ORDER_TYPE_LABELS, PAY_METHOD_LABELS, type OrderType } from "../checkout";
import type { InboxOrder } from "../inbox";
import { updateOrderStatusAction } from "../inbox-actions";
import { scheduledLabel } from "../preorder";
import {
  ago,
  INBOX_FILTERS,
  matchesFilter,
  primaryAction,
  STATUS_LABELS,
  type InboxFilter,
  type OrderStatus,
} from "../status";
import { orderNumberLabel } from "../whatsapp";
import { blinkTitle, playChime, soundReady, unlockSound, vibrate } from "./order-alert";
import { useOrdersRealtime, type OrderRow, type RealtimeState } from "./use-orders-realtime";

export const STATUS_STYLES: Record<OrderStatus, string> = {
  new: "bg-primary text-primary-foreground",
  accepted: "bg-maiz text-frijol",
  preparing: "bg-maiz text-frijol",
  ready: "bg-success text-white",
  delivered: "bg-muted text-muted-foreground",
  cancelled: "bg-muted text-muted-foreground line-through",
};

const TYPE_FILTERS: { value: OrderType | "todos"; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "dine_in", label: "Comer aquí" },
  { value: "takeout", label: "Para llevar" },
  { value: "delivery", label: "A domicilio" },
];

/**
 * Bandeja de pedidos en tiempo real (panel). Un pedido nuevo aparece solo,
 * suena, vibra y el título parpadea hasta que alguien lo acepta. Cada tarjeta
 * tiene el siguiente paso como botón grande.
 */
export function OrderInbox({
  businessId,
  branchIds,
  showBranch,
  branches,
  orders: serverOrders,
  detailBase,
}: {
  businessId: string;
  branchIds: string[];
  showBranch: boolean;
  branches: { id: string; name: string }[];
  orders: InboxOrder[];
  /** Ruta del detalle: el panel o la bandeja del staff (/staff/pedidos). */
  detailBase?: string;
}) {
  const router = useRouter();
  const now = useNowMinute();
  const [filter, setFilter] = useState<InboxFilter>("activos");
  const [type, setType] = useState<OrderType | "todos">("todos");
  const [sound, setSound] = useState(false);
  const [pending, startTransition] = useTransition();
  const [busyId, setBusyId] = useState<string | null>(null);
  // Pedidos recién llegados por Realtime: se dibujan al instante con los datos
  // de la fila y los productos llegan con el refresco del servidor.
  const [incoming, setIncoming] = useState<InboxOrder[]>([]);
  // Cambios de estado ya confirmados por el servidor, mientras llega la lista
  // nueva: solo se aplican si la lista sigue en el estado anterior.
  const [moved, setMoved] = useState<Record<string, { from: OrderStatus; to: OrderStatus }>>({});
  const serverIds = new Set(serverOrders.map((o) => o.id));
  const orders = [...incoming.filter((o) => !serverIds.has(o.id)), ...serverOrders].map((o) =>
    moved[o.id]?.from === o.status ? { ...o, status: moved[o.id]!.to } : o,
  );

  const live = useOrdersRealtime({
    businessId,
    branchIds,
    onInsert: (row) => {
      setIncoming((list) => [fromRow(row, branches), ...list.filter((o) => o.id !== row.id)]);
      playChime();
      vibrate();
      toast(`Nuevo pedido ${orderNumberLabel(row.number)} · ${formatQ(row.total_cents)}`, {
        duration: 8000,
      });
      router.refresh();
    },
    onUpdate: () => router.refresh(),
  });

  // El primer toque en la página activa el sonido (regla de los navegadores).
  useEffect(() => {
    const unlock = () => {
      if (unlockSound()) setSound(true);
    };
    window.addEventListener("pointerdown", unlock, { once: true });
    return () => window.removeEventListener("pointerdown", unlock);
  }, []);

  const newCount = orders.filter((o) => o.status === "new").length;
  useEffect(() => blinkTitle(newCount), [newCount]);

  const clock = now ?? new Date(0);
  const counts = Object.fromEntries(
    INBOX_FILTERS.map((f) => [
      f.value,
      orders.filter((o) => matchesFilter(o, f.value, clock)).length,
    ]),
  ) as Record<InboxFilter, number>;
  const shown = orders.filter(
    (o) => matchesFilter(o, filter, clock) && (type === "todos" || o.orderType === type),
  );

  // Optimista: la tarjeta cambia al tocar; si el servidor lo rechaza, vuelve.
  function move(order: InboxOrder, to: OrderStatus) {
    const change = { from: order.status, to };
    setMoved((m) => ({ ...m, [order.id]: change }));
    setBusyId(order.id);
    startTransition(async () => {
      const result = await updateOrderStatusAction({ businessId, orderId: order.id, to });
      if (result.ok) {
        toast.success(`${orderNumberLabel(order.number)}: ${STATUS_LABELS[to].toLowerCase()}.`);
      } else {
        setMoved((m) => Object.fromEntries(Object.entries(m).filter(([id]) => id !== order.id)));
        toast.error(result.message);
      }
      router.refresh();
      setBusyId(null);
    });
  }

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <LiveBadge state={live} />
        <Button
          type="button"
          variant={sound ? "ghost" : "outline"}
          size="sm"
          onClick={() => {
            const ok = unlockSound() || soundReady();
            setSound(ok);
            if (ok) playChime();
          }}
        >
          {sound ? <BellIcon /> : <BellOffIcon />}
          {sound ? "Sonido activado" : "Activar sonido"}
        </Button>
      </div>

      <div role="tablist" aria-label="Estado" className="flex gap-1 overflow-x-auto">
        {INBOX_FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className="type-small h-10 shrink-0 rounded-full border border-border bg-card px-4 font-semibold aria-selected:border-primary aria-selected:bg-primary aria-selected:text-primary-foreground"
          >
            {f.label}
            {counts[f.value] > 0 ? (
              <span className="ml-1.5 tabular-nums opacity-80">{counts[f.value]}</span>
            ) : null}
          </button>
        ))}
      </div>
      <div role="group" aria-label="Tipo" className="flex gap-1 overflow-x-auto">
        {TYPE_FILTERS.map((t) => (
          <button
            key={t.value}
            type="button"
            aria-pressed={type === t.value}
            onClick={() => setType(t.value)}
            className="type-caption h-9 shrink-0 rounded-full px-3 font-semibold text-muted-foreground aria-pressed:bg-secondary aria-pressed:text-foreground"
          >
            {t.label}
          </button>
        ))}
      </div>

      {shown.length === 0 ? (
        <p className="type-body rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
          {filter === "activos"
            ? "No hay pedidos activos. Cuando llegue uno, aparece aquí y suena."
            : "No hay pedidos aquí."}
        </p>
      ) : (
        <ul className="grid gap-3 md:grid-cols-2">
          {shown.map((order) => {
            const next = primaryAction(order.status, order.orderType);
            const detail = `${detailBase ?? `/panel/${businessId}/pedidos`}/${order.id}`;
            return (
              <li
                key={order.id}
                className={cn(
                  "grid gap-2 rounded-lg border bg-card p-4 shadow-1",
                  order.status === "new"
                    ? "border-primary ring-2 ring-primary/20"
                    : "border-border",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <Link href={detail} className="type-h3 hover:underline">
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
                    {order.orderType === "dine_in" && order.tableLabel
                      ? ` · ${order.tableLabel}`
                      : ""}
                  </span>
                  {order.scheduledFor ? (
                    <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                      <ClockIcon aria-hidden className="size-3.5" />
                      {scheduledLabel(new Date(order.scheduledFor).toISOString(), clock)}
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
                    <span className="text-muted-foreground">
                      {" "}
                      · {PAY_METHOD_LABELS[order.payment]}
                    </span>
                  </p>
                  <div className="flex items-center gap-1">
                    {next ? (
                      <Button
                        type="button"
                        size="sm"
                        loading={pending && busyId === order.id}
                        onClick={() => move(order, next.to)}
                      >
                        {next.label}
                      </Button>
                    ) : null}
                    <Button asChild variant="ghost" size="icon-sm" aria-label="Ver detalle">
                      <Link href={detail}>
                        <ChevronRightIcon />
                      </Link>
                    </Button>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Tarjeta provisional con la fila de Realtime (sin productos todavía). */
function fromRow(row: OrderRow, branches: { id: string; name: string }[]): InboxOrder {
  return {
    id: row.id,
    number: row.number,
    status: row.status as OrderStatus,
    orderType: row.order_type as OrderType,
    tableLabel: row.table_label,
    scheduledFor: row.scheduled_for ? new Date(row.scheduled_for) : null,
    customerName: row.customer_name,
    totalCents: row.total_cents,
    payment: row.payment_method as InboxOrder["payment"],
    address: row.address,
    createdAt: new Date(row.created_at),
    branch: { id: row.branch_id, name: branches.find((b) => b.id === row.branch_id)?.name ?? "" },
    summary: "Cargando productos…",
  };
}

export function LiveBadge({ state }: { state: RealtimeState }) {
  return (
    <p role="status" className="type-small inline-flex items-center gap-2 font-semibold">
      <span
        aria-hidden
        className={cn(
          "size-2.5 rounded-full",
          state === "live"
            ? "animate-latido bg-success"
            : state === "offline"
              ? "bg-destructive"
              : "bg-maiz",
        )}
      />
      {state === "live"
        ? "En vivo"
        : state === "offline"
          ? "Sin conexión: reintentando…"
          : "Conectando…"}
    </p>
  );
}
