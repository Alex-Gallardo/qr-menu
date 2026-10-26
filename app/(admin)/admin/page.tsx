import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { LICENSE_STATUS_LABELS } from "@/features/billing/billing";
import { requirePlatform } from "@/features/admin/access";
import { getDashboard } from "@/features/admin/queries";
import type { EffectiveStatus } from "@/features/licensing/entitlements";
import { formatDateEs, todayInGuatemala } from "@/lib/gt-time";
import { formatQ } from "@/lib/money";

// Ver admin/layout.tsx: el super admin siempre espera al servidor.
export const instant = false;

/** Tablero (guía "Uso y métricas"): estados, MRR, vencimientos, gracia, pagos y actividad. */
export default function AdminHomePage() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Dashboard />
    </Suspense>
  );
}

async function Dashboard() {
  await requirePlatform("businesses.view");
  const d = await getDashboard();
  const now = new Date();
  const day = (date: Date | null) => (date ? formatDateEs(todayInGuatemala(date), now) : "—");
  const statuses: EffectiveStatus[] = [
    "trial",
    "active",
    "grace",
    "free",
    "suspended",
    "cancelled",
  ];
  const maxOrders = Math.max(1, ...d.ordersByDay.map((o) => o.orders));

  return (
    <>
      <h1 className="type-h1">Tablero</h1>
      <section aria-label="Resumen" className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Negocios" value={String(d.total)} />
        <Stat label="MRR" value={formatQ(d.mrrCents)} hint="Licencias activas pagadas" />
        <Stat
          label="Pagos por verificar"
          value={String(d.pendingPayments)}
          href={d.pendingPayments ? "/admin/pagos" : undefined}
        />
        <Stat label="Altas esta semana" value={String(d.signups)} />
      </section>
      <section aria-label="Por estado" className="flex flex-wrap gap-2">
        {statuses.map((s) => (
          <span key={s} className="type-small rounded-full bg-muted px-3 py-1">
            {LICENSE_STATUS_LABELS[s]}:{" "}
            <strong className="tabular-nums">{d.byStatus[s] ?? 0}</strong>
          </span>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Vencen en 7 días" empty="Ninguno.">
          {d.expiring.map((b) => (
            <Row key={b.id} href={`/admin/negocios/${b.id}`} label={b.name}>
              {LICENSE_STATUS_LABELS[b.status]} · {day(b.endsAt)}
            </Row>
          ))}
        </Panel>
        <Panel title="En gracia" empty="Ninguno.">
          {d.inGrace.map((b) => (
            <Row key={b.id} href={`/admin/negocios/${b.id}`} label={b.name}>
              hasta {day(b.until)}
            </Row>
          ))}
        </Panel>
        <Panel title="Pasaron a Gratis esta semana" empty="Ninguno.">
          {d.downgraded.map((b) => (
            <Row
              key={`${b.id}-${b.at.toISOString()}`}
              href={`/admin/negocios/${b.id}`}
              label={b.name}
            >
              {day(b.at)}
            </Row>
          ))}
        </Panel>
        <Panel title="Publicados sin pedidos en 7 días" empty="Todos tienen pedidos.">
          {d.quiet.map((b) => (
            <Row key={b.id} href={`/admin/negocios/${b.id}`} label={b.name} />
          ))}
        </Panel>
      </div>

      <section className="grid gap-3 rounded-xl border border-border bg-card p-5 shadow-1">
        <h2 className="type-h3">Pedidos por día (7 días)</h2>
        {d.ordersByDay.length === 0 ? (
          <p className="type-body text-muted-foreground">Sin pedidos esta semana.</p>
        ) : (
          <ul className="grid gap-1.5">
            {d.ordersByDay.map((o) => (
              <li
                key={o.day}
                className="type-small grid grid-cols-[6rem_1fr_3rem] items-center gap-2"
              >
                <span className="text-muted-foreground tabular-nums">{o.day}</span>
                <span className="h-2 overflow-hidden rounded-full bg-muted">
                  <span
                    className="block h-full rounded-full bg-primary"
                    style={{ width: `${(o.orders / maxOrders) * 100}%` }}
                  />
                </span>
                <span className="text-right font-semibold tabular-nums">{o.orders}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function Stat({
  label,
  value,
  hint,
  href,
}: {
  label: string;
  value: string;
  hint?: string;
  href?: string;
}) {
  const body = (
    <>
      <p className="type-caption text-muted-foreground">{label}</p>
      <p className="type-h2 mt-1 tabular-nums">{value}</p>
      {hint ? <p className="type-caption text-muted-foreground">{hint}</p> : null}
    </>
  );
  return href ? (
    <Link
      href={href}
      className="rounded-lg border border-primary bg-card p-4 shadow-1 hover:shadow-2"
    >
      {body}
    </Link>
  ) : (
    <div className="rounded-lg border border-border bg-card p-4 shadow-1">{body}</div>
  );
}

function Panel({
  title,
  empty,
  children,
}: {
  title: string;
  empty: string;
  children: React.ReactNode[];
}) {
  return (
    <section className="grid content-start gap-3 rounded-xl border border-border bg-card p-5 shadow-1">
      <h2 className="type-h3">{title}</h2>
      {children.length === 0 ? (
        <p className="type-body text-muted-foreground">{empty}</p>
      ) : (
        <ul className="grid gap-1">{children}</ul>
      )}
    </section>
  );
}

function Row({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children?: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="type-small flex justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted"
      >
        <span className="font-semibold">{label}</span>
        {children ? <span className="text-muted-foreground">{children}</span> : null}
      </Link>
    </li>
  );
}
