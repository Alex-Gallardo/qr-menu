import { describe, expect, it } from "vitest";
import {
  copyName,
  effectivePriceCents,
  isDefaultSetting,
  matchesSearch,
  moveInList,
  soldOutBranchIds,
  viewForBranch,
  type BranchSetting,
} from "@/features/products/catalog";

const ZONA_1 = "zona-1";
const ANTIGUA = "antigua";
const chapin = { price_cents: 4500, is_available: true };

describe("disponibilidad y precio por sucursal", () => {
  it("agotar solo en Antigua no afecta Zona 1", () => {
    const settings: BranchSetting[] = [
      { branch_id: ANTIGUA, is_available: false, price_override_cents: null },
    ];
    expect(viewForBranch(chapin, ANTIGUA, settings)).toMatchObject({
      available: false,
      unavailableReason: "this_branch",
    });
    expect(viewForBranch(chapin, ZONA_1, settings)).toMatchObject({
      available: true,
      unavailableReason: null,
      priceCents: 4500,
    });
  });

  it("agotado en el catálogo se agota en todas las sucursales", () => {
    const off = { ...chapin, is_available: false };
    expect(viewForBranch(off, ZONA_1, []).unavailableReason).toBe("everywhere");
    expect(viewForBranch(off, ANTIGUA, []).unavailableReason).toBe("everywhere");
  });

  it("el precio de la sucursal solo cambia en esa sucursal", () => {
    const settings: BranchSetting[] = [
      { branch_id: ANTIGUA, is_available: true, price_override_cents: 5000 },
    ];
    expect(viewForBranch(chapin, ANTIGUA, settings)).toMatchObject({
      priceCents: 5000,
      hasOwnPrice: true,
    });
    expect(viewForBranch(chapin, ZONA_1, settings)).toMatchObject({
      priceCents: 4500,
      hasOwnPrice: false,
    });
  });

  it("sin fila de sucursal hereda todo del catálogo", () => {
    expect(viewForBranch(chapin, ZONA_1, [])).toEqual({
      priceCents: 4500,
      available: true,
      unavailableReason: null,
      hasOwnPrice: false,
    });
  });

  it("borrado u oculto por licencia no se puede pedir", () => {
    expect(viewForBranch({ ...chapin, deleted_at: new Date() }, ZONA_1, []).available).toBe(false);
    expect(
      viewForBranch({ ...chapin, hidden_by_license: true }, ZONA_1, []).unavailableReason,
    ).toBe("hidden");
  });

  it("orden de precios: producto → menú → sucursal", () => {
    expect(effectivePriceCents({ basePriceCents: 4500 })).toBe(4500);
    expect(effectivePriceCents({ basePriceCents: 4500, menuPriceCents: 4000 })).toBe(4000);
    expect(
      effectivePriceCents({ basePriceCents: 4500, menuPriceCents: 4000, branchPriceCents: 5000 }),
    ).toBe(5000);
    expect(effectivePriceCents({ basePriceCents: 4500, branchPriceCents: 0 })).toBe(0);
  });

  it("resume dónde está agotado y qué filas sobran", () => {
    expect(
      soldOutBranchIds([
        { branch_id: ANTIGUA, is_available: false, price_override_cents: null },
        { branch_id: ZONA_1, is_available: true, price_override_cents: 100 },
      ]),
    ).toEqual([ANTIGUA]);
    expect(isDefaultSetting({ is_available: true, price_override_cents: null })).toBe(true);
    expect(isDefaultSetting({ is_available: true, price_override_cents: 4000 })).toBe(false);
    expect(isDefaultSetting({ is_available: false, price_override_cents: null })).toBe(false);
  });
});

describe("búsqueda", () => {
  it("ignora tildes, mayúsculas y orden de palabras", () => {
    expect(matchesSearch(["Café de olla", "Bebidas calientes"], "cafe")).toBe(true);
    expect(matchesSearch(["Café de olla"], "OLLA café")).toBe(true);
    expect(matchesSearch(["Pepián de pollo", null], "pepian res")).toBe(false);
    expect(matchesSearch(["Lo que sea"], "  ")).toBe(true);
  });
});

describe("duplicar y ordenar", () => {
  it("pone (copia) sin repetir nombres", () => {
    expect(copyName("Café", [])).toBe("Café (copia)");
    expect(copyName("Café", ["Café (copia)"])).toBe("Café (copia 2)");
    expect(copyName("Café (copia)", ["Café (copia)", "Café (copia 2)"])).toBe("Café (copia 3)");
  });

  it("mueve con el vecino y no se sale de la lista", () => {
    expect(moveInList(["a", "b", "c"], 1, -1)).toEqual(["b", "a", "c"]);
    expect(moveInList(["a", "b", "c"], 2, 1)).toBeNull();
    expect(moveInList(["a", "b", "c"], 0, -1)).toBeNull();
  });
});
