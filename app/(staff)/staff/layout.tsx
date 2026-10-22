import type { Metadata, Viewport } from "next";
import { MANIFEST_PATHS, THEME_COLOR } from "@/features/notifications/manifest";

/** La bandeja del staff se instala como app en la tablet o el celular de la sucursal. */
export const metadata: Metadata = {
  manifest: MANIFEST_PATHS.staff,
  appleWebApp: { capable: true, title: "Pedidos", statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: THEME_COLOR };

export default function StaffAppLayout({ children }: LayoutProps<"/staff">) {
  return children;
}
