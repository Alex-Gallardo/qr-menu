import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "@/lib/zod";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { PanelPage } from "@/features/panel/components/panel-page";
import { getPanelContext } from "@/features/panel/context";
import { panelHref } from "@/features/panel/nav";
import { ProductForm } from "@/features/products/components/product-form";
import { toProductFormInput } from "@/features/products/form-values";
import { getProductForEdit, listCatalog } from "@/features/products/server";

export const metadata: Metadata = { title: "Producto" };

export default function Page({ params }: PageProps<"/panel/[businessId]/productos/[productId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditProduct params={params} />
    </Suspense>
  );
}

async function EditProduct({
  params,
}: {
  params: Promise<{ businessId: string; productId: string }>;
}) {
  const { businessId, productId } = await params;
  if (!z.uuid().safeParse(productId).success) notFound();
  const ctx = await getPanelContext(businessId);
  const branchIds = ctx.branches.map((b) => b.id);
  const [product, { categories }] = await Promise.all([
    getProductForEdit(businessId, productId, branchIds),
    listCatalog(businessId, []),
  ]);
  if (!product) notFound();

  return (
    <PanelPage title={product.name} description="Foto, precio y disponibilidad por sucursal.">
      <ProductForm
        mode="edit"
        initial={toProductFormInput(businessId, product, branchIds)}
        categories={categories}
        branches={ctx.branches.map((b) => ({ id: b.id, name: b.name }))}
        canToggleEverywhere={ctx.member.allBranches}
        listHref={panelHref(businessId, "productos")}
      />
    </PanelPage>
  );
}
