import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { PageSkeleton } from "@/components/feedback/page-skeleton";
import { appearanceAllowance } from "@/features/appearance/appearance";
import { fontClasses } from "@/features/appearance/font-loaders";
import { getAppearancePage } from "@/features/appearance/server";
import { SignOutButton } from "@/features/auth/components/sign-out-button";
import { formatPhone } from "@/lib/phone";
import { BrandStep } from "@/features/onboarding/components/brand-step";
import { BusinessStepForm } from "@/features/onboarding/components/business-step";
import { ProductsStep } from "@/features/onboarding/components/products-step";
import { PublishStep } from "@/features/onboarding/components/publish-step";
import { StepsNav } from "@/features/onboarding/components/steps-nav";
import { checklist, maxStep, ONBOARDING_STEPS, parseStep } from "@/features/onboarding/onboarding";
import {
  getChecklistData,
  getOnboarding,
  progressOf,
  type Onboarding,
} from "@/features/onboarding/server";
import { panelHref } from "@/features/panel/nav";
import { qrLink } from "@/features/qr/codes";
import { qrColor } from "@/features/qr/matrix";
import { templateFor } from "@/features/public-menu/templates";
import { normalizeTheme } from "@/features/public-menu/theme";
import { requireUser } from "@/lib/auth/session";
import { BRAND } from "@/lib/brand";
import { db } from "@/lib/db";
import { slugify } from "@/features/businesses/slug";

export const metadata: Metadata = { title: "Configura tu menú" };

/**
 * Asistente de alta en 4 pasos (guía D1): negocio y sucursal → marca →
 * productos → publicar. Se puede salir y volver: retoma donde se quedó.
 */
export default function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  return (
    <Suspense fallback={<PageSkeleton />}>
      <Onboarding searchParams={searchParams} />
    </Suspense>
  );
}

async function Onboarding({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requireUser("/onboarding");
  const query = await searchParams;
  const onboarding = await getOnboarding(user.id);
  const progress = progressOf(onboarding);
  const raw = typeof query.paso === "string" ? query.paso : null;
  // Ya publicado y sin pedir un paso: al panel.
  if (onboarding?.published && !raw) redirect(panelHref(onboarding.id, ""));
  const step = parseStep(raw, progress);
  const meta = ONBOARDING_STEPS[step - 1]!;

  return (
    <main className="mx-auto grid w-full max-w-5xl gap-6 px-4 py-6 sm:py-10">
      <header className="flex items-center justify-between gap-3">
        <Logo />
        <SignOutButton />
      </header>
      <StepsNav current={step} max={maxStep(progress)} />
      <div className="grid gap-1">
        <p className="type-caption font-semibold text-muted-foreground">Paso {step} de 4</p>
        <h1 className="type-h1">{meta.title}</h1>
        <p className="type-body text-muted-foreground">{meta.hint}.</p>
      </div>
      {step === 1 ? (
        <BusinessStepForm initial={businessInitial(onboarding)} appHost={new URL(BRAND.url).host} />
      ) : step === 2 ? (
        <Brand onboarding={onboarding!} />
      ) : step === 3 ? (
        <ProductsStep businessId={onboarding!.id} existing={onboarding!.products} />
      ) : (
        <Publish onboarding={onboarding!} />
      )}
    </main>
  );
}

function businessInitial(o: Onboarding | null) {
  if (!o?.branch) return null;
  const b = o.branch;
  return {
    name: o.name,
    slug: o.slug,
    branchName: b.name,
    address: b.address ?? "",
    addressReference: b.address_reference ?? "",
    city: b.city ?? "",
    location: b.lat !== null && b.lng !== null ? { lat: b.lat, lng: b.lng } : null,
    whatsapp: formatPhone(b.whatsapp_e164),
  };
}

async function Brand({ onboarding }: { onboarding: Onboarding }) {
  const data = await getAppearancePage(onboarding.id);
  if (!data) notFound();
  const allTemplates = data.features.includes("all_templates");
  return (
    <BrandStep
      businessId={onboarding.id}
      initialDoc={data.doc}
      allow={appearanceAllowance(data.features)}
      allTemplates={allTemplates}
      licenseHref={panelHref(onboarding.id, "ajustes/licencia")}
      business={{
        name: data.business.name,
        logoUrl: data.business.logoUrl,
        branchName: data.business.branch?.name ?? "Tu sucursal",
        template: templateFor(data.business.template, allTemplates),
        products: data.business.products,
      }}
    />
  );
}

async function Publish({ onboarding }: { onboarding: Onboarding }) {
  const branch = onboarding.branch!;
  const [data, qr, checklistData] = await Promise.all([
    getAppearancePage(onboarding.id),
    db().qr_codes.findFirst({
      where: { business_id: onboarding.id, branch_id: branch.id, table_label: null },
      orderBy: { created_at: "asc" },
      select: { short_code: true },
    }),
    getChecklistData(onboarding.id),
  ]);
  if (!data) notFound();
  const theme = normalizeTheme(data.doc, appearanceAllowance(data.features));
  const menuPath = `/${onboarding.slug}/${branch.slug}`;
  const fileName = `qr-${slugify(onboarding.name)}-${slugify(branch.name)}`;

  return (
    <div className={fontClasses(theme.fontHeading, theme.fontBody)}>
      <PublishStep
        businessId={onboarding.id}
        published={onboarding.published}
        menuUrl={new URL(menuPath, BRAND.url).toString()}
        menuPath={menuPath}
        qr={qr ? { link: qrLink(BRAND.url, qr.short_code), label: branch.name, fileName } : null}
        brand={{
          businessName: onboarding.name,
          logoUrl: onboarding.logo_url,
          color: qrColor(theme),
          headingFont: `"${theme.fontHeading}"`,
          bodyFont: `"${theme.fontBody}"`,
        }}
        checklist={checklist(checklistData).map((item) => ({
          key: item.key,
          label: item.label,
          hint: item.hint,
          done: item.done,
          href: panelHref(onboarding.id, item.segment),
        }))}
        panelHref={panelHref(onboarding.id, "")}
      />
    </div>
  );
}
