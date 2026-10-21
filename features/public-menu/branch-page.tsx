import type { Metadata } from "next";
import { BRAND } from "@/lib/brand";
import { PublicMenuView } from "./components/public-menu-view";
import { Splash } from "./components/splash";
import { getBranchMenu, type PublicBranch, type PublicBusiness } from "./data";
import { restaurantJsonLd, serializeJsonLd } from "./json-ld";

/**
 * Menú de una sucursal: lo usan /{negocio}/{sucursal} y /{negocio} cuando el
 * negocio tiene una sola sucursal (se muestra directo, sin redirección).
 */

export function branchMetadata(business: PublicBusiness, branch: PublicBranch): Metadata {
  // "Zona 1, Ciudad de Guatemala" pero no "Antigua, Antigua Guatemala".
  const place =
    branch.city && !branch.city.toLowerCase().includes(branch.name.toLowerCase())
      ? `${branch.name}, ${branch.city}`
      : (branch.city ?? branch.name);
  const title = `Menú de ${business.name} · ${place}`;
  const description =
    business.description ??
    `Mira el menú del día de ${business.name} en ${branch.name} y pide por WhatsApp.`;
  const image = business.cover_url ?? business.logo_url;
  const path = `/${business.slug}/${branch.slug}`;
  return {
    title: { absolute: title },
    description,
    // Con una sola sucursal, /{negocio} muestra lo mismo: la canónica es la de la sucursal.
    alternates: { canonical: path },
    robots: business.indexable ? undefined : { index: false, follow: false },
    openGraph: {
      title,
      description,
      type: "website",
      locale: "es_GT",
      url: path,
      ...(image ? { images: [{ url: image }] } : {}),
    },
  };
}

export async function BranchMenu({
  business,
  branch,
}: {
  business: PublicBusiness;
  branch: PublicBranch;
}) {
  const payload = await getBranchMenu(business.id, branch.id);
  const url = new URL(`/${business.slug}/${branch.slug}`, BRAND.url).toString();

  return (
    <>
      <script
        type="application/ld+json"
        // Datos del negocio escapados: "<" no puede cerrar el script.
        dangerouslySetInnerHTML={{
          __html: serializeJsonLd(restaurantJsonLd(business, branch, payload, url)),
        }}
      />
      <Splash
        config={business.splash}
        storageKey={business.id}
        name={business.name}
        logoUrl={business.logo_url}
      >
        <PublicMenuView
          business={{
            slug: business.slug,
            name: business.name,
            description: business.description,
            logoUrl: business.logo_url,
            coverUrl: business.cover_url,
            theme: business.theme,
          }}
          branch={{
            id: branch.id,
            slug: branch.slug,
            name: branch.name,
            isActive: branch.is_active,
            hours: branch.hours,
          }}
          payload={payload}
          selectorHref={business.branches.length > 1 ? `/${business.slug}` : null}
        />
      </Splash>
    </>
  );
}
