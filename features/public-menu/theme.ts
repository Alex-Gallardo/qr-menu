import { PALETTE_PRESETS, type PalettePreset } from "@/features/appearance/palettes";
import {
  bodyFont,
  fontStack,
  headingFont,
  type BodyFont,
  type HeadingFont,
} from "@/features/appearance/fonts";
import { readableTextOn } from "@/lib/color";
import { safeHttpsUrl } from "@/lib/safe-url";

/**
 * Tema del negocio para el menú público como variables CSS (--menu-*). Las
 * plantillas solo usan estas variables, así el mismo componente se ve con
 * cualquiera de las 8 paletas (o una personalizada).
 */

export type LoaderStyle = "logo" | "puntos" | "plato";

export type MenuBackground =
  | { type: "color" }
  | { type: "gradient"; from: string; to: string }
  | { type: "image"; url: string }
  | { type: "video"; url: string; poster: string | null };

export type MenuTheme = {
  primary: string;
  accent: string;
  bg: string;
  surface: string;
  text: string;
  /** Radio de tarjetas en px. */
  radius: number;
  showPoweredBy: boolean;
  fontHeading: HeadingFont;
  fontBody: BodyFont;
  /** Fondo de la página; el video se muestra en la portada del encabezado. */
  background: MenuBackground;
  /** Capa oscura sobre imagen o video (0–0.8). */
  overlay: number;
  loader: LoaderStyle;
};

/** Lo que el plan permite personalizar. Sin pasar nada, se respeta lo guardado. */
export type ThemeAllowance = {
  customPalette: boolean;
  imageBg: boolean;
  videoBg: boolean;
  removeBranding: boolean;
};

export type RawTheme = Partial<{
  palette_preset: string;
  color_primary: string;
  color_accent: string;
  color_bg: string;
  color_surface: string;
  color_text: string;
  bg_type: string;
  bg_value: string | null;
  bg_video_url: string | null;
  bg_poster_url: string | null;
  bg_overlay: number;
  font_heading: string;
  font_body: string;
  radius: number;
  loader_style: string;
  show_powered_by: boolean;
}>;

const HEX = /^#[0-9a-fA-F]{6}$/;
const DEFAULT = PALETTE_PRESETS[0]!;
const ALL: ThemeAllowance = {
  customPalette: true,
  imageBg: true,
  videoBg: true,
  removeBranding: true,
};

/** Solo colores #RRGGBB: un valor raro en la base no puede inyectar CSS. */
const safeHex = (value: string | null | undefined, fallback: string) =>
  value && HEX.test(value) ? value : fallback;

export const presetSurface = (p: PalettePreset) => (p.dark ? "#221D19" : "#FFFFFF");

/** "#D23B22,#F6B73C" → los dos colores, o null si no es un degradado válido. */
export function parseGradient(value: string | null | undefined) {
  const [from, to] = (value ?? "").split(",").map((s) => s.trim());
  return from && to && HEX.test(from) && HEX.test(to) ? { from, to } : null;
}

function background(raw: RawTheme, allow: ThemeAllowance): MenuBackground {
  if (raw.bg_type === "gradient") {
    const g = parseGradient(raw.bg_value);
    if (g) return { type: "gradient", ...g };
  }
  if (raw.bg_type === "image" && allow.imageBg) {
    const url = safeHttpsUrl(raw.bg_value);
    if (url) return { type: "image", url };
  }
  if (raw.bg_type === "video" && allow.videoBg) {
    const url = safeHttpsUrl(raw.bg_video_url);
    if (url) return { type: "video", url, poster: safeHttpsUrl(raw.bg_poster_url) };
  }
  return { type: "color" };
}

export function normalizeTheme(raw: RawTheme | null, allow: ThemeAllowance = ALL): MenuTheme {
  const r = raw ?? {};
  const preset = PALETTE_PRESETS.find((p) => p.id === r.palette_preset);
  // Paleta lista: sus colores. Personalizada sin la función del plan: la de la plataforma.
  const fixed = preset ?? (allow.customPalette ? null : DEFAULT);
  return {
    primary: fixed ? fixed.primary : safeHex(r.color_primary, DEFAULT.primary),
    accent: fixed ? fixed.accent : safeHex(r.color_accent, DEFAULT.accent),
    bg: fixed ? fixed.bg : safeHex(r.color_bg, DEFAULT.bg),
    surface: fixed ? presetSurface(fixed) : safeHex(r.color_surface, "#FFFFFF"),
    text: fixed ? fixed.text : safeHex(r.color_text, DEFAULT.text),
    radius: Math.min(28, Math.max(0, Math.round(r.radius ?? 16))),
    showPoweredBy: allow.removeBranding ? (r.show_powered_by ?? true) : true,
    fontHeading: headingFont(r.font_heading),
    fontBody: bodyFont(r.font_body),
    background: background(r, allow),
    overlay: Math.min(0.8, Math.max(0, r.bg_overlay ?? 0.35)),
    loader: r.loader_style === "puntos" || r.loader_style === "plato" ? r.loader_style : "logo",
  };
}

/** Tema a partir de una paleta lista (styleguide, vista previa de Apariencia). */
export function themeFromPreset(id: string, radius = 16): MenuTheme {
  return normalizeTheme({ palette_preset: id, radius });
}

const shade = (overlay: number) =>
  `linear-gradient(rgb(0 0 0 / ${overlay}), rgb(0 0 0 / ${overlay}))`;

/** Fondo de la página detrás de la columna del menú (CSS `background`). */
export function canvasBackground(theme: MenuTheme): string {
  const bg = theme.background;
  switch (bg.type) {
    case "gradient":
      return `linear-gradient(160deg, ${bg.from}, ${bg.to})`;
    case "image":
      return `${shade(theme.overlay)}, url("${bg.url}") center / cover no-repeat fixed`;
    case "video":
      return bg.poster
        ? `${shade(theme.overlay)}, url("${bg.poster}") center / cover no-repeat fixed`
        : theme.bg;
    default:
      return theme.bg;
  }
}

/** Degradado o imagen para la portada cuando no hay foto (null = la portada de siempre). */
export function heroBackground(theme: MenuTheme): string | null {
  const bg = theme.background;
  if (bg.type === "gradient") return `linear-gradient(160deg, ${bg.from}, ${bg.to})`;
  if (bg.type === "image")
    return `${shade(theme.overlay)}, url("${bg.url}") center / cover no-repeat`;
  return null;
}

/** Variables CSS para el contenedor del menú. */
export function themeStyle(theme: MenuTheme): Record<string, string> {
  return {
    "--menu-primary": theme.primary,
    "--menu-on-primary": readableTextOn(theme.primary),
    "--menu-accent": theme.accent,
    "--menu-on-accent": readableTextOn(theme.accent),
    "--menu-bg": theme.bg,
    "--menu-surface": theme.surface,
    "--menu-text": theme.text,
    "--menu-muted": `color-mix(in oklab, ${theme.text} 62%, ${theme.surface})`,
    "--menu-line": `color-mix(in oklab, ${theme.text} 12%, ${theme.surface})`,
    "--menu-soft": `color-mix(in oklab, ${theme.primary} 10%, ${theme.surface})`,
    "--menu-radius": `${theme.radius}px`,
    // type-h1/h2 y font-heading leen --font-display; el resto hereda font-family.
    "--font-display": fontStack(theme.fontHeading),
    "--menu-font-body": fontStack(theme.fontBody),
  };
}
