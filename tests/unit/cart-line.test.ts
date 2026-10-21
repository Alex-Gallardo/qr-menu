import { describe, expect, it } from "vitest";
import { buildBranchMenu, type RawProduct } from "@/features/public-menu/payload";
import {
  clampQuantity,
  defaultSelection,
  priceLine,
  toggleOption,
} from "@/features/public-menu/cart-line";
import type { OptionGroup } from "@/features/products/options";

const opt = (id: string, delta = 0, is_available = true) => ({
  id,
  name: id,
  price_delta_cents: delta,
  is_available,
});

const huevos: OptionGroup = {
  id: "huevos",
  name: "Huevos",
  min_select: 1,
  max_select: 1,
  options: [opt("estrellados"), opt("revueltos"), opt("rancheros")],
};
const extras: OptionGroup = {
  id: "extras",
  name: "Extras",
  min_select: 0,
  max_select: 3,
  options: [
    opt("platanos", 800),
    opt("aguacate", 600),
    opt("queso", 500),
    opt("chorizo", 1000, false),
  ],
};
const groups = [huevos, extras];

describe("precio de la hoja de producto con precio de sucursal", () => {
  // El chapín cuesta Q45 en el catálogo y Q48 en Antigua (precio propio de la sucursal).
  const chapin: RawProduct = {
    id: "chapin",
    name: "Desayuno chapín",
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
    branch_settings: [{ branch_id: "antigua", is_available: true, price_override_cents: 4800 }],
    option_groups: groups,
  };
  const menus = [
    {
      id: "m",
      name: "Desayunos",
      description: null,
      template: null,
      is_active: true,
      is_default: true,
      hidden_by_license: false,
      sections: [
        {
          id: "s",
          name: "Típicos",
          description: null,
          items: [{ product_id: "chapin", price_override_cents: null, is_featured: false }],
        },
      ],
    },
  ];
  const itemPrice = (branchId: string) =>
    buildBranchMenu({ branchId, products: [chapin], menus, slots: [], rules: [], overrides: [] })
      .menus[0]!.sections[0]!.items[0]!.priceCents;

  it("Antigua: Q48 + aguacate Q6 = Q54; por 2 = Q108", () => {
    const line = priceLine({
      priceCents: itemPrice("antigua"),
      groups,
      selectedOptionIds: ["revueltos", "aguacate"],
      quantity: 2,
    });
    expect(line).toMatchObject({
      ok: true,
      unitCents: 5400,
      totalCents: 10800,
      optionNames: ["revueltos", "aguacate"],
    });
  });

  it("Zona 1 (sin precio propio): Q45 + aguacate Q6 = Q51", () => {
    const line = priceLine({
      priceCents: itemPrice("zona-1"),
      groups,
      selectedOptionIds: ["revueltos", "aguacate"],
      quantity: 1,
    });
    expect(line.totalCents).toBe(5100);
  });

  it("sin elegir los huevos no se puede agregar", () => {
    const line = priceLine({ priceCents: 4800, groups, selectedOptionIds: [], quantity: 1 });
    expect(line.ok).toBe(false);
    expect(line.problems[0]).toEqual({ groupId: "huevos", message: "Elige tus huevos." });
  });

  it("una opción agotada no suma y bloquea", () => {
    const line = priceLine({
      priceCents: 4800,
      groups,
      selectedOptionIds: ["estrellados", "chorizo"],
      quantity: 1,
    });
    expect(line.ok).toBe(false);
    expect(line.unitCents).toBe(4800);
  });
});

describe("elegir opciones", () => {
  it("grupo de una: funciona como radio", () => {
    expect(toggleOption(huevos, ["estrellados", "queso"], "rancheros")).toEqual([
      "queso",
      "rancheros",
    ]);
    expect(toggleOption(huevos, ["rancheros"], "rancheros")).toEqual([]);
  });

  it("grupo de varias: casillas hasta el máximo", () => {
    let sel = toggleOption(extras, [], "platanos");
    sel = toggleOption(extras, sel, "aguacate");
    sel = toggleOption(extras, sel, "queso");
    expect(toggleOption(extras, sel, "chorizo")).toEqual(sel); // ya hay 3
    expect(toggleOption(extras, sel, "aguacate")).toEqual(["platanos", "queso"]);
  });

  it("los obligatorios de una vienen con la primera opción disponible", () => {
    const tamano: OptionGroup = {
      id: "t",
      name: "Tamaño",
      min_select: 1,
      max_select: 1,
      options: [opt("chico", 0, false), opt("mediano"), opt("grande", 400)],
    };
    expect(defaultSelection([tamano, extras])).toEqual(["mediano"]);
  });

  it("cantidad entre 1 y 20", () => {
    expect([
      clampQuantity(0),
      clampQuantity(3),
      clampQuantity(50),
      clampQuantity(Number.NaN),
    ]).toEqual([1, 3, 20, 1]);
  });
});
