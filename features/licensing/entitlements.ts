import { FEATURES, type Feature, type PlanLimits } from "./plan-catalog";

/**
 * Permisos efectivos de un negocio = plan + ajustes del super admin + estado de
 * la licencia. Función pura: el cron (QRM-042) mueve los estados en la base,
 * pero esto ya aplica la vigencia aunque el cron no haya corrido.
 */

export type LicenseStatus = "trial" | "active" | "grace" | "suspended" | "cancelled";

/** Estado que se aplica de verdad (incluye la degradación a Gratis). */
export type EffectiveStatus = "trial" | "active" | "grace" | "free" | "suspended" | "cancelled";

export type PlanInput = { id: string; limits: unknown; features: string[] };

export type LicenseInput = {
  plan_id: string;
  status: LicenseStatus;
  ends_at: Date;
  grace_days: number;
  limit_overrides: unknown;
  feature_overrides: unknown;
};

export type Entitlements = {
  /** Plan que se aplica (puede ser "gratis" si la licencia se degradó). */
  planId: string;
  /** Plan contratado en la licencia. */
  licensedPlanId: string;
  status: EffectiveStatus;
  limits: PlanLimits;
  features: Feature[];
  /** Panel en solo lectura (suspendida). */
  readOnly: boolean;
  /** El negocio puede usar el panel. */
  panelAccess: boolean;
  /** El menú público está en línea y acepta pedidos. */
  menuOnline: boolean;
  endsAt: Date | null;
  graceEndsAt: Date | null;
  /** Días que faltan para el vencimiento o el fin de la gracia (para banners). */
  daysLeft: number | null;
};

const DAY = 24 * 60 * 60 * 1000;
const LIMIT_KEYS: (keyof PlanLimits)[] = [
  "branches",
  "products",
  "menus",
  "time_slots",
  "qr",
  "managers",
  "staff",
  "storage_mb",
];

/** Límites desde JSON: número ≥ 0 o null (ilimitado). Lo desconocido o ausente = 0. */
export function parseLimits(value: unknown): PlanLimits {
  const v = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const out = {} as PlanLimits;
  for (const key of LIMIT_KEYS) {
    const raw = v[key];
    out[key] = raw === null ? null : typeof raw === "number" && raw >= 0 ? Math.floor(raw) : 0;
  }
  return out;
}

function applyLimitOverrides(limits: PlanLimits, overrides: unknown): PlanLimits {
  if (!overrides || typeof overrides !== "object") return limits;
  const o = overrides as Record<string, unknown>;
  const out = { ...limits };
  for (const key of LIMIT_KEYS) {
    if (!(key in o)) continue;
    const raw = o[key];
    if (raw === null) out[key] = null;
    else if (typeof raw === "number" && raw >= 0) out[key] = Math.floor(raw);
  }
  return out;
}

function asFeatures(list: unknown): Feature[] {
  if (!Array.isArray(list)) return [];
  return list.filter((f): f is Feature => FEATURES.includes(f as Feature));
}

function applyFeatureOverrides(features: Feature[], overrides: unknown): Feature[] {
  if (!overrides || typeof overrides !== "object") return features;
  const o = overrides as { add?: unknown; remove?: unknown };
  const set = new Set(features);
  for (const f of asFeatures(o.add)) set.add(f);
  for (const f of asFeatures(o.remove)) set.delete(f);
  return FEATURES.filter((f) => set.has(f));
}

export function computeEntitlements(input: {
  license: LicenseInput | null;
  plan: PlanInput | null;
  freePlan: PlanInput;
  now?: Date;
}): Entitlements {
  const now = input.now ?? new Date();
  const free = {
    planId: input.freePlan.id,
    limits: parseLimits(input.freePlan.limits),
    features: asFeatures(input.freePlan.features),
  };

  // Sin licencia (no debería pasar): se trata como Gratis.
  if (!input.license || !input.plan) {
    return {
      ...free,
      licensedPlanId: free.planId,
      status: "free",
      readOnly: false,
      panelAccess: true,
      menuOnline: true,
      endsAt: null,
      graceEndsAt: null,
      daysLeft: null,
    };
  }

  const { license, plan } = input;
  const endsAt = license.ends_at;
  const graceEndsAt = new Date(endsAt.getTime() + license.grace_days * DAY);
  const daysUntil = (d: Date) => Math.max(0, Math.ceil((d.getTime() - now.getTime()) / DAY));

  const paid = {
    planId: plan.id,
    limits: applyLimitOverrides(parseLimits(plan.limits), license.limit_overrides),
    features: applyFeatureOverrides(asFeatures(plan.features), license.feature_overrides),
  };
  const base = { licensedPlanId: plan.id, endsAt, graceEndsAt };

  if (license.status === "cancelled") {
    return {
      ...free,
      ...base,
      status: "cancelled",
      readOnly: true,
      panelAccess: false,
      menuOnline: false,
      daysLeft: null,
    };
  }
  if (license.status === "suspended") {
    return {
      ...paid,
      ...base,
      status: "suspended",
      readOnly: true,
      panelAccess: true,
      menuOnline: false,
      daysLeft: null,
    };
  }

  // El plan Gratis no vence.
  if (plan.id === free.planId) {
    return {
      ...paid,
      ...base,
      status: "free",
      readOnly: false,
      panelAccess: true,
      menuOnline: true,
      daysLeft: null,
    };
  }

  const open = { readOnly: false, panelAccess: true, menuOnline: true };

  // Prueba: al terminar pasa directo a Gratis (sin gracia).
  if (license.status === "trial") {
    return now <= endsAt
      ? { ...paid, ...base, ...open, status: "trial", daysLeft: daysUntil(endsAt) }
      : { ...free, ...base, ...open, status: "free", daysLeft: null };
  }

  // Activa o en gracia: vigente → activa; vencida → gracia; fin de gracia → Gratis.
  if (now <= endsAt && license.status === "active") {
    return { ...paid, ...base, ...open, status: "active", daysLeft: daysUntil(endsAt) };
  }
  if (now <= graceEndsAt) {
    return { ...paid, ...base, ...open, status: "grace", daysLeft: daysUntil(graceEndsAt) };
  }
  return { ...free, ...base, ...open, status: "free", daysLeft: null };
}

export function hasFeature(entitlements: Pick<Entitlements, "features">, feature: Feature) {
  return entitlements.features.includes(feature);
}
