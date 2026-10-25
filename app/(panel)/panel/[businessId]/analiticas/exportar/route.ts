import type { NextRequest } from "next/server";
import { parsePeriod, periodRanges, toCsv } from "@/features/analytics/metrics";
import { getDailyRows } from "@/features/analytics/server";
import { hasFeature } from "@/features/licensing/entitlements";
import { ALL_BRANCHES } from "@/features/panel/branch-selection";
import { getPanelContext } from "@/features/panel/context";
import { todayInGuatemala } from "@/lib/gt-time";

/**
 * Exportar analíticas por día y sucursal (plan Negocio): CSV para Excel con
 * las sucursales que ve quien exporta y la sucursal elegida arriba.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/panel/[businessId]/analiticas/exportar">,
) {
  const { businessId } = await ctx.params;
  const panel = await getPanelContext(businessId);
  if (!hasFeature(panel.entitlements, "analytics_compare"))
    return new Response("Exportar viene con el plan Negocio.", { status: 403 });

  const period = parsePeriod(request.nextUrl.searchParams.get("periodo"), true);
  const { current } = periodRanges(period);
  const all = panel.selectedBranch === ALL_BRANCHES || !panel.selectedBranch;
  const branchIds = panel.branches
    .filter((b) => all || b.id === panel.selectedBranch)
    .map((b) => b.id);

  const rows = await getDailyRows(businessId, branchIds, current);
  const csv = toCsv(
    [
      "Fecha",
      "Sucursal",
      "Visitas",
      "Visitantes",
      "Escaneos QR",
      "Pedidos",
      "Cancelados",
      "Ventas (Q)",
      "Ticket promedio (Q)",
    ],
    rows.map((r) => {
      const valid = r.orders - r.cancelled;
      return [
        r.day,
        r.branch,
        r.visits,
        r.visitors,
        r.scans,
        r.orders,
        r.cancelled,
        (r.revenue / 100).toFixed(2),
        valid > 0 ? (r.revenue / valid / 100).toFixed(2) : "0.00",
      ];
    }),
  );
  const name = `analiticas-${panel.business.slug}-${period}-${todayInGuatemala()}.csv`;
  return new Response(csv, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${name}"`,
      "cache-control": "no-store",
    },
  });
}
