/**
 * Grupos de opciones (puros): "Tamaño" obligatorio (elige 1), "Extras" de 0 a 3.
 * Las mismas reglas las usa el panel al guardar y, más adelante, el carrito y
 * el servidor al recalcular el pedido.
 */

export const MAX_GROUPS = 10;
export const MAX_OPTIONS = 30;
export const MAX_DELTA_CENTS = 1_000_00; // ±Q1,000

export type GroupRule = { min_select: number; max_select: number };

export type OptionGroup = GroupRule & {
  id: string;
  name: string;
  options: { id: string; name: string; price_delta_cents: number; is_available: boolean }[];
};

/** Plantillas para empezar rápido (los nombres y precios se editan). */
export const GROUP_PRESETS = {
  size: {
    name: "Tamaño",
    min_select: 1,
    max_select: 1,
    options: [
      { name: "Mediano", price_delta_cents: 0 },
      { name: "Grande", price_delta_cents: 500 },
    ],
  },
  extras: {
    name: "Extras",
    min_select: 0,
    max_select: 3,
    options: [
      { name: "Queso extra", price_delta_cents: 500 },
      { name: "Aguacate", price_delta_cents: 800 },
    ],
  },
} as const;

/** Problema con la regla de un grupo, o null si está bien. */
export function groupRuleProblem(rule: GroupRule, optionCount: number): string | null {
  const { min_select: min, max_select: max } = rule;
  if (optionCount === 0) return "Agrega al menos una opción.";
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < 1)
    return "Revisa cuántas puede elegir.";
  if (min > max) return "El mínimo no puede ser mayor que el máximo.";
  if (max > optionCount)
    return `Solo hay ${optionCount} ${optionCount === 1 ? "opción" : "opciones"}: el máximo no puede ser mayor.`;
  return null;
}

/** Texto para el cliente y el panel: "Obligatorio · elige 1", "Opcional · hasta 3". */
export function describeGroup({ min_select: min, max_select: max }: GroupRule) {
  if (min === 0) return max === 1 ? "Opcional · elige 1" : `Opcional · hasta ${max}`;
  if (min === max) return `Obligatorio · elige ${min}`;
  return `Obligatorio · elige de ${min} a ${max}`;
}

export type SelectionProblem = { groupId: string; message: string };

/**
 * Valida lo que eligió el cliente y suma los precios de las opciones.
 * Opciones desconocidas, agotadas o repetidas cuentan como problema.
 */
export function checkSelection(groups: readonly OptionGroup[], selectedIds: readonly string[]) {
  const problems: SelectionProblem[] = [];
  const seen = new Set<string>();
  const known = new Map<
    string,
    { groupId: string; delta: number; available: boolean; name: string }
  >();
  for (const g of groups)
    for (const o of g.options)
      known.set(o.id, {
        groupId: g.id,
        delta: o.price_delta_cents,
        available: o.is_available,
        name: o.name,
      });

  let deltaCents = 0;
  const countByGroup = new Map<string, number>();
  for (const id of selectedIds) {
    const option = known.get(id);
    if (!option) {
      problems.push({ groupId: "", message: "Una de las opciones ya no existe." });
      continue;
    }
    if (seen.has(id)) continue;
    seen.add(id);
    if (!option.available) {
      problems.push({ groupId: option.groupId, message: `“${option.name}” se nos acabó.` });
      continue;
    }
    deltaCents += option.delta;
    countByGroup.set(option.groupId, (countByGroup.get(option.groupId) ?? 0) + 1);
  }

  for (const g of groups) {
    const count = countByGroup.get(g.id) ?? 0;
    if (count < g.min_select)
      problems.push({
        groupId: g.id,
        message:
          g.min_select === 1
            ? `Elige ${article(g.name)}.`
            : `Elige al menos ${g.min_select} en ${g.name}.`,
      });
    if (count > g.max_select)
      problems.push({
        groupId: g.id,
        message: `Puedes elegir hasta ${g.max_select} en ${g.name}.`,
      });
  }

  return { ok: problems.length === 0, problems, deltaCents };
}

/** ¿Se puede agregar al carrito con un toque? (sin grupos obligatorios) */
export function hasRequiredGroups(groups: readonly GroupRule[]) {
  return groups.some((g) => g.min_select > 0);
}

/** "5", "+5", "-2.50", "Q 5" → centavos con signo. Vacío = 0. Inválido → null. */
export function parseDelta(text: string): number | null {
  const clean = text.replace(/[Qq\s,]/g, "");
  if (clean === "" || clean === "+" || clean === "-") return clean === "" ? 0 : null;
  const match = /^([+-]?)(\d+(?:\.\d{1,2})?)$/.exec(clean);
  if (!match) return null;
  const cents = Math.round(Number(match[2]) * 100);
  return match[1] === "-" ? -cents : cents;
}

/** Centavos con signo → texto del input ("500" → "5", "-250" → "-2.50", 0 → ""). */
export function deltaToInput(cents: number) {
  if (cents === 0) return "";
  const abs = Math.abs(cents);
  const text = abs % 100 === 0 ? String(abs / 100) : (abs / 100).toFixed(2);
  return cents < 0 ? `-${text}` : text;
}

function article(name: string) {
  const lower = name.toLowerCase();
  return lower.endsWith("s") ? `tus ${lower}` : `tu ${lower}`;
}
