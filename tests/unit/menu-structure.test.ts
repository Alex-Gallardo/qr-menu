import { describe, expect, it } from "vitest";
import { menuDocumentSchema } from "@/features/menus/schemas";
import {
  addProducts,
  allowedTemplates,
  duplicateSection,
  emptySection,
  menuStats,
  moveItemToSection,
  statsLabel,
  type DraftSection,
} from "@/features/menus/structure";

const P = ["a0000000-0000-4000-8000-000000000001", "a0000000-0000-4000-8000-000000000002"] as const;
const BIZ = "ef7f52a0-acbb-4db7-8071-7c5b91ebae12";
const MENU = "0b8e3f1a-2c4d-4e6f-8a9b-1c2d3e4f5a6b";

describe("estructura del editor", () => {
  it("agrega productos sin repetir y con llaves únicas", () => {
    const s = addProducts(addProducts(emptySection("Bebidas"), [P[0]]), [P[0], P[1], P[1]]);
    expect(s.items.map((i) => i.productId)).toEqual([P[0], P[1]]);
    expect(new Set(s.items.map((i) => i.key)).size).toBe(2);
  });

  it("mueve un producto a otra sección sin duplicarlo", () => {
    const a = addProducts(emptySection("A"), [P[0], P[1]]);
    const b = addProducts(emptySection("B"), [P[1]]);
    const moved = moveItemToSection([a, b], a.items[0]!.key, b.key);
    expect(moved.map((s) => s.items.map((i) => i.productId))).toEqual([[P[1]], [P[1], P[0]]]);
    // Si el destino ya lo tiene, solo sale del origen.
    const again = moveItemToSection(moved, moved[0]!.items[0]!.key, b.key);
    expect(again.map((s) => s.items.length)).toEqual([0, 2]);
  });

  it("duplica una sección justo debajo con llaves nuevas", () => {
    const a = addProducts(emptySection("Fuertes"), [P[0]]);
    const b = emptySection("Postres");
    const result = duplicateSection([a, b], a.key);
    expect(result.map((s) => s.name)).toEqual(["Fuertes", "Fuertes (copia)", "Postres"]);
    expect(result[1]!.items[0]!.key).not.toBe(a.items[0]!.key);
  });

  it("resume secciones y productos", () => {
    const sections: DraftSection[] = [
      addProducts(emptySection("A"), [P[0], P[1]]),
      emptySection("B"),
    ];
    expect(statsLabel(menuStats(sections))).toBe("2 secciones · 2 productos");
    expect(statsLabel({ sections: 1, items: 1 })).toBe("1 sección · 1 producto");
  });

  it("Gratis solo usa la plantilla Clásico", () => {
    expect(allowedTemplates(false)).toEqual(["clasico"]);
    expect(allowedTemplates(true)).toEqual(["clasico", "galeria", "minimal", "tarjetas"]);
  });
});

describe("menuDocumentSchema", () => {
  const base = {
    businessId: BIZ,
    menuId: MENU,
    name: "Menú",
    description: "",
    template: "clasico",
  };

  it("ordena, convierte precios y quita repetidos dentro de una sección", () => {
    const r = menuDocumentSchema.parse({
      ...base,
      sections: [
        {
          key: "s",
          name: "Fuertes",
          description: "",
          items: [
            { key: "1", productId: P[0], price: "39.50", isFeatured: true },
            { key: "2", productId: P[1], price: "", isFeatured: false },
            { key: "3", productId: P[0], price: "", isFeatured: false },
          ],
        },
      ],
    });
    expect(r.data).toEqual({ name: "Menú", description: null, template: "clasico" });
    expect(r.sections[0]!.items).toEqual([
      { product_id: P[0], price_override_cents: 3950, is_featured: true, sort: 0 },
      { product_id: P[1], price_override_cents: null, is_featured: false, sort: 1 },
    ]);
  });

  it("pide nombre de sección y precios válidos", () => {
    const bad = menuDocumentSchema.safeParse({
      ...base,
      sections: [
        {
          key: "s",
          name: " ",
          description: "",
          items: [{ key: "1", productId: P[0], price: "abc", isFeatured: false }],
        },
      ],
    });
    expect(bad.success).toBe(false);
    expect(bad.error!.issues.map((i) => i.message)).toEqual(
      expect.arrayContaining([
        "Ponle nombre a la sección.",
        "Escribe un precio como 45 o déjalo vacío.",
      ]),
    );
  });
});
