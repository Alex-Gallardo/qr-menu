import { checkSelection, type OptionGroup } from "@/features/products/options";
import { clampQuantity } from "@/features/public-menu/cart-line";

/**
 * Carrito del comensal (puro). Hay uno por negocio y pertenece a una sola
 * sucursal: cada sucursal tiene sus precios y su disponibilidad, así que al
 * entrar a otra se vacía (con aviso y "Volver a …"). Se guarda en el
 * dispositivo y vence a las 12 horas (un carrito de ayer ya no sirve).
 * Los precios son para mostrar: el servidor los recalcula al pedir (QRM-027).
 */

export const CART_TTL_MS = 12 * 60 * 60 * 1000;
export const MAX_LINES = 50;

export type CartLine = {
  /** Mismo producto, mismas opciones y misma nota = misma línea. */
  key: string;
  productId: string;
  name: string;
  imageUrl: string | null;
  optionIds: string[];
  optionNames: string[];
  note: string;
  quantity: number;
  /** Precio unitario cuando se agregó (respaldo si el menú ya no lo trae). */
  unitCents: number;
};

export type Cart = {
  branchId: string;
  branchSlug: string;
  branchName: string;
  lines: CartLine[];
  updatedAt: number;
};

export const cartLineKey = (productId: string, optionIds: readonly string[], note: string) =>
  [productId, [...optionIds].sort().join(","), note.trim().toLowerCase()].join("|");

export function addLine(lines: readonly CartLine[], line: Omit<CartLine, "key">): CartLine[] {
  const note = line.note.trim();
  const key = cartLineKey(line.productId, line.optionIds, note);
  if (lines.some((l) => l.key === key))
    return lines.map((l) =>
      l.key === key
        ? { ...l, quantity: clampQuantity(l.quantity + line.quantity), unitCents: line.unitCents }
        : l,
    );
  if (lines.length >= MAX_LINES) return [...lines];
  return [...lines, { ...line, note, key, quantity: clampQuantity(line.quantity) }];
}

/** Cantidad nueva; 0 o menos quita la línea. */
export function setLineQuantity(lines: readonly CartLine[], key: string, quantity: number) {
  if (quantity <= 0) return lines.filter((l) => l.key !== key);
  return lines.map((l) => (l.key === key ? { ...l, quantity: clampQuantity(quantity) } : l));
}

export const isExpired = (cart: Pick<Cart, "updatedAt">, now: number) =>
  now - cart.updatedAt > CART_TTL_MS;

/**
 * Al abrir una sucursal: el carrito sigue si es de esta sucursal; si es de
 * otra y tiene productos, se vacía y se devuelve para el aviso ("Volver a").
 */
export function enterBranch(
  cart: Cart | undefined,
  branch: Pick<Cart, "branchId" | "branchSlug" | "branchName">,
  now: number,
): { cart: Cart; replaced: Cart | null } {
  const fresh = { ...branch, lines: [], updatedAt: now };
  if (!cart || isExpired(cart, now)) return { cart: fresh, replaced: null };
  if (cart.branchId === branch.branchId) return { cart: { ...cart, ...branch }, replaced: null };
  return { cart: fresh, replaced: cart.lines.length > 0 ? cart : null };
}

export type PricedLine = CartLine & {
  /** null = se puede pedir; si no, por qué no. */
  issue: string | null;
  lineCents: number;
};

/**
 * Precios y disponibilidad de hoy para lo que está en el carrito (puede venir
 * de hace horas): producto, opciones y precio en esta sucursal y menú.
 */
export function priceCart(
  lines: readonly CartLine[],
  catalog: {
    product: (
      id: string,
    ) => { available: boolean; optionGroups: readonly OptionGroup[] } | undefined;
    priceCents: (productId: string) => number | undefined;
  },
) {
  const priced: PricedLine[] = lines.map((line) => {
    const product = catalog.product(line.productId);
    const base = catalog.priceCents(line.productId);
    if (!product || base === undefined)
      return { ...line, issue: "Ya no está en el menú.", lineCents: 0 };
    if (!product.available) return { ...line, issue: "Se nos acabó aquí.", lineCents: 0 };
    const selection = checkSelection(product.optionGroups, line.optionIds);
    if (!selection.ok) return { ...line, issue: selection.problems[0]!.message, lineCents: 0 };
    const unitCents = base + selection.deltaCents;
    return { ...line, unitCents, issue: null, lineCents: unitCents * line.quantity };
  });
  const ok = priced.filter((l) => !l.issue);
  return {
    lines: priced,
    count: ok.reduce((n, l) => n + l.quantity, 0),
    totalCents: ok.reduce((n, l) => n + l.lineCents, 0),
    issues: priced.length - ok.length,
  };
}

/** "1 producto", "3 productos". */
export const productsLabel = (n: number) => `${n} ${n === 1 ? "producto" : "productos"}`;
