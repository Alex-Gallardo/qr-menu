import type { Metadata } from "next";
import { CalendarClockIcon } from "lucide-react";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { LimitCard } from "@/features/licensing/components/limit-card";
import { checkLimit } from "@/features/licensing/limits";
import { getUsage } from "@/features/licensing/server";
import { PanelPage } from "@/features/panel/components/panel-page";
import { getPanelContext } from "@/features/panel/context";
import { panelHref } from "@/features/panel/nav";
import { TimeSlotsManager } from "@/features/schedule/components/time-slots-manager";
import { listSlots } from "@/features/schedule/server";

export const metadata: Metadata = { title: "Programación" };

export default function Page({ params }: PageProps<"/panel/[businessId]/programacion">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Schedule params={params} />
    </Suspense>
  );
}

async function Schedule({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await getPanelContext(businessId);
  const isOwner = ctx.member.role === "owner";
  const [slots, used] = await Promise.all([
    listSlots(businessId),
    getUsage(businessId, "time_slots"),
  ]);
  const limit = checkLimit(ctx.entitlements.limits, "time_slots", used);

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
          slots={slots}
          canEdit={isOwner}
          canAdd={limit.ok}
          limitNotice={
            limit.ok ? null : (
              <LimitCard
                message={limit.message}
                licenseHref={panelHref(businessId, "ajustes/licencia")}
              />
            )
          }
        />
      </section>

      <section className="flex items-start gap-4 rounded-xl border border-dashed border-border p-5 sm:p-6">
        <CalendarClockIcon aria-hidden className="mt-0.5 size-6 shrink-0 text-muted-foreground" />
        <div className="grid gap-1">
          <h2 className="type-h3">Programación semanal</h2>
          <p className="type-small text-muted-foreground">
            Muy pronto: eliges qué menú se ve en cada franja y cada día, para todas las sucursales o
            solo una.
          </p>
        </div>
      </section>
    </PanelPage>
  );
}
