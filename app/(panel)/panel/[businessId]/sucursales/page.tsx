import type { Metadata } from "next";
import { SectionPlaceholder } from "@/features/panel/components/section-placeholder";

export const metadata: Metadata = { title: "Sucursales" };

export default function Page({ params }: PageProps<"/panel/[businessId]/sucursales">) {
  return <SectionPlaceholder params={params} segment="sucursales" />;
}
