import { describe, expect, it } from "vitest";
import {
  addLine,
  CART_TTL_MS,
  enterBranch,
  priceCart,
  productsLabel,
  setLineQuantity,
  type Cart,
  type CartLine,
} from "@/features/cart/cart";
import type { OptionGroup } from "@/features/products/options";

const line = (over: Partial<Omit<CartLine, "key">> = {}): Omit<CartLine, "key"> => ({
  productId: "chapin",
  name: "Desayuno chapín",
  imageUrl: null,
  optionIds: ["revueltos"],
  optionNames: ["Revueltos"],
  note: "",
  quantity: 1,
  unitCents: 4800,
  ...over,
});

const antigua = { branchId: "antigua", branchSlug: "antigua", branchName: "Antigua" };
const zona1 = { branchId: "zona-1", branchSlug: "zona-1", branchName: "Zona 1" };
const NOW = 1_800_000_000_000;

describe("líneas del carrito", () => {
  it("mismo producto, opciones y nota se suman en una línea", () => {
    let lines = addLine([], line());
    lines = addLine(lines, line({ quantity: 2, note: " " }));
    expect(lines).toHaveLength(1);
    expect(lines[0]!.quantity).toBe(3);
  });

  it("otras opciones u otra nota son otra línea", () => {
    let lines = addLine([], line());
    lines = addLine(lines, line({ optionIds: ["estrellados"] }));
    lines = addLine(lines, line({ note: "Sin cebolla" }));
    expect(lines).toHaveLength(3);
  });

  it("cantidad: tope de 20 y 0 la quita", () => {
    const lines = addLine([], line());
    const key = lines[0]!.key;
    expect(setLineQuantity(lines, key, 50)[0]!.quantity).toBe(20);
    expect(setLineQuantity(lines, key, 0)).toEqual([]);
  });
});

describe("carrito por sucursal", () => {
  const cart = (over: Partial<Cart> = {}): Cart => ({
    ...antigua,
    lines: addLine([], line()),
    updatedAt: NOW - 60_000,
    ...over,
  });

  it("sobrevive a recargar: misma sucursal, mismo carrito", () => {
    const { cart: next, replaced } = enterBranch(cart(), antigua, NOW);
    expect(next.lines).toHaveLength(1);
    expect(replaced).toBeNull();
  });

  it("se vacía al cambiar de sucursal y devuelve el anterior para el aviso", () => {
    const before = cart();
    const { cart: next, replaced } = enterBranch(before, zona1, NOW);
    expect(next).toMatchObject({ branchId: "zona-1", lines: [] });
    expect(replaced).toBe(before);
  });

  it("cambiar de sucursal con el carrito vacío no avisa", () => {
    expect(enterBranch(cart({ lines: [] }), zona1, NOW).replaced).toBeNull();
  });

  it("un carrito de hace más de 12 horas ya no sirve", () => {
    const old = cart({ updatedAt: NOW - CART_TTL_MS - 1 });
    expect(enterBranch(old, antigua, NOW).cart.lines).toEqual([]);
    expect(enterBranch(old, zona1, NOW).replaced).toBeNull();
  });
});

describe("precios de hoy", () => {
  const extras: OptionGroup = {
    id: "extras",
    name: "Extras",
    min_select: 0,
    max_select: 3,
    options: [
      { id: "aguacate", name: "Aguacate", price_delta_cents: 600, is_available: true },
      { id: "chorizo", name: "Chorizo", price_delta_cents: 1000, is_available: false },
    ],
  };
  const products: Record<string, { available: boolean; optionGroups: OptionGroup[] }> = {
    chapin: { available: true, optionGroups: [extras] },
    pasta: { available: false, optionGroups: [] },
  };
  const prices: Record<string, number> = { chapin: 4800, pasta: 7800 };
  const catalog = { product: (id: string) => products[id], priceCents: (id: string) => prices[id] };

  it("cuenta productos y suma con el precio actual de la sucursal", () => {
    const lines = addLine(
      addLine([], line({ optionIds: ["aguacate"], quantity: 2, unitCents: 4500 })),
      line({ optionIds: [], unitCents: 1 }),
    );
    const priced = priceCart(lines, catalog);
    expect(priced.count).toBe(3);
    expect(priced.totalCents).toBe(5400 * 2 + 4800);
    expect(`${productsLabel(priced.count)} · Q${priced.totalCents / 100}`).toBe(
      "3 productos · Q156",
    );
  });

  it("lo agotado, lo que ya no está o una opción agotada no cuentan y se explican", () => {
    const lines = [
      ...addLine([], line({ productId: "pasta", optionIds: [] })),
      ...addLine([], line({ productId: "borrado", optionIds: [] })),
      ...addLine([], line({ optionIds: ["chorizo"] })),
    ];
    const priced = priceCart(lines, catalog);
    expect(priced.lines.map((l) => l.issue)).toEqual([
      "Se nos acabó aquí.",
      "Ya no está en el menú.",
      "“Chorizo” se nos acabó.",
    ]);
    expect(priced).toMatchObject({ count: 0, totalCents: 0, issues: 3 });
  });
});
