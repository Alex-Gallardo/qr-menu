import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { PanelPage } from "@/features/panel/components/panel-page";
import { getPanelContext } from "@/features/panel/context";
import { CategoriesManager } from "@/features/products/components/categories-manager";
import { listCatalog } from "@/features/products/server";

export const metadata: Metadata = { title: "Categorías" };

export default function Page({ params }: PageProps<"/panel/[businessId]/productos/categorias">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Categories params={params} />
    </Suspense>
  );
}

async function Categories({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  await getPanelContext(businessId);
  const { categories } = await listCatalog(businessId, []);

  return (
    <PanelPage
      title="Categorías"
      description="Agrupan tus productos en el menú. El orden de aquí es el orden de tu menú."
    >
      <CategoriesManager businessId={businessId} categories={categories} />
    </PanelPage>
  );
}
