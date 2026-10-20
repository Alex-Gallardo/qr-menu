import { describe, expect, it } from "vitest";
import { FEATURES, PLAN_CATALOG } from "@/features/licensing/plan-catalog";
import { RESERVED_SLUGS } from "@/features/platform/defaults";

const plan = (id: string) => PLAN_CATALOG.find((p) => p.id === id)!;

describe("catálogo de planes", () => {
  it("tiene los 3 planes con los precios confirmados", () => {
    expect(PLAN_CATALOG.map((p) => [p.id, p.price_gtq])).toEqual([
      ["gratis", 0],
      ["pro", 149],
      ["negocio", 299],
    ]);
  });

  it("solo usa funciones conocidas y sin repetir", () => {
    for (const p of PLAN_CATALOG) {
      expect(p.features.every((f) => FEATURES.includes(f))).toBe(true);
      expect(new Set(p.features).size).toBe(p.features.length);
    }
  });

  it("cada plan incluye todo lo del plan anterior", () => {
    expect(plan("pro").features).toEqual(expect.arrayContaining(plan("gratis").features));
    expect(plan("negocio").features).toEqual(expect.arrayContaining(plan("pro").features));
  });

  it("Gratis: 1 sucursal, 25 productos, 1 menú y sin equipo", () => {
    expect(plan("gratis").limits).toMatchObject({
      branches: 1,
      products: 25,
      menus: 1,
      managers: 0,
      staff: 0,
    });
  });

  it("solo Negocio permite varias sucursales y quitar la marca", () => {
    expect(plan("negocio").limits.branches).toBe(3);
    expect(plan("pro").features).not.toContain("remove_branding");
    expect(plan("negocio").features).toContain("remove_branding");
  });

  it("reserva las rutas propias de la app", () => {
    for (const slug of ["panel", "admin", "staff", "api", "styleguide", "q"]) {
      expect(RESERVED_SLUGS).toContain(slug);
    }
  });
});
