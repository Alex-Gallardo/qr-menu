import type { MetadataRoute } from "next";

/**
 * App instalable del menú de cada sucursal (guía §7, "App instalable por
 * negocio"), puro: rutas, manifiesto y cuándo ofrecer instalarla.
 */

export const MENU_ICON_VARIANTS = ["192", "512", "maskable", "apple"] as const;
export type MenuIconVariant = (typeof MENU_ICON_VARIANTS)[number];

export function menuAppPaths(businessSlug: string, branchSlug: string) {
  const base = `/${businessSlug}/${branchSlug}`;
  return {
    base,
    manifest: `${base}/manifest.webmanifest`,
    icon: (variant: MenuIconVariant) => `${base}/app-icon/${variant}`,
    /** ?source=pwa: las analíticas distinguen las visitas desde la app. */
    start: `${base}?source=pwa`,
    /** Todo el negocio: "Cambiar sucursal" sigue dentro de la app. */
    scope: `/${businessSlug}/`,
  };
}

/** Nombre bajo el ícono: Android muestra ~12 caracteres. */
export function shortAppName(name: string) {
  const clean = name.trim().replace(/\s+/g, " ");
  if (clean.length <= 12) return clean;
  const words = clean.split(" ");
  let out = "";
  for (const w of words) {
    const next = out ? `${out} ${w}` : w;
    if (next.length > 12) break;
    out = next;
  }
  return out || clean.slice(0, 12);
}

export function branchManifest(input: {
  business: { name: string; slug: string; description: string | null };
  branch: { name: string; slug: string };
  /** Con varias sucursales, el nombre dice cuál (se pueden instalar las dos). */
  multiBranch: boolean;
  theme: { primary: string; bg: string };
}): MetadataRoute.Manifest {
  const { business, branch, multiBranch, theme } = input;
  const paths = menuAppPaths(business.slug, branch.slug);
  return {
    // Identidad estable por sucursal: el navegador la reconoce aunque cambie el nombre.
    id: paths.base,
    name: multiBranch ? `${business.name} · ${branch.name}` : business.name,
    short_name: shortAppName(business.name),
    description: business.description ?? `Menú del día de ${business.name} y pedidos por WhatsApp.`,
    start_url: paths.start,
    scope: paths.scope,
    display: "standalone",
    orientation: "portrait",
    lang: "es-GT",
    background_color: theme.bg,
    theme_color: theme.primary,
    categories: ["food", "shopping"],
    icons: [
      { src: paths.icon("192"), sizes: "192x192", type: "image/png", purpose: "any" },
      { src: paths.icon("512"), sizes: "512x512", type: "image/png", purpose: "any" },
      { src: paths.icon("maskable"), sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

/** Satori (next/og) no dibuja WebP: solo los logos PNG o JPEG van en el ícono. */
export const iconCanUseLogo = (url: string | null): url is string =>
  Boolean(url && /\.(png|jpe?g)(\?|$)/i.test(url));

export type InstallOffer =
  /** Chrome/Edge en Android (o escritorio): el botón abre el diálogo del navegador. */
  | "prompt"
  /** iPhone/iPad: guía "Compartir → Agregar a inicio". */
  | "ios"
  | null;

/**
 * ¿Ofrecer instalar? Nunca dentro de la app instalada, ni en el navegador de
 * Instagram/Facebook (no pueden agregar a inicio), ni si el cliente ya dijo
 * "Ahora no" en este negocio.
 */
export function installOffer(c: {
  standalone: boolean;
  isIOS: boolean;
  inAppBrowser: boolean;
  hasPrompt: boolean;
  dismissed: boolean;
}): InstallOffer {
  if (c.standalone || c.dismissed || c.inAppBrowser) return null;
  if (c.hasPrompt) return "prompt";
  if (c.isIOS) return "ios";
  return null;
}

export const isInAppBrowser = (userAgent: string) =>
  /FBAN|FBAV|Instagram|Line\/|TikTok|Snapchat/i.test(userAgent);
