import type { Metadata } from "next";
import { SectionPlaceholder } from "@/features/panel/components/section-placeholder";

export const metadata: Metadata = { title: "Apariencia" };

export default function Page({ params }: PageProps<"/panel/[businessId]/apariencia">) {
  return <SectionPlaceholder params={params} segment="apariencia" />;
}
