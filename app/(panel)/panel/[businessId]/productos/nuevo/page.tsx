import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { LimitCard } from "@/features/licensing/components/limit-card";
import { checkLimit } from "@/features/licensing/limits";
import { getUsage } from "@/features/licensing/server";
import { PanelPage } from "@/features/panel/components/panel-page";
import { getPanelContext } from "@/features/panel/context";
import { panelHref } from "@/features/panel/nav";
import { ProductForm } from "@/features/products/components/product-form";
import { toProductFormInput } from "@/features/products/form-values";
import { listCatalog } from "@/features/products/server";

export const metadata: Metadata = { title: "Nuevo producto" };

export default function Page({ params }: PageProps<"/panel/[businessId]/productos/nuevo">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewProduct params={params} />
    </Suspense>
  );
}

async function NewProduct({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await getPanelContext(businessId);
  const [{ categories }, used] = await Promise.all([
    listCatalog(businessId, []),
    getUsage(businessId, "products"),
  ]);
  const limit = checkLimit(ctx.entitlements.limits, "products", used);

  return (
    <PanelPage title="Nuevo producto" description="Foto, nombre, precio y dónde está disponible.">
      {limit.ok ? (
        <ProductForm
          mode="create"
          initial={toProductFormInput(
            businessId,
            null,
            ctx.branches.map((b) => b.id),
          )}
          categories={categories}
          branches={ctx.branches.map((b) => ({ id: b.id, name: b.name }))}
          canToggleEverywhere={ctx.member.allBranches}
          listHref={panelHref(businessId, "productos")}
        />
      ) : (
        <LimitCard
          message={limit.message}
          licenseHref={
            ctx.member.role === "owner" ? panelHref(businessId, "ajustes/licencia") : undefined
          }
        />
      )}
    </PanelPage>
  );
}
