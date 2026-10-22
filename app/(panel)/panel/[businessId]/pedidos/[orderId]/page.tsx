import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { OrderDetail } from "@/features/orders/components/order-detail";
import { getOrderDetail } from "@/features/orders/inbox";
import { getPanelContext } from "@/features/panel/context";
import { panelHref } from "@/features/panel/nav";

export const metadata: Metadata = { title: "Pedido" };

export default function Page({ params }: PageProps<"/panel/[businessId]/pedidos/[orderId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: Promise<{ businessId: string; orderId: string }> }) {
  const { businessId, orderId } = await params;
  const ctx = await getPanelContext(businessId);
  // Solo pedidos de las sucursales que el usuario puede ver (si no, 404).
  const order = /^[0-9a-f-]{36}$/i.test(orderId)
    ? await getOrderDetail(
        businessId,
        orderId,
        ctx.branches.map((b) => b.id),
      )
    : null;
  if (!order) notFound();
  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-6 lg:px-8 lg:py-10">
      <OrderDetail
        businessId={businessId}
        order={order}
        backHref={panelHref(businessId, "pedidos")}
      />
    </div>
  );
}
