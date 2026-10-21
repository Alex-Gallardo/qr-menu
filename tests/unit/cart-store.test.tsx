// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useCart } from "@/features/cart/store";
import { CartBar } from "@/features/public-menu/templates/clasico/cart-bar";

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element -- next/image no corre en jsdom
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

const antigua = { branchId: "antigua", branchSlug: "antigua", branchName: "Antigua" };
const zona1 = { branchId: "zona-1", branchSlug: "zona-1", branchName: "Zona 1" };
const chapin = {
  productId: "chapin",
  name: "Desayuno chapín",
  imageUrl: null,
  optionIds: [],
  optionNames: [],
  note: "",
  quantity: 2,
  unitCents: 4800,
};

/** Simula recargar la página: el estado en memoria se pierde y se lee del dispositivo. */
async function reload() {
  const saved = localStorage.getItem("qrm:carrito");
  useCart.setState({ carts: {} }); // también se guarda: se repone lo que había
  if (saved) localStorage.setItem("qrm:carrito", saved);
  await useCart.persist.rehydrate();
}

beforeEach(async () => {
  localStorage.clear();
  useCart.setState({ carts: {} });
});
afterEach(cleanup);

describe("carrito guardado en el dispositivo", () => {
  it("sobrevive a recargar", async () => {
    useCart.getState().enter("negocio", antigua);
    useCart.getState().add("negocio", chapin);
    await reload();
    expect(useCart.getState().enter("negocio", antigua)).toBeNull();
    expect(useCart.getState().carts.negocio!.lines).toMatchObject([
      { productId: "chapin", quantity: 2 },
    ]);
  });

  it("se vacía al cambiar de sucursal y se puede volver con el pedido", async () => {
    useCart.getState().enter("negocio", antigua);
    useCart.getState().add("negocio", chapin);
    await reload();
    const replaced = useCart.getState().enter("negocio", zona1);
    expect(replaced?.branchName).toBe("Antigua");
    expect(useCart.getState().carts.negocio).toMatchObject({ branchId: "zona-1", lines: [] });

    useCart.getState().restore("negocio", replaced!);
    await reload();
    expect(useCart.getState().enter("negocio", antigua)).toBeNull();
    expect(useCart.getState().carts.negocio!.lines).toHaveLength(1);
  });

  it("cada negocio tiene su carrito", () => {
    useCart.getState().enter("a", antigua);
    useCart.getState().add("a", chapin);
    useCart.getState().enter("b", zona1);
    expect(useCart.getState().carts.a!.lines).toHaveLength(1);
    expect(useCart.getState().carts.b!.lines).toHaveLength(0);
  });
});

describe("<CartBar />", () => {
  it('"3 productos · Q116.00 · Ver pedido" y avisa al agregar', () => {
    const onOpen = vi.fn();
    render(<CartBar count={3} totalCents={11600} announce="Agregado: 1 × Café." onOpen={onOpen} />);
    const bar = screen.getByRole("button", { name: /Ver pedido/ });
    expect(bar.textContent).toBe("33 productos · Q116.00Ver pedido");
    expect(screen.getByText("Agregado: 1 × Café.").getAttribute("aria-live")).toBe("polite");
    fireEvent.click(bar);
    expect(onOpen).toHaveBeenCalled();
  });

  it("sin productos no se muestra", () => {
    render(<CartBar count={0} totalCents={0} announce="" onOpen={() => {}} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
