import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import {
  BranchTable,
  ExportButton,
  FunnelSection,
  HoursChart,
  KpiGrid,
  PeriodPicker,
  RankedList,
  summaryKpis,
} from "@/features/analytics/components/analytics-view";
import { FeatureInvite } from "@/features/licensing/components/feature";
import { parsePeriod, periodRanges, type Period } from "@/features/analytics/metrics";
import { getBranchSummaries, getBreakdown, getSummary } from "@/features/analytics/server";
import { hasFeature } from "@/features/licensing/entitlements";
import { ALL_BRANCHES } from "@/features/panel/branch-selection";
import { PanelPage } from "@/features/panel/components/panel-page";
import { getPanelContext } from "@/features/panel/context";
import { panelHref } from "@/features/panel/nav";
import { formatQ } from "@/lib/money";

export const metadata: Metadata = { title: "Analíticas" };

export default function Page({
  params,
  searchParams,
}: PageProps<"/panel/[businessId]/analiticas">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Analytics params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Analytics({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ businessId }, query] = await Promise.all([params, searchParams]);
  const ctx = await getPanelContext(businessId);
  if (ctx.branches.length === 0) notFound();

  const full = hasFeature(ctx.entitlements, "analytics_full");
  const compare = hasFeature(ctx.entitlements, "analytics_compare");
  const period = parsePeriod(typeof query.periodo === "string" ? query.periodo : null, full);
  const { current, previous, previousLabel } = periodRanges(period);

  // La sucursal la elige el selector de arriba (igual que en Inicio).
  const all = ctx.selectedBranch === ALL_BRANCHES || !ctx.selectedBranch;
  const selected = all ? ctx.branches : ctx.branches.filter((b) => b.id === ctx.selectedBranch);
  const branchIds = selected.map((b) => b.id);
  const branchLabel = all ? "todas tus sucursales" : (selected[0]?.name ?? "");
  const licenseHref =
    ctx.member.role === "owner" ? panelHref(businessId, "ajustes/licencia") : undefined;
  const base = panelHref(businessId, "analiticas");
  const hrefFor = (p: Period) => `${base}?periodo=${p}`;
  const exportHref = compare ? `${base}/exportar?periodo=${period}` : null;

  if (!full) {
    const today = await getSummary(businessId, branchIds, current);
    return (
      <PanelPage title="Analíticas" description={`Visitas y pedidos de hoy en ${branchLabel}.`}>
        <KpiGrid
          items={[
            { label: "Visitas al menú", value: String(today.visits) },
            { label: "Escaneos de QR", value: String(today.scans) },
            { label: "Pedidos", value: String(today.orders) },
            { label: "Ventas", value: formatQ(today.revenueCents) },
          ]}
        />
        <FeatureInvite name="analytics_full" licenseHref={licenseHref}>
          El embudo, los productos más vistos y pedidos, los pedidos por hora y la comparación con
          la semana anterior vienen con el plan Pro.
        </FeatureInvite>
      </PanelPage>
    );
  }

  const showBranches = compare && all && ctx.branches.length > 1;
  const [now, before, breakdown, perBranch] = await Promise.all([
    getSummary(businessId, branchIds, current),
    getSummary(businessId, branchIds, previous),
    getBreakdown(businessId, branchIds, current),
    showBranches ? getBranchSummaries(businessId, selected, current) : null,
  ]);

  return (
    <PanelPage
      title="Analíticas"
      description={`Cómo te va en ${branchLabel}: comparado con ${previousLabel}.`}
    >
      <PeriodPicker value={period} hrefFor={hrefFor} />
      <KpiGrid items={summaryKpis(now, before)} previousLabel={previousLabel} />
      <p className="type-caption -mt-2 text-muted-foreground">
        Visitas y embudo se cuentan desde que se activaron las analíticas del menú (una visita por
        celular cada 30 min); pedidos y ventas, desde siempre. Las ventas no incluyen cancelados.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <FunnelSection summary={now} />
        <HoursChart rows={breakdown.byHour} />
        <RankedList
          title="Productos más pedidos"
          description="Unidades en pedidos no cancelados."
          empty="Sin pedidos en este periodo."
          rows={breakdown.topOrdered.map((p) => ({
            label: p.name,
            sub: formatQ(p.revenue),
            value: p.quantity,
            valueLabel: String(p.quantity),
          }))}
        />
        <RankedList
          title="Productos más vistos"
          description="Veces que abrieron la ficha del producto."
          empty="Nadie ha abierto un producto en este periodo."
          rows={breakdown.topViewed.map((p) => ({
            label: p.name,
            value: p.count,
            valueLabel: String(p.count),
          }))}
        />
        <RankedList
          title="Escaneos por QR"
          description="Cada código QR impreso: mesas, sucursal y campañas."
          empty="Sin escaneos en este periodo."
          rows={breakdown.qrScans.map((q) => ({
            label: q.label,
            sub: all && ctx.branches.length > 1 ? q.branch : undefined,
            value: q.count,
            valueLabel: String(q.count),
          }))}
        />
      </div>

      {perBranch ? (
        <BranchTable rows={perBranch} exportHref={exportHref} />
      ) : compare && exportHref ? (
        <ExportButton href={exportHref} />
      ) : (
        <FeatureInvite name="analytics_compare" licenseHref={licenseHref}>
          La comparación por sucursal y exportar a Excel (CSV) vienen con el plan Negocio.
        </FeatureInvite>
      )}
    </PanelPage>
  );
}
