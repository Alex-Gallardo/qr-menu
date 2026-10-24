import { DownloadIcon } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { EditorSection } from "@/features/appearance/components/controls";
import { formatQ } from "@/lib/money";
import {
  avgTicket,
  conversion,
  delta,
  deltaLabel,
  funnel,
  hourLabel,
  hoursSeries,
  pct,
  PERIODS,
  type Period,
} from "../metrics";
import type { Summary } from "../server";

/*
 * Analíticas del panel (servidor: sin JavaScript en el cliente). Gráficas de
 * una sola serie con el color principal; cada barra dice su valor al pasar el
 * mouse o con el lector de pantalla.
 */

export function PeriodPicker({
  value,
  hrefFor,
}: {
  value: Period;
  hrefFor: (p: Period) => string;
}) {
  return (
    <nav aria-label="Periodo" className="flex flex-wrap gap-2">
      {PERIODS.map((p) => (
        <Link
          key={p.value}
          href={hrefFor(p.value)}
          aria-current={value === p.value ? "page" : undefined}
          scroll={false}
          className="type-small inline-flex h-11 items-center rounded-full border border-border bg-card px-4 font-semibold transition-colors hover:bg-muted aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground"
        >
          {p.label}
        </Link>
      ))}
    </nav>
  );
}

type Kpi = { label: string; value: string; change?: number | null; hint?: string };

export function KpiGrid({ items, previousLabel }: { items: Kpi[]; previousLabel?: string }) {
  return (
    <section aria-label="Resumen" className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((k) => (
        <div key={k.label} className="rounded-lg border border-border bg-card p-4 shadow-1">
          <p className="type-caption text-muted-foreground">{k.label}</p>
          <p className="type-h2 mt-1 tabular-nums">{k.value}</p>
          {k.change !== undefined ? (
            <p
              className="type-caption mt-1 text-muted-foreground"
              title={previousLabel ? `Contra ${previousLabel}` : undefined}
            >
              <span
                className={cn(
                  "font-semibold",
                  k.change !== null && k.change > 0 && "text-success",
                  k.change !== null && k.change < 0 && "text-destructive",
                )}
              >
                {k.change !== null && k.change > 0
                  ? "▲ "
                  : k.change !== null && k.change < 0
                    ? "▼ "
                    : ""}
                {deltaLabel(k.change)}
              </span>
              {previousLabel ? <span className="sr-only"> contra {previousLabel}</span> : null}
            </p>
          ) : k.hint ? (
            <p className="type-caption mt-1 text-muted-foreground">{k.hint}</p>
          ) : null}
        </div>
      ))}
    </section>
  );
}

/** Tarjetas del periodo, con el cambio contra el anterior. */
export function summaryKpis(now: Summary, before: Summary | null): Kpi[] {
  const ch = (a: number, b: number | undefined) => (before ? delta(a, b ?? 0) : undefined);
  const conv = conversion(now.orderedVisitors, now.visitors);
  const convBefore = before ? conversion(before.orderedVisitors, before.visitors) : null;
  const ticket = avgTicket(now.revenueCents, now.validOrders);
  return [
    { label: "Visitas al menú", value: String(now.visits), change: ch(now.visits, before?.visits) },
    { label: "Escaneos de QR", value: String(now.scans), change: ch(now.scans, before?.scans) },
    {
      label: "Pedidos",
      value: String(now.orders),
      change: ch(now.orders, before?.orders),
      hint: now.cancelled ? `${now.cancelled} cancelados` : undefined,
    },
    {
      label: "Conversión",
      value: conv === null ? "—" : `${conv} %`,
      change: before && conv !== null && convBefore !== null ? delta(conv, convBefore) : undefined,
      hint: conv === null ? "Sin visitas registradas" : undefined,
    },
    {
      label: "Ventas",
      value: formatQ(now.revenueCents),
      change: ch(now.revenueCents, before?.revenueCents),
    },
    {
      label: "Ticket promedio",
      value: formatQ(ticket),
      change: before
        ? delta(ticket, avgTicket(before.revenueCents, before.validOrders))
        : undefined,
    },
    {
      label: "A domicilio",
      value: `${pct(now.delivery, now.orders) ?? 0} %`,
      hint: `${now.delivery} de ${now.orders} pedidos`,
    },
    {
      label: "Programados",
      value: `${pct(now.scheduled, now.orders) ?? 0} %`,
      hint: `${now.scheduled} de ${now.orders} pedidos`,
    },
  ];
}

export function FunnelSection({ summary }: { summary: Summary }) {
  const steps = funnel({
    visitors: summary.visitors,
    viewedProduct: summary.viewedProduct,
    addedToCart: summary.addedToCart,
    startedCheckout: summary.startedCheckout,
    orders: summary.orderedVisitors,
  });
  return (
    <EditorSection
      title="Embudo"
      description="Personas (por celular) en cada paso. El último: las que además enviaron un pedido, según tu bandeja."
    >
      {summary.visitors === 0 ? (
        <Empty>Todavía no hay visitas en este periodo.</Empty>
      ) : (
        <ol className="grid gap-3">
          {steps.map((s, i) => (
            <li key={s.key} className="grid gap-1">
              <div className="type-small flex items-baseline justify-between gap-3">
                <span className="font-semibold">{s.label}</span>
                <span className="font-semibold tabular-nums">{s.value}</span>
              </div>
              <span className="h-3 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${Math.min(100, s.ofFirst ?? 0)}%` }}
                />
              </span>
              {i > 0 && s.ofPrevious !== null ? (
                <span className="type-caption text-muted-foreground tabular-nums">
                  {s.ofPrevious} % del paso anterior
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      )}
    </EditorSection>
  );
}

export function HoursChart({ rows }: { rows: { hour: number; orders: number }[] }) {
  const series = hoursSeries(rows);
  const max = Math.max(...series.map((s) => s.orders));
  // Solo las horas con actividad y su vecindad: de la primera a la última con pedidos.
  const first = series.findIndex((s) => s.orders > 0);
  const last = 23 - [...series].reverse().findIndex((s) => s.orders > 0);
  const shown = max === 0 ? [] : series.slice(Math.max(0, first - 1), Math.min(24, last + 2));
  const peak = series.find((s) => s.orders === max);

  return (
    <EditorSection
      title="Pedidos por hora"
      description={
        peak && max > 0
          ? `La hora con más pedidos: ${hourLabel(peak.hour)} (${max}).`
          : "A qué hora te piden más (hora de Guatemala)."
      }
    >
      {shown.length === 0 ? (
        <Empty>Sin pedidos en este periodo.</Empty>
      ) : (
        <>
          <div
            role="img"
            aria-label={shown.map((s) => `${hourLabel(s.hour)}: ${s.orders}`).join(", ")}
            className="flex h-40 items-end gap-0.5 border-b border-border"
          >
            {shown.map((s) => (
              <div
                key={s.hour}
                className="group relative flex h-full flex-1 items-end"
                title={`${hourLabel(s.hour)}: ${s.orders} ${s.orders === 1 ? "pedido" : "pedidos"}`}
              >
                <span
                  className="block w-full rounded-t-[4px] bg-primary transition-opacity group-hover:opacity-80"
                  style={{ height: `${(s.orders / max) * 100}%`, minHeight: s.orders ? 2 : 0 }}
                />
                <span className="type-caption pointer-events-none absolute -top-6 left-1/2 hidden -translate-x-1/2 rounded bg-foreground px-1.5 py-0.5 whitespace-nowrap text-background tabular-nums group-hover:block">
                  {s.orders}
                </span>
              </div>
            ))}
          </div>
          <div aria-hidden className="type-caption flex justify-between text-muted-foreground">
            <span>{hourLabel(shown[0]!.hour)}</span>
            <span>{hourLabel(shown[shown.length - 1]!.hour)}</span>
          </div>
        </>
      )}
    </EditorSection>
  );
}

export function RankedList({
  title,
  description,
  rows,
  empty,
}: {
  title: string;
  description: string;
  rows: { label: string; sub?: string; value: number; valueLabel: string }[];
  empty: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <EditorSection title={title} description={description}>
      {rows.length === 0 ? (
        <Empty>{empty}</Empty>
      ) : (
        <ol className="grid gap-3">
          {rows.map((r, i) => (
            <li key={`${r.label}-${i}`} className="grid gap-1">
              <div className="type-small flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate">
                  <span className="font-semibold">{r.label}</span>
                  {r.sub ? <span className="text-muted-foreground"> · {r.sub}</span> : null}
                </span>
                <span className="shrink-0 font-semibold tabular-nums">{r.valueLabel}</span>
              </div>
              <span className="h-2 overflow-hidden rounded-full bg-muted">
                <span
                  className="block h-full rounded-full bg-primary"
                  style={{ width: `${(r.value / max) * 100}%` }}
                />
              </span>
            </li>
          ))}
        </ol>
      )}
    </EditorSection>
  );
}

export function BranchTable({
  rows,
  exportHref,
}: {
  rows: { id: string; name: string; summary: Summary }[];
  exportHref: string | null;
}) {
  return (
    <EditorSection
      title="Comparación por sucursal"
      description="El mismo periodo en cada una de tus sucursales."
    >
      <div className="-mx-1 overflow-x-auto px-1">
        <table className="type-small w-full min-w-[34rem] border-collapse text-right tabular-nums">
          <thead className="text-muted-foreground">
            <tr className="border-b border-border">
              <th scope="col" className="py-2 text-left font-semibold">
                Sucursal
              </th>
              <th scope="col" className="py-2 font-semibold">
                Visitas
              </th>
              <th scope="col" className="py-2 font-semibold">
                Pedidos
              </th>
              <th scope="col" className="py-2 font-semibold">
                Conversión
              </th>
              <th scope="col" className="py-2 font-semibold">
                Ventas
              </th>
              <th scope="col" className="py-2 font-semibold">
                Ticket
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ id, name, summary: s }) => {
              const conv = conversion(s.orderedVisitors, s.visitors);
              return (
                <tr key={id} className="border-b border-border last:border-0">
                  <th scope="row" className="py-2.5 text-left font-semibold">
                    {name}
                  </th>
                  <td className="py-2.5">{s.visits}</td>
                  <td className="py-2.5">{s.orders}</td>
                  <td className="py-2.5">{conv === null ? "—" : `${conv} %`}</td>
                  <td className="py-2.5">{formatQ(s.revenueCents)}</td>
                  <td className="py-2.5">{formatQ(avgTicket(s.revenueCents, s.validOrders))}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {exportHref ? <ExportButton href={exportHref} /> : null}
    </EditorSection>
  );
}

export function ExportButton({ href }: { href: string }) {
  return (
    <Button asChild variant="outline" className="justify-self-start">
      <a href={href} download>
        <DownloadIcon aria-hidden />
        Exportar por día (CSV)
      </a>
    </Button>
  );
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="type-body text-muted-foreground">{children}</p>;
}
