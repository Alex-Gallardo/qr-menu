import type { Metadata } from "next";
import { SectionPlaceholder } from "@/features/panel/components/section-placeholder";

export const metadata: Metadata = { title: "Datos del negocio" };

export default function Page({ params }: PageProps<"/panel/[businessId]/ajustes/negocio">) {
  return <SectionPlaceholder params={params} segment="ajustes/negocio" />;
}
