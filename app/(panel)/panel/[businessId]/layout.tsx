import { Suspense } from "react";
import { getPanelContext } from "@/features/panel/context";
import { PanelShell, PanelShellSkeleton } from "@/features/panel/components/panel-shell";

/**
 * Marco del panel del negocio. La sesión se lee dentro de Suspense (Cache
 * Components); cada página vuelve a validar su acceso con getPanelContext
 * (la misma lectura cacheada por request).
 */
export default function PanelLayout({ children, params }: LayoutProps<"/panel/[businessId]">) {
  return (
    <Suspense fallback={<PanelShellSkeleton />}>
      <Shell params={params}>{children}</Shell>
    </Suspense>
  );
}

async function Shell({
  params,
  children,
}: {
  params: Promise<{ businessId: string }>;
  children: React.ReactNode;
}) {
  const { businessId } = await params;
  const ctx = await getPanelContext(businessId);
  return <PanelShell ctx={ctx}>{children}</PanelShell>;
}
