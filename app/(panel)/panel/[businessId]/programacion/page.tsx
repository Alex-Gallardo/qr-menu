import type { Metadata } from "next";
import { LockIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { cn } from "cn";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { LimitCard } from "@/features/licensing/components/limit-card";
import { checkLimit } from "@/features/licensing/limits";
import { getUsage } from "@/features/licensing/server";
import { PanelPage } from "@/features/panel/components/panel-page";
import { getPanelContext } from "@/features/panel/context";
import { panelHref } from "@/features/panel/nav";
import { OverridesManager } from "@/features/schedule/components/overrides-manager";
import { ScheduleGrid } from "@/features/schedule/components/schedule-grid";
import { TimeSlotsManager } from "@/features/schedule/components/time-slots-manager";
import { gridFromRules, pruneGrid } from "@/features/schedule/grid";
import { getScheduleData } from "@/features/schedule/program-server";

export const metadata: Metadata = { title: "Programación" };

const GENERAL = "general";

export default function Page({
  params,
  searchParams,
}: PageProps<"/panel/[businessId]/programacion">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Schedule params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Schedule({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [{ businessId }, query] = await Promise.all([params, searchParams]);
  const ctx = await getPanelContext(businessId);
  const isOwner = ctx.member.role === "owner";
  const [data, used] = await Promise.all([
    getScheduleData(businessId),
    getUsage(businessId, "time_slots"),
  ]);
  const slotLimit = checkLimit(ctx.entitlements.limits, "time_slots", used);
  const features = ctx.entitlements.features;
  const hasScheduling = features.includes("scheduling");
  const hasBranchScheduling = features.includes("branch_scheduling");
  const licenseHref = isOwner ? panelHref(businessId, "ajustes/licencia") : undefined;
  const scheduleHref = panelHref(businessId, "programacion");

  // Alcance: "Todas las sucursales" (solo el dueño) o una sucursal visible.
  const requested = typeof query.sucursal === "string" ? query.sucursal : undefined;
  const scopes = [
    ...(isOwner ? [{ id: GENERAL, name: "Todas las sucursales" }] : []),
    ...ctx.branches.map((b) => ({ id: b.id, name: b.name })),
  ];
  const scope = scopes.find((s) => s.id === requested) ?? scopes[0];
  const branchId = scope && scope.id !== GENERAL ? scope.id : null;

  const activeSlots = data.slots.filter((s) => s.is_active);
  const usableMenus = data.menus.filter((m) => m.is_active && !m.hidden_by_license);
  const slotIds = new Set(activeSlots.map((s) => s.id));
  const menuIds = new Set(usableMenus.map((m) => m.id));
  const generalGrid = pruneGrid(gridFromRules(data.rules, null), slotIds, menuIds);
  const scopeGrid = branchId
    ? pruneGrid(gridFromRules(data.rules, branchId), slotIds, menuIds)
    : generalGrid;
  const canEditGrid = branchId ? hasBranchScheduling : isOwner && hasScheduling;
  const overrides = data.overrides.filter((o) =>
    branchId ? o.branch_id === branchId || o.branch_id === null : o.branch_id === null,
  );

  return (
    <PanelPage
      title="Programación"
      description="Las franjas de tu día y qué menú se ve en cada una."
    >
      <section className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-1 sm:p-6">
        <div className="grid gap-1">
          <h2 className="type-h3">Franjas horarias</h2>
          <p className="type-small text-muted-foreground">
            Tu menú cambia solo según la hora de Guatemala. Valen para todas las sucursales.
          </p>
        </div>
        <TimeSlotsManager
          businessId={businessId}
          slots={data.slots}
          canEdit={isOwner}
          canAdd={slotLimit.ok}
          limitNotice={
            slotLimit.ok ? null : (
              <LimitCard message={slotLimit.message} licenseHref={licenseHref} />
            )
          }
        />
      </section>

      {scopes.length > 1 ? (
        <nav
          aria-label="¿Para qué sucursal?"
          className="-mx-4 flex gap-2 overflow-x-auto px-4 lg:mx-0 lg:px-0"
        >
          {scopes.map((s) => {
            const locked = s.id !== GENERAL && !hasBranchScheduling;
            return (
              <Link
                key={s.id}
                href={`${scheduleHref}?sucursal=${s.id}`}
                aria-current={s.id === scope?.id ? "page" : undefined}
                className={cn(
                  "type-small inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-border bg-card px-4 font-semibold whitespace-nowrap",
                  "aria-[current=page]:border-primary aria-[current=page]:bg-primary aria-[current=page]:text-primary-foreground",
                )}
              >
                {locked ? <LockIcon aria-hidden className="size-3.5" /> : null}
                {s.name}
              </Link>
            );
          })}
        </nav>
      ) : null}

      <section className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-1 sm:p-6">
        <div className="grid gap-1">
          <h2 className="type-h3">Semana{scope ? ` · ${scope.name}` : ""}</h2>
          <p className="type-small text-muted-foreground">
            Toca una celda para elegir qué menú se ve ese día en esa franja.
          </p>
        </div>
        {!hasScheduling ? (
          <LimitCard
            message="Tu plan muestra siempre tu menú predeterminado. Con el plan Pro eliges qué menú se ve en cada franja y cada día."
            licenseHref={licenseHref}
          />
        ) : branchId && !hasBranchScheduling ? (
          <LimitCard
            message="La programación por sucursal es del plan Negocio. Esta sucursal usa la de “Todas las sucursales”."
            licenseHref={licenseHref}
          />
        ) : null}
        {activeSlots.length === 0 ? (
          <p className="type-small text-muted-foreground">
            Agrega o activa una franja horaria para programar tu semana.
          </p>
        ) : usableMenus.length === 0 ? (
          <p className="type-small text-muted-foreground">
            Crea o activa un menú en{" "}
            <Link href={panelHref(businessId, "menus")} className="underline">
              Menús
            </Link>{" "}
            para programarlo.
          </p>
        ) : (
          <ScheduleGrid
            key={scope?.id}
            businessId={businessId}
            branchId={branchId}
            scopeLabel={scope?.name ?? ""}
            slots={activeSlots}
            menus={usableMenus.map((m) => ({ id: m.id, name: m.name }))}
            generalGrid={generalGrid}
            initialGrid={scopeGrid}
            canEdit={canEditGrid}
          />
        )}
        {data.seasonalCount > 0 ? (
          <p className="type-caption text-muted-foreground">
            Además hay {data.seasonalCount === 1 ? "1 regla" : `${data.seasonalCount} reglas`} por
            temporada (con fechas) que no se editan aquí.
          </p>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-xl border border-border bg-card p-5 shadow-1 sm:p-6">
        <div className="grid gap-1">
          <h2 className="type-h3">Fechas especiales{scope ? ` · ${scope.name}` : ""}</h2>
          <p className="type-small text-muted-foreground">
            Feriados, días cerrados o un menú distinto un día. Ganan a la programación de la semana.
          </p>
        </div>
        <OverridesManager
          key={scope?.id}
          businessId={businessId}
          branchId={branchId}
          today={data.today}
          overrides={overrides}
          slots={activeSlots.map((s) => ({ id: s.id, name: s.name }))}
          menus={usableMenus.map((m) => ({ id: m.id, name: m.name }))}
          branches={ctx.branches.map((b) => ({ id: b.id, name: b.name }))}
          canEdit={branchId ? true : isOwner}
          canChooseMenu={hasScheduling}
        />
      </section>
    </PanelPage>
  );
}
