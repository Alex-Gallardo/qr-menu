import { minutesOf } from "@/features/branches/hours";
import { addDays, guatemalaNow, gtInstant } from "@/lib/gt-time";
import { crossesMidnight, isWithinSlot, sortSlots, type SlotKey } from "./slots";

/**
 * Menú del día de una sucursal (puro: corre igual en el servidor y en el
 * navegador del cliente, con la hora de Guatemala). Orden de la guía:
 *
 *  1. Fecha especial de la sucursal para hoy y la franja actual (o "Cerrado").
 *  2. Fecha especial general del negocio.
 *  3. Programación de la sucursal para la franja y el día → mayor prioridad.
 *  4. Programación general.
 *  5. Sin franja activa: el próximo menú, con aviso ("La cena empieza a las 17:30").
 *  6. Nada aplica: el menú predeterminado.
 *
 * Una franja que cruza la medianoche (22:00–02:00) pertenece al día en que
 * empezó: el sábado a la 01:00 sigue siendo "la noche del viernes".
 */

export type ResolverSlot = {
  id: string;
  key: SlotKey;
  name: string;
  start_time: string;
  end_time: string;
  is_active: boolean;
};

export type ResolverMenu = {
  id: string;
  is_active: boolean;
  is_default: boolean;
  hidden_by_license?: boolean;
};

export type ResolverRule = {
  menu_id: string;
  time_slot_id: string;
  branch_id: string | null;
  weekdays: number[];
  priority: number;
  starts_on?: Date | string | null;
  ends_on?: Date | string | null;
};

export type ResolverOverride = {
  branch_id: string | null;
  /** "YYYY-MM-DD" */
  date: string;
  time_slot_id: string | null;
  /** null = Cerrado. */
  menu_id: string | null;
  note?: string | null;
};

export type ResolverInput = {
  branchId: string;
  slots: readonly ResolverSlot[];
  menus: readonly ResolverMenu[];
  rules: readonly ResolverRule[];
  overrides: readonly ResolverOverride[];
};

export type ActiveMenu = {
  /** open: hay menú en la franja actual · closed: fecha especial "Cerrado" ·
   *  upcoming: fuera de franja, se muestra el próximo · default: el predeterminado. */
  status: "open" | "closed" | "upcoming" | "default";
  menuId: string | null;
  /** Franja actual (open/closed) o la próxima (upcoming). */
  slot: ResolverSlot | null;
  reason:
    | "override_branch"
    | "override_general"
    | "schedule_branch"
    | "schedule_general"
    | "next_slot"
    | "default";
  /** Aviso para el cliente: "La cena empieza a las 17:30", "Cerrado por feriado". */
  message: string | null;
  note: string | null;
};

const ARTICLE: Record<SlotKey, string> = {
  breakfast: "El desayuno",
  lunch: "El almuerzo",
  dinner: "La cena",
  custom: "",
};

/** "La cena empieza a las 17:30" / "El desayuno empieza mañana a las 06:30". */
export function slotStartsMessage(slot: ResolverSlot, tomorrow: boolean) {
  const who = ARTICLE[slot.key] || slot.name;
  return `${who} empieza ${tomorrow ? "mañana " : ""}a las ${slot.start_time}`;
}

const toIso = (value: Date | string | null | undefined) =>
  value
    ? typeof value === "string"
      ? value.slice(0, 10)
      : value.toISOString().slice(0, 10)
    : null;

/** Día de servicio de la franja: si cruza la medianoche y estamos en su cola, es el de ayer. */
function serviceDay(slot: ResolverSlot, date: string, weekday: number, minutes: number) {
  if (crossesMidnight(slot) && minutes < minutesOf(slot.end_time)) {
    return { date: addDays(date, -1), weekday: (weekday + 6) % 7 };
  }
  return { date, weekday };
}

function usableMenu(menus: readonly ResolverMenu[], id: string | null) {
  if (!id) return null;
  const menu = menus.find((m) => m.id === id);
  return menu && menu.is_active && !menu.hidden_by_license ? menu : null;
}

/** Fecha especial del alcance para ese día y franja: la de la franja gana a la de todo el día. */
function findOverride(
  overrides: readonly ResolverOverride[],
  branchId: string | null,
  date: string,
  slotId: string | null,
) {
  const sameDay = overrides.filter((o) => o.branch_id === branchId && o.date === date);
  return (
    (slotId ? sameDay.find((o) => o.time_slot_id === slotId) : undefined) ??
    sameDay.find((o) => o.time_slot_id === null) ??
    null
  );
}

/**
 * Regla que manda en un alcance: mayor prioridad; en empate, la de temporada
 * (con fechas) gana a la semanal; si sigue el empate, la de menor id de menú
 * (determinista: el mismo resultado en el servidor y en cada celular).
 */
function findRule(
  input: ResolverInput,
  branchId: string | null,
  slotId: string,
  day: { date: string; weekday: number },
) {
  const candidates = input.rules.filter((r) => {
    if (r.branch_id !== branchId || r.time_slot_id !== slotId) return false;
    if (!r.weekdays.includes(day.weekday)) return false;
    const from = toIso(r.starts_on);
    const to = toIso(r.ends_on);
    if (from && day.date < from) return false;
    if (to && day.date > to) return false;
    return usableMenu(input.menus, r.menu_id) !== null;
  });
  candidates.sort(
    (a, b) =>
      b.priority - a.priority ||
      Number(Boolean(b.starts_on || b.ends_on)) - Number(Boolean(a.starts_on || a.ends_on)) ||
      a.menu_id.localeCompare(b.menu_id),
  );
  return candidates[0] ?? null;
}

const defaultMenu = (menus: readonly ResolverMenu[]) =>
  menus.find((m) => m.is_default && usableMenu(menus, m.id)) ?? null;

/** Resultado para una franja concreta en su día de servicio (pasos 1 a 4). */
function resolveInSlot(
  input: ResolverInput,
  slot: ResolverSlot,
  day: { date: string; weekday: number },
): ActiveMenu | null {
  for (const [scope, reason] of [
    [input.branchId, "override_branch"],
    [null, "override_general"],
  ] as const) {
    const override = findOverride(input.overrides, scope, day.date, slot.id);
    if (!override) continue;
    if (override.menu_id === null) {
      return {
        status: "closed",
        menuId: null,
        slot,
        reason,
        message: override.note ? `Cerrado: ${override.note}` : "Cerrado hoy",
        note: override.note ?? null,
      };
    }
    // Un menú especial en pausa o borrado no aplica: se sigue con la programación.
    if (usableMenu(input.menus, override.menu_id)) {
      return {
        status: "open",
        menuId: override.menu_id,
        slot,
        reason,
        message: null,
        note: override.note ?? null,
      };
    }
  }
  for (const [scope, reason] of [
    [input.branchId, "schedule_branch"],
    [null, "schedule_general"],
  ] as const) {
    const rule = findRule(input, scope, slot.id, day);
    if (rule)
      return { status: "open", menuId: rule.menu_id, slot, reason, message: null, note: null };
  }
  return null;
}

export function resolveActiveMenu(input: ResolverInput, at: Date = new Date()): ActiveMenu {
  const now = guatemalaNow(at);
  const slots = sortSlots(input.slots.filter((s) => s.is_active));
  const fallback = (): ActiveMenu => ({
    status: "default",
    menuId: defaultMenu(input.menus)?.id ?? null,
    slot: null,
    reason: "default",
    message: null,
    note: null,
  });

  // Franja actual (si hay varias, la primera del día; no deberían cruzarse).
  const current = slots.find((s) => isWithinSlot(now.minutes, s));
  if (current) {
    const day = serviceDay(current, now.date, now.weekday, now.minutes);
    return resolveInSlot(input, current, day) ?? { ...fallback(), slot: current };
  }

  // Fuera de franja: un "Cerrado" de todo el día manda aunque no haya franja.
  for (const [scope, reason] of [
    [input.branchId, "override_branch"],
    [null, "override_general"],
  ] as const) {
    const allDay = findOverride(input.overrides, scope, now.date, null);
    if (allDay && allDay.time_slot_id === null && allDay.menu_id === null) {
      return {
        status: "closed",
        menuId: null,
        slot: null,
        reason,
        message: allDay.note ? `Cerrado: ${allDay.note}` : "Cerrado hoy",
        note: allDay.note ?? null,
      };
    }
  }

  // Paso 5: la próxima franja (hoy o mañana) y el menú que tendrá.
  const next = nextSlot(slots, now.minutes);
  if (next) {
    const date = next.tomorrow ? addDays(now.date, 1) : now.date;
    const weekday = next.tomorrow ? (now.weekday + 1) % 7 : now.weekday;
    const upcoming = resolveInSlot(input, next.slot, { date, weekday });
    if (upcoming && upcoming.status === "open") {
      return {
        status: "upcoming",
        menuId: upcoming.menuId,
        slot: next.slot,
        reason: "next_slot",
        message: slotStartsMessage(next.slot, next.tomorrow),
        note: upcoming.note,
      };
    }
  }
  return fallback();
}

function nextSlot(slots: readonly ResolverSlot[], minutes: number) {
  const later = slots.find((s) => minutesOf(s.start_time) > minutes);
  if (later) return { slot: later, tomorrow: false };
  return slots[0] ? { slot: slots[0], tomorrow: true } : null;
}

/**
 * Menú de la siguiente franja después de la actual (para "Siguiente: …" en el
 * panel). null si no hay otra franja o no tiene menú.
 */
export function resolveNextMenu(input: ResolverInput, at: Date = new Date()) {
  const now = guatemalaNow(at);
  const slots = sortSlots(input.slots.filter((s) => s.is_active));
  const current = slots.find((s) => isWithinSlot(now.minutes, s));
  const after = current ? minutesOf(current.start_time) : now.minutes;
  const next = nextSlot(
    slots.filter((s) => s.id !== current?.id),
    after,
  );
  if (!next) return null;
  const date = next.tomorrow ? addDays(now.date, 1) : now.date;
  const startsAt = gtInstant(date, minutesOf(next.slot.start_time));
  const result = resolveActiveMenu(input, startsAt);
  return result.status === "open" ? { ...result, tomorrow: next.tomorrow } : null;
}
