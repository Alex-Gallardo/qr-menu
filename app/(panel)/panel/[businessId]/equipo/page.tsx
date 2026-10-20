import type { Metadata } from "next";
import { SectionPlaceholder } from "@/features/panel/components/section-placeholder";

export const metadata: Metadata = { title: "Equipo" };

export default function Page({ params }: PageProps<"/panel/[businessId]/equipo">) {
  return <SectionPlaceholder params={params} segment="equipo" />;
}
