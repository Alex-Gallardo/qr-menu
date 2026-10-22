import type { MetadataRoute } from "next";
import { ROBOTS_DISALLOW } from "@/features/public-menu/seo";
import { BRAND } from "@/lib/brand";

/** /robots.txt: se indexan la landing y los menús; nada del panel, staff ni pedidos. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ROBOTS_DISALLOW }],
    sitemap: new URL("/sitemap.xml", BRAND.url).toString(),
  };
}
