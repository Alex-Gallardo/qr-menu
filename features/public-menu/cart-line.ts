import { checkSelection, type OptionGroup } from "@/features/products/options";

/**
 * Precio de una línea del carrito (puro): el precio del producto en esta
 * sucursal y este menú (ya resuelto: producto → menú → sucursal) más las
 * opciones elegidas, por la cantidad. El servidor lo vuelve a calcular al
 * crear el pedido (QRM-027); esto es lo que ve el cliente mientras elige.
 */

export const MAX_QUANTITY = 20;
export const MAX_NOTE = 140;

export const clampQuantity = (n: number) => Math.min(MAX_QUANTITY, Math.max(1, Math.round(n) || 1));

export function priceLine(input: {
  /** Precio del producto en esta sucursal y menú (centavos). */
  priceCents: number;
  groups: readonly OptionGroup[];
  selectedOptionIds: readonly string[];
  quantity: number;
}) {
  const selection = checkSelection(input.groups, input.selectedOptionIds);
  const quantity = clampQuantity(input.quantity);
  const unitCents = input.priceCents + selection.deltaCents;
  const optionNames = input.groups.flatMap((g) =>
    g.options.filter((o) => input.selectedOptionIds.includes(o.id)).map((o) => o.name),
  );
  return {
    ok: selection.ok,
    problems: selection.problems,
    quantity,
    unitCents,
    totalCents: unitCents * quantity,
    optionNames,
  };
}

/**
 * Elegir u olvidar una opción respetando el grupo: si solo se puede una
 * (máximo 1) funciona como radio; si no, como casilla hasta el máximo.
 */
export function toggleOption(
  group: Pick<OptionGroup, "max_select" | "options">,
  selected: readonly string[],
  optionId: string,
): string[] {
  const inGroup = new Set(group.options.map((o) => o.id));
  const others = selected.filter((id) => !inGroup.has(id));
  const mine = selected.filter((id) => inGroup.has(id));
  if (mine.includes(optionId)) return [...others, ...mine.filter((id) => id !== optionId)];
  if (group.max_select === 1) return [...others, optionId];
  if (mine.length >= group.max_select) return [...selected];
  return [...selected, optionId];
}

/** Selección inicial: en grupos obligatorios de 1, la primera opción disponible ya marcada. */
export function defaultSelection(groups: readonly OptionGroup[]): string[] {
  return groups.flatMap((g) => {
    if (g.min_select !== 1 || g.max_select !== 1) return [];
    const first = g.options.find((o) => o.is_available);
    return first ? [first.id] : [];
  });
}
