import type { Metadata } from "next";
import { SectionPlaceholder } from "@/features/panel/components/section-placeholder";

export const metadata: Metadata = { title: "QR y compartir" };

export default function Page({ params }: PageProps<"/panel/[businessId]/qr">) {
  return <SectionPlaceholder params={params} segment="qr" />;
}
