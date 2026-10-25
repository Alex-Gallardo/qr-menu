import type { Metadata } from "next";
import { Bricolage_Grotesque, Inter } from "next/font/google";
import { GlobalFeedback } from "@/components/feedback/global-feedback";
import { BRAND } from "@/lib/brand";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
  display: "swap",
});

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
    <html lang="es-GT" className={`${inter.variable} ${bricolage.variable}`}>
      <body>
        {children}
        <GlobalFeedback />
      </body>
    </html>
  );
}
