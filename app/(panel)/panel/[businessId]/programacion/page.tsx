import type { Metadata } from "next";
import { SectionPlaceholder } from "@/features/panel/components/section-placeholder";

export const metadata: Metadata = { title: "Programación" };

export default function Page({ params }: PageProps<"/panel/[businessId]/programacion">) {
  return <SectionPlaceholder params={params} segment="programacion" />;
}
