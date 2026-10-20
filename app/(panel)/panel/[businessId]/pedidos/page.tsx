import type { Metadata } from "next";
import { SectionPlaceholder } from "@/features/panel/components/section-placeholder";

export const metadata: Metadata = { title: "Pedidos" };

export default function Page({ params }: PageProps<"/panel/[businessId]/pedidos">) {
  return <SectionPlaceholder params={params} segment="pedidos" />;
}
