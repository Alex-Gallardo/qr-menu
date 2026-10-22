import { checkSelection } from "@/features/products/options";
import type { BranchMenuPayload } from "@/features/public-menu/payload";
import { resolveActiveMenu } from "@/features/schedule/resolve-active-menu";

/**
 * Precio de un pedido (puro). El carrito solo manda producto, opciones y
 * cantidad: el precio sale de aquí, con los datos de este momento. Regla
 * (la misma del menú público): si el platillo está en el menú que toca, su
 * precio en ese menú (producto → precio especial del menú → precio de la
 * sucursal); si no, su precio en la sucursal.
 */

export type OrderItemInput = {
  productId: string;
  optionIds: string[];
  quantity: number;
  note: string;
};

export type PricedOrderLine = {
  productId: string;
  name: string;
  unitCents: number;
  quantity: number;
  lineCents: number;
  note: string | null;
  options: { group: string; name: string; deltaCents: number }[];
};

export type ItemProblem = { productId: string; name: string; message: string };

/** Precio unitario base (sin opciones) en esta sucursal y menú. */
export function unitPrice(payload: BranchMenuPayload, menuId: string | null, productId: string) {
  const menu = menuId ? payload.menus.find((m) => m.id === menuId) : undefined;
  const item = menu?.sections.flatMap((s) => s.items).find((i) => i.productId === productId);
  return item?.priceCents ?? payload.products[productId]?.priceCents;
}

/** ¿Aparece en algún menú activo de la sucursal? (no se pide lo que no está en la carta) */
export function isOnAnyMenu(payload: BranchMenuPayload, productId: string) {
  return payload.menus.some((m) =>
    m.sections.some((s) => s.items.some((i) => i.productId === productId)),
  );
}

/** Menú que toca en la sucursal a esa hora (la de ahora o la programada). */
export function menuAt(payload: BranchMenuPayload, branchId: string, at: Date) {
  return resolveActiveMenu({ branchId, ...payload.resolver }, at).menuId ?? null;
}

export function priceOrderItems(
  items: readonly OrderItemInput[],
  payload: BranchMenuPayload,
  menuId: string | null,
) {
  const lines: PricedOrderLine[] = [];
  const problems: ItemProblem[] = [];
  for (const item of items) {
    const product = payload.products[item.productId];
    const base =
      product && isOnAnyMenu(payload, item.productId)
        ? unitPrice(payload, menuId, item.productId)
        : undefined;
    if (!product || base === undefined) {
      problems.push({
        productId: item.productId,
        name: product?.name ?? "Un producto",
        message: "ya no está en el menú",
      });
      continue;
    }
    if (!product.available) {
      problems.push({ productId: product.id, name: product.name, message: "se nos acabó" });
      continue;
    }
    const selection = checkSelection(product.optionGroups, item.optionIds);
    if (!selection.ok) {
      problems.push({
        productId: product.id,
        name: product.name,
        message: selection.problems[0]!.message,
      });
      continue;
    }
    const options = product.optionGroups.flatMap((g) =>
      g.options
        .filter((o) => item.optionIds.includes(o.id))
        .map((o) => ({ group: g.name, name: o.name, deltaCents: o.price_delta_cents })),
    );
    const unitCents = base + selection.deltaCents;
    lines.push({
      productId: product.id,
      name: product.name,
      unitCents,
      quantity: item.quantity,
      lineCents: unitCents * item.quantity,
      note: item.note.trim() || null,
      options,
    });
  }
  return { lines, problems, subtotalCents: lines.reduce((n, l) => n + l.lineCents, 0) };
}

/** "Se nos acabó: Pasta con mariscos. Quítalo de tu pedido para continuar." */
export function itemProblemsMessage(problems: readonly ItemProblem[]) {
  const list = problems.map((p) => `${p.name} (${p.message})`).join(", ");
  return `Revisa tu pedido: ${list}. Quítalo para continuar.`;
}
