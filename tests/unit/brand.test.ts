import { describe, expect, it } from "vitest";
import { BRAND } from "@/lib/brand";

describe("BRAND", () => {
  it("tiene nombre, tagline y URL por defecto", () => {
    expect(BRAND.name.length).toBeGreaterThan(0);
    expect(BRAND.tagline.length).toBeGreaterThan(0);
    expect(() => new URL(BRAND.url)).not.toThrow();
  });
});
