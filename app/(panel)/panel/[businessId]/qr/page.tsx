import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { checkLimit } from "@/features/licensing/limits";
import { getUsage } from "@/features/licensing/server";
import { PanelPage } from "@/features/panel/components/panel-page";
import { getPanelContext } from "@/features/panel/context";
import { panelHref } from "@/features/panel/nav";
import { getPublicBusiness } from "@/features/public-menu/data";
import { qrColor } from "@/features/qr/matrix";
import { QrManager } from "@/features/qr/components/qr-manager";
import { listQrCodes } from "@/features/qr/server";
import { fontClasses } from "@/features/appearance/font-loaders";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "QR y compartir" };

export default function Page({ params }: PageProps<"/panel/[businessId]/qr">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Qr params={params} />
    </Suspense>
  );
}

async function Qr({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const ctx = await getPanelContext(businessId);
  if (ctx.branches.length === 0) notFound();
  const branchIds = ctx.branches.map((b) => b.id);
  const [qrs, used, publicBusiness] = await Promise.all([
    listQrCodes(businessId, branchIds),
    getUsage(businessId, "qr"),
    getPublicBusiness(ctx.business.slug),
  ]);
  const limit = checkLimit(ctx.entitlements.limits, "qr", used);
  // Colores y fuentes de Apariencia (en la versión que permite su plan).
  const theme = publicBusiness?.theme;
  const isOwner = ctx.member.role === "owner";

  return (
    <PanelPage
      title="QR y compartir"
      description="QR de cada sucursal, de tus mesas y de campañas, listos para imprimir. Y textos para tus redes."
    >
      <div className={theme ? fontClasses(theme.fontHeading, theme.fontBody) : undefined}>
        <QrManager
          businessId={businessId}
          businessSlug={ctx.business.slug}
          branches={ctx.branches.map((b) => ({ id: b.id, name: b.name, slug: b.slug }))}
          initialBranchId={
            ctx.selectedBranch && branchIds.includes(ctx.selectedBranch)
              ? ctx.selectedBranch
              : branchIds[0]!
          }
          qrs={qrs}
          appUrl={BRAND.url}
          brand={{
            businessName: ctx.business.name,
            logoUrl: ctx.business.logo_url,
            color: theme ? qrColor(theme) : "#231A17",
            headingFont: `"${theme?.fontHeading ?? "Bricolage Grotesque"}"`,
            bodyFont: `"${theme?.fontBody ?? "Inter"}"`,
          }}
          limitMessage={limit.ok ? null : limit.message}
          licenseHref={isOwner ? panelHref(businessId, "ajustes/licencia") : undefined}
        />
      </div>
    </PanelPage>
  );
}
