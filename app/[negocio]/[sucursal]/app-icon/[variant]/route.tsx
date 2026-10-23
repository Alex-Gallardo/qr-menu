import { menuAppIcon } from "@/features/public-menu/app-icon";
import { getPublicBusiness } from "@/features/public-menu/data";
import { MENU_ICON_VARIANTS, type MenuIconVariant } from "@/features/public-menu/pwa";

/** Íconos de la app del menú: /{negocio}/{sucursal}/app-icon/{192|512|maskable|apple}. */
export async function GET(
  _request: Request,
  ctx: RouteContext<"/[negocio]/[sucursal]/app-icon/[variant]">,
) {
  const { negocio, sucursal, variant } = await ctx.params;
  if (!MENU_ICON_VARIANTS.includes(variant as MenuIconVariant))
    return new Response("No encontrado", { status: 404 });
  const business = await getPublicBusiness(negocio);
  if (!business?.branches.some((b) => b.slug === sucursal))
    return new Response("No encontrado", { status: 404 });
  return menuAppIcon(variant as MenuIconVariant, {
    name: business.name,
    logoUrl: business.logo_url,
    primary: business.theme.primary,
    bg: business.theme.bg,
  });
}
