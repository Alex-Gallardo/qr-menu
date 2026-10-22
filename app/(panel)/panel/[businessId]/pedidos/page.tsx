import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { OrderInbox } from "@/features/orders/components/order-inbox";
import { listInboxOrders } from "@/features/orders/inbox";
import { ALL_BRANCHES } from "@/features/panel/branch-selection";
import { PanelPage } from "@/features/panel/components/panel-page";
import { getPanelContext } from "@/features/panel/context";

export const metadata: Metadata = { title: "Pedidos" };

export default function Page({ params }: PageProps<"/panel/[businessId]/pedidos">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Inbox params={params} />
    </Suspense>
  );
}

async function Inbox({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await getPanelContext(businessId);
  // "Todas" (solo el dueño) o la sucursal elegida en el selector de arriba.
  const branchIds =
    ctx.selectedBranch === ALL_BRANCHES || !ctx.selectedBranch
      ? ctx.branches.map((b) => b.id)
      : [ctx.selectedBranch];
  const orders = await listInboxOrders(branchIds);
  const branchName =
    branchIds.length === 1 ? ctx.branches.find((b) => b.id === branchIds[0])?.name : null;

  return (
    <PanelPage
      title="Pedidos"
      description={branchName ? `Bandeja de ${branchName}.` : "Bandeja de todas tus sucursales."}
    >
      <OrderInbox
        businessId={businessId}
        branchIds={branchIds}
        showBranch={branchIds.length > 1}
        branches={ctx.branches.map((b) => ({ id: b.id, name: b.name }))}
        orders={orders}
      />
    </PanelPage>
  );
}
