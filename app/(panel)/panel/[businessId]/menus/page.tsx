import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { LimitCard } from "@/features/licensing/components/limit-card";
import { checkLimit } from "@/features/licensing/limits";
import { getUsage } from "@/features/licensing/server";
import { MenusList } from "@/features/menus/components/menus-list";
import { listMenus } from "@/features/menus/server";
import { PanelPage } from "@/features/panel/components/panel-page";
import { getPanelContext } from "@/features/panel/context";
import { panelHref } from "@/features/panel/nav";

export const metadata: Metadata = { title: "Menús" };

export default function Page({ params }: PageProps<"/panel/[businessId]/menus">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Menus params={params} />
    </Suspense>
  );
}

async function Menus({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await getPanelContext(businessId);
  const [menus, used] = await Promise.all([listMenus(businessId), getUsage(businessId, "menus")]);
  const limit = checkLimit(ctx.entitlements.limits, "menus", used);

  return (
    <PanelPage
      title="Menús"
      description={
        limit.limit === null
          ? "Arma tus menús con productos de tu catálogo."
          : `Usas ${used} de ${limit.limit} ${limit.limit === 1 ? "menú" : "menús"} de tu plan.`
      }
    >
      <MenusList
        businessId={businessId}
        menus={menus}
        menusHref={panelHref(businessId, "menus")}
        canCreate={limit.ok}
        limitNotice={
          limit.ok ? null : (
            <LimitCard
              message={limit.message}
              licenseHref={
                ctx.member.role === "owner" ? panelHref(businessId, "ajustes/licencia") : undefined
              }
            />
          )
        }
      />
    </PanelPage>
  );
}
