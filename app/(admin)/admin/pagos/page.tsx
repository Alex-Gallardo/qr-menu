import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { cn } from "cn";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { requirePlatform } from "@/features/admin/access";
import { PaymentReview } from "@/features/admin/components/payment-review";
import { listPayments } from "@/features/admin/queries";
import { PAYMENT_STATUS_LABELS } from "@/features/billing/billing";
import { formatDateEs, todayInGuatemala } from "@/lib/gt-time";
import { formatQ } from "@/lib/money";

export const metadata: Metadata = { title: "Pagos" };

const TABS = ["pending", "verified", "rejected"] as const;

/** Pagos de licencias (guía A2): por verificar, verificados y rechazados. */
export default function Page({ searchParams }: PageProps<"/admin/pagos">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Payments searchParams={searchParams} />
    </Suspense>
  );
}

async function Payments({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePlatform("payments.verify", "/admin/pagos");
  const query = await searchParams;
  const status = TABS.find((t) => t === query.estado) ?? "pending";
  const rows = await listPayments(status);
  const now = new Date();
  const day = (d: Date) => formatDateEs(todayInGuatemala(d), now);

  return (
    <>
      <h1 className="type-h1">Pagos</h1>
      <nav aria-label="Estado" className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <Link
            key={t}
            href={`/admin/pagos?estado=${t}`}
            aria-current={t === status ? "page" : undefined}
            className={cn(
              "type-small inline-flex h-10 items-center rounded-full border px-4 font-semibold",
              t === status
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-card",
            )}
          >
            {t === "pending" ? "Por verificar" : PAYMENT_STATUS_LABELS[t]}
          </Link>
        ))}
      </nav>
      {rows.length === 0 ? (
        <p className="type-body text-muted-foreground">No hay pagos aquí.</p>
      ) : (
        <ul className="grid gap-3">
          {rows.map((p) => (
            <li
              key={p.id}
              className="grid gap-2 rounded-xl border border-border bg-card p-4 shadow-1"
            >
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
                {status === "pending" ? " (se recalcula al verificar)" : ""}
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
              {status === "pending" ? <PaymentReview paymentId={p.id} /> : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
