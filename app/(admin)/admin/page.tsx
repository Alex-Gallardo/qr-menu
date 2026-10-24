import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { listPendingPayments } from "@/features/billing/server";
import { requirePlatformUser } from "@/lib/auth/session";
import { formatDateEs, todayInGuatemala } from "@/lib/gt-time";
import { formatQ } from "@/lib/money";

/** Provisional: el super admin completo llega en QRM-042. */
export default function AdminHomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <AdminHome />
    </Suspense>
  );
}

async function AdminHome() {
  const { user, profile } = await requirePlatformUser();
  const payments = await listPendingPayments();
  const now = new Date();
  const day = (d: Date) => formatDateEs(todayInGuatemala(d), now);
  return (
    <main className="mx-auto grid max-w-landing gap-6 px-4 py-10">
      <header className="flex items-center justify-between gap-4">
        <Logo />
        <SignOutButton />
      </header>
      <div>
        <p className="type-caption font-semibold tracking-wider text-muted-foreground uppercase">
          Super admin · {profile.platform_role}
        </p>
        <h1 className="type-h1">Hola, {profile.full_name ?? user.email}</h1>
        <p className="type-body mt-2 text-muted-foreground">
          Sesión verificada en dos pasos. Verificar o rechazar pagos, negocios y licencias llegan en
          QRM-042.
        </p>
      </div>
      <section aria-labelledby="pagos" className="grid gap-3">
        <h2 id="pagos" className="type-h3">
          Pagos por verificar ({payments.length})
        </h2>
        {payments.length === 0 ? (
          <p className="type-body text-muted-foreground">No hay boletas pendientes.</p>
        ) : (
          <ul className="grid gap-3">
            {payments.map((p) => (
              <li key={p.id} className="grid gap-1 rounded-lg border border-border bg-card p-4">
                <p className="type-body font-semibold">
                  {p.license.business.name} · {formatQ(p.amount_cents)} · plan {p.license.plan_id}
                </p>
                <p className="type-small text-muted-foreground">
                  {p.method === "deposit" ? "Depósito" : "Transferencia"}
                  {p.bank ? ` · ${p.bank}` : ""} · ref. {p.reference} · enviado {day(p.created_at)}
                </p>
                <p className="type-small text-muted-foreground">
                  Cubre {day(p.period_start)} → {day(p.period_end)}
                </p>
                {p.receiptLink ? (
                  <a
                    href={p.receiptLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="type-small font-semibold text-primary underline-offset-4 hover:underline"
                  >
                    Ver boleta (link de 10 min)
                  </a>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
