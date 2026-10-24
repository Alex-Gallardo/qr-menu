import type { Metadata } from "next";
import { ArrowLeftIcon } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "@/lib/zod";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { Button } from "@/components/ui/button";
import { MenuEditor } from "@/features/menus/components/menu-editor";
import { getMenuForEdit, listPickerProducts } from "@/features/menus/server";
import { allowedTemplates, type MenuTemplate } from "@/features/menus/structure";
import { PanelPage } from "@/features/panel/components/panel-page";
import { getPanelContext } from "@/features/panel/context";
import { panelHref } from "@/features/panel/nav";

export const metadata: Metadata = { title: "Editar menú" };

export default function Page({ params }: PageProps<"/panel/[businessId]/menus/[menuId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditMenu params={params} />
    </Suspense>
  );
}

async function EditMenu({ params }: { params: Promise<{ businessId: string; menuId: string }> }) {
  const { businessId, menuId } = await params;
  if (!z.uuid().safeParse(menuId).success) notFound();
  const ctx = await getPanelContext(businessId);
  const [menu, products] = await Promise.all([
    getMenuForEdit(businessId, menuId),
    listPickerProducts(businessId),
  ]);
  if (!menu) notFound();

  // Productos borrados del catálogo no se muestran (al guardar salen del menú).
  const live = new Set(products.map((p) => p.id));
  const initial = {
    name: menu.name,
    description: menu.description ?? "",
    template: (menu.template ?? "clasico") as MenuTemplate,
    sections: menu.sections.map((s) => ({
      key: s.id,
      name: s.name,
      description: s.description ?? "",
      items: s.items
        .filter((i) => live.has(i.product_id))
        .map((i) => ({
          key: i.id,
          productId: i.product_id,
          price: i.price_override_cents === null ? "" : String(i.price_override_cents / 100),
          isFeatured: i.is_featured,
        })),
    })),
  };

  return (
    <PanelPage
      title={menu.name}
      description={
        menu.is_default
          ? "Tu menú predeterminado. Los cambios se guardan solos."
          : "Los cambios se guardan solos."
      }
      actions={
        <Button asChild variant="ghost" size="sm">
          <Link href={panelHref(businessId, "menus")}>
            <ArrowLeftIcon />
            Menús
          </Link>
        </Button>
      }
    >
      <MenuEditor
        businessId={businessId}
        menuId={menu.id}
        initial={initial}
        products={products}
        allowedTemplates={allowedTemplates(ctx.entitlements.features.includes("all_templates"))}
      />
    </PanelPage>
  );
}
