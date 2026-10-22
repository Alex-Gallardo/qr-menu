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

const coordsOf = (b: { lat: number | null; lng: number | null }) =>
  b.lat !== null && b.lng !== null ? { lat: b.lat, lng: b.lng } : null;

export async function BranchMenu({
  business,
  branch,
}: {
  business: PublicBusiness;
  branch: PublicBranch;
}) {
  const payload = await getBranchMenu(business.id, branch.id);
  const url = new URL(`/${business.slug}/${branch.slug}`, BRAND.url).toString();
  // Cuentas de esta sucursal primero, luego las de todo el negocio.
  const bankAccounts = business.bank_accounts
    .filter((a) => a.branch_id === null || a.branch_id === branch.id)
    .sort((a, b) => Number(a.branch_id === null) - Number(b.branch_id === null))
    .map((a) => ({
      id: a.id,
      bankName: a.bank_name,
      accountType: a.account_type,
      accountNumber: a.account_number,
      holderName: a.holder_name,
      instructions: a.instructions,
    }));

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
            id: business.id,
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
            order: {
              acceptsDineIn: branch.accepts_dine_in,
              acceptsTakeout: branch.accepts_takeout,
              acceptsDelivery: branch.accepts_delivery,
              acceptsTransfer: branch.accepts_transfer,
              deliveryFeeCents: branch.delivery_fee_cents,
              minOrderCents: branch.min_order_cents,
              hasBankAccounts: bankAccounts.length > 0,
              requiresLocation: branch.delivery_requires_location,
              location: coordsOf(branch),
              radiusKm: branch.delivery_radius_km,
              preorderMode: branch.preorder_mode,
              preorderMinLeadMin: branch.preorder_min_lead_min,
              preorderMaxDays: branch.preorder_max_days,
              preordersEnabled: business.preorders,
            },
            bankAccounts,
            // Para sugerir "Pedir a Antigua" si esta sucursal no llega.
            otherBranches: business.branches
              .filter((b) => b.id !== branch.id && b.is_active)
              .map((b) => ({
                slug: b.slug,
                name: b.name,
                location: coordsOf(b),
                radiusKm: b.delivery_radius_km,
                acceptsDelivery: b.accepts_delivery,
              })),
          }}
          payload={payload}
          selectorHref={business.branches.length > 1 ? `/${business.slug}` : null}
        />
      </Splash>
    </>
  );
}
