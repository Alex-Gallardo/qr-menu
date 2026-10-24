import type { Metadata } from "next";
import { Suspense } from "react";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { requirePlatform } from "@/features/admin/access";
import { PlanPrices, SettingsForm } from "@/features/admin/components/settings-form";
import { getPlatformSettings } from "@/features/admin/settings";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Configuración" };

/** Configuración global (platform_settings) y precios de los planes. */
export default function Page() {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Settings />
    </Suspense>
  );
}

async function Settings() {
  await requirePlatform("settings.edit", "/admin/configuracion");
  const [s, plans] = await Promise.all([
    getPlatformSettings(),
    db().plans.findMany({
      where: { id: { in: ["pro", "negocio"] } },
      orderBy: { sort: "asc" },
      select: { id: true, name: true, price_gtq: true },
    }),
  ]);
  const extra = s.reservedSlugs.filter((slug) => !s.builtInSlugs.includes(slug));
  return (
    <>
      <h1 className="type-h1">Configuración</h1>
      <SettingsForm
        builtInSlugs={s.builtInSlugs}
        initial={{
          maintenanceEnabled: s.maintenance.enabled,
          maintenanceMessage: s.maintenance.message,
          trialDays: s.trialDays,
          founderTrialDays: s.founderTrialDays,
          graceDays: s.graceDays,
          reservedSlugs: extra.join("\n"),
          paymentAccounts: s.paymentAccounts,
        }}
      />
      <PlanPrices
        plans={plans.map((p) => ({
          id: p.id as "pro" | "negocio",
          name: p.name,
          price: p.price_gtq,
        }))}
      />
    </>
  );
}
