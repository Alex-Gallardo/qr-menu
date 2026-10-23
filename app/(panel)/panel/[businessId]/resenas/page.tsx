import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { PanelPage } from "@/features/panel/components/panel-page";
import { getPanelContext } from "@/features/panel/context";
import { panelHref } from "@/features/panel/nav";
import { ReviewsBoard } from "@/features/reviews/components/reviews-board";
import { branchGoogleUrls, listReviews } from "@/features/reviews/server";
import { formatWhenGT } from "@/lib/gt-time";

export const metadata: Metadata = { title: "Reseñas" };

export default function Page({ params }: PageProps<"/panel/[businessId]/resenas">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Reviews params={params} />
    </Suspense>
  );
}

async function Reviews({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await getPanelContext(businessId);
  if (ctx.branches.length === 0) notFound();
  const branchIds = ctx.branches.map((b) => b.id);
  const [reviews, googleUrls] = await Promise.all([
    listReviews(businessId, branchIds),
    branchGoogleUrls(businessId, branchIds),
  ]);
  const now = new Date();

  return (
    <PanelPage
      title="Reseñas"
      description="Lo que opinan tus clientes de cada sucursal, y cuántos lo publican también en Google."
    >
      <ReviewsBoard
        businessId={businessId}
        branches={ctx.branches.map((b) => ({
          id: b.id,
          name: b.name,
          googleUrl: googleUrls[b.id] ?? null,
        }))}
        initialBranchId={
          ctx.selectedBranch && branchIds.includes(ctx.selectedBranch)
            ? ctx.selectedBranch
            : branchIds.length > 1
              ? "all"
              : branchIds[0]!
        }
        reviews={reviews.map(({ createdAt, ...r }) => ({
          ...r,
          when: formatWhenGT(createdAt, now),
        }))}
        branchesHref={panelHref(businessId, "sucursales")}
      />
    </PanelPage>
  );
}
