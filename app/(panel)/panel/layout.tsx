import type { Metadata, Viewport } from "next";
import { MANIFEST_PATHS, THEME_COLOR } from "@/features/notifications/manifest";
import { BRAND } from "@/lib/brand";

/** El panel se instala como app (necesario para los avisos en iPhone). */
export const metadata: Metadata = {
  manifest: MANIFEST_PATHS.panel,
  appleWebApp: { capable: true, title: BRAND.name, statusBarStyle: "default" },
};

export const viewport: Viewport = { themeColor: THEME_COLOR };

export default function PanelAppLayout({ children }: LayoutProps<"/panel">) {
  return children;
}
