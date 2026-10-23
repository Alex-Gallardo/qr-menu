/**
 * Analíticas (guía §6 "Analíticas"), puro: periodos en hora de Guatemala,
 * comparación con la semana anterior, embudo y exportación. Los números salen
 * de la tabla propia de eventos (visitas, productos vistos, carrito) y de la
 * tabla de pedidos (pedidos, ventas): así el embudo cuadra con la base.
 */

/** Eventos que manda el menú público (los demás los escribe el servidor). */
export const CLIENT_EVENTS = [
  "page_view",
  "product_view",
  "add_to_cart",
  "checkout_start",
  "app_installed",
] as const;
export type ClientEvent = (typeof CLIENT_EVENTS)[number];

export const PERIODS = [
  { value: "hoy", label: "Hoy" },
  { value: "7d", label: "7 días" },
  { value: "30d", label: "30 días" },
] as const;
export type Period = (typeof PERIODS)[number]["value"];

const DAY = 24 * 60 * 60 * 1000;
/** Guatemala: UTC−6 todo el año (sin horario de verano). */
const GT_OFFSET = 6 * 60 * 60 * 1000;

/** Sin "analíticas completas" (plan Gratis) solo se ve hoy. */
export function parsePeriod(raw: string | null | undefined, full: boolean): Period {
  if (!full) return "hoy";
  return PERIODS.some((p) => p.value === raw) ? (raw as Period) : "7d";
}

/** Medianoche de Guatemala del día de `now`, como instante UTC. */
export function gtMidnight(now: Date) {
  const gt = new Date(now.getTime() - GT_OFFSET);
  return new Date(Date.UTC(gt.getUTCFullYear(), gt.getUTCMonth(), gt.getUTCDate()) + GT_OFFSET);
}

export type Range = { from: Date; to: Date };

/**
 * Periodo y su comparación: hoy contra el mismo día (y a la misma hora) de la
 * semana pasada; 7 días contra los 7 anteriores; 30 contra los 30 anteriores.
 */
export function periodRanges(period: Period, now: Date = new Date()) {
  const today = gtMidnight(now);
  const days = period === "hoy" ? 1 : period === "7d" ? 7 : 30;
  const from = new Date(today.getTime() - (days - 1) * DAY);
  const shift = Math.max(7, days) * DAY;
  return {
    current: { from, to: now } satisfies Range,
    previous: { from: new Date(from.getTime() - shift), to: new Date(now.getTime() - shift) },
    previousLabel:
      period === "hoy"
        ? "el mismo día de la semana pasada"
        : period === "7d"
          ? "la semana anterior"
          : "los 30 días anteriores",
  };
}

/** Porcentaje entero (null si no hay base). */
export function pct(part: number, total: number) {
  return total > 0 ? Math.round((part / total) * 100) : null;
}

/** Cambio contra el periodo anterior: +25 %, −10 %; null si antes era 0. */
export function delta(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : null;
  return Math.round(((current - previous) / previous) * 100);
}

export function deltaLabel(change: number | null) {
  if (change === null) return "nuevo";
  if (change === 0) return "igual";
  return `${change > 0 ? "+" : "−"}${Math.abs(change)} %`;
}

export type FunnelCounts = {
  visitors: number;
  viewedProduct: number;
  addedToCart: number;
  startedCheckout: number;
  /** Celulares del embudo que enviaron un pedido (sale de la tabla de pedidos). */
  orders: number;
};

const FUNNEL_STEPS: { key: keyof FunnelCounts; label: string }[] = [
  { key: "visitors", label: "Vieron el menú" },
  { key: "viewedProduct", label: "Abrieron un producto" },
  { key: "addedToCart", label: "Agregaron al pedido" },
  { key: "startedCheckout", label: "Abrieron su pedido" },
  { key: "orders", label: "Pidieron" },
];

/**
 * Embudo por visitantes (dispositivos); el último paso son los que además
 * tienen un pedido en la base con el mismo id de dispositivo.
 * `ofFirst`: % sobre los que vieron el menú (el ancho de la barra).
 */
export function funnel(counts: FunnelCounts) {
  return FUNNEL_STEPS.map((step, i) => {
    const value = counts[step.key];
    const prev = i > 0 ? counts[FUNNEL_STEPS[i - 1]!.key] : value;
    return {
      ...step,
      value,
      ofFirst: pct(value, counts.visitors),
      ofPrevious: i > 0 ? pct(value, prev) : null,
    };
  });
}

/** Conversión: visitantes que pidieron sobre visitantes (null sin visitas registradas). */
export const conversion = (orders: number, visitors: number) => pct(orders, visitors);

/** Ticket promedio en centavos (pedidos no cancelados). */
export const avgTicket = (revenueCents: number, orders: number) =>
  orders > 0 ? Math.round(revenueCents / orders) : 0;

/** 24 horas (0–23) con los pedidos de cada una; las que faltan, en 0. */
export function hoursSeries(rows: { hour: number; orders: number }[]) {
  const out = Array.from({ length: 24 }, (_, hour) => ({ hour, orders: 0 }));
  for (const r of rows) if (r.hour >= 0 && r.hour < 24) out[r.hour]!.orders += r.orders;
  return out;
}

/** "7 a. m.", "12 p. m.", "9 p. m." (para la gráfica por hora). */
export function hourLabel(hour: number) {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  return `${h} ${hour < 12 ? "a. m." : "p. m."}`;
}

/** CSV para Excel en español: separador ";" , BOM y comillas cuando hace falta. */
export function toCsv(header: string[], rows: (string | number | null)[][]) {
  const cell = (v: string | number | null) => {
    // Un nombre que empieza con = + - @ sería una fórmula en Excel.
    const text =
      v === null ? "" : typeof v === "string" && /^[=+\-@]/.test(v) ? `'${v}` : String(v);
    return /[";\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return "﻿" + [header, ...rows].map((r) => r.map(cell).join(";")).join("\r\n") + "\r\n";
}
