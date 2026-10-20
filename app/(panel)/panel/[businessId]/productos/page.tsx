import type { Metadata } from "next";
import { PlusIcon, TagsIcon } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { Button } from "@/components/ui/button";
import { LimitCard } from "@/features/licensing/components/limit-card";
import { checkLimit } from "@/features/licensing/limits";
import { getUsage } from "@/features/licensing/server";
import { PanelPage } from "@/features/panel/components/panel-page";
import { ALL_BRANCHES } from "@/features/panel/branch-selection";
import { getPanelContext } from "@/features/panel/context";
import { panelHref } from "@/features/panel/nav";
import { ProductCatalog } from "@/features/products/components/product-catalog";
import { listCatalog } from "@/features/products/server";

export const metadata: Metadata = { title: "Productos" };

export default function Page({ params }: PageProps<"/panel/[businessId]/productos">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Products params={params} />
    </Suspense>
  );
}

async function Products({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await getPanelContext(businessId);
  const branchIds = ctx.branches.map((b) => b.id);
  const [catalog, used] = await Promise.all([
    listCatalog(businessId, branchIds),
    getUsage(businessId, "products"),
  ]);
  const limit = checkLimit(ctx.entitlements.limits, "products", used);
  const productsHref = panelHref(businessId, "productos");
  const branchId =
    ctx.selectedBranch && ctx.selectedBranch !== ALL_BRANCHES ? ctx.selectedBranch : null;

  return (
    <PanelPage
      title="Productos"
      description={
        limit.limit === null
          ? `${used} productos en tu catálogo.`
          : `Usas ${used} de ${limit.limit} productos de tu plan.`
      }
      actions={
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href={`${productsHref}/categorias`}>
              <TagsIcon />
              Categorías
            </Link>
          </Button>
          {limit.ok ? (
            <Button asChild>
              <Link href={`${productsHref}/nuevo`}>
                <PlusIcon />
                Agregar producto
              </Link>
            </Button>
          ) : null}
        </div>
      }
    >
      {!limit.ok ? (
        <LimitCard
          message={limit.message}
          licenseHref={
            ctx.member.role === "owner" ? panelHref(businessId, "ajustes/licencia") : undefined
          }
        />
      ) : null}
      <ProductCatalog
        businessId={businessId}
        products={catalog.products}
        categories={catalog.categories}
        branches={ctx.branches.map((b) => ({ id: b.id, name: b.name }))}
        branchId={branchId}
        canToggleEverywhere={ctx.member.allBranches}
        productsHref={productsHref}
      />
    </PanelPage>
  );
}
