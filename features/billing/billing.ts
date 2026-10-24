/**
 * Mi plan y pagos de licencia (guía "Pagos de licencias por transferencia"),
 * puro: precios por periodo, hasta cuándo se extiende, textos de estados,
 * funciones y uso contra límites.
 */
import type { EffectiveStatus } from "@/features/licensing/entitlements";
import type { Feature, LimitedResource, PlanLimits } from "@/features/licensing/plan-catalog";

export const BILLING_PERIODS = [
  { value: "monthly", label: "Mensual", months: 1 },
  { value: "annual", label: "Anual · 2 meses gratis", months: 12 },
] as const;
export type BillingPeriod = (typeof BILLING_PERIODS)[number]["value"];

/** Planes que se pagan (Gratis no). */
export const PAID_PLANS = ["pro", "negocio"] as const;
export type PaidPlan = (typeof PAID_PLANS)[number];

export const PAYMENT_METHODS = [
  { value: "transfer", label: "Transferencia" },
  { value: "deposit", label: "Depósito" },
] as const;

/** Anual = 10 meses (2 gratis). El precio especial de la licencia manda sobre el de lista. */
export function amountCents(monthlyGtq: number, period: BillingPeriod) {
  return monthlyGtq * (period === "annual" ? 10 : 1) * 100;
}

function addMonthsUtc(date: Date, months: number) {
  const d = new Date(date);
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  // 31 de enero + 1 mes → último día de febrero (no 3 de marzo).
  if (d.getUTCDate() !== day) d.setUTCDate(0);
  return d;
}

/**
 * Periodo que cubre el pago: empieza cuando termina el actual (si aún no
 * vence, no se pierden días) o hoy si ya venció.
 */
export function nextPeriod(currentEnd: Date | null, period: BillingPeriod, now: Date = new Date()) {
  const start = currentEnd && currentEnd.getTime() > now.getTime() ? currentEnd : now;
  const months = BILLING_PERIODS.find((p) => p.value === period)!.months;
  return { start, end: addMonthsUtc(start, months) };
}

export const LICENSE_STATUS_LABELS: Record<EffectiveStatus, string> = {
  trial: "Prueba gratis",
  active: "Activa",
  grace: "Vencida (en gracia)",
  free: "Plan Gratis",
  suspended: "En pausa",
  cancelled: "Cancelada",
};

export const PAYMENT_STATUS_LABELS = {
  pending: "En verificación",
  verified: "Verificado",
  rejected: "Rechazado",
} as const;

export const FEATURE_LABELS: Record<Feature, string> = {
  scheduling: "Desayuno, almuerzo, cena y programación semanal",
  branch_scheduling: "Programación distinta por sucursal",
  multi_branch: "Varias sucursales",
  preorders: "Pedidos fuera de horario",
  all_templates: "Las 4 plantillas del menú",
  custom_palette: "Paleta personalizada o de tu logo",
  image_bg: "Fondo con imagen",
  video_bg: "Fondo con video",
  custom_splash: "Bienvenida configurable",
  staff_pin: "Staff con PIN",
  analytics_full: "Analíticas completas",
  analytics_compare: "Comparación por sucursal y exportar",
  remove_branding: "Quitar el pie de la marca",
};

/** Plan más barato que incluye la función (para la invitación a mejorar). */
export function planWithFeature<
  P extends { id: string; name: string; features: string[]; sort: number },
>(feature: Feature, plans: readonly P[]) {
  return (
    [...plans].sort((a, b) => a.sort - b.sort).find((p) => p.features.includes(feature)) ?? null
  );
}

const RESOURCE_LABELS: Record<LimitedResource, string> = {
  branches: "Sucursales",
  products: "Productos",
  menus: "Menús",
  time_slots: "Franjas horarias",
  qr: "Códigos QR",
  managers: "Encargados",
  staff: "Staff con PIN",
  storage_mb: "Fotos y videos (MB)",
};

/** Uso contra límites ("2/3 sucursales", "18/∞ productos"). */
export function usageRows(limits: PlanLimits, usage: Record<LimitedResource, number>) {
  return (Object.keys(RESOURCE_LABELS) as LimitedResource[]).map((resource) => {
    const limit = limits[resource];
    const used = usage[resource] ?? 0;
    return {
      resource,
      label: RESOURCE_LABELS[resource],
      used,
      limit,
      /** % usado (null si es ilimitado o el plan no lo incluye). */
      pct: limit ? Math.min(100, Math.round((used / limit) * 100)) : null,
      full: limit !== null && used >= limit,
    };
  });
}

/** Boletas en verificación a la vez (evita mandar la misma muchas veces). */
export const MAX_PENDING_PAYMENTS = 3;
