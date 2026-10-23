import type { Feature } from "@/features/licensing/plan-catalog";
import { presetSurface, type ThemeAllowance } from "@/features/public-menu/theme";
import { BRAND } from "@/lib/brand";
import { PALETTE_PRESETS } from "./palettes";

/**
 * Apariencia del menú: lo que edita el dueño (columnas de `themes`). Puro:
 * lo usan el editor (vista previa) y la Server Action (validar el plan).
 */

export type AppearanceDoc = {
  /** Id de paleta lista, "custom" (color por color) o "logo" (extraída del logo). */
  palette_preset: string;
  color_primary: string;
  color_accent: string;
  color_bg: string;
  color_surface: string;
  color_text: string;
  bg_type: "color" | "gradient" | "image" | "video";
  /** Degradado "#A,#B" o URL de la imagen. */
  bg_value: string | null;
  bg_video_url: string | null;
  bg_poster_url: string | null;
  bg_overlay: number;
  font_heading: string;
  font_body: string;
  radius: number;
  loader_style: "logo" | "puntos" | "plato";
  show_powered_by: boolean;
  splash_style: "lift" | "fade" | "zoom" | "none";
  splash_bg_type: "color" | "gradient" | "image";
  splash_bg_value: string;
  splash_logo_size: number;
  splash_show_name: boolean;
  splash_tagline: string | null;
  splash_duration_ms: number;
  splash_easing: "suave" | "elastico" | "rapido";
  splash_frequency: "always" | "once_per_session" | "first_visit";
};

export const SPLASH_FIELDS = [
  "splash_style",
  "splash_bg_type",
  "splash_bg_value",
  "splash_logo_size",
  "splash_show_name",
  "splash_tagline",
  "splash_duration_ms",
  "splash_easing",
  "splash_frequency",
] as const satisfies readonly (keyof AppearanceDoc)[];

const COLOR_FIELDS = [
  "color_primary",
  "color_accent",
  "color_bg",
  "color_surface",
  "color_text",
] as const satisfies readonly (keyof AppearanceDoc)[];

/** Los valores por defecto de `themes` (bienvenida estándar incluida). */
export const DEFAULT_APPEARANCE: AppearanceDoc = {
  palette_preset: "tomate",
  color_primary: "#D23B22",
  color_accent: "#F6B73C",
  color_bg: "#FBF6EE",
  color_surface: "#FFFFFF",
  color_text: "#231A17",
  bg_type: "color",
  bg_value: null,
  bg_video_url: null,
  bg_poster_url: null,
  bg_overlay: 0.35,
  font_heading: "Bricolage Grotesque",
  font_body: "Inter",
  radius: 16,
  loader_style: "logo",
  show_powered_by: true,
  splash_style: "lift",
  splash_bg_type: "color",
  splash_bg_value: "#D23B22",
  splash_logo_size: 112,
  splash_show_name: true,
  splash_tagline: null,
  splash_duration_ms: 1800,
  splash_easing: "suave",
  splash_frequency: "once_per_session",
};

export const isPresetId = (id: string) => PALETTE_PRESETS.some((p) => p.id === id);

/** Con una paleta lista, sus colores exactos (lo que se guarda siempre coincide con la lista). */
export function canonicalAppearance(doc: AppearanceDoc): AppearanceDoc {
  const preset = PALETTE_PRESETS.find((p) => p.id === doc.palette_preset);
  const out = { ...doc, splash_tagline: doc.splash_tagline?.trim() || null };
  if (preset) {
    out.color_primary = preset.primary;
    out.color_accent = preset.accent;
    out.color_bg = preset.bg;
    out.color_surface = presetSurface(preset);
    out.color_text = preset.text;
  }
  if (out.bg_type !== "image" && out.bg_type !== "gradient") out.bg_value = null;
  if (out.bg_type !== "video") {
    out.bg_video_url = null;
    out.bg_poster_url = null;
  }
  return out;
}

/** Qué puede personalizar el negocio según su plan. */
export function appearanceAllowance(features: readonly Feature[]) {
  const has = (f: Feature) => features.includes(f);
  return {
    customPalette: has("custom_palette"),
    imageBg: has("image_bg"),
    videoBg: has("video_bg"),
    removeBranding: has("remove_branding"),
    customSplash: has("custom_splash"),
  } satisfies ThemeAllowance & { customSplash: boolean };
}
export type AppearanceAllowance = ReturnType<typeof appearanceAllowance>;

const PRO = "del plan Pro";

/**
 * ¿El cambio usa algo que el plan no incluye? Solo cuenta lo que cambia: si
 * el negocio bajó de plan con una paleta personalizada guardada, puede seguir
 * cambiando el resto (el menú público ya muestra la versión de su plan).
 */
export function lockedChange(
  next: AppearanceDoc,
  current: AppearanceDoc,
  allow: AppearanceAllowance,
): string | null {
  const changed = (k: keyof AppearanceDoc) => next[k] !== current[k];

  if (
    !allow.customPalette &&
    !isPresetId(next.palette_preset) &&
    (changed("palette_preset") || COLOR_FIELDS.some(changed))
  )
    return `La paleta personalizada y la de tu logo son ${PRO}.`;

  const bgChanged = changed("bg_type") || changed("bg_value") || changed("bg_video_url");
  if (!allow.imageBg && next.bg_type === "image" && bgChanged)
    return `El fondo con imagen es ${PRO}.`;
  if (!allow.videoBg && next.bg_type === "video" && bgChanged)
    return `El fondo con video es ${PRO}.`;

  if (!allow.customSplash && SPLASH_FIELDS.some(changed))
    return `La bienvenida personalizada es ${PRO}.`;

  if (!allow.removeBranding && !next.show_powered_by && changed("show_powered_by"))
    return `Quitar "Hecho con ${BRAND.name}" es del plan Negocio.`;

  return null;
}

/**
 * El fondo de color de la bienvenida sigue al color principal mientras el
 * dueño no lo haya cambiado (por defecto son iguales). Sin bienvenida
 * personalizada en el plan no se toca: el menú ya usa el principal.
 */
export function followPrimary(
  doc: AppearanceDoc,
  patch: Partial<AppearanceDoc>,
  customSplash: boolean,
): Partial<AppearanceDoc> {
  const primary = patch.color_primary;
  if (
    !customSplash ||
    !primary ||
    "splash_bg_value" in patch ||
    doc.splash_bg_type !== "color" ||
    doc.splash_bg_value.toUpperCase() !== doc.color_primary.toUpperCase()
  )
    return patch;
  return { ...patch, splash_bg_value: primary };
}
