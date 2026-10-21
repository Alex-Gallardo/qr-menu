/**
 * Cuadrícula semanal de programación (pura): celdas día × franja con el menú
 * que se muestra. "General" vale para todas las sucursales; una sucursal puede
 * tener sus propias celdas, que ganan a las generales.
 */

/** Lunes primero, como en un calendario de Guatemala (0 = domingo en la base). */
export const GRID_WEEKDAYS = [1, 2, 3, 4, 5, 6, 0] as const;
export const WEEKDAY_SHORT: Record<number, string> = {
  0: "Dom",
  1: "Lun",
  2: "Mar",
  3: "Mié",
  4: "Jue",
  5: "Vie",
  6: "Sáb",
};

/** Clave de celda: `${slotId}:${weekday}` → menuId. */
export type Grid = Record<string, string>;

export const cellKey = (slotId: string, weekday: number) => `${slotId}:${weekday}`;

export type ScheduleRule = {
  menu_id: string;
  time_slot_id: string;
  branch_id: string | null;
  weekdays: number[];
  priority: number;
  starts_on?: Date | string | null;
  ends_on?: Date | string | null;
};

/** Prioridad con la que se guardan las reglas: la de sucursal siempre por encima. */
export const GENERAL_PRIORITY = 0;
export const BRANCH_PRIORITY = 10;

/** Solo las reglas semanales (sin rango de fechas) entran en la cuadrícula. */
export const isWeeklyRule = (r: Pick<ScheduleRule, "starts_on" | "ends_on">) =>
  !r.starts_on && !r.ends_on;

/**
 * Cuadrícula de un alcance (null = general). Si dos reglas caen en la misma
 * celda gana la de mayor prioridad (las del seed o versiones anteriores).
 */
export function gridFromRules(rules: readonly ScheduleRule[], branchId: string | null): Grid {
  const grid: Grid = {};
  const best: Record<string, number> = {};
  for (const r of rules) {
    if (r.branch_id !== branchId || !isWeeklyRule(r)) continue;
    for (const day of r.weekdays) {
      const key = cellKey(r.time_slot_id, day);
      if (best[key] === undefined || r.priority > best[key]!) {
        grid[key] = r.menu_id;
        best[key] = r.priority;
      }
    }
  }
  return grid;
}

/** Filas compactas para guardar: una por (franja, menú) con sus días ordenados. */
export function rulesFromGrid(grid: Grid, branchId: string | null) {
  const groups = new Map<string, { time_slot_id: string; menu_id: string; weekdays: number[] }>();
  for (const [key, menuId] of Object.entries(grid)) {
    const [slotId, day] = key.split(":");
    if (!slotId || day === undefined) continue;
    const id = `${slotId}|${menuId}`;
    const group = groups.get(id) ?? { time_slot_id: slotId, menu_id: menuId, weekdays: [] };
    group.weekdays.push(Number(day));
    groups.set(id, group);
  }
  return [...groups.values()].map((g) => ({
    ...g,
    weekdays: g.weekdays.sort((a, b) => a - b),
    branch_id: branchId,
    priority: branchId ? BRANCH_PRIORITY : GENERAL_PRIORITY,
  }));
}

export type EffectiveCell = { menuId: string | null; source: "branch" | "general" | null };

/** Lo que verá una sucursal en una celda: su regla gana a la general. */
export function effectiveCell(general: Grid, branch: Grid | null, key: string): EffectiveCell {
  if (branch?.[key]) return { menuId: branch[key]!, source: "branch" };
  if (general[key]) return { menuId: general[key]!, source: "general" };
  return { menuId: null, source: null };
}

/** Pone (o quita, con null) el mismo menú en los 7 días de una franja. */
export function fillWeek(grid: Grid, slotId: string, menuId: string | null): Grid {
  const next = { ...grid };
  for (const day of GRID_WEEKDAYS) {
    const key = cellKey(slotId, day);
    if (menuId) next[key] = menuId;
    else delete next[key];
  }
  return next;
}

export function setCell(grid: Grid, key: string, menuId: string | null): Grid {
  const next = { ...grid };
  if (menuId) next[key] = menuId;
  else delete next[key];
  return next;
}

/** Quita celdas de franjas o menús que ya no existen (o están en pausa). */
export function pruneGrid(grid: Grid, slotIds: ReadonlySet<string>, menuIds: ReadonlySet<string>) {
  return Object.fromEntries(
    Object.entries(grid).filter(
      ([key, menuId]) => slotIds.has(key.split(":")[0]!) && menuIds.has(menuId),
    ),
  );
}

/** Colores fijos por menú (en orden) para reconocerlos en la cuadrícula. */
export const MENU_COLORS = [
  "bg-tomate/90 text-white",
  "bg-aguacate/90 text-white",
  "bg-maiz text-frijol",
  "bg-frijol text-white",
  "bg-chile/80 text-white",
  "bg-canela text-white",
] as const;

/** "Desayunos" → "Des", "Almuerzo ejecutivo" → "AE" (para celdas angostas). */
export function menuInitials(name: string) {
  const words = name
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 2 || /^[A-ZÁÉÍÓÚ]/.test(w));
  if (words.length >= 2) return (words[0]![0]! + words[1]![0]!).toUpperCase();
  return name.trim().slice(0, 3);
}
