import "server-only";
import { cacheLife, cacheTag } from "next/cache";
import { getEntitlements } from "@/features/licensing/server";
import { db } from "@/lib/db";
import { addDays, dateOnly, todayInGuatemala } from "@/lib/gt-time";
import { tags } from "@/lib/cache-tags";
import { buildBranchMenu, type BranchMenuPayload } from "./payload";
import { normalizeTheme } from "./theme";

/**
 * Lecturas del menú público, cacheadas con etiquetas. Cada Server Action del
 * panel que cambia algo visible llama updateTag(business|branch|slug) y la
 * siguiente visita ya ve el cambio (meta: menos de 5 s). La vida "hours" es
 * solo un respaldo para lo que depende del reloj (licencia que vence).
 */

/** Negocio por su link, con sus sucursales visibles. null si no existe. */
export async function getPublicBusiness(slug: string) {
  "use cache";
  cacheLife("hours");
  cacheTag(tags.slug(slug));

  const business = await db().businesses.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      logo_url: true,
      cover_url: true,
      instagram: true,
      facebook: true,
      tiktok: true,
      published: true,
      theme: {
        select: {
          color_primary: true,
          color_accent: true,
          color_bg: true,
          color_surface: true,
          color_text: true,
          radius: true,
          show_powered_by: true,
        },
      },
      branches: {
        where: { hidden_by_license: false },
        orderBy: [{ sort: "asc" }, { created_at: "asc" }],
        select: {
          id: true,
          slug: true,
          name: true,
          address: true,
          address_reference: true,
          city: true,
          lat: true,
          lng: true,
          whatsapp_e164: true,
          phone: true,
          is_active: true,
          accepts_dine_in: true,
          accepts_takeout: true,
          accepts_delivery: true,
          hours: { select: { weekday: true, opens: true, closes: true } },
        },
      },
    },
  });
  if (!business) return null;
  cacheTag(tags.business(business.id));

  const entitlements = await getEntitlements(business.id);
  return {
    ...business,
    theme: normalizeTheme(business.theme),
    /** Licencia suspendida o cancelada → "Menú no disponible temporalmente". */
    menuOnline: entitlements.menuOnline,
    /** Indexable solo si publicó y su licencia está en línea. */
    indexable: business.published && entitlements.menuOnline,
  };
}

export type PublicBusiness = NonNullable<Awaited<ReturnType<typeof getPublicBusiness>>>;
export type PublicBranch = PublicBusiness["branches"][number];

/** Todo lo que el celular necesita para mostrar el menú de una sucursal. */
export async function getBranchMenu(
  businessId: string,
  branchId: string,
): Promise<BranchMenuPayload> {
  "use cache";
  cacheLife("hours");
  cacheTag(tags.business(businessId), tags.branch(branchId));

  const today = todayInGuatemala();
  const [products, menus, slots, rules, overrides] = await Promise.all([
    db().products.findMany({
      where: { business_id: businessId, deleted_at: null, hidden_by_license: false },
      select: {
        id: true,
        name: true,
        description: true,
        price_cents: true,
        compare_at_cents: true,
        image_url: true,
        image_blurhash: true,
        tags: true,
        is_available: true,
        hidden_by_license: true,
        deleted_at: true,
        prep_minutes: true,
        branch_settings: {
          where: { branch_id: branchId },
          select: { branch_id: true, is_available: true, price_override_cents: true },
        },
        option_groups: {
          orderBy: [{ sort: "asc" }, { id: "asc" }],
          select: {
            id: true,
            name: true,
            min_select: true,
            max_select: true,
            options: {
              orderBy: [{ sort: "asc" }, { id: "asc" }],
              select: { id: true, name: true, price_delta_cents: true, is_available: true },
            },
          },
        },
      },
    }),
    db().menus.findMany({
      where: { business_id: businessId },
      orderBy: [{ is_default: "desc" }, { created_at: "asc" }],
      select: {
        id: true,
        name: true,
        description: true,
        template: true,
        is_active: true,
        is_default: true,
        hidden_by_license: true,
        sections: {
          orderBy: [{ sort: "asc" }, { id: "asc" }],
          select: {
            id: true,
            name: true,
            description: true,
            items: {
              orderBy: [{ sort: "asc" }, { id: "asc" }],
              select: { product_id: true, price_override_cents: true, is_featured: true },
            },
          },
        },
      },
    }),
    db().time_slots.findMany({
      where: { business_id: businessId },
      orderBy: { sort: "asc" },
      select: {
        id: true,
        key: true,
        name: true,
        start_time: true,
        end_time: true,
        is_active: true,
      },
    }),
    db().menu_schedules.findMany({
      where: {
        menu: { business_id: businessId },
        OR: [{ branch_id: null }, { branch_id: branchId }],
      },
      select: {
        menu_id: true,
        time_slot_id: true,
        branch_id: true,
        weekdays: true,
        priority: true,
        starts_on: true,
        ends_on: true,
      },
    }),
    // Desde ayer (franjas que cruzan la medianoche) hasta 60 días: la página
    // vive horas en caché y el celular resuelve con su propia fecha.
    db().menu_overrides.findMany({
      where: {
        business_id: businessId,
        OR: [{ branch_id: null }, { branch_id: branchId }],
        date: {
          gte: new Date(`${addDays(today, -1)}T00:00:00Z`),
          lte: new Date(`${addDays(today, 60)}T00:00:00Z`),
        },
      },
      select: { branch_id: true, date: true, time_slot_id: true, menu_id: true, note: true },
    }),
  ]);

  return buildBranchMenu({
    branchId,
    products,
    menus,
    slots,
    rules: rules.map((r) => ({
      ...r,
      starts_on: r.starts_on ? dateOnly(r.starts_on) : null,
      ends_on: r.ends_on ? dateOnly(r.ends_on) : null,
    })),
    overrides: overrides.map((o) => ({ ...o, date: dateOnly(o.date) })),
  });
}
