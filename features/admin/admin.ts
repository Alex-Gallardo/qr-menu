/** Super admin, puro: MRR, ajustes de límites y funciones por licencia, anuncios. */
import { FEATURES, type Feature, type LimitedResource } from "@/features/licensing/plan-catalog";

/**
 * MRR en centavos: suma mensual de las licencias activas de planes pagados
 * (precio especial si tiene). Las anuales cuentan su mensualidad de lista.
 */
export function mrrCents(
  licenses: {
    status: string;
    plan_id: string;
    price_gtq: number;
    price_override_gtq: number | null;
  }[],
) {
  return licenses
    .filter((l) => l.status === "active" && l.plan_id !== "gratis")
    .reduce((sum, l) => sum + (l.price_override_gtq ?? l.price_gtq) * 100, 0);
}

export const LIMIT_RESOURCES: { key: LimitedResource; label: string }[] = [
  { key: "branches", label: "Sucursales" },
  { key: "products", label: "Productos" },
  { key: "menus", label: "Menús" },
  { key: "time_slots", label: "Franjas" },
  { key: "qr", label: "QR" },
  { key: "managers", label: "Encargados" },
  { key: "staff", label: "Staff" },
  { key: "storage_mb", label: "Almacenamiento (MB)" },
];

/**
 * Límites a la medida desde el formulario: "" = el del plan, "∞" = ilimitado,
 * un número ≥ 0 = ese. Devuelve el JSON de limit_overrides (null si no hay).
 */
export function parseLimitOverrides(form: Partial<Record<LimitedResource, string>>) {
  const out: Partial<Record<LimitedResource, number | null>> = {};
  for (const { key } of LIMIT_RESOURCES) {
    const raw = (form[key] ?? "").trim();
    if (raw === "") continue;
    if (raw === "∞" || raw.toLowerCase() === "ilimitado") out[key] = null;
    else if (/^\d+$/.test(raw)) out[key] = Number(raw);
    else throw new Error(`Límite inválido en ${key}: usa un número, ∞ o déjalo vacío.`);
  }
  return Object.keys(out).length ? out : null;
}

export function limitOverridesToForm(value: unknown) {
  const o = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  return Object.fromEntries(
    LIMIT_RESOURCES.map(({ key }) => [
      key,
      !(key in o) ? "" : o[key] === null ? "∞" : typeof o[key] === "number" ? String(o[key]) : "",
    ]),
  ) as Record<LimitedResource, string>;
}

export type FeatureChoice = "plan" | "on" | "off";

/** Cada función: la del plan, forzada a sí o forzada a no → {add, remove}. */
export function featureOverrides(choices: Partial<Record<Feature, FeatureChoice>>) {
  const add = FEATURES.filter((f) => choices[f] === "on");
  const remove = FEATURES.filter((f) => choices[f] === "off");
  return add.length || remove.length ? { add, remove } : null;
}

export function featureChoicesFrom(value: unknown): Record<Feature, FeatureChoice> {
  const o = (value && typeof value === "object" ? value : {}) as {
    add?: unknown;
    remove?: unknown;
  };
  const add = Array.isArray(o.add) ? o.add : [];
  const remove = Array.isArray(o.remove) ? o.remove : [];
  return Object.fromEntries(
    FEATURES.map((f) => [f, add.includes(f) ? "on" : remove.includes(f) ? "off" : "plan"]),
  ) as Record<Feature, FeatureChoice>;
}

/** Audiencia de un anuncio: todos, un plan o un negocio. */
export type Audience =
  { kind: "all" } | { kind: "plan"; planId: string } | { kind: "business"; businessId: string };

export function parseAudience(raw: string): Audience | null {
  if (raw === "all") return { kind: "all" };
  const [kind, value] = raw.split(":");
  if (kind === "plan" && value) return { kind: "plan", planId: value };
  if (kind === "business" && value && /^[0-9a-f-]{36}$/i.test(value))
    return { kind: "business", businessId: value };
  return null;
}

/** ¿El anuncio le toca a este negocio ahora? */
export function announcementApplies(
  a: { audience: string; starts_at: Date; ends_at: Date | null; is_active: boolean },
  business: { id: string; planId: string },
  now: Date = new Date(),
) {
  if (!a.is_active || a.starts_at > now || (a.ends_at && a.ends_at <= now)) return false;
  const audience = parseAudience(a.audience);
  if (!audience) return false;
  if (audience.kind === "all") return true;
  if (audience.kind === "plan") return audience.planId === business.planId;
  return audience.businessId === business.id;
}

/** Slugs reservados desde un textarea (uno por línea o separados por comas). */
export function parseSlugList(text: string) {
  return [
    ...new Set(
      text
        .split(/[\s,]+/)
        .map((s) => s.trim().toLowerCase())
        .filter((s) => /^[a-z0-9-]{1,40}$/.test(s)),
    ),
  ];
}
