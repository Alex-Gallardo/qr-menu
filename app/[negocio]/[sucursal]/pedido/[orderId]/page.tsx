import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { getCustomerOrder } from "@/features/orders/queries";
import { getOrderReview } from "@/features/reviews/server";
import { emailEnabled } from "@/lib/email";
import { MenuFooter, MenuShell } from "@/features/public-menu/templates/clasico/components";
import { OrderConfirmation } from "@/features/public-menu/templates/clasico/order-confirmation";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Confirmación del pedido: aquí llega el comensal justo después de pedir (y
 * al regresar de WhatsApp). El link es privado: el id del pedido no se adivina.
 */

export const metadata: Metadata = {
  title: "Tu pedido",
  robots: { index: false, follow: false },
};

export default function Page({ params }: PageProps<"/[negocio]/[sucursal]/pedido/[orderId]">) {
  return (
    <Suspense
      fallback={
        <div className="mx-auto grid max-w-[480px] justify-items-center gap-4 px-4 pt-12">
          <Skeleton className="size-20 rounded-full" />
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-40 w-full" />
        </div>
      }
    >
      <Content params={params} />
    </Suspense>
  );
}

async function Content({
  params,
}: {
  params: Promise<{ negocio: string; sucursal: string; orderId: string }>;
}) {
  const { negocio, sucursal, orderId } = await params;
  const data = await getCustomerOrder(negocio, sucursal, orderId);
  if (!data) notFound();
  const review = await getOrderReview(data.id);
  return (
    <MenuShell theme={data.business.theme}>
      <OrderConfirmation
        orderId={data.id}
        status={data.status}
        statusLabel={data.statusLabel}
        order={data.order}
        branchWhatsapp={data.branch.whatsapp}
        message={data.message}
        whatsappUrl={data.whatsappUrl}
        bankAccounts={data.bankAccounts}
        menuHref={`/${data.business.slug}/${data.branch.slug}`}
        emailNotice={data.hasEmail && emailEnabled()}
        review={review}
      />
      <MenuFooter showPoweredBy={data.business.theme.showPoweredBy} />
    </MenuShell>
  );
}
