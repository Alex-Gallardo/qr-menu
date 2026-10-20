import type { Metadata } from "next";
import { SectionPlaceholder } from "@/features/panel/components/section-placeholder";

export const metadata: Metadata = { title: "Productos" };

export default function Page({ params }: PageProps<"/panel/[businessId]/productos">) {
  return <SectionPlaceholder params={params} segment="productos" />;
}
