import { hexToHsl, hslToHex, rgbToHex } from "@/lib/color";
import { fixPalette, type PaletteColors } from "./contrast";

/**
 * "Extraer de mi logo": colores dominantes de los píxeles del logo (el canvas
 * del navegador entrega RGBA) y 3 propuestas de paleta que ya cumplen AA.
 */

export type LogoPalette = PaletteColors & { id: string; name: string };

/** Colores dominantes, del más al menos representativo (máximo `max`). */
export function dominantColors(rgba: ArrayLike<number>, max = 4): string[] {
  const buckets = new Map<number, { r: number; g: number; b: number; n: number }>();
  for (let i = 0; i + 3 < rgba.length; i += 4) {
    if (rgba[i + 3]! < 128) continue; // transparente
    const r = rgba[i]!;
    const g = rgba[i + 1]!;
    const b = rgba[i + 2]!;
    // 16 niveles por canal: agrupa tonos casi iguales (antialias, compresión).
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key) ?? { r: 0, g: 0, b: 0, n: 0 };
    bucket.r += r;
    bucket.g += g;
    bucket.b += b;
    bucket.n += 1;
    buckets.set(key, bucket);
  }

  const candidates = [...buckets.values()]
    .map((b) => {
      const hex = rgbToHex([b.r / b.n, b.g / b.n, b.b / b.n]);
      const [h, s, l] = hexToHsl(hex);
      return { hex, h, s, l, n: b.n };
    })
    // El fondo blanco y los negros/grises casi puros no son "colores de marca".
    .filter((c) => c.l > 0.08 && c.l < 0.92 && c.s > 0.18)
    // Prefiere colores con presencia y saturados.
    .sort((a, b) => b.n * (0.4 + b.s) - a.n * (0.4 + a.s));

  const picked: typeof candidates = [];
  for (const c of candidates) {
    const similar = picked.some((p) => {
      const dh = Math.min(Math.abs(p.h - c.h), 360 - Math.abs(p.h - c.h));
      return dh < 24 && Math.abs(p.l - c.l) < 0.25;
    });
    if (!similar) picked.push(c);
    if (picked.length === max) break;
  }
  return picked.map((c) => c.hex);
}

/**
 * Tres propuestas: clara con el color principal, clara con el segundo color
 * y oscura. Si el logo no tiene colores (negro sobre blanco) se arma una
 * paleta neutra con acento tomate.
 */
export function proposePalettes(colors: string[]): LogoPalette[] {
  const main = colors[0] ?? "#111111";
  const [h, s] = hexToHsl(main);
  const second =
    colors[1] ?? (colors[0] ? hslToHex((h + 40) % 360, Math.max(s, 0.6), 0.55) : "#D23B22");
  const [h2] = hexToHsl(second);

  const light = (hue: number, primary: string, accent: string): PaletteColors => ({
    primary,
    accent,
    bg: hslToHex(hue, 0.4, 0.965),
    surface: "#FFFFFF",
    text: hslToHex(hue, 0.25, 0.12),
  });

  return [
    { id: "logo-1", name: "Del logo · Clara", ...fixPalette(light(h, main, second)) },
    { id: "logo-2", name: "Del logo · Segundo color", ...fixPalette(light(h2, second, main)) },
    {
      id: "logo-3",
      name: "Del logo · Oscura",
      ...fixPalette({
        primary: hslToHex(h, Math.max(s, 0.5), 0.62),
        accent: second,
        bg: hslToHex(h, 0.2, 0.07),
        surface: hslToHex(h, 0.16, 0.12),
        text: hslToHex(h, 0.25, 0.94),
      }),
    },
  ];
}
