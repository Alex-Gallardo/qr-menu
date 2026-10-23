// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicProduct } from "@/features/public-menu/payload";
import { TEMPLATE_PARTS, templateFor, type MenuTemplateId } from "@/features/public-menu/templates";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element -- next/image no corre en jsdom
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

// next/font solo existe al compilar con Next.
vi.mock("@/features/appearance/font-loaders", () => ({ fontClasses: () => "" }));

afterEach(cleanup);

/**
 * QRM-034, criterio "Las 4 plantillas pasan el mismo test visual": cada
 * plantilla cambia la disposición, pero el cliente debe ver lo mismo (nombre,
 * precio, precio tachado, Agotado, etiquetas, Destacado) y poder hacer lo
 * mismo (abrir el producto, agregar con "+", nunca un agotado).
 */

const product = (over: Partial<PublicProduct> & Pick<PublicProduct, "id" | "name">) =>
  ({
    description: null,
    imageUrl: null,
    blurhash: null,
    blurDataUrl: null,
    priceCents: 4500,
    compareAtCents: null,
    tags: [],
    available: true,
    prepMinutes: null,
    optionGroups: [],
    ...over,
  }) satisfies PublicProduct;

const parrillada = product({
  id: "parrillada",
  name: "Parrillada para compartir",
  description: "Lomito, pollo y chorizo.",
  imageUrl: "https://images.unsplash.com/photo-1555939594-58d7cb561ad1",
  priceCents: 16500,
  compareAtCents: 18000,
  tags: ["popular"],
});
const empanadas = product({ id: "empanadas", name: "Empanadas (3 u.)", available: false });
const cafe = product({
  id: "cafe",
  name: "Café de olla",
  description: "Con canela.",
  priceCents: 1800,
});
const ITEMS = [
  { product: parrillada, featured: true },
  { product: empanadas, featured: false },
  { product: cafe, featured: false },
];

function renderTemplate(id: MenuTemplateId) {
  const { MenuSection, ProductCard } = TEMPLATE_PARTS[id];
  const onOpen = vi.fn();
  const onQuickAdd = vi.fn();
  render(
    <MenuSection id="compartir" name="Para compartir" description="Para la mesa">
      {ITEMS.map(({ product: p, featured }, i) => (
        <ProductCard
          key={p.id}
          product={p}
          priceCents={p.priceCents}
          featured={featured}
          appearIndex={i}
          onOpen={() => onOpen(p.id)}
          onQuickAdd={() => onQuickAdd(p.id)}
        />
      ))}
    </MenuSection>,
  );
  return { onOpen, onQuickAdd };
}

describe.each(["clasico", "galeria", "minimal", "tarjetas"] as const)("plantilla %s", (id) => {
  it("sección con título enlazado y una tarjeta por producto, en orden", () => {
    renderTemplate(id);
    const section = screen.getByRole("region", { name: "Para compartir" });
    expect(section.id).toBe("seccion-compartir");
    expect(within(section).getByText("Para la mesa")).toBeTruthy();
    const items = within(section).getAllByRole("listitem");
    expect(items.map((li) => within(li).getByRole("heading", { level: 3 }).textContent)).toEqual([
      "Parrillada para compartir",
      "Empanadas (3 u.)",
      "Café de olla",
    ]);
    // Cascada de entrada solo con appearIndex.
    expect(items.every((li) => li.className.includes("animate-aparecer"))).toBe(true);
  });

  it("precio una sola vez, precio tachado, Agotado, etiquetas y Destacado", () => {
    renderTemplate(id);
    expect(screen.getAllByText("Q165.00")).toHaveLength(1);
    expect(screen.getAllByText("Q18.00")).toHaveLength(1);
    expect(screen.getByText("Q180.00").tagName).toBe("S");
    expect(screen.getAllByText("Agotado")).toHaveLength(1);
    expect(screen.getAllByText("Popular")).toHaveLength(1);
    expect(screen.getAllByLabelText("Destacado")).toHaveLength(1);
  });

  it("tocar el producto abre la hoja; el + agrega, pero nunca un agotado", () => {
    const { onOpen, onQuickAdd } = renderTemplate(id);
    for (const { product: p } of ITEMS) {
      const open = screen.getByRole("button", { name: p.name });
      expect(open.getAttribute("aria-haspopup")).toBe("dialog");
      fireEvent.click(open);
    }
    expect(onOpen.mock.calls.map((c) => c[0])).toEqual(["parrillada", "empanadas", "cafe"]);

    expect(screen.queryByRole("button", { name: "Agregar Empanadas (3 u.)" })).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Agregar Parrillada para compartir" }));
    fireEvent.click(screen.getByRole("button", { name: "Agregar Café de olla" }));
    expect(onQuickAdd.mock.calls.map((c) => c[0])).toEqual(["parrillada", "cafe"]);
  });

  it("las fotos que muestra llevan el nombre del producto como texto alternativo", () => {
    renderTemplate(id);
    for (const img of screen.queryAllByRole("img")) {
      expect(ITEMS.map((i) => i.product.name)).toContain(img.getAttribute("alt"));
    }
  });
});

describe("plantilla que se usa", () => {
  it("la guardada si el plan incluye todas; si no, Clásico", () => {
    expect(templateFor("tarjetas", true)).toBe("tarjetas");
    expect(templateFor("tarjetas", false)).toBe("clasico");
    expect(templateFor(null, true)).toBe("clasico");
    expect(templateFor("otra", true)).toBe("clasico");
  });
});
