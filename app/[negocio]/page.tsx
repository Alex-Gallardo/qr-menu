import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { BranchMenu, branchMetadata } from "@/features/public-menu/branch-page";
import { BranchSelector } from "@/features/public-menu/components/branch-selector";
import { MenuUnavailable } from "@/features/public-menu/components/menu-unavailable";
import { getPublicBusiness } from "@/features/public-menu/data";
import { organizationJsonLd, serializeJsonLd } from "@/features/public-menu/json-ld";
import { BRAND } from "@/lib/brand";

/** /{negocio}: con una sucursal lleva directo a su menú; con varias, el selector. */

export async function generateMetadata({ params }: PageProps<"/[negocio]">): Promise<Metadata> {
  const { negocio } = await params;
  const business = await getPublicBusiness(negocio);
  if (!business) return { title: "Menú no encontrado", robots: { index: false } };
  if (business.branches.length === 1) return branchMetadata(business, business.branches[0]!);
  const title = `Menú de ${business.name}`;
  const description =
    business.description ??
    `Elige tu sucursal de ${business.name}, mira el menú del día y pide por WhatsApp.`;
  const image = business.cover_url ?? business.logo_url;
  return {
    title: { absolute: title },
    description,
    alternates: { canonical: `/${business.slug}` },
    robots: business.indexable ? undefined : { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "es_GT",
      url: `/${business.slug}`,
      ...(image ? { images: [{ url: image }] } : {}),
    },
  };
}

export default function Page({ params }: PageProps<"/[negocio]">) {
  return (
    <Suspense fallback={<SelectorSkeleton />}>
      <Business params={params} />
    </Suspense>
  );
}

async function Business({ params }: { params: Promise<{ negocio: string }> }) {
  const { negocio } = await params;
  const business = await getPublicBusiness(negocio);
  if (!business || business.branches.length === 0) notFound();
  if (!business.menuOnline) return <MenuUnavailable businessName={business.name} />;
  // Una sola sucursal: su menú directo, sin redirección (canónica = la de la sucursal).
  if (business.branches.length === 1)
    return <BranchMenu business={business} branch={business.branches[0]!} />;

  const url = new URL(`/${business.slug}`, BRAND.url).toString();
  const branches = business.branches.map((b) => ({
    ...b,
    url: new URL(`/${business.slug}/${b.slug}`, BRAND.url).toString(),
  }));

  return (
    <main className="mx-auto grid min-h-dvh w-full max-w-[480px] content-start gap-6 px-4 py-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(organizationJsonLd(business, branches, url)),
        }}
      />
      <header className="grid justify-items-center gap-3 text-center">
        <span className="grid size-20 place-items-center overflow-hidden rounded-full bg-card shadow-2">
          {business.logo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={business.logo_url}
              alt={`Logo de ${business.name}`}
              className="size-full object-cover"
            />
          ) : (
            <span className="type-h2 text-primary">{business.name.slice(0, 1)}</span>
          )}
        </span>
        <h1 className="type-h1">{business.name}</h1>
        {business.description ? (
          <p className="type-body text-muted-foreground">{business.description}</p>
        ) : null}
      </header>
      <BranchSelector
        businessSlug={business.slug}
        branches={business.branches.map((b) => ({
          slug: b.slug,
          name: b.name,
          address: b.address,
          city: b.city,
          lat: b.lat,
          lng: b.lng,
          isActive: b.is_active,
          hours: b.hours,
        }))}
      />
    </main>
  );
}

function SelectorSkeleton() {
  return (
    <div className="mx-auto grid w-full max-w-[480px] gap-6 px-4 py-8" aria-hidden>
      <div className="grid justify-items-center gap-3">
        <Skeleton className="size-20 rounded-full" />
        <Skeleton className="h-8 w-1/2" />
      </div>
      {Array.from({ length: 2 }, (_, i) => (
        <Skeleton key={i} className="h-24 w-full rounded-xl" />
      ))}
    </div>
  );
}
