import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { z } from "@/lib/zod";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { BranchForm } from "@/features/branches/components/branch-form";
import { toBranchFormInput } from "@/features/branches/form-values";
import { getBranch } from "@/features/branches/server";
import { PanelPage } from "@/features/panel/components/panel-page";
import { getPanelContext } from "@/features/panel/context";
import { panelHref } from "@/features/panel/nav";
import { canSeeBranch } from "@/lib/auth/access";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Sucursal" };

export default function Page({ params }: PageProps<"/panel/[businessId]/sucursales/[branchId]">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <EditBranch params={params} />
    </Suspense>
  );
}

async function EditBranch({
  params,
}: {
  params: Promise<{ businessId: string; branchId: string }>;
}) {
  const { businessId, branchId } = await params;
  if (!z.uuid().safeParse(branchId).success) notFound();
  const ctx = await getPanelContext(businessId);
  // El encargado solo edita sus sucursales.
  if (!canSeeBranch(ctx.member, branchId)) notFound();

  const branch = await getBranch(businessId, branchId);
  if (!branch) notFound();
  const canPreorder = ctx.entitlements.features.includes("preorders");

  return (
    <PanelPage
      title={branch.name}
      description="Datos, horario, entregas y pedidos fuera de horario."
    >
      <BranchForm
        mode="edit"
        initial={toBranchFormInput(businessId, branch, { canPreorder })}
        publicPrefix={`${new URL(BRAND.url).host}/${ctx.business.slug}/`}
        canPreorder={canPreorder}
        listHref={panelHref(businessId, "sucursales")}
      />
    </PanelPage>
  );
}
