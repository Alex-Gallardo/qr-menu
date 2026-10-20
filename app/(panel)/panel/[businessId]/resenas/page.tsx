import type { Metadata } from "next";
import { SectionPlaceholder } from "@/features/panel/components/section-placeholder";

export const metadata: Metadata = { title: "Reseñas" };

export default function Page({ params }: PageProps<"/panel/[businessId]/resenas">) {
  return <SectionPlaceholder params={params} segment="resenas" />;
}
