import { minutesOf, WEEKDAYS } from "@/features/branches/hours";
import { addDays, gtInstant, guatemalaNow } from "@/lib/gt-time";

/**
 * ¿Para cuándo? (puro). Con la sucursal abierta se puede pedir "Lo antes
 * posible"; según su modo (`preorder_mode`) también programar, o dejar el
 * pedido estando cerrada: horarios cada 15 min dentro del horario de la
 * sucursal, desde ahora + anticipación mínima y hasta los días máximos. Los
 * días con fecha especial "Cerrado" no se ofrecen. El servidor valida lo mismo
 * al crear el pedido (validateScheduledFor).
 */

export type PreorderMode = "off" | "next_open" | "always";
export type HoursRow = { weekday: number; opens: string; closes: string };

export const SLOT_STEP_MIN = 15;
const DAY = 1440;

export type TimingRules = {
  hours: readonly HoursRow[];
  /** Fechas "YYYY-MM-DD" cerradas por fecha especial. */
  closedDates: readonly string[];
  mode: PreorderMode;
  minLeadMin: number;
  maxDays: number;
  /** El plan incluye "pedidos programados"; sin eso el modo es "off". */
  preordersEnabled: boolean;
};

export type TimeSlot = { at: string; minutes: number; label: string };
export type DaySlots = { date: string; label: string; times: TimeSlot[] };

export type OrderTiming = {
  openNow: boolean;
  /** Se puede pedir "Lo antes posible". */
  asap: boolean;
  /** Horarios para programar (vacío si no se puede). */
  days: DaySlots[];
  /** Aviso para el menú cuando está cerrada. */
  notice: string | null;
  /** Por qué no se puede pedir ahora (null = sí se puede). */
  blocked: string | null;
};

/** 7:30, 13:05 (como en la guía: sin cero a la izquierda). */
export const timeLabel = (minutes: number) =>
  `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}`;

/** Turnos de un día como minutos desde la medianoche de hoy (pueden pasar de 1440). */
function windows(rules: TimingRules, todayWeekday: number, fromDay: number, toDay: number) {
  const result: { start: number; end: number }[] = [];
  for (let d = fromDay; d <= toDay; d++) {
    const weekday = (((todayWeekday + d) % 7) + 7) % 7;
    for (const row of rules.hours.filter((r) => r.weekday === weekday)) {
      const opens = minutesOf(row.opens);
      let closes = minutesOf(row.closes);
      if (closes <= opens) closes += DAY; // cruza la medianoche
      result.push({ start: d * DAY + opens, end: d * DAY + closes });
    }
  }
  return result.sort((a, b) => a.start - b.start);
}

function dayWord(offset: number, weekday: number) {
  if (offset === 0) return "hoy";
  if (offset === 1) return "mañana";
  return `el ${WEEKDAYS[weekday]!.toLowerCase()}`;
}

export function orderTiming(rules: TimingRules, now: Date = new Date()): OrderTiming {
  const gt = guatemalaNow(now);
  const closed = new Set(rules.closedDates);
  const dateAt = (offset: number) => addDays(gt.date, offset);
  const nowMin = gt.minutes;
  const mode: PreorderMode = rules.preordersEnabled ? rules.mode : "off";

  // Turnos desde ayer (cola de medianoche) hasta el último día permitido, sin días cerrados.
  const maxDays = Math.max(0, Math.min(rules.maxDays, 14));
  const all = windows(rules, gt.weekday, -1, Math.max(maxDays, 7)).filter(
    (w) => !closed.has(dateAt(Math.floor(w.start / DAY))),
  );
  const openNow = all.some((w) => w.start <= nowMin && nowMin < w.end);
  const next = all.find((w) => w.start > nowMin);
  const nextLabel = next
    ? `${dayWord(Math.floor(next.start / DAY), (gt.weekday + Math.floor(next.start / DAY)) % 7)} a las ${timeLabel(next.start % DAY)}`
    : null;

  const days: DaySlots[] = [];
  if (mode !== "off") {
    const earliest =
      Math.ceil((nowMin + Math.max(0, rules.minLeadMin)) / SLOT_STEP_MIN) * SLOT_STEP_MIN;
    const limit = (maxDays + 1) * DAY;
    for (const w of all) {
      // Último horario: 15 min antes de cerrar.
      for (
        let t = Math.ceil(w.start / SLOT_STEP_MIN) * SLOT_STEP_MIN;
        t < w.end;
        t += SLOT_STEP_MIN
      ) {
        if (t < earliest || t >= limit || t + SLOT_STEP_MIN > w.end) continue;
        const offset = Math.floor(t / DAY);
        const date = dateAt(offset);
        if (closed.has(date)) continue;
        let day = days.find((d) => d.date === date);
        if (!day) {
          const word = dayWord(offset, (gt.weekday + offset) % 7);
          day = { date, label: word.charAt(0).toUpperCase() + word.slice(1), times: [] };
          days.push(day);
        }
        const minutes = t - offset * DAY;
        if (!day.times.some((x) => x.minutes === minutes))
          day.times.push({
            at: gtInstant(date, minutes).toISOString(),
            minutes,
            label: timeLabel(minutes),
          });
      }
    }
    days.sort((a, b) => a.date.localeCompare(b.date));
    days.forEach((d) => d.times.sort((a, b) => a.minutes - b.minutes));
  }

  const asap = openNow || mode === "always";
  const first = days[0]?.times[0];
  let notice: string | null = null;
  let blocked: string | null = null;
  if (!openNow) {
    if (mode === "always") {
      notice = nextLabel
        ? `Ahorita estamos cerrados, pero puedes dejar tu pedido: lo atendemos al abrir (${nextLabel}).`
        : "Ahorita estamos cerrados, pero puedes dejar tu pedido.";
    } else if (mode === "next_open" && first) {
      notice = `Ahorita estamos cerrados, pero puedes dejar tu pedido para ${days[0]!.label.toLowerCase()} desde las ${first.label}.`;
    } else {
      notice = nextLabel
        ? `Ahorita estamos cerrados. Abrimos ${nextLabel}. Puedes ver el menú igual.`
        : "Ahorita estamos cerrados. Puedes ver el menú igual.";
      blocked = nextLabel ? `Abrimos ${nextLabel}.` : "Por ahora no estamos recibiendo pedidos.";
    }
  }
  return { openNow, asap, days, notice, blocked };
}

/**
 * ¿Vale esta hora? null = lo antes posible. Devuelve el problema o null.
 * Lo usa el servidor al crear el pedido (QRM-027).
 */
export function validateScheduledFor(
  rules: TimingRules,
  scheduledFor: Date | null,
  now: Date = new Date(),
): string | null {
  const timing = orderTiming(rules, now);
  if (scheduledFor === null)
    return timing.asap ? null : (timing.blocked ?? "Elige para cuándo quieres tu pedido.");
  const at = scheduledFor.toISOString();
  const ok = timing.days.some((d) => d.times.some((t) => t.at === at));
  return ok ? null : "Ese horario ya no está disponible. Elige otro.";
}

/** "hoy 7:30", "mañana 7:30", "jueves 24 7:30" para el resumen y el mensaje. */
export function scheduledLabel(at: string, now: Date = new Date()) {
  const target = guatemalaNow(new Date(at));
  const today = guatemalaNow(now).date;
  const time = timeLabel(target.minutes);
  if (target.date === today) return `hoy ${time}`;
  if (target.date === addDays(today, 1)) return `mañana ${time}`;
  return `${WEEKDAYS[target.weekday]!.toLowerCase()} ${Number(target.date.slice(8))} ${time}`;
}
