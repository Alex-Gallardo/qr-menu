/**
 * Horario semanal de una sucursal: un turno por día (0 = domingo … 6 = sábado).
 * Si cierra antes de abrir, el turno cruza la medianoche (18:00–02:00).
 */

export type DayHours = { weekday: number; open: boolean; opens: string; closes: string };

export const WEEKDAYS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
export const WEEKDAYS_SHORT = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isTime(value: string) {
  return TIME.test(value);
}

export function minutesOf(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h! * 60 + m!;
}

/** Semana completa (7 días) a partir de las filas guardadas. */
export function toWeek(rows: { weekday: number; opens: string; closes: string }[]): DayHours[] {
  return WEEKDAYS.map((_, weekday) => {
    const row = rows.find((r) => r.weekday === weekday);
    return row
      ? { weekday, open: true, opens: row.opens, closes: row.closes }
      : { weekday, open: false, opens: "08:00", closes: "20:00" };
  });
}

/** Lunes a sábado 08:00–20:00, domingo cerrado. */
export function defaultWeek(): DayHours[] {
  return WEEKDAYS.map((_, weekday) => ({
    weekday,
    open: weekday !== 0,
    opens: "08:00",
    closes: "20:00",
  }));
}

/** Problema del día o null. */
export function dayProblem(day: DayHours): string | null {
  if (!day.open) return null;
  if (!isTime(day.opens) || !isTime(day.closes)) return "Usa horas como 07:30.";
  if (day.opens === day.closes) return "La hora de cierre debe ser distinta a la de apertura.";
  return null;
}

/** "07:00–21:00" o "Cerrado" para un día. */
export function dayLabel(day: DayHours | undefined) {
  if (!day?.open) return "Cerrado";
  return `${day.opens}–${day.closes}`;
}

/**
 * Resumen corto agrupando días seguidos con el mismo horario:
 * "Lun–Sáb 07:00–21:00 · Dom 08:00–15:00".
 */
export function weekSummary(week: DayHours[]) {
  // Empieza en lunes para que "Lun–Sáb" quede junto.
  const order = [1, 2, 3, 4, 5, 6, 0].map((d) => week.find((w) => w.weekday === d)!);
  const groups: { from: number; to: number; label: string }[] = [];
  for (const day of order) {
    const label = dayLabel(day);
    const last = groups.at(-1);
    if (last && last.label === label) last.to = day.weekday;
    else groups.push({ from: day.weekday, to: day.weekday, label });
  }
  return groups
    .filter((g) => g.label !== "Cerrado")
    .map((g) =>
      g.from === g.to
        ? `${WEEKDAYS_SHORT[g.from]} ${g.label}`
        : `${WEEKDAYS_SHORT[g.from]}–${WEEKDAYS_SHORT[g.to]} ${g.label}`,
    )
    .join(" · ");
}
