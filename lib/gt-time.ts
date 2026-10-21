/**
 * Hora de Guatemala (America/Guatemala, UTC-6 sin horario de verano). El menú
 * del día, las fechas especiales y los horarios se calculan siempre con esta
 * hora, sin importar dónde corra el servidor o el navegador.
 */

export const GT_TIMEZONE = "America/Guatemala";

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: GT_TIMEZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  weekday: "short",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

const WEEKDAY_INDEX: Record<string, number> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

/** Fecha ("2026-12-24"), día de la semana (0 = domingo) y minutos desde medianoche en Guatemala. */
export function guatemalaNow(now: Date = new Date()) {
  const parts = Object.fromEntries(partsFormatter.formatToParts(now).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: WEEKDAY_INDEX[parts.weekday!]!,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

export const todayInGuatemala = (now: Date = new Date()) => guatemalaNow(now).date;

/** "2026-12-24" → "jueves 24 de diciembre" (sin año si es el año en curso). */
export function formatDateEs(isoDate: string, now: Date = new Date()) {
  const [y, m, d] = isoDate.split("-").map(Number);
  // Mediodía UTC: el día no cambia por la zona horaria al formatear.
  const date = new Date(Date.UTC(y!, m! - 1, d!, 12));
  const sameYear = y === Number(todayInGuatemala(now).slice(0, 4));
  return new Intl.DateTimeFormat("es-GT", {
    timeZone: "UTC",
    weekday: "long",
    day: "numeric",
    month: "long",
    ...(sameYear ? {} : { year: "numeric" }),
  }).format(date);
}

/** Fecha de la base (@db.Date, medianoche UTC) → "YYYY-MM-DD". */
export const dateOnly = (date: Date) => date.toISOString().slice(0, 10);

/** "2026-12-24" + 1 → "2026-12-25" (cruza meses y años). */
export function addDays(isoDate: string, days: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d! + days)).toISOString().slice(0, 10);
}

/** Instante (Date) de una fecha y hora local de Guatemala: ("2026-12-24", 17:30) → 23:30 UTC. */
export function gtInstant(isoDate: string, minutes: number) {
  const [y, m, d] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(y!, m! - 1, d!) + (minutes + 6 * 60) * 60_000);
}
