import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { appearanceAllowance } from "@/features/appearance/appearance";
import { AppearanceEditor } from "@/features/appearance/components/appearance-editor";
import { getAppearancePage } from "@/features/appearance/server";
import { PanelPage } from "@/features/panel/components/panel-page";
import { requireOwnerPage } from "@/features/panel/context";
import { panelHref } from "@/features/panel/nav";

export const metadata: Metadata = { title: "Apariencia" };

export default function Page({ params }: PageProps<"/panel/[businessId]/apariencia">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Appearance params={params} />
    </Suspense>
  );
}

async function Appearance({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  await requireOwnerPage(businessId, "apariencia");
  const data = await getAppearancePage(businessId);
  if (!data) notFound();
  const { business } = data;

  return (
    <PanelPage
      title="Apariencia"
      description="Colores, fondo, fuentes, bienvenida y carga de tu menú. Los cambios se guardan solos."
    >
      <AppearanceEditor
        businessId={businessId}
        initial={data.doc}
        allow={appearanceAllowance(data.features)}
        licenseHref={panelHref(businessId, "ajustes/licencia")}
        menuHref={business.branch ? `/${business.slug}/${business.branch.slug}` : null}
        business={{
          name: business.name,
          description: business.description,
          logoUrl: business.logoUrl,
          coverUrl: business.coverUrl,
          branchName: business.branch?.name ?? "Tu sucursal",
          products: business.products,
        }}
      />
    </PanelPage>
  );
}
