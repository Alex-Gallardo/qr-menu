import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { cn } from "cn";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { requirePlatform } from "@/features/admin/access";
import { PaymentCard } from "@/features/admin/components/payment-card";
import { PaymentReview } from "@/features/admin/components/payment-review";
import { listPayments } from "@/features/admin/queries";
import { PAYMENT_STATUS_LABELS } from "@/features/billing/billing";

export const metadata: Metadata = { title: "Pagos" };

// Ver admin/layout.tsx: el super admin siempre espera al servidor.
export const instant = false;

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
            <PaymentCard
              key={p.id}
              payment={p}
              pending={status === "pending"}
              now={now}
              actions={status === "pending" ? <PaymentReview paymentId={p.id} /> : null}
            />
          ))}
        </ul>
      )}
    </>
  );
}
