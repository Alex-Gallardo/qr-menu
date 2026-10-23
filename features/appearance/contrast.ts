import {
  AA_LARGE,
  AA_NORMAL,
  contrastRatio,
  hexToHsl,
  hslToHex,
  readableTextOn,
} from "@/lib/color";

/**
 * Chequeo de contraste de una paleta (guía §7: "verificación automática de
 * contraste AA y sugerencia de tono si no cumple"). Las 8 paletas listas pasan
 * todas las reglas; una personalizada o extraída del logo puede no hacerlo.
 */

export type PaletteColors = {
  primary: string;
  accent: string;
  bg: string;
  surface: string;
  text: string;
};
export type ColorField = keyof PaletteColors;

export type ContrastIssue = {
  id: "text_bg" | "text_surface" | "on_primary" | "primary_bg";
  message: string;
  ratio: number;
  min: number;
  /** Cambio sugerido que cumple, conservando el tono. */
  fix: { field: ColorField; value: string };
};

const fmt = (ratio: number) => `${ratio.toFixed(1)}:1`;

/**
 * Mueve la luminosidad de `color` lo mínimo posible (hacia arriba o hacia
 * abajo) hasta llegar a `min` de contraste contra `against`.
 */
export function adjustForContrast(color: string, against: string, min: number): string {
  if (contrastRatio(color, against) >= min) return color.toUpperCase();
  const [h, s, l] = hexToHsl(color);
  for (let step = 1; step <= 100; step++) {
    for (const dir of [-1, 1]) {
      const next = l + (dir * step) / 100;
      if (next < 0 || next > 1) continue;
      const candidate = hslToHex(h, s, next);
      if (contrastRatio(candidate, against) >= min) return candidate;
    }
  }
  return contrastRatio("#000000", against) > contrastRatio("#FFFFFF", against)
    ? "#000000"
    : "#FFFFFF";
}

/** Problemas de contraste de la paleta; vacío = cumple AA. */
export function paletteIssues(c: PaletteColors): ContrastIssue[] {
  const issues: ContrastIssue[] = [];

  const textBg = contrastRatio(c.text, c.bg);
  if (textBg < AA_NORMAL)
    issues.push({
      id: "text_bg",
      message: `El texto casi no se lee sobre el fondo (${fmt(textBg)}; se necesita 4.5:1).`,
      ratio: textBg,
      min: AA_NORMAL,
      fix: { field: "text", value: adjustForContrast(c.text, c.bg, AA_NORMAL) },
    });

  const textSurface = contrastRatio(c.text, c.surface);
  if (textSurface < AA_NORMAL)
    issues.push({
      id: "text_surface",
      message: `El texto casi no se lee sobre las tarjetas (${fmt(textSurface)}; se necesita 4.5:1).`,
      ratio: textSurface,
      min: AA_NORMAL,
      fix: { field: "text", value: adjustForContrast(c.text, c.surface, AA_NORMAL) },
    });

  // Botones y "Agregar": el texto (blanco u oscuro, el más legible) sobre el primario.
  const on = readableTextOn(c.primary);
  const onPrimary = contrastRatio(on, c.primary);
  if (onPrimary < AA_NORMAL)
    issues.push({
      id: "on_primary",
      message: `El texto de los botones casi no se lee (${fmt(onPrimary)}; se necesita 4.5:1).`,
      ratio: onPrimary,
      min: AA_NORMAL,
      fix: { field: "primary", value: adjustForContrast(c.primary, on, AA_NORMAL) },
    });

  // Botones, precios y enlaces deben distinguirse del fondo (componentes: 3:1).
  const primaryBg = contrastRatio(c.primary, c.bg);
  if (primaryBg < AA_LARGE)
    issues.push({
      id: "primary_bg",
      message: `Los botones se pierden en el fondo (${fmt(primaryBg)}; se necesita 3:1).`,
      ratio: primaryBg,
      min: AA_LARGE,
      fix: { field: "primary", value: adjustForContrast(c.primary, c.bg, AA_LARGE) },
    });

  return issues;
}

/** Aplica las sugerencias hasta que la paleta cumpla (o se agoten los intentos). */
export function fixPalette(colors: PaletteColors): PaletteColors {
  let current = { ...colors };
  for (let round = 0; round < 6; round++) {
    const issue = paletteIssues(current)[0];
    if (!issue) break;
    current = { ...current, [issue.fix.field]: issue.fix.value };
  }
  return current;
}
