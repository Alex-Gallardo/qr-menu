// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { PublicProduct } from "@/features/public-menu/payload";
import {
  ProductSheet,
  withArticle,
  type ProductSheetProps,
} from "@/features/public-menu/templates/clasico/product-sheet";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element -- next/image no corre en jsdom
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

afterEach(cleanup);

const opt = (id: string, name: string, delta = 0, is_available = true) => ({
  id,
  name,
  price_delta_cents: delta,
  is_available,
});

const chapin: PublicProduct = {
  id: "chapin",
  name: "Desayuno chapín",
  description: "Huevos al gusto, frijoles, plátanos y crema.",
  imageUrl: null,
  blurhash: null,
  blurDataUrl: null,
  priceCents: 4800,
  compareAtCents: null,
  tags: [],
  available: true,
  prepMinutes: 15,
  optionGroups: [
    {
      id: "huevos",
      name: "Huevos",
      min_select: 1,
      max_select: 1,
      options: [opt("estrellados", "Estrellados"), opt("revueltos", "Revueltos")],
    },
    {
      id: "extras",
      name: "Extras",
      min_select: 0,
      max_select: 2,
      options: [
        opt("aguacate", "Aguacate", 600),
        opt("queso", "Queso", 500),
        opt("chorizo", "Chorizo", 1000, false),
      ],
    },
  ],
};

function setup(over: Partial<ProductSheetProps> = {}) {
  const props: ProductSheetProps = {
    product: chapin,
    priceCents: 4800, // precio de Antigua
    blockedReason: null,
    suggestion: null,
    onAdd: vi.fn(),
    onSuggest: vi.fn(),
    onClose: vi.fn(),
    ...over,
  };
  render(<ProductSheet {...props} />);
  return props;
}

const addButton = () => screen.getByRole("button", { name: /^Agregar ·/ });

describe("<ProductSheet />", () => {
  it("abre con el precio de la sucursal y lo actualiza al elegir y cambiar la cantidad", () => {
    const props = setup();
    expect(screen.getByRole("dialog").hasAttribute("open")).toBe(true);
    expect(addButton().textContent).toBe("Agregar · Q48.00");

    // Los huevos (obligatorio de 1) ya vienen con la primera opción.
    expect(screen.getByLabelText("Estrellados")).toHaveProperty("checked", true);
    fireEvent.click(screen.getByLabelText("Revueltos"));
    fireEvent.click(screen.getByLabelText(/^Aguacate/));
    expect(addButton().textContent).toBe("Agregar · Q54.00");

    fireEvent.click(screen.getByRole("button", { name: "Agregar uno" }));
    expect(addButton().textContent).toBe("Agregar · Q108.00");

    fireEvent.change(screen.getByRole("textbox"), { target: { value: "  Sin cebolla " } });
    fireEvent.click(addButton());
    expect(props.onAdd).toHaveBeenCalledWith(
      {
        productId: "chapin",
        optionIds: ["revueltos", "aguacate"],
        optionNames: ["Revueltos", "Aguacate"],
        note: "Sin cebolla",
        quantity: 2,
        unitCents: 5400,
      },
      expect.anything(),
    );
  });

  it("respeta el máximo del grupo y no deja elegir lo agotado", () => {
    setup();
    expect(screen.getByLabelText(/Chorizo/)).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByLabelText(/^Aguacate/));
    fireEvent.click(screen.getByLabelText(/^Queso/));
    // Ya hay 2 de 2: las que faltan quedan bloqueadas, las elegidas se pueden quitar.
    expect(screen.getByLabelText(/^Queso/)).toHaveProperty("disabled", false);
    expect(addButton().textContent).toBe("Agregar · Q59.00");
  });

  it("si falta un obligatorio, lo señala en lugar de agregar", () => {
    const props = setup({
      product: {
        ...chapin,
        optionGroups: [{ ...chapin.optionGroups[0]!, min_select: 1, max_select: 2 }],
      },
    });
    fireEvent.click(addButton());
    expect(props.onAdd).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe("Elige tus huevos.");
  });

  it("agotado en la sucursal: sin botón de agregar y con sugerencia", () => {
    const props = setup({
      product: { ...chapin, available: false },
      suggestion: { id: "rancheros", name: "Huevos rancheros" },
    });
    expect(screen.queryByRole("button", { name: /^Agregar ·/ })).toBeNull();
    expect(screen.getByRole("status").textContent).toContain(
      "Este se nos acabó aquí. ¿Te animas con unos Huevos rancheros?",
    );
    fireEvent.click(screen.getByRole("button", { name: "Ver Huevos rancheros" }));
    expect(props.onSuggest).toHaveBeenCalledWith("rancheros");
  });

  it("sucursal en pausa: se ve el precio pero no se puede agregar", () => {
    setup({ blockedReason: "Esta sucursal no recibe pedidos por ahora." });
    expect(addButton()).toHaveProperty("disabled", true);
    expect(screen.getByText("Esta sucursal no recibe pedidos por ahora.")).toBeTruthy();
  });

  it("Escape y la X cierran", () => {
    const props = setup();
    fireEvent(screen.getByRole("dialog"), new Event("cancel", { cancelable: true }));
    fireEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(props.onClose).toHaveBeenCalledTimes(2);
  });
});

describe("withArticle", () => {
  it("elige el artículo por el nombre", () => {
    expect(
      ["Huevos rancheros", "Pupusa", "Desayuno chapín", "Enchiladas"].map(withArticle),
    ).toEqual(["unos Huevos rancheros", "una Pupusa", "un Desayuno chapín", "unas Enchiladas"]);
  });
});
