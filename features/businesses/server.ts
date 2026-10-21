import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { mergeReserved, slugFormatProblem, type SlugProblem } from "./slug";

/** Slugs reservados vigentes (rutas propias + los del super admin). */
export const getReservedSlugs = cache(async () => {
  const setting = await db().platform_settings.findUnique({
    where: { key: "reserved_slugs" },
    select: { value: true },
  });
  return mergeReserved(setting?.value);
});

/** Problema del link o null si se puede usar (el propio negocio puede conservar el suyo). */
export async function slugProblem(slug: string, businessId: string): Promise<SlugProblem | null> {
  const format = slugFormatProblem(slug, await getReservedSlugs());
  if (format) return format;
  const owner = await db().businesses.findUnique({ where: { slug }, select: { id: true } });
  return owner && owner.id !== businessId ? "taken" : null;
}

export async function getBusinessSettings(businessId: string) {
  return db().businesses.findUnique({
    where: { id: businessId },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      email: true,
      instagram: true,
      facebook: true,
      tiktok: true,
      whatsapp_greeting: true,
      whatsapp_farewell: true,
      logo_url: true,
      cover_url: true,
    },
  });
}
