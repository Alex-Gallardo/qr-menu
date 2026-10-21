import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { BranchForm } from "@/features/branches/components/branch-form";
import { toBranchFormInput } from "@/features/branches/form-values";
import { LimitCard } from "@/features/licensing/components/limit-card";
import { checkLimit } from "@/features/licensing/limits";
import { getUsage } from "@/features/licensing/server";
import { PanelPage } from "@/features/panel/components/panel-page";
import { getPanelContext } from "@/features/panel/context";
import { panelHref } from "@/features/panel/nav";
import { BRAND } from "@/lib/brand";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Nueva sucursal" };

export default function Page({ params }: PageProps<"/panel/[businessId]/sucursales/nueva">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewBranch params={params} />
    </Suspense>
  );
}

async function NewBranch({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await getPanelContext(businessId);
  if (ctx.member.role !== "owner") notFound();

  const [used, firstBranch] = await Promise.all([
    getUsage(businessId, "branches"),
    db().branches.findFirst({
      where: { business_id: businessId },
      orderBy: [{ sort: "asc" }, { created_at: "asc" }],
      select: { city: true, lat: true, lng: true },
    }),
  ]);
  const limit = checkLimit(ctx.entitlements.limits, "branches", used);
  const canPreorder = ctx.entitlements.features.includes("preorders");

  return (
    <PanelPage
      title="Nueva sucursal"
      description="Tu catálogo es el mismo; cada sucursal tiene su WhatsApp, horario y zona de entrega."
    >
      {limit.ok ? (
        <BranchForm
          mode="create"
          initial={toBranchFormInput(businessId, null, { city: firstBranch?.city, canPreorder })}
          publicPrefix={`${new URL(BRAND.url).host}/${ctx.business.slug}/`}
          canPreorder={canPreorder}
          listHref={panelHref(businessId, "sucursales")}
          mapCenter={
            firstBranch?.lat != null && firstBranch.lng != null
              ? { lat: firstBranch.lat, lng: firstBranch.lng }
              : undefined
          }
        />
      ) : (
        <LimitCard
          message={limit.message}
          licenseHref={panelHref(businessId, "ajustes/licencia")}
        />
      )}
    </PanelPage>
  );
}
