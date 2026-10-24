import Link from "next/link";
import type { ReactNode } from "react";
import { formatDateEs, todayInGuatemala } from "@/lib/gt-time";
import { formatQ } from "@/lib/money";

export type PaymentCardData = {
  amount_cents: number;
  method: string;
  bank: string | null;
  reference: string;
  rejection_reason: string | null;
  period_start: Date;
  period_end: Date;
  created_at: Date;
  plan: string;
  period: string | null;
  receiptLink: string | null;
  license: { price_override_gtq: number | null; business: { id: string; name: string } };
};

/**
 * Pago de licencia en el super admin: negocio, monto, plan, banco y referencia,
 * el periodo que cubre y la boleta. `actions` = Verificar / Rechazar (si está pendiente).
 */
export function PaymentCard({
  payment: p,
  pending,
  now,
  actions,
}: {
  payment: PaymentCardData;
  pending: boolean;
  now: Date;
  actions?: ReactNode;
}) {
  const day = (d: Date) => formatDateEs(todayInGuatemala(d), now);
  return (
    <li className="grid gap-2 rounded-xl border border-border bg-card p-4 shadow-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <Link
          href={`/admin/negocios/${p.license.business.id}`}
          className="type-body font-semibold text-primary hover:underline"
        >
          {p.license.business.name}
        </Link>
        <span className="type-h3 tabular-nums">{formatQ(p.amount_cents)}</span>
      </div>
      <p className="type-small text-muted-foreground">
        Plan {p.plan}
        {p.period ? ` · ${p.period === "annual" ? "anual" : "mensual"}` : ""} ·{" "}
        {p.method === "deposit" ? "depósito" : "transferencia"} · {p.bank ?? "—"} · ref.{" "}
        {p.reference} · enviado {day(p.created_at)}
        {p.license.price_override_gtq !== null
          ? ` · precio especial Q${p.license.price_override_gtq}/mes`
          : ""}
      </p>
      <p className="type-small text-muted-foreground">
        Cubre {day(p.period_start)} → {day(p.period_end)}
        {pending ? " (se recalcula al verificar)" : ""}
      </p>
      {p.rejection_reason ? (
        <p className="type-small text-destructive">Motivo: {p.rejection_reason}</p>
      ) : null}
      {p.receiptLink ? (
        <a
          href={p.receiptLink}
          target="_blank"
          rel="noopener noreferrer"
          className="type-small justify-self-start font-semibold text-primary hover:underline"
        >
          Ver boleta (link de 10 min)
        </a>
      ) : null}
      {actions}
    </li>
  );
}
