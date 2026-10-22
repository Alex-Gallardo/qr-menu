import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { PanelPage } from "@/features/panel/components/panel-page";
import { ALL_BRANCHES } from "@/features/panel/branch-selection";
import { getPanelContext } from "@/features/panel/context";
import { DevicesList } from "@/features/staff/components/devices-list";
import { listStaffAndDevices } from "@/features/staff/server";

export const metadata: Metadata = { title: "Equipo" };

/**
 * Equipo: por ahora, los dispositivos autorizados para el staff con PIN y el
 * staff de cada sucursal. Invitar encargados y editar PINs llega en QRM-040.
 */
export default function Page({ params }: PageProps<"/panel/[businessId]/equipo">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Team params={params} />
    </Suspense>
  );
}

async function Team({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await getPanelContext(businessId);
  const branchIds =
    ctx.selectedBranch === ALL_BRANCHES || !ctx.selectedBranch
      ? ctx.branches.map((b) => b.id)
      : [ctx.selectedBranch];
  const { devices, staff } = await listStaffAndDevices(branchIds);

  return (
    <PanelPage title="Equipo" description="Dispositivos autorizados y staff con PIN.">
      <section className="grid gap-3">
        <h2 className="type-h3">Dispositivos autorizados</h2>
        <DevicesList
          businessId={businessId}
          devices={devices.map((d) => ({
            id: d.id,
            name: d.name,
            branch: { name: d.branch.name },
            lastSeenAt: d.last_seen_at,
            createdAt: d.created_at,
          }))}
        />
      </section>
      <section className="grid gap-3">
        <h2 className="type-h3">Staff con PIN</h2>
        {staff.length === 0 ? (
          <p className="type-body text-muted-foreground">Todavía no hay staff en esta sucursal.</p>
        ) : (
          <ul className="grid gap-2">
            {staff.map((s) => (
              <li
                key={s.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card p-3"
              >
                <span className="type-body font-semibold">{s.display_name}</span>
                <span className="type-small text-muted-foreground">
                  {s.branch.name}
                  {s.is_active ? "" : " · inactivo"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </PanelPage>
  );
}
