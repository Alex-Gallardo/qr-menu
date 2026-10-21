import type { BranchMenuPayload } from "./payload";

/**
 * Datos estructurados (schema.org) del menú público: Google entiende el
 * restaurante, su ubicación, su horario y su menú con precios en GTQ.
 */

const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

type BusinessLike = {
  name: string;
  description: string | null;
  logo_url: string | null;
  cover_url: string | null;
};
type BranchLike = {
  name: string;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  whatsapp_e164: string;
  phone: string | null;
  hours: { weekday: number; opens: string; closes: string }[];
};

const price = (cents: number) => (cents / 100).toFixed(2);

export function restaurantJsonLd(
  business: BusinessLike,
  branch: BranchLike,
  payload: BranchMenuPayload,
  url: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "Restaurant",
    name: `${business.name} · ${branch.name}`,
    url,
    ...(business.description ? { description: business.description } : {}),
    ...(business.cover_url || business.logo_url
      ? { image: business.cover_url ?? business.logo_url }
      : {}),
    telephone: branch.phone ?? branch.whatsapp_e164,
    priceRange: "Q",
    currenciesAccepted: "GTQ",
    address: {
      "@type": "PostalAddress",
      ...(branch.address ? { streetAddress: branch.address } : {}),
      ...(branch.city ? { addressLocality: branch.city } : {}),
      addressCountry: "GT",
    },
    ...(branch.lat !== null && branch.lng !== null
      ? { geo: { "@type": "GeoCoordinates", latitude: branch.lat, longitude: branch.lng } }
      : {}),
    openingHoursSpecification: branch.hours.map((h) => ({
      "@type": "OpeningHoursSpecification",
      dayOfWeek: `https://schema.org/${DAYS[h.weekday]}`,
      opens: h.opens,
      closes: h.closes,
    })),
    hasMenu: payload.menus.map((menu) => ({
      "@type": "Menu",
      name: menu.name,
      ...(menu.description ? { description: menu.description } : {}),
      hasMenuSection: menu.sections.map((section) => ({
        "@type": "MenuSection",
        name: section.name,
        hasMenuItem: section.items.map((item) => {
          const product = payload.products[item.productId]!;
          return {
            "@type": "MenuItem",
            name: product.name,
            ...(product.description ? { description: product.description } : {}),
            ...(product.imageUrl ? { image: product.imageUrl } : {}),
            offers: {
              "@type": "Offer",
              price: price(item.priceCents),
              priceCurrency: "GTQ",
              availability: product.available
                ? "https://schema.org/InStock"
                : "https://schema.org/OutOfStock",
            },
          };
        }),
      })),
    })),
  };
}

/** Negocio con varias sucursales: enlaza cada una. */
export function organizationJsonLd(
  business: BusinessLike,
  branches: (BranchLike & { url: string })[],
  url: string,
) {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: business.name,
    url,
    ...(business.logo_url ? { logo: business.logo_url } : {}),
    department: branches.map((b) => ({
      "@type": "Restaurant",
      name: `${business.name} · ${b.name}`,
      url: b.url,
      telephone: b.phone ?? b.whatsapp_e164,
      address: {
        "@type": "PostalAddress",
        ...(b.address ? { streetAddress: b.address } : {}),
        ...(b.city ? { addressLocality: b.city } : {}),
        addressCountry: "GT",
      },
    })),
  };
}

/** Para <script type="application/ld+json">: escapa "<" (evita cerrar el script con datos del negocio). */
export const serializeJsonLd = (data: unknown) => JSON.stringify(data).replace(/</g, "\\u003c");
