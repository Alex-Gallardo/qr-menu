"use client";

import { ArrowLeftIcon, CheckIcon, CopyIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { useEffect, type CSSProperties } from "react";
import { toast } from "sonner";
import { markWhatsAppOpenedAction } from "@/features/orders/actions";
import { ORDER_TYPE_LABELS, PAY_METHOD_LABELS } from "@/features/orders/checkout";
import { scheduledLabel } from "@/features/orders/preorder";
import { orderNumberLabel, type MessageOrder } from "@/features/orders/whatsapp";
import { formatQ } from "@/lib/money";
import { formatPhone } from "@/lib/phone";
import { BankAccounts, type BankAccount } from "./bank-accounts";

// Confeti ligero: 14 papelitos con posición, giro y retraso fijos (sin azar en el render).
const CONFETTI = Array.from({ length: 14 }, (_, i) => ({
  x: ((i * 37) % 100) - 50,
  r: (i * 53) % 360,
  d: (i % 5) * 60,
  c: i % 3,
}));

/**
 * Confirmación del pedido (plantilla Clásico): check animado con confeti,
 * número, estado y resumen. Llega con ?enviar=1 justo después de pedir: abre
 * WhatsApp con el mensaje y, al regresar, el comensal ya está aquí. Si
 * WhatsApp no se abrió: "Reenviar por WhatsApp", WhatsApp Web o "Copiar pedido".
 */
export function OrderConfirmation({
  orderId,
  status,
  statusLabel,
  order,
  branchWhatsapp,
  message,
  whatsappUrl,
  bankAccounts,
  menuHref,
  emailNotice,
}: {
  orderId: string;
  status: string;
  statusLabel: string;
  order: MessageOrder;
  branchWhatsapp: string;
  message: string;
  whatsappUrl: string;
  bankAccounts: BankAccount[];
  menuHref: string;
  /** Dejó su correo y el envío está activo: "Te enviamos el resumen a tu correo". */
  emailNotice: boolean;
}) {
  const webUrl = `https://web.whatsapp.com/send?phone=${branchWhatsapp.replace(/\D/g, "")}&text=${encodeURIComponent(message)}`;

  function openWhatsApp() {
    void markWhatsAppOpenedAction(orderId);
    window.location.href = whatsappUrl;
  }

  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("enviar") !== "1") return;
    // Una sola vez: al recargar o regresar ya no se vuelve a abrir.
    url.searchParams.delete("enviar");
    window.history.replaceState(window.history.state, "", url);
    void markWhatsAppOpenedAction(orderId);
    window.location.href = whatsappUrl;
  }, [orderId, whatsappUrl]);

  async function copyOrder() {
    try {
      await navigator.clipboard.writeText(message);
      toast.success(`Pedido copiado: pégalo en el chat de ${formatPhone(branchWhatsapp)}.`);
    } catch {
      toast("No se pudo copiar. Mantén presionado el texto del pedido para copiarlo.");
    }
  }

  const when = order.scheduledFor
    ? `Programado para ${scheduledLabel(new Date(order.scheduledFor).toISOString())}`
    : "Lo antes posible";

  return (
    <main className="grid gap-6 px-4 pt-8">
      <section className="relative grid justify-items-center gap-3 text-center">
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-6 h-0">
          {CONFETTI.map((p, i) => (
            <span
              key={i}
              className="animate-confeti absolute left-1/2 top-0 h-3 w-1.5 rounded-sm"
              style={
                {
                  "--x": `${p.x * 3}px`,
                  "--r": `${p.r}deg`,
                  animationDelay: `${p.d}ms`,
                  background:
                    p.c === 0
                      ? "var(--menu-primary)"
                      : p.c === 1
                        ? "var(--menu-accent)"
                        : "var(--color-aguacate)",
                } as CSSProperties
              }
            />
          ))}
        </div>
        <span className="animate-check grid size-20 place-items-center rounded-full bg-[var(--menu-primary)] text-[var(--menu-on-primary)] shadow-2">
          <CheckIcon aria-hidden className="size-10" strokeWidth={3} />
        </span>
        <h1 className="type-h2">¡Pedido {orderNumberLabel(order.number)} recibido!</h1>
        <p className="type-body text-[var(--menu-muted)]">
          {order.businessName} · {order.branchName}
        </p>
        <p
          className="type-small rounded-full bg-[var(--menu-soft)] px-3 py-1 font-semibold"
          data-status={status}
        >
          Estado: {statusLabel}
        </p>
        {emailNotice ? (
          <p className="type-small text-[var(--menu-muted)]">Te enviamos el resumen a tu correo.</p>
        ) : null}
      </section>

      <section className="grid gap-3 rounded-[var(--menu-radius)] border border-[var(--menu-line)] bg-[var(--menu-surface)] p-4">
        <p className="type-small">
          Envíale tu pedido a la sucursal por WhatsApp para que lo empiecen a preparar.
        </p>
        <button
          type="button"
          onClick={openWhatsApp}
          className="type-body flex h-14 items-center justify-center gap-2 rounded-full bg-whatsapp px-4 font-semibold text-frijol transition-transform active:scale-[0.97]"
        >
          Reenviar por WhatsApp
        </button>
        <div className="flex flex-wrap justify-center gap-2">
          <button
            type="button"
            onClick={() => void copyOrder()}
            className="type-small inline-flex h-10 items-center gap-1.5 rounded-full border border-[var(--menu-line)] px-3 font-semibold"
          >
            <CopyIcon aria-hidden className="size-4" />
            Copiar pedido
          </button>
          <a
            href={webUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => void markWhatsAppOpenedAction(orderId)}
            className="type-small inline-flex h-10 items-center gap-1.5 rounded-full border border-[var(--menu-line)] px-3 font-semibold"
          >
            <ExternalLinkIcon aria-hidden className="size-4" />
            WhatsApp Web
          </a>
        </div>
        <p className="type-caption text-center text-[var(--menu-muted)]">
          ¿No tienes WhatsApp aquí? Copia el pedido y mándalo al {formatPhone(branchWhatsapp)}.
        </p>
      </section>

      <section aria-labelledby="resumen" className="grid gap-3">
        <h2 id="resumen" className="type-h3">
          Tu pedido
        </h2>
        <p className="type-small text-[var(--menu-muted)]">
          {[
            ORDER_TYPE_LABELS[order.orderType],
            order.orderType === "dine_in" ? order.tableLabel : null,
            when,
          ]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <ul className="grid gap-2">
          {order.items.map((item, i) => (
            <li key={i} className="type-body flex justify-between gap-3">
              <span>
                {item.quantity}× {item.name}
                {item.options.length > 0 ? (
                  <span className="type-small block text-[var(--menu-muted)]">
                    {item.options.map((o) => o.name).join(", ")}
                  </span>
                ) : null}
              </span>
              <span className="tabular-nums">{formatQ(item.lineCents)}</span>
            </li>
          ))}
        </ul>
        <dl className="type-body grid gap-1 border-t border-[var(--menu-line)] pt-3">
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
          <div className="flex justify-between text-[var(--menu-muted)]">
            <dt>Pago</dt>
            <dd>{PAY_METHOD_LABELS[order.payment]}</dd>
          </div>
        </dl>
        {order.orderType === "delivery" && order.address ? (
          <p className="type-small text-[var(--menu-muted)]">
            📍 {order.address}
            {order.addressReference ? ` · ${order.addressReference}` : ""}
          </p>
        ) : null}
        {order.payment === "transfer" && bankAccounts.length > 0 ? (
          <BankAccounts accounts={bankAccounts} totalCents={order.totalCents} />
        ) : null}
      </section>

      <Link
        href={menuHref}
        className="type-small inline-flex h-12 items-center justify-center gap-1.5 justify-self-center font-semibold text-[var(--menu-primary)]"
      >
        <ArrowLeftIcon aria-hidden className="size-4" />
        Volver al menú
      </Link>
    </main>
  );
}
