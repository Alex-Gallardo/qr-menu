import { describe, expect, it } from "vitest";
import { productFormSchema, type ProductFormInput } from "@/features/products/schemas";

const BIZ = "ef7f52a0-acbb-4db7-8071-7c5b91ebae12";
const BRANCH = "0b8e3f1a-2c4d-4e6f-8a9b-1c2d3e4f5a6b";

const base: ProductFormInput = {
  businessId: BIZ,
  name: "Desayuno chapín",
  description: "",
  category_id: "",
  price: "45",
  compare_at: "",
  tags: [],
  prep_minutes: "",
  image_url: null,
  image_blurhash: "LEHV6nWB2y",
  is_available: true,
  branches: [{ branchId: BRANCH, is_available: true, price: "" }],
};

const errorsOf = (over: Partial<ProductFormInput>) => {
  const r = productFormSchema.safeParse({ ...base, ...over });
  return r.success
    ? {}
    : Object.fromEntries(r.error.issues.map((i) => [i.path.join("."), i.message]));
};

describe("productFormSchema", () => {
  it("convierte a centavos y limpia lo vacío", () => {
    const r = productFormSchema.parse({ ...base, price: "Q 45.50", prep_minutes: "12" });
    expect(r.data).toMatchObject({
      price_cents: 4550,
      compare_at_cents: null,
      category_id: null,
      description: null,
      prep_minutes: 12,
      // Sin foto no se guarda blurhash suelto.
      image_blurhash: null,
    });
    expect(r.branches).toEqual([
      { branchId: BRANCH, is_available: true, price_override_cents: null },
    ]);
  });

  it("pide un precio válido", () => {
    expect(errorsOf({ price: "" }).price).toBe("Escribe el precio.");
    expect(errorsOf({ price: "45.555" }).price).toMatch(/45 o 45.50/);
    expect(errorsOf({ price: "cuarenta" }).price).toMatch(/45 o 45.50/);
    expect(errorsOf({ price: "-3" }).price).toBeDefined();
    expect(errorsOf({ price: "100000" }).price).toMatch(/demasiado alto/);
  });

  it("el precio tachado debe ser mayor que el precio", () => {
    expect(errorsOf({ compare_at: "40" }).compare_at).toMatch(/mayor/);
    expect(errorsOf({ compare_at: "55" })).toEqual({});
  });

  it("valida el precio propio de cada sucursal", () => {
    const errors = errorsOf({ branches: [{ branchId: BRANCH, is_available: true, price: "abc" }] });
    expect(errors["branches.0.price"]).toMatch(/déjalo vacío/);
    const ok = productFormSchema.parse({
      ...base,
      branches: [{ branchId: BRANCH, is_available: false, price: "50" }],
    });
    expect(ok.branches[0]).toMatchObject({ is_available: false, price_override_cents: 5000 });
  });

  it("minutos entre 1 y 240 y etiquetas conocidas", () => {
    expect(errorsOf({ prep_minutes: "0" }).prep_minutes).toBeDefined();
    expect(errorsOf({ prep_minutes: "300" }).prep_minutes).toBeDefined();
    expect(errorsOf({ prep_minutes: "1.5" }).prep_minutes).toBeDefined();
    expect(errorsOf({ tags: ["popular", "inventada" as "popular"] })["tags.1"]).toBeDefined();
  });

  describe("grupos de opciones", () => {
    const tamano = {
      name: "Tamaño",
      required: true,
      min: "1",
      max: "1",
      options: [
        { name: "Mediano", price: "", is_available: true },
        { name: "Grande", price: "5", is_available: true },
      ],
    };
    const extras = {
      name: "Extras",
      required: false,
      min: "1",
      max: "3",
      options: ["Queso", "Aguacate", "Tocino", "Chile"].map((name) => ({
        name,
        price: "-1.50",
        is_available: name !== "Tocino",
      })),
    };

    it("“Tamaño” obligatorio (1–1) y “Extras” opcional (0–3) con orden y precios", () => {
      const r = productFormSchema.parse({ ...base, groups: [tamano, extras] });
      expect(r.groups.map((g) => [g.name, g.min_select, g.max_select, g.sort])).toEqual([
        ["Tamaño", 1, 1, 0],
        ["Extras", 0, 3, 1],
      ]);
      expect(r.groups[0]!.options.map((o) => o.price_delta_cents)).toEqual([0, 500]);
      expect(r.groups[1]!.options[2]).toMatchObject({
        name: "Tocino",
        is_available: false,
        sort: 2,
      });
      expect(r.groups[1]!.options[0]!.price_delta_cents).toBe(-150);
    });

    it("sin grupos sigue siendo válido", () => {
      expect(productFormSchema.parse(base).groups).toEqual([]);
    });

    it("rechaza reglas imposibles, grupos vacíos y nombres repetidos", () => {
      expect(errorsOf({ groups: [{ ...tamano, max: "3" }] })["groups.0.max"]).toMatch(/Solo hay 2/);
      expect(errorsOf({ groups: [{ ...tamano, min: "2" }] })["groups.0.max"]).toMatch(/mínimo/);
      expect(errorsOf({ groups: [{ ...tamano, min: "0" }] })["groups.0.min"]).toBeDefined();
      expect(errorsOf({ groups: [{ ...extras, max: "" }] })["groups.0.max"]).toBeDefined();
      expect(errorsOf({ groups: [{ ...tamano, options: [] }] })["groups.0.options"]).toMatch(
        /al menos una/,
      );
      expect(errorsOf({ groups: [tamano, { ...tamano }] })["groups.1.name"]).toMatch(/Ya tienes/);
      const dup = {
        ...tamano,
        options: [tamano.options[0]!, { ...tamano.options[0]!, name: "mediano" }],
      };
      expect(errorsOf({ groups: [dup] })["groups.0.options.1.name"]).toMatch(/ya está/);
      const bad = { ...tamano, options: [{ ...tamano.options[0]!, price: "cinco" }] };
      expect(errorsOf({ groups: [bad] })["groups.0.options.0.price"]).toMatch(/-5 para restar/);
    });
  });
});
