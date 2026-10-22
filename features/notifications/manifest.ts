import type { MetadataRoute } from "next";
import { BRAND } from "@/lib/brand";

/**
 * Manifiestos de las apps instalables del negocio (guía §8): el panel del
 * dueño/encargado y la bandeja del staff. Con la app instalada, el iPhone
 * permite push (iOS 16.4+). El del menú por sucursal es otro ticket (QRM-036).
 * El alcance es todo el sitio: al tocar un aviso se abre el pedido dentro de la app.
 */

export type AppKind = "panel" | "staff";

export const MANIFEST_PATHS: Record<AppKind, string> = {
  panel: "/panel.webmanifest",
  staff: "/staff.webmanifest",
};

/** Colores de la marca (tomate sobre masa). */
export const THEME_COLOR = "#D23B22";
const BACKGROUND = "#FBF6EE";

export function appManifest(kind: AppKind): MetadataRoute.Manifest {
  const panel = kind === "panel";
  return {
    id: panel ? "/panel" : "/staff",
    name: panel ? `${BRAND.name} · Panel` : `${BRAND.name} · Pedidos`,
    short_name: panel ? BRAND.name : "Pedidos",
    description: panel
      ? "Pedidos, menú y sucursales de tu negocio."
      : "Bandeja de pedidos de la sucursal.",
    start_url: panel ? "/panel" : "/staff",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    lang: "es-GT",
    background_color: BACKGROUND,
    theme_color: THEME_COLOR,
    icons: [
      { src: "/app-icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/app-icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/app-icon/maskable", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
