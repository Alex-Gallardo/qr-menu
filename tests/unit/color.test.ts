import { describe, expect, it } from "vitest";
import { PALETTE_PRESETS } from "@/features/appearance/palettes";
import { contrastRatio, hexToRgb, meetsAA, readableTextOn } from "@/lib/color";

describe("color", () => {
  it("convierte hex corto y largo", () => {
    expect(hexToRgb("#fff")).toEqual([255, 255, 255]);
    expect(hexToRgb("#D23B22")).toEqual([210, 59, 34]);
    expect(() => hexToRgb("#12")).toThrow();
  });

  it("calcula contraste conocido", () => {
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 1);
    expect(contrastRatio("#777777", "#777777")).toBeCloseTo(1, 5);
  });

  it("texto blanco sobre tomate cumple AA", () => {
    expect(meetsAA("#ffffff", "#D23B22")).toBe(true);
  });

  it("elige texto legible sobre el color de fondo", () => {
    expect(readableTextOn("#25D366")).toBe("#231a17");
    expect(readableTextOn("#231A17")).toBe("#ffffff");
  });

  it.each(PALETTE_PRESETS)("la paleta $name tiene texto AA sobre su fondo", (p) => {
    expect(meetsAA(p.text, p.bg)).toBe(true);
  });
});
