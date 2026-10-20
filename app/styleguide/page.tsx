import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense, type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { getAuthUser, getProfile } from "@/lib/auth/session";
import { BrandSection } from "./_sections/brand";
import { ButtonsSection } from "./_sections/buttons";
import { ColorSection } from "./_sections/color";
import { FeedbackSection, FormsSection } from "./_sections/forms-feedback";
import { SurfacesSection } from "./_sections/surfaces";
import { TypographySection } from "./_sections/typography";

export const metadata: Metadata = {
  title: "Styleguide",
  robots: { index: false, follow: false },
};

const NAV = [
  { id: "marca", label: "Marca" },
  { id: "color", label: "Color" },
  { id: "tipografia", label: "Tipografía" },
  { id: "superficies", label: "Radios y sombras" },
  { id: "botones", label: "Botones" },
  { id: "formularios", label: "Formularios" },
  { id: "feedback", label: "Feedback" },
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
    <div className="min-h-dvh">
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur">
        <div className="mx-auto flex max-w-landing items-center gap-6 overflow-x-auto px-4 py-3">
          <Logo className="shrink-0" />
          <nav aria-label="Secciones" className="flex gap-1">
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
            Componentes reales del proyecto. Si no está aquí, todavía no existe en el diseño.
          </p>
        </div>
        <BrandSection />
        <ColorSection />
        <TypographySection />
        <SurfacesSection />
        <ButtonsSection />
        <FormsSection />
        <FeedbackSection />
      </main>
    </div>
  );
}
