import { getPublicBusiness } from "@/features/public-menu/data";
import { branchManifest } from "@/features/public-menu/pwa";

/**
 * Manifiesto de la app del menú de una sucursal: se instala con el nombre,
 * el ícono y los colores del negocio. Usa la misma lectura cacheada del menú
 * (un cambio en Apariencia o en el logo la invalida).
 */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/[negocio]/[sucursal]/manifest.webmanifest">,
) {
  const { negocio, sucursal } = await ctx.params;
  const business = await getPublicBusiness(negocio);
  const branch = business?.branches.find((b) => b.slug === sucursal);
  if (!business || !branch) return new Response("No encontrado", { status: 404 });
  const manifest = branchManifest({
    business: { name: business.name, slug: business.slug, description: business.description },
    branch: { name: branch.name, slug: branch.slug },
    multiBranch: business.branches.length > 1,
    theme: { primary: business.theme.primary, bg: business.theme.bg },
  });
  return Response.json(manifest, {
    headers: {
      "content-type": "application/manifest+json",
      "cache-control": "public, max-age=0, must-revalidate",
    },
  });
}
