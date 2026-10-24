/**
 * Ciclo de vida de la licencia (guía §9 y A3), puro: qué transición toca hoy
 * y qué recordatorio mandar. Lo aplica el cron diario (/api/cron/licenses).
 *
 *   prueba vencida            → Gratis (sin gracia)
 *   activa vencida            → gracia (grace_days, 7 por defecto)
 *   gracia sin pago al final  → Gratis
 *
 * Bajar a Gratis no borra nada: lo que excede los límites se oculta.
 */

const DAY = 24 * 60 * 60 * 1000;
export const FREE_PLAN = "gratis";

export type LifecycleLicense = {
  plan_id: string;
  status: "trial" | "active" | "grace" | "suspended" | "cancelled";
  ends_at: Date;
  grace_days: number;
};

export type Transition =
  | { kind: "grace"; status: "grace" }
  | { kind: "downgraded"; status: "active"; plan_id: typeof FREE_PLAN; from: string };

export function nextTransition(l: LifecycleLicense, now: Date = new Date()): Transition | null {
  if (l.plan_id === FREE_PLAN) return null;
  const t = now.getTime();
  const ends = l.ends_at.getTime();
  if (l.status === "trial" && t > ends)
    return { kind: "downgraded", status: "active", plan_id: FREE_PLAN, from: l.plan_id };
  if (l.status === "active" && t > ends) return { kind: "grace", status: "grace" };
  if (l.status === "grace" && t > ends + l.grace_days * DAY)
    return { kind: "downgraded", status: "active", plan_id: FREE_PLAN, from: l.plan_id };
  return null;
}

/** Avisos antes del vencimiento (panel y correo al dueño). */
export const REMINDER_DAYS = [7, 3, 1] as const;

/**
 * ¿Toca un recordatorio? 7, 3 o 1 día antes de que venza (prueba o activa), una
 * sola vez cada uno por periodo (`sent`: los días ya avisados desde `ends_at`).
 */
export function reminderDue(
  l: LifecycleLicense,
  sent: readonly number[],
  now: Date = new Date(),
): number | null {
  if (l.plan_id === FREE_PLAN || (l.status !== "trial" && l.status !== "active")) return null;
  const left = Math.ceil((l.ends_at.getTime() - now.getTime()) / DAY);
  if (left < 1) return null;
  // El menor umbral alcanzado que aún no se avisó (si el cron falló un día, no se repite el de 7).
  const due = REMINDER_DAYS.filter((d) => left <= d);
  const day = due.at(-1);
  return day !== undefined && !sent.includes(day) ? day : null;
}

/** Cuántos de cada cosa quedan visibles en Gratis (el resto se oculta por orden). */
export type FreeLimits = {
  branches: number | null;
  products: number | null;
  menus: number | null;
  qr: number | null;
  staff: number | null;
};

/** Ids a ocultar: se conservan los primeros `limit` (ya vienen ordenados). */
export function idsOverLimit(orderedIds: string[], limit: number | null) {
  return limit === null ? [] : orderedIds.slice(Math.max(0, limit));
}

export function reminderText(days: number, planName: string) {
  return days === 1
    ? `Tu plan ${planName} vence mañana.`
    : `Tu plan ${planName} vence en ${days} días.`;
}
