import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { OrderDetail } from "@/features/orders/components/order-detail";
import { getOrderDetail } from "@/features/orders/inbox";
import { StaffBar } from "@/features/staff/components/staff-bar";
import { requireStaffShift } from "@/features/staff/context";

export const metadata: Metadata = { title: "Pedido", robots: { index: false } };

export default function Page({ params }: PageProps<"/staff/pedidos/[orderId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Detail params={params} />
    </Suspense>
  );
}

async function Detail({ params }: { params: Promise<{ orderId: string }> }) {
  const { orderId } = await params;
  const shift = await requireStaffShift();
  // Solo pedidos de la sucursal del turno.
  const order = /^[0-9a-f-]{36}$/i.test(orderId)
    ? await getOrderDetail(shift.business_id, orderId, [shift.branch_id])
    : null;
  if (!order) notFound();
  return (
    <>
      <StaffBar
        businessName={shift.business.name}
        branchName={shift.branch.name}
        staffName={shift.staff.display_name}
      />
      <div className="mx-auto w-full max-w-3xl px-4 py-6">
        <OrderDetail businessId={shift.business_id} order={order} backHref="/staff/pedidos" />
      </div>
    </>
  );
}
