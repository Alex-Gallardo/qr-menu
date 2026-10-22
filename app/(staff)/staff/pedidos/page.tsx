import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { OrderInbox } from "@/features/orders/components/order-inbox";
import { listInboxOrders } from "@/features/orders/inbox";
import { PushPrompt } from "@/features/notifications/components/push-prompt";
import { StaffBar } from "@/features/staff/components/staff-bar";
import { requireStaffShift } from "@/features/staff/context";

export const metadata: Metadata = { title: "Pedidos", robots: { index: false } };

/** Bandeja del staff: solo los pedidos de la sucursal de su turno. */
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Inbox />
    </Suspense>
  );
}

async function Inbox() {
  const shift = await requireStaffShift();
  const orders = await listInboxOrders([shift.branch_id]);
  return (
    <>
      <StaffBar
        businessName={shift.business.name}
        branchName={shift.branch.name}
        staffName={shift.staff.display_name}
      />
      <div className="mx-auto grid w-full max-w-5xl gap-4 px-4 py-6">
        <h1 className="type-h1">Pedidos</h1>
        <PushPrompt mode="staff" />
        <OrderInbox
          businessId={shift.business_id}
          branchIds={[shift.branch_id]}
          showBranch={false}
          branches={[{ id: shift.branch_id, name: shift.branch.name }]}
          orders={orders}
          detailBase="/staff/pedidos"
        />
      </div>
    </>
  );
}
