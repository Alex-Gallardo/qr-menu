import { PALETTE_PRESETS } from "@/features/appearance/palettes";
import { readableTextOn } from "@/lib/color";

/**
 * Tema del negocio para el menú público como variables CSS (--menu-*). Las
 * plantillas solo usan estas variables, así el mismo componente se ve con
 * cualquiera de las 8 paletas (o una personalizada).
 */

export type MenuTheme = {
  primary: string;
  accent: string;
  bg: string;
  surface: string;
  text: string;
  /** Radio de tarjetas en px. */
  radius: number;
  showPoweredBy: boolean;
};

const HEX = /^#[0-9a-fA-F]{6}$/;
const DEFAULT = PALETTE_PRESETS[0]!;

/** Solo colores #RRGGBB: un valor raro en la base no puede inyectar CSS. */
const safeHex = (value: string | null | undefined, fallback: string) =>
  value && HEX.test(value) ? value : fallback;

export function normalizeTheme(
  raw: Partial<{
    color_primary: string;
    color_accent: string;
    color_bg: string;
    color_surface: string;
    color_text: string;
    radius: number;
    show_powered_by: boolean;
  }> | null,
): MenuTheme {
  return {
    primary: safeHex(raw?.color_primary, DEFAULT.primary),
    accent: safeHex(raw?.color_accent, DEFAULT.accent),
    bg: safeHex(raw?.color_bg, DEFAULT.bg),
    surface: safeHex(raw?.color_surface, "#FFFFFF"),
    text: safeHex(raw?.color_text, DEFAULT.text),
    radius: Math.min(28, Math.max(0, Math.round(raw?.radius ?? 16))),
    showPoweredBy: raw?.show_powered_by ?? true,
  };
}

/** Tema a partir de una paleta lista (styleguide, vista previa de Apariencia). */
export function themeFromPreset(id: string, radius = 16): MenuTheme {
  const p = PALETTE_PRESETS.find((x) => x.id === id) ?? DEFAULT;
  return {
    primary: p.primary,
    accent: p.accent,
    bg: p.bg,
    surface: p.dark ? "#221D19" : "#FFFFFF",
    text: p.text,
    radius,
    showPoweredBy: true,
  };
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
  };
}
