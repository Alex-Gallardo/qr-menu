import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { BusinessSettingsForm } from "@/features/businesses/components/business-settings-form";
import { getBusinessSettings } from "@/features/businesses/server";
import { PanelPage } from "@/features/panel/components/panel-page";
import { requireOwnerPage } from "@/features/panel/context";
import { BRAND } from "@/lib/brand";

export const metadata: Metadata = { title: "Datos del negocio" };

export default function Page({ params }: PageProps<"/panel/[businessId]/ajustes/negocio">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <BusinessSettings params={params} />
    </Suspense>
  );
}

async function BusinessSettings({ params }: { params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  await requireOwnerPage(businessId, "ajustes/negocio");
  const settings = await getBusinessSettings(businessId);
  if (!settings) notFound();
  const { id, ...initial } = settings;

  return (
    <PanelPage title="Datos del negocio" description="Nombre, link, redes y mensaje de WhatsApp.">
      <BusinessSettingsForm
        businessId={id}
        appHost={new URL(BRAND.url).host}
        initial={{
          ...initial,
          description: initial.description ?? "",
          email: initial.email ?? "",
          instagram: initial.instagram ?? "",
          facebook: initial.facebook ?? "",
          tiktok: initial.tiktok ?? "",
          whatsapp_greeting: initial.whatsapp_greeting ?? "",
          whatsapp_farewell: initial.whatsapp_farewell ?? "",
        }}
      />
    </PanelPage>
  );
}
