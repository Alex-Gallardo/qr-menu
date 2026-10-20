import { describe, expect, it } from "vitest";
import { businessSettingsSchema } from "@/features/businesses/schemas";
import {
  mergeReserved,
  normalizeHandle,
  slugFormatProblem,
  slugify,
} from "@/features/businesses/slug";
import { diffFields } from "@/lib/audit";

const reserved = mergeReserved(["promo"]);

describe("slugify", () => {
  it.each([
    ["Café El Portal", "cafe-el-portal"],
    ["  Pupusería La Ñapa!! ", "pupuseria-la-napa"],
    ["Comedor   Doña Tere #2", "comedor-dona-tere-2"],
    ["---", ""],
  ])("%s → %s", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("no pasa de 40 caracteres ni termina en guion", () => {
    const s = slugify("Restaurante y cafetería de la esquina del parque central de la zona uno");
    expect(s.length).toBeLessThanOrEqual(40);
    expect(s.endsWith("-")).toBe(false);
  });
});

describe("slugFormatProblem", () => {
  it("acepta links válidos", () => {
    expect(slugFormatProblem("cafe-el-portal", reserved)).toBeNull();
    expect(slugFormatProblem("pollo2go", reserved)).toBeNull();
  });

  it.each([
    ["", "empty"],
    ["ab", "short"],
    ["a".repeat(41), "long"],
    ["Cafe", "format"],
    ["cafe el portal", "format"],
    ["café", "format"],
    ["-cafe", "format"],
    ["cafe--portal", "format"],
    ["cafe_portal", "format"],
  ])("%s → %s", (slug, problem) => {
    expect(slugFormatProblem(slug, reserved)).toBe(problem);
  });

  it("rechaza las rutas de la app y los reservados del super admin", () => {
    for (const slug of ["panel", "admin", "entrar", "styleguide", "mantenimiento", "promo"]) {
      expect(slugFormatProblem(slug, reserved)).toBe("reserved");
    }
  });

  it("las rutas de la app siguen reservadas aunque el ajuste venga vacío o roto", () => {
    expect(slugFormatProblem("panel", mergeReserved(null))).toBe("reserved");
    expect(slugFormatProblem("panel", mergeReserved("x"))).toBe("reserved");
  });
});

describe("normalizeHandle", () => {
  it.each([
    ["@cafeelportal", "cafeelportal"],
    ["https://www.instagram.com/cafeelportal/", "cafeelportal"],
    ["instagram.com/cafeelportal?igsh=abc", "cafeelportal"],
    ["https://www.tiktok.com/@cafeelportal", "cafeelportal"],
    ["", null],
    [null, null],
  ])("%s → %s", (input, expected) => {
    expect(normalizeHandle(input)).toBe(expected);
  });
});

describe("businessSettingsSchema", () => {
  const base = {
    businessId: "8f9d0a5e-7f3c-4c5b-9a2e-1d2c3b4a5f6e",
    name: "Café",
    slug: " Cafe-Portal ",
  };

  it("normaliza: link en minúsculas, vacíos → null y redes sin @", () => {
    const r = businessSettingsSchema.parse({
      ...base,
      email: "",
      instagram: "@cafe",
      description: "  ",
    });
    expect(r).toMatchObject({
      slug: "cafe-portal",
      email: null,
      instagram: "cafe",
      description: null,
    });
  });

  it("valida correo y largos con mensajes en español", () => {
    expect(
      businessSettingsSchema.safeParse({ ...base, email: "no" }).error?.issues[0]?.message,
    ).toBe("Ese correo no parece válido.");
    expect(
      businessSettingsSchema.safeParse({ ...base, whatsapp_greeting: "x".repeat(121) }).success,
    ).toBe(false);
  });
});

describe("diffFields", () => {
  it("solo registra lo que cambió", () => {
    expect(
      diffFields<Record<string, unknown>>(
        { name: "A", slug: "a", email: null },
        { name: "A", slug: "b", email: "x@y.co" },
      ),
    ).toEqual({ slug: ["a", "b"], email: [null, "x@y.co"] });
  });
});
