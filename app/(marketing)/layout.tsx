import { GoogleAnalytics } from "@/features/marketing/components/ga";
import { SiteFooter, SiteHeader, WhatsAppFab } from "@/features/marketing/components/site-chrome";

/** Páginas públicas de la plataforma: landing, precios y legal (con GA4 si está configurado). */
export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <SiteHeader />
      {children}
      <SiteFooter />
      <WhatsAppFab />
      <GoogleAnalytics />
    </>
  );
}
