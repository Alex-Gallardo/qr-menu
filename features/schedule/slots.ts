import { isTime, minutesOf } from "@/features/branches/hours";

/**
 * Franjas horarias (puras): Desayuno, Almuerzo, Cena o personalizadas. Si la
 * hora de fin es menor que la de inicio, la franja cruza la medianoche
 * (20:00–02:00). Las mismas funciones las usará resolveActiveMenu (QRM-019).
 */

export type SlotKey = "breakfast" | "lunch" | "dinner" | "custom";

export type Slot = {
  id: string;
  key: SlotKey;
  name: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

const DAY = 24 * 60;

export const SLOT_PRESETS: Record<
  Exclude<SlotKey, "custom">,
  { name: string; start: string; end: string }
> = {
  breakfast: { name: "Desayuno", start: "06:30", end: "11:00" },
  lunch: { name: "Almuerzo", start: "11:30", end: "15:30" },
  dinner: { name: "Cena", start: "17:30", end: "21:30" },
};

export const SLOT_KEY_LABELS: Record<SlotKey, string> = {
  breakfast: "Desayuno",
  lunch: "Almuerzo",
  dinner: "Cena",
  custom: "Personalizada",
};

export function crossesMidnight(slot: Pick<Slot, "start_time" | "end_time">) {
  return minutesOf(slot.end_time) < minutesOf(slot.start_time);
}

/** Minutos que dura la franja (contando el cruce de medianoche). */
export function slotDuration(slot: Pick<Slot, "start_time" | "end_time">) {
  const start = minutesOf(slot.start_time);
  const end = minutesOf(slot.end_time);
  return end > start ? end - start : DAY - start + end;
}

/** "4 h 30 min", "45 min", "3 h". */
export function formatDuration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/** "06:30–11:00" o "20:00–02:00 (+1 día)". */
export function formatSlotRange(slot: Pick<Slot, "start_time" | "end_time">) {
  return `${slot.start_time}–${slot.end_time}${crossesMidnight(slot) ? " (termina al día siguiente)" : ""}`;
}

/** Tramos [inicio, fin) en minutos del día; una franja que cruza la medianoche da dos. */
function segments(slot: Pick<Slot, "start_time" | "end_time">): [number, number][] {
  const start = minutesOf(slot.start_time);
  const end = minutesOf(slot.end_time);
  return end > start
    ? [[start, end]]
    : [
        [start, DAY],
        [0, end],
      ];
}

/** ¿Se cruzan? Que una termine justo cuando empieza la otra no cuenta. */
export function slotsOverlap(
  a: Pick<Slot, "start_time" | "end_time">,
  b: Pick<Slot, "start_time" | "end_time">,
) {
  return segments(a).some(([as, ae]) => segments(b).some(([bs, be]) => as < be && bs < ae));
}

/** ¿La hora (minutos desde medianoche) cae dentro de la franja? Inicio incluido, fin no. */
export function isWithinSlot(minutes: number, slot: Pick<Slot, "start_time" | "end_time">) {
  return segments(slot).some(([s, e]) => minutes >= s && minutes < e);
}

/** Problema de horario de una franja sola, o null. */
export function slotTimeProblem(slot: Pick<Slot, "start_time" | "end_time">): string | null {
  if (!isTime(slot.start_time) || !isTime(slot.end_time)) return "Usa horas como 06:30.";
  if (slot.start_time === slot.end_time) return "La hora de fin debe ser distinta a la de inicio.";
  if (slotDuration(slot) < 30) return "La franja debe durar al menos 30 minutos.";
  return null;
}

/**
 * Primera franja activa con la que choca `candidate` (sin contarse a sí misma),
 * o null. Las pausadas no cuentan: no se muestran.
 */
export function findOverlap<T extends Pick<Slot, "id" | "start_time" | "end_time" | "is_active">>(
  candidate: Pick<Slot, "start_time" | "end_time"> & { id?: string },
  others: readonly T[],
) {
  return (
    others.find((o) => o.is_active && o.id !== candidate.id && slotsOverlap(candidate, o)) ?? null
  );
}

/** Orden natural del día: por hora de inicio. */
export function sortSlots<T extends Pick<Slot, "start_time" | "name">>(slots: readonly T[]) {
  return [...slots].sort(
    (a, b) => minutesOf(a.start_time) - minutesOf(b.start_time) || a.name.localeCompare(b.name),
  );
}

/** Para la línea de tiempo del panel: posición y ancho en % del día de cada tramo. */
export function timelineSegments(slot: Pick<Slot, "start_time" | "end_time">) {
  return segments(slot).map(([s, e]) => ({ left: (s / DAY) * 100, width: ((e - s) / DAY) * 100 }));
}
