import type { Metadata } from "next";
import { SectionPlaceholder } from "@/features/panel/components/section-placeholder";

export const metadata: Metadata = { title: "Analíticas" };

export default function Page({ params }: PageProps<"/panel/[businessId]/analiticas">) {
  return <SectionPlaceholder params={params} segment="analiticas" />;
}
