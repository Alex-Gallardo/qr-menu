import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { deviceLabel } from "@/features/notifications/messages";
import { PushSettings } from "@/features/notifications/components/push-settings";
import { listUserSubscriptions } from "@/features/notifications/server";
import { PanelPage } from "@/features/panel/components/panel-page";
import { getPanelContext } from "@/features/panel/context";
import { panelHref } from "@/features/panel/nav";
import { formatWhenGT } from "@/lib/gt-time";

export const metadata: Metadata = { title: "Notificaciones" };

export default function Page({ params }: PageProps<"/panel/[businessId]/ajustes/notificaciones">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Notifications params={params} />
    </Suspense>
  );
}

async function Notifications({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await getPanelContext(businessId);
  const subscriptions = await listUserSubscriptions(businessId, ctx.user.id);
  const owner = ctx.member.role === "owner";

  return (
    <PanelPage
      title="Notificaciones"
      description="Avisos de pedidos en tu celular, tablet o computadora."
    >
      <PushSettings
        businessId={businessId}
        branches={ctx.branches.map((b) => ({ id: b.id, name: b.name }))}
        allLabel={owner || ctx.member.allBranches ? "Todas las sucursales" : "Todas mis sucursales"}
        inboxHref={panelHref(businessId, "pedidos")}
        devices={subscriptions.map((s) => ({
          id: s.id,
          endpoint: s.endpoint,
          branchId: s.branch_id,
          label: deviceLabel(s.user_agent),
          detail: s.last_success_at
            ? `último aviso ${formatWhenGT(s.last_success_at)}`
            : `activado ${formatWhenGT(s.created_at)}`,
        }))}
      />
    </PanelPage>
  );
}
