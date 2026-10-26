import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { requirePlatform } from "@/features/admin/access";
import { AssistedBusinessForm } from "@/features/admin/components/assisted-business-form";
import { getPlatformSettings } from "@/features/admin/settings";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Crear negocio" };

// Ver admin/layout.tsx: el super admin siempre espera al servidor.
export const instant = false;

/** Alta asistida de un fundador (guía A1). */
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <NewBusiness />
    </Suspense>
  );
}

async function NewBusiness() {
  await requirePlatform("businesses.create", "/admin/negocios/nuevo");
  const settings = await getPlatformSettings();
  return (
    <>
      <h1 className="type-h1">Crear negocio</h1>
      <p className="type-body text-muted-foreground">
        Para un fundador o una demo: queda sin publicar, con la licencia que elijas y una invitación
        de dueño para su correo.
      </p>
      <AssistedBusinessForm
        appHost={new URL(BRAND.url).host}
        trialDays={settings.trialDays}
        founderTrialDays={settings.founderTrialDays}
      />
    </>
  );
}
