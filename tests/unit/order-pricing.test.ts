import { describe, expect, it } from "vitest";
import { itemProblemsMessage, priceOrderItems, unitPrice } from "@/features/orders/pricing";
import { buildBranchMenu, type RawMenu, type RawProduct } from "@/features/public-menu/payload";

const product = (over: Partial<RawProduct> & Pick<RawProduct, "id" | "name">): RawProduct => ({
  description: null,
  price_cents: 3000,
  compare_at_cents: null,
  image_url: null,
  image_blurhash: null,
  tags: [],
  is_available: true,
  hidden_by_license: false,
  deleted_at: null,
  prep_minutes: null,
  branch_settings: [],
  option_groups: [],
  ...over,
});

const menu = (
  id: string,
  items: RawMenu["sections"][number]["items"],
  isDefault = false,
): RawMenu => ({
  id,
  name: id,
  description: null,
  template: null,
  is_active: true,
  is_default: isDefault,
  hidden_by_license: false,
  sections: [{ id: `${id}-s`, name: "Todo", description: null, items }],
});

const item = (product_id: string, price_override_cents: number | null = null) => ({
  product_id,
  price_override_cents,
  is_featured: false,
});

const payload = buildBranchMenu({
  branchId: "b",
  products: [
    product({
      id: "pepian",
      name: "Pepián",
      branch_settings: [{ branch_id: "b", is_available: true, price_override_cents: 3500 }],
    }),
    product({
      id: "horchata",
      name: "Horchata",
      price_cents: 1000,
      option_groups: [
        {
          id: "t",
          name: "Tamaño",
          min_select: 1,
          max_select: 1,
          options: [
            { id: "chico", name: "Chico", price_delta_cents: 0, is_available: true },
            { id: "grande", name: "Grande", price_delta_cents: 500, is_available: true },
          ],
        },
      ],
    }),
    product({
      id: "tamal",
      name: "Tamal",
      branch_settings: [{ branch_id: "b", is_available: false, price_override_cents: null }],
    }),
    product({ id: "rellenitos", name: "Rellenitos" }),
    product({ id: "cafe", name: "Café", price_cents: 1500 }),
  ],
  menus: [
    menu("carta", [item("pepian", 2800), item("horchata", 900), item("tamal")], true),
    menu("cena", [item("cafe", 1200)]),
  ],
  slots: [],
  rules: [],
  overrides: [],
});

describe("precio del pedido en el servidor", () => {
  it("producto → especial del menú → sucursal (gana la sucursal)", () => {
    expect(unitPrice(payload, "carta", "pepian")).toBe(3500);
    expect(unitPrice(payload, "carta", "horchata")).toBe(900);
  });

  it("si no está en el menú que toca, su precio en la sucursal", () => {
    expect(unitPrice(payload, "carta", "cafe")).toBe(1500);
    expect(unitPrice(payload, "cena", "cafe")).toBe(1200);
  });

  it("suma opciones y cantidades", () => {
    const priced = priceOrderItems(
      [
        { productId: "pepian", optionIds: [], quantity: 2, note: "" },
        { productId: "horchata", optionIds: ["grande"], quantity: 1, note: " sin hielo " },
      ],
      payload,
      "carta",
    );
    expect(priced.problems).toEqual([]);
    expect(priced.subtotalCents).toBe(3500 * 2 + 1400);
    expect(priced.lines[1]).toMatchObject({
      unitCents: 1400,
      note: "sin hielo",
      options: [{ group: "Tamaño", name: "Grande", deltaCents: 500 }],
    });
  });

  it("dice qué no se puede pedir y por qué", () => {
    const priced = priceOrderItems(
      [
        { productId: "tamal", optionIds: [], quantity: 1, note: "" },
        { productId: "rellenitos", optionIds: [], quantity: 1, note: "" },
        { productId: "horchata", optionIds: [], quantity: 1, note: "" },
        { productId: "inventado", optionIds: [], quantity: 1, note: "" },
      ],
      payload,
      "carta",
    );
    expect(priced.lines).toEqual([]);
    expect(itemProblemsMessage(priced.problems)).toBe(
      "Revisa tu pedido: Tamal (se nos acabó), Rellenitos (ya no está en el menú), Horchata (Elige tu tamaño.), Un producto (ya no está en el menú). Quítalo para continuar.",
    );
  });
});
