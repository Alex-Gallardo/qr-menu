import { MessageCircleIcon } from "lucide-react";
import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { BRAND } from "@/lib/brand";
import { salesWhatsappUrl } from "../content";
import { TrackedLink } from "./tracked-link";

const salesPhone = () => process.env.NEXT_PUBLIC_SALES_WHATSAPP?.replace(/\D/g, "") || null;

const btn =
  "inline-flex h-11 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold whitespace-nowrap transition-transform active:scale-[0.97] sm:px-5";

/** Barra superior: logo, Precios, Demo, Entrar y "Pruébalo gratis". */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-30 border-b border-border/70 bg-background/90 backdrop-blur">
      <div className="mx-auto flex max-w-landing items-center gap-4 px-4 py-3">
        <Link href="/" aria-label={`${BRAND.name}: inicio`} className="shrink-0">
          <Logo />
        </Link>
        <nav aria-label="Principal" className="ml-auto flex items-center gap-1 sm:gap-3">
          <Link
            href="/precios"
            className="hidden px-2 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground sm:inline"
          >
            Precios
          </Link>
          <TrackedLink
            href="/demo"
            event="demo_open"
            place="header"
            className="hidden px-2 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground sm:inline"
          >
            Demo
          </TrackedLink>
          <Link
            href="/entrar"
            className="px-2 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
          >
            Entrar
          </Link>
          <TrackedLink
            href="/registro"
            event="cta_trial_click"
            place="header"
            className={`${btn} bg-primary text-primary-foreground`}
          >
            Pruébalo gratis
          </TrackedLink>
        </nav>
      </div>
    </header>
  );
}

/** Pie: contacto, legal y "Hecho en Guatemala". */
export function SiteFooter() {
  const phone = salesPhone();
  return (
    <footer className="border-t border-border bg-card">
      <div className="mx-auto grid max-w-landing gap-8 px-4 py-10 sm:grid-cols-3">
        <div className="grid content-start gap-2">
          <Logo />
          <p className="text-sm text-muted-foreground">{BRAND.tagline}</p>
          <p className="text-sm text-muted-foreground">Hecho en Guatemala</p>
        </div>
        <nav aria-label="Producto" className="grid content-start gap-2 text-sm">
          <p className="font-semibold">Producto</p>
          <Link href="/precios" className="text-muted-foreground hover:text-foreground">
            Precios
          </Link>
          <Link href="/demo" className="text-muted-foreground hover:text-foreground">
            Ver demo
          </Link>
          <Link href="/registro" className="text-muted-foreground hover:text-foreground">
            Crear mi menú
          </Link>
          <Link href="/entrar" className="text-muted-foreground hover:text-foreground">
            Entrar
          </Link>
        </nav>
        <nav aria-label="Contacto y legal" className="grid content-start gap-2 text-sm">
          <p className="font-semibold">Contacto</p>
          {phone ? (
            <a
              href={salesWhatsappUrl(phone, BRAND.name)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-muted-foreground hover:text-foreground"
            >
              WhatsApp de ventas
            </a>
          ) : null}
          <Link href="/legal/terminos" className="text-muted-foreground hover:text-foreground">
            Términos
          </Link>
          <Link href="/legal/privacidad" className="text-muted-foreground hover:text-foreground">
            Privacidad
          </Link>
        </nav>
      </div>
      <p className="border-t border-border px-4 py-4 text-center text-xs text-muted-foreground">
        © {BRAND.name}. Todos los derechos reservados.
      </p>
    </footer>
  );
}

/** Botón flotante de WhatsApp de ventas ("Hola, quiero mi …"). */
export function WhatsAppFab() {
  const phone = salesPhone();
  if (!phone) return null;
  return (
    <TrackedLink
      href={salesWhatsappUrl(phone, BRAND.name)}
      target="_blank"
      rel="noopener noreferrer"
      event="cta_whatsapp_click"
      place="flotante"
      aria-label="Escríbenos por WhatsApp"
      className="fixed right-4 bottom-4 z-40 grid size-14 place-items-center rounded-full bg-[#25D366] text-frijol shadow-3 transition-transform hover:scale-105 active:scale-95"
    >
      <MessageCircleIcon aria-hidden className="size-7" />
    </TrackedLink>
  );
}

export { btn as ctaClass, salesPhone };
