import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(BRAND.url),
  title: {
    default: BRAND.name,
    template: `%s · ${BRAND.name}`,
  },
  description: BRAND.tagline,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-GT">
      <body>{children}</body>
    </html>
  );
}
