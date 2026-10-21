import { describe, expect, it } from "vitest";
import { buildBranchMenu, type RawMenu, type RawProduct } from "@/features/public-menu/payload";

const ZONA1 = "zona-1";
const ANTIGUA = "antigua";

const product = (over: Partial<RawProduct>): RawProduct => ({
  id: "p",
  name: "Producto",
  description: null,
  price_cents: 4500,
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

const products: RawProduct[] = [
  product({
    id: "chapin",
    name: "Desayuno chapín",
    branch_settings: [{ branch_id: ANTIGUA, is_available: true, price_override_cents: 4800 }],
  }),
  product({
    id: "pasta",
    name: "Pasta",
    price_cents: 7800,
    branch_settings: [{ branch_id: ANTIGUA, is_available: false, price_override_cents: null }],
  }),
  product({ id: "borrado", deleted_at: new Date() }),
  product({ id: "oculto", hidden_by_license: true }),
  product({ id: "agotado", is_available: false }),
];

const menu = (over: Partial<RawMenu>): RawMenu => ({
  id: "m",
  name: "Menú",
  description: null,
  template: null,
  is_active: true,
  is_default: false,
  hidden_by_license: false,
  sections: [],
  ...over,
});

const menus: RawMenu[] = [
  menu({
    id: "carta",
    is_default: true,
    sections: [
      {
        id: "s1",
        name: "Fuertes",
        description: null,
        items: [
          { product_id: "chapin", price_override_cents: 4000, is_featured: true },
          { product_id: "pasta", price_override_cents: null, is_featured: false },
          { product_id: "borrado", price_override_cents: null, is_featured: false },
        ],
      },
      {
        id: "s2",
        name: "Vacía",
        description: null,
        items: [{ product_id: "oculto", price_override_cents: null, is_featured: false }],
      },
    ],
  }),
  menu({ id: "pausado", is_active: false }),
  menu({ id: "fuera-del-plan", hidden_by_license: true }),
];

const build = (branchId: string) =>
  buildBranchMenu({
    branchId,
    products,
    menus,
    slots: [],
    rules: [
      { menu_id: "carta", time_slot_id: "t", branch_id: null, weekdays: [1], priority: 0 },
      { menu_id: "carta", time_slot_id: "t", branch_id: ANTIGUA, weekdays: [1], priority: 10 },
      { menu_id: "carta", time_slot_id: "t", branch_id: "otra", weekdays: [1], priority: 10 },
    ],
    overrides: [
      { branch_id: null, date: "2026-12-24", time_slot_id: null, menu_id: null },
      { branch_id: "otra", date: "2026-12-24", time_slot_id: null, menu_id: null },
    ],
  });

describe("menú público de una sucursal", () => {
  it("precio: producto → precio especial del menú → precio de la sucursal (gana la sucursal)", () => {
    const zona1 = build(ZONA1);
    const antigua = build(ANTIGUA);
    // Zona 1: sin precio de sucursal, aplica el especial del menú.
    expect(zona1.menus[0]!.sections[0]!.items[0]).toEqual({
      productId: "chapin",
      priceCents: 4000,
      featured: true,
    });
    // Antigua: su precio propio gana al especial del menú.
    expect(antigua.menus[0]!.sections[0]!.items[0]!.priceCents).toBe(4800);
    // En el catálogo de la sucursal (sin menú) también se usa su precio.
    expect(antigua.products.chapin!.priceCents).toBe(4800);
    expect(zona1.products.chapin!.priceCents).toBe(4500);
  });

  it("agotado solo en Antigua: en Zona 1 sigue disponible", () => {
    expect(build(ANTIGUA).products.pasta!.available).toBe(false);
    expect(build(ZONA1).products.pasta!.available).toBe(true);
    expect(build(ZONA1).products.agotado!.available).toBe(false);
  });

  it("no publica productos borrados u ocultos ni secciones que quedan vacías", () => {
    const payload = build(ZONA1);
    expect(Object.keys(payload.products).sort()).toEqual(["agotado", "chapin", "pasta"]);
    expect(payload.menus[0]!.sections.map((s) => s.name)).toEqual(["Fuertes"]);
    expect(payload.menus[0]!.sections[0]!.items.map((i) => i.productId)).toEqual([
      "chapin",
      "pasta",
    ]);
  });

  it("solo menús activos y dentro del plan; plantilla Clásico por defecto", () => {
    expect(build(ZONA1).menus.map((m) => [m.id, m.template, m.isDefault])).toEqual([
      ["carta", "clasico", true],
    ]);
  });

  it("solo viajan las reglas y fechas especiales generales y de esta sucursal", () => {
    const { resolver } = build(ANTIGUA);
    expect(resolver.rules.map((r) => r.branch_id)).toEqual([null, ANTIGUA]);
    expect(resolver.overrides.map((o) => o.branch_id)).toEqual([null]);
    expect(build(ZONA1).resolver.rules.map((r) => r.branch_id)).toEqual([null]);
  });
});
