import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { EditorSection } from "@/features/appearance/components/controls";
import { hasFeature } from "@/features/licensing/entitlements";
import { checkLimit } from "@/features/licensing/limits";
import { getUsage } from "@/features/licensing/server";
import { ALL_BRANCHES } from "@/features/panel/branch-selection";
import { PanelPage } from "@/features/panel/components/panel-page";
import { getPanelContext } from "@/features/panel/context";
import { panelHref } from "@/features/panel/nav";
import { DevicesList } from "@/features/staff/components/devices-list";
import { listStaffAndDevices } from "@/features/staff/server";
import { ManagersSection } from "@/features/team/components/managers-section";
import { StaffSection } from "@/features/team/components/staff-section";
import { listManagers, listStaff } from "@/features/team/server";
import { emailEnabled } from "@/lib/email";
import { formatDateEs, formatWhenGT, todayInGuatemala } from "@/lib/gt-time";

export const metadata: Metadata = { title: "Equipo" };

/**
 * Equipo: encargados e invitaciones (solo el dueño), staff con PIN y
 * dispositivos autorizados de las sucursales que ve quien mira.
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
  const isOwner = ctx.member.role === "owner";
  // El selector de arriba filtra staff y dispositivos (como en Inicio).
  const selected =
    ctx.selectedBranch === ALL_BRANCHES || !ctx.selectedBranch
      ? ctx.branches
      : ctx.branches.filter((b) => b.id === ctx.selectedBranch);
  const branchIds = selected.map((b) => b.id);
  const licenseHref = isOwner ? panelHref(businessId, "ajustes/licencia") : undefined;
  const now = new Date();

  const [{ devices }, staff, staffUsed, team] = await Promise.all([
    listStaffAndDevices(branchIds),
    listStaff(branchIds),
    getUsage(businessId, "staff"),
    isOwner ? listManagers(businessId) : null,
  ]);
  const staffLimit = checkLimit(ctx.entitlements.limits, "staff", staffUsed);
  const pendingInvites = team?.invitations.filter((i) => !i.expired).length ?? 0;
  const managerLimit = team
    ? checkLimit(ctx.entitlements.limits, "managers", team.managers.length + pendingInvites)
    : null;
  const branchOptions = ctx.branches.map((b) => ({ id: b.id, name: b.name }));

  return (
    <PanelPage
      title="Equipo"
      description={
        isOwner
          ? "Encargados por sucursal, staff con PIN y las tablets autorizadas."
          : "El staff con PIN y las tablets de tus sucursales."
      }
    >
      {team && managerLimit ? (
        <ManagersSection
          businessId={businessId}
          businessName={ctx.business.name}
          branches={branchOptions}
          managers={team.managers}
          invitations={team.invitations.map((i) => ({
            id: i.id,
            email: i.email,
            allBranches: i.allBranches,
            branchIds: i.branchIds,
            expired: i.expired,
            until: `vence el ${formatDateEs(todayInGuatemala(i.expiresAt), now)}`,
          }))}
          limitMessage={managerLimit.ok ? null : managerLimit.message}
          licenseHref={licenseHref!}
          emailOn={emailEnabled()}
        />
      ) : null}

      <StaffSection
        businessId={businessId}
        branches={selected.map((b) => ({ id: b.id, name: b.name }))}
        staff={staff.map((s) => ({
          id: s.id,
          name: s.name,
          active: s.active,
          branchId: s.branchId,
          branchName: s.branchName,
          lastLogin: s.lastLoginAt
            ? `último turno ${formatWhenGT(s.lastLoginAt, now)}`
            : "sin turnos todavía",
        }))}
        allowed={hasFeature(ctx.entitlements, "staff_pin")}
        limitMessage={staffLimit.ok ? null : staffLimit.message}
        licenseHref={licenseHref}
      />

      <EditorSection
        title="Dispositivos autorizados"
        description="Tablets y celulares donde el staff entra con su PIN. Para agregar uno, abre /staff en ese dispositivo con tu cuenta."
      >
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
      </EditorSection>
    </PanelPage>
  );
}
