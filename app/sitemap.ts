import type { MetadataRoute } from "next";
import { connection } from "next/server";
import { listIndexableBusinesses } from "@/features/public-menu/data";
import { sitemapEntries } from "@/features/public-menu/seo";
import { BRAND } from "@/lib/brand";

/**
 * /sitemap.xml con los menús publicados. Se arma al pedirlo (no en el build)
 * y la lista se cachea una hora: un negocio nuevo aparece sin redeploy.
 */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  await connection();
  return sitemapEntries(BRAND.url, await listIndexableBusinesses());
}
