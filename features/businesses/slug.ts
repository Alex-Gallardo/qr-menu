import { MIN_SLUG_LENGTH, RESERVED_SLUGS } from "@/features/platform/defaults";

/** Reglas del link del negocio: {app}/{link}. */
export const MAX_SLUG_LENGTH = 40;

export type SlugProblem = "empty" | "short" | "long" | "format" | "reserved" | "taken";

export const SLUG_MESSAGES: Record<SlugProblem, string> = {
  empty: "Escribe el link de tu negocio.",
  short: `Usa al menos ${MIN_SLUG_LENGTH} caracteres.`,
  long: `Usa como máximo ${MAX_SLUG_LENGTH} caracteres.`,
  format: "Usa solo letras minúsculas, números y guiones (sin espacios ni tildes).",
  reserved: "Ese link está reservado. Prueba con otro.",
  taken: "Ese link ya lo usa otro negocio. Prueba con otro.",
};

/** "Café El Portal!" → "cafe-el-portal". */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, "");
}

/** Reservados = rutas propias de la app + los que agregue el super admin (platform_settings). */
export function mergeReserved(fromSettings: unknown): Set<string> {
  const extra = Array.isArray(fromSettings)
    ? fromSettings.filter((s): s is string => typeof s === "string")
    : [];
  return new Set([...RESERVED_SLUGS, ...extra.map((s) => s.toLowerCase())]);
}

/** Valida formato y reservados (lo único que no depende de la base). */
export function slugFormatProblem(slug: string, reserved: Set<string>): SlugProblem | null {
  if (!slug) return "empty";
  if (slug.length < MIN_SLUG_LENGTH) return "short";
  if (slug.length > MAX_SLUG_LENGTH) return "long";
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) return "format";
  if (reserved.has(slug)) return "reserved";
  return null;
}

/** "@cafe", "instagram.com/cafe/", "https://www.tiktok.com/@cafe" → "cafe". */
export function normalizeHandle(value: string | null | undefined): string | null {
  if (!value) return null;
  const v = value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/^(www\.)?(instagram|facebook|tiktok)\.com\//i, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "")
    .replace(/^@/, "");
  return v || null;
}
