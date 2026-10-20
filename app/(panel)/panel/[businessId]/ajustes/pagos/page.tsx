import type { Metadata } from "next";
import { SectionPlaceholder } from "@/features/panel/components/section-placeholder";

export const metadata: Metadata = { title: "Cuentas para transferencia" };

export default function Page({ params }: PageProps<"/panel/[businessId]/ajustes/pagos">) {
  return <SectionPlaceholder params={params} segment="ajustes/pagos" />;
}
