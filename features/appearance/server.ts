import "server-only";
import { getEntitlements } from "@/features/licensing/server";
import { deleteOwnMediaByUrl, isRegisteredMediaUrl } from "@/features/media/server";
import type { PublicProduct } from "@/features/public-menu/payload";
import { audit, diffFields } from "@/lib/audit";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { blurhashToDataUrl } from "@/lib/images/blurhash-url";
import {
  appearanceAllowance,
  canonicalAppearance,
  DEFAULT_APPEARANCE,
  lockedChange,
  type AppearanceDoc,
} from "./appearance";

const SELECT = {
  palette_preset: true,
  color_primary: true,
  color_accent: true,
  color_bg: true,
  color_surface: true,
  color_text: true,
  bg_type: true,
  bg_value: true,
  bg_video_url: true,
  bg_poster_url: true,
  bg_overlay: true,
  font_heading: true,
  font_body: true,
  radius: true,
  loader_style: true,
  show_powered_by: true,
  splash_style: true,
  splash_bg_type: true,
  splash_bg_value: true,
  splash_logo_size: true,
  splash_show_name: true,
  splash_tagline: true,
  splash_duration_ms: true,
  splash_easing: true,
  splash_frequency: true,
} as const;

/** Fila de `themes` → documento del editor (con los valores por defecto si aún no existe). */
export async function getAppearanceDoc(businessId: string): Promise<AppearanceDoc> {
  const row = await db().themes.findUnique({ where: { business_id: businessId }, select: SELECT });
  if (!row) return DEFAULT_APPEARANCE;
  return {
    ...row,
    // La base admite "video" en la bienvenida; el editor solo color, degradado o imagen.
    splash_bg_type: row.splash_bg_type === "video" ? "color" : row.splash_bg_type,
    loader_style:
      row.loader_style === "puntos" || row.loader_style === "plato" ? row.loader_style : "logo",
  } as AppearanceDoc;
}

export async function saveAppearanceDoc(businessId: string, doc: AppearanceDoc) {
  await db().themes.upsert({
    where: { business_id: businessId },
    create: { business_id: businessId, ...doc },
    update: doc,
  });
}

/** Todo lo que la página de Apariencia necesita: lo guardado, el plan y datos reales para la vista previa. */
export async function getAppearancePage(businessId: string) {
  const [doc, entitlements, business] = await Promise.all([
    getAppearanceDoc(businessId),
    getEntitlements(businessId),
    db().businesses.findUnique({
      where: { id: businessId },
      select: {
        name: true,
        slug: true,
        description: true,
        logo_url: true,
        cover_url: true,
        branches: {
          where: { hidden_by_license: false },
          orderBy: [{ sort: "asc" }, { created_at: "asc" }],
          take: 1,
          select: { name: true, slug: true },
        },
        // Plantilla del menú predeterminado: la vista previa se ve como el menú real.
        menus: {
          orderBy: [{ is_default: "desc" }, { created_at: "asc" }],
          take: 1,
          select: { template: true },
        },
        products: {
          where: { deleted_at: null, hidden_by_license: false },
          orderBy: [{ image_url: { sort: "asc", nulls: "last" } }, { created_at: "asc" }],
          take: 3,
          select: {
            id: true,
            name: true,
            description: true,
            price_cents: true,
            compare_at_cents: true,
            image_url: true,
            image_blurhash: true,
            tags: true,
          },
        },
      },
    }),
  ]);
  if (!business) return null;

  const products: PublicProduct[] = business.products.map((p) => ({
    id: p.id,
    name: p.name,
    description: p.description,
    imageUrl: p.image_url,
    blurhash: p.image_blurhash,
    blurDataUrl: blurhashToDataUrl(p.image_blurhash),
    priceCents: p.price_cents,
    compareAtCents: p.compare_at_cents,
    tags: p.tags,
    available: true,
    prepMinutes: null,
    optionGroups: [],
  }));

  return {
    doc,
    features: entitlements.features,
    business: {
      name: business.name,
      slug: business.slug,
      description: business.description,
      logoUrl: business.logo_url,
      coverUrl: business.cover_url,
      branch: business.branches[0] ?? null,
      template: business.menus[0]?.template ?? null,
      products,
    },
  };
}

/** URLs de nuestro bucket que usa la apariencia (para validar las nuevas y limpiar las reemplazadas). */
function mediaUrls(doc: AppearanceDoc): string[] {
  return [
    doc.bg_type === "image" ? doc.bg_value : null,
    doc.bg_video_url,
    doc.bg_poster_url,
    doc.splash_bg_type === "image" ? doc.splash_bg_value : null,
  ].filter((u): u is string => Boolean(u));
}

/**
 * Guarda la apariencia: rechaza lo que el plan no incluye y archivos ajenos,
 * borra las imágenes o el video que se reemplazaron y deja auditoría.
 */
export async function updateAppearance(
  businessId: string,
  input: AppearanceDoc,
  { actorId }: { actorId: string },
) {
  const next = canonicalAppearance(input);
  const [current, entitlements] = await Promise.all([
    getAppearanceDoc(businessId),
    getEntitlements(businessId),
  ]);

  const locked = lockedChange(next, current, appearanceAllowance(entitlements.features));
  if (locked) throw new AppError("feature_unavailable", locked);

  const before = new Set(mediaUrls(current));
  for (const url of mediaUrls(next)) {
    if (!before.has(url) && !(await isRegisteredMediaUrl(businessId, url)))
      throw new AppError("forbidden", "Esa imagen no es de tu negocio.");
  }

  await saveAppearanceDoc(businessId, next);

  const kept = new Set(mediaUrls(next));
  for (const url of before) if (!kept.has(url)) await deleteOwnMediaByUrl(businessId, url);

  const changes = diffFields(current, next);
  if (Object.keys(changes).length > 0) {
    await audit({
      actorId,
      actorKind: "user",
      businessId,
      action: "theme.update",
      entity: "themes",
      entityId: businessId,
      diff: changes,
    });
  }
  return next;
}
