import type { Metadata } from "next";
import { SectionPlaceholder } from "@/features/panel/components/section-placeholder";

export const metadata: Metadata = { title: "Mi plan" };

export default function Page({ params }: PageProps<"/panel/[businessId]/ajustes/licencia">) {
  return <SectionPlaceholder params={params} segment="ajustes/licencia" />;
}
