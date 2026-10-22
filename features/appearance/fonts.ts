/**
 * Catálogo curado de 12 fuentes de Google (guía §7): 6 para títulos y 6 para
 * texto. Se autohospedan con next/font (font-loaders.ts) y el navegador solo
 * descarga las 2 que usa el negocio.
 */

export const HEADING_FONTS = [
  {
    name: "Bricolage Grotesque",
    cssVar: "--font-bricolage",
    fallback: "ui-sans-serif, system-ui, sans-serif",
  },
  { name: "Fraunces", cssVar: "--font-fraunces", fallback: "ui-serif, Georgia, serif" },
  { name: "Playfair Display", cssVar: "--font-playfair", fallback: "ui-serif, Georgia, serif" },
  { name: "DM Serif Display", cssVar: "--font-dm-serif", fallback: "ui-serif, Georgia, serif" },
  { name: "Pacifico", cssVar: "--font-pacifico", fallback: "cursive" },
  { name: "Lobster Two", cssVar: "--font-lobster-two", fallback: "cursive" },
] as const;

export const BODY_FONTS = [
  { name: "Inter", cssVar: "--font-inter", fallback: "ui-sans-serif, system-ui, sans-serif" },
  { name: "Nunito", cssVar: "--font-nunito", fallback: "ui-sans-serif, system-ui, sans-serif" },
  { name: "Poppins", cssVar: "--font-poppins", fallback: "ui-sans-serif, system-ui, sans-serif" },
  { name: "Lato", cssVar: "--font-lato", fallback: "ui-sans-serif, system-ui, sans-serif" },
  { name: "DM Sans", cssVar: "--font-dm-sans", fallback: "ui-sans-serif, system-ui, sans-serif" },
  {
    name: "Work Sans",
    cssVar: "--font-work-sans",
    fallback: "ui-sans-serif, system-ui, sans-serif",
  },
] as const;

export type HeadingFont = (typeof HEADING_FONTS)[number]["name"];
export type BodyFont = (typeof BODY_FONTS)[number]["name"];
export type FontName = HeadingFont | BodyFont;

export const DEFAULT_HEADING: HeadingFont = "Bricolage Grotesque";
export const DEFAULT_BODY: BodyFont = "Inter";

/** Fuente de títulos válida (lo desconocido vuelve a la de la plataforma). */
export const headingFont = (value: string | null | undefined): HeadingFont =>
  HEADING_FONTS.find((f) => f.name === value)?.name ?? DEFAULT_HEADING;

export const bodyFont = (value: string | null | undefined): BodyFont =>
  BODY_FONTS.find((f) => f.name === value)?.name ?? DEFAULT_BODY;

/** `font-family` con la variable de next/font y su respaldo del sistema. */
export function fontStack(name: FontName): string {
  const font = [...HEADING_FONTS, ...BODY_FONTS].find((f) => f.name === name)!;
  return `var(${font.cssVar}), ${font.fallback}`;
}
