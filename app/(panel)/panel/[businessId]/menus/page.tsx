import type { Metadata } from "next";
import { SectionPlaceholder } from "@/features/panel/components/section-placeholder";

export const metadata: Metadata = { title: "Menús" };

export default function Page({ params }: PageProps<"/panel/[businessId]/menus">) {
  return <SectionPlaceholder params={params} segment="menus" />;
}
