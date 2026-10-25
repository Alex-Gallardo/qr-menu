import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { getAuthUser, getProfile } from "@/lib/auth/session";
import { A11ySection } from "./_sections/a11y";
import { AdminSection } from "./_sections/admin";
import { BrandSection } from "./_sections/brand";
import { ButtonsSection } from "./_sections/buttons";
import { ColorSection } from "./_sections/color";
import { EmailSection } from "./_sections/email";
import { FeedbackSection, FormsSection } from "./_sections/forms-feedback";
import { IconsSection } from "./_sections/icons";
import { LoadingSection } from "./_sections/loading";
import { MotionSection } from "./_sections/motion";
import { PanelSection } from "./_sections/panel";
import { PublicMenuSection } from "./_sections/public-menu";
import { SpacingSection } from "./_sections/spacing";
import { SplashSection } from "./_sections/splash";
import { SurfacesSection } from "./_sections/surfaces";
import { StyleguideThemeProvider, ThemePicker } from "./_sections/theme-context";
import { TypographySection } from "./_sections/typography";
import { VoiceSection } from "./_sections/voice";

export const metadata: Metadata = {
  title: "Styleguide",
  robots: { index: false, follow: false },
};

const NAV = [
  { id: "marca", label: "Marca" },
  { id: "color", label: "Color" },
  { id: "tipografia", label: "Tipografía" },
  { id: "espaciado", label: "Espaciado" },
  { id: "superficies", label: "Radios y sombras" },
  { id: "iconografia", label: "Íconos" },
  { id: "botones", label: "Botones" },
  { id: "formularios", label: "Formularios" },
  { id: "bienvenida", label: "Bienvenida" },
  { id: "carga", label: "Carga" },
  { id: "publico", label: "Menú público" },
  { id: "panel", label: "Panel" },
  { id: "super-admin", label: "Super admin" },
  { id: "feedback", label: "Feedback" },
  { id: "movimiento", label: "Movimiento" },
  { id: "voz", label: "Voz" },
  { id: "accesibilidad", label: "Accesibilidad" },
  { id: "correos", label: "Correos" },
] as const;

/**
 * Fuente de verdad visual: todo componente nuevo nace aquí antes de usarse.
 * En producción solo la ve el equipo de la plataforma; en desarrollo y previews, cualquiera.
 */
export default function StyleguidePage() {
  if (process.env.VERCEL_ENV !== "production") return <Styleguide />;
  return (
    <Suspense fallback={null}>
      <PlatformOnly>
        <Styleguide />
      </PlatformOnly>
    </Suspense>
  );
}

async function PlatformOnly({ children }: { children: ReactNode }) {
  const user = await getAuthUser();
  const profile = user && !user.isAnonymous ? await getProfile(user.id) : null;
  if (!profile || profile.platform_role === "none") notFound();
  return children;
}

function Styleguide() {
  return (
    <StyleguideThemeProvider>
      <div className="min-h-dvh">
        <header className="relative z-40 border-b border-border bg-background/90 backdrop-blur md:sticky md:top-0">
          <div className="mx-auto grid max-w-landing gap-2 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <Logo className="shrink-0" />
              <ThemePicker />
            </div>
            <nav aria-label="Secciones" className="-mx-4 flex gap-1 overflow-x-auto px-4">
              {NAV.map((n) => (
                <a
                  key={n.id}
                  href={`#${n.id}`}
                  className="type-small rounded-full px-3 py-1.5 whitespace-nowrap hover:bg-muted"
                >
                  {n.label}
                </a>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-landing px-4 pb-16">
          <div className="py-10">
            <h1 className="type-h1">Styleguide</h1>
            <p className="type-body mt-2 max-w-prose text-muted-foreground">
              Componentes reales del proyecto, en el orden de la guía (17 secciones más los
              correos). Arriba eliges el tema: la marca (landing y panel) o cualquiera de las 8
              paletas, y una de las 4 plantillas del menú. Si no está aquí, todavía no existe en el
              diseño.
            </p>
          </div>
          <BrandSection />
          <ColorSection />
          <TypographySection />
          <SpacingSection />
          <SurfacesSection />
          <IconsSection />
          <ButtonsSection />
          <FormsSection />
          <SplashSection />
          <LoadingSection />
          <PublicMenuSection />
          <PanelSection />
          <AdminSection />
          <FeedbackSection />
          <MotionSection />
          <VoiceSection />
          <A11ySection />
          <EmailSection />
        </main>
      </div>
    </StyleguideThemeProvider>
  );
}
