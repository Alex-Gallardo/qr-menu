import type { MetadataRoute } from "next";

/**
 * SEO del menú público (puro): qué se indexa y qué no. Solo los negocios
 * publicados con la licencia en línea; con una sola sucursal, /{negocio}
 * muestra su menú con canónica /{negocio}/{sucursal}, así que se lista solo esa.
 */

export const ROBOTS_DISALLOW = [
  "/panel",
  "/staff",
  "/admin",
  "/api",
  "/auth",
  "/entrar",
  "/registro",
  "/recuperar",
  "/onboarding",
  "/invitacion",
  "/mantenimiento",
  "/styleguide",
  // Confirmación de pedidos: links privados del comensal.
  "/*/*/pedido/",
];

export type SitemapBusiness = {
  slug: string;
  updatedAt: Date;
  branches: { slug: string }[];
};

export function sitemapEntries(baseUrl: string, businesses: readonly SitemapBusiness[]) {
  const url = (path: string) => new URL(path, baseUrl).toString();
  const entries: MetadataRoute.Sitemap = [
    { url: url("/"), changeFrequency: "weekly", priority: 1 },
  ];
  for (const b of businesses) {
    if (b.branches.length === 0) continue;
    if (b.branches.length > 1)
      entries.push({
        url: url(`/${b.slug}`),
        lastModified: b.updatedAt,
        changeFrequency: "daily",
        priority: 0.8,
      });
    for (const branch of b.branches)
      entries.push({
        url: url(`/${b.slug}/${branch.slug}`),
        lastModified: b.updatedAt,
        changeFrequency: "daily",
        priority: 0.9,
      });
  }
  return entries;
}
