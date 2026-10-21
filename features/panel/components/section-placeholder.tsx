import { Suspense } from "react";
import { EmptyState } from "@/components/feedback/empty-state";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { requireOwnerPage } from "../context";
import { SECTIONS } from "../sections";
import { NavIcon } from "./nav-icon";
import { PanelPage } from "./panel-page";

/** Página provisional de una sección: valida acceso y muestra un estado vacío que enseña. */
export function SectionPlaceholder({
  params,
  segment,
}: {
  params: Promise<{ businessId: string }>;
  segment: keyof typeof SECTIONS;
}) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Section params={params} segment={segment} />
    </Suspense>
  );
}

async function Section({
  params,
  segment,
}: {
  params: Promise<{ businessId: string }>;
  segment: string;
}) {
  const { businessId } = await params;
  await requireOwnerPage(businessId, segment);
  const section = SECTIONS[segment]!;

  return (
    <PanelPage title={section.title} description={section.description}>
      <EmptyState icon={<NavIcon name={section.icon} />} title="Muy pronto">
        {section.empty}
      </EmptyState>
    </PanelPage>
  );
}
