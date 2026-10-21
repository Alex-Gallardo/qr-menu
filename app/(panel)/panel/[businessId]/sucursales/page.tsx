import type { Metadata } from "next";
import { ChevronRightIcon, PlusIcon, StoreIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { Button } from "@/components/ui/button";
import { toWeek, weekSummary } from "@/features/branches/hours";
import { listBranches } from "@/features/branches/server";
import { LimitCard } from "@/features/licensing/components/limit-card";
import { checkLimit } from "@/features/licensing/limits";
import { getUsage } from "@/features/licensing/server";
import { PanelPage } from "@/features/panel/components/panel-page";
import { getPanelContext } from "@/features/panel/context";
import { panelHref } from "@/features/panel/nav";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Sucursales" };

export default function Page({ params }: PageProps<"/panel/[businessId]/sucursales">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Branches params={params} />
    </Suspense>
  );
}

async function Branches({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await getPanelContext(businessId);
  const isOwner = ctx.member.role === "owner";
  const [branches, used] = await Promise.all([
    listBranches(
      businessId,
      ctx.branches.map((b) => b.id),
    ),
    getUsage(businessId, "branches"),
  ]);
  const limit = checkLimit(ctx.entitlements.limits, "branches", used);

  const addButton =
    isOwner && limit.ok ? (
      <Button asChild>
        <Link href={panelHref(businessId, "sucursales/nueva")}>
          <PlusIcon />
          Agregar sucursal
        </Link>
      </Button>
    ) : null;

  return (
    <PanelPage
      title="Sucursales"
      description={
        isOwner ? `Usas ${used} de ${limit.limit ?? "∞"} sucursales de tu plan.` : "Tus sucursales."
      }
      actions={addButton}
    >
      {isOwner && !limit.ok ? (
        <LimitCard
          message={limit.message}
          licenseHref={panelHref(businessId, "ajustes/licencia")}
        />
      ) : null}

      {branches.length === 0 ? (
        <EmptyState icon={<StoreIcon />} title="Aún no tienes sucursales" action={addButton}>
          Agrega tu primer local con su WhatsApp, su horario y su zona de entrega.
        </EmptyState>
      ) : (
        <ul className="grid gap-3">
          {branches.map((b) => {
            const types = [
              b.accepts_dine_in && "Comer aquí",
              b.accepts_takeout && "Para llevar",
              b.accepts_delivery && "A domicilio",
            ].filter(Boolean);
            return (
              <li key={b.id}>
                <Link
                  href={panelHref(businessId, `sucursales/${b.id}`)}
                  className="group flex items-center gap-4 rounded-xl border border-border bg-card p-4 shadow-1 transition-shadow hover:shadow-2 sm:p-5"
                >
                  <span className="grid size-12 shrink-0 place-items-center rounded-lg bg-nube text-primary">
                    <StoreIcon aria-hidden className="size-6" />
                  </span>
                  <span className="grid min-w-0 flex-1 gap-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="type-h3">{b.name}</span>
                      <span
                        className={`type-caption rounded-full px-2 py-0.5 font-semibold ${b.is_active ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}
                      >
                        {b.is_active ? "Activa" : "En pausa"}
                      </span>
                    </span>
                    <span className="type-small truncate text-muted-foreground">
                      {[b.address, b.city].filter(Boolean).join(", ") || "Sin dirección"} · WhatsApp{" "}
                      {formatPhone(b.whatsapp_e164)}
                    </span>
                    <span className="type-caption text-muted-foreground">
                      {weekSummary(toWeek(b.hours)) || "Sin horario"} · {types.join(", ")}
                    </span>
                  </span>
                  <ChevronRightIcon
                    aria-hidden
                    className="size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                  />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </PanelPage>
  );
}
