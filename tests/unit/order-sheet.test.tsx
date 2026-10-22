// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { priceCart } from "@/features/cart/cart";
import type { CheckoutBranch } from "@/features/orders/checkout";
import { orderTiming, type TimingRules } from "@/features/orders/preorder";
import {
  OrderSheet,
  type OrderSheetProps,
  type RememberedCustomer,
} from "@/features/public-menu/templates/clasico/order-sheet";
import { gtInstant } from "@/lib/gt-time";

// El mapa (Leaflet) no corre en jsdom: un marcador basta para saber que se muestra.
vi.mock("next/dynamic", () => ({
  default: () =>
    function MapaFalso() {
      return <div data-testid="mapa" />;
    },
}));

vi.mock("next/image", () => ({
  // eslint-disable-next-line @next/next/no-img-element -- next/image no corre en jsdom
  default: ({ alt, src }: { alt: string; src: string }) => <img alt={alt} src={src} />,
}));

afterEach(cleanup);

const ZONA_1 = { lat: 14.6427, lng: -90.5133 };
const MIXCO = { lat: 14.6331, lng: -90.6064 };
const ANTIGUA = { lat: 14.5586, lng: -90.7295 };

const branch: CheckoutBranch = {
  acceptsDineIn: true,
  acceptsTakeout: true,
  acceptsDelivery: true,
  acceptsTransfer: true,
  deliveryFeeCents: 1500,
  minOrderCents: 5000,
  hasBankAccounts: true,
  requiresLocation: true,
  location: ZONA_1,
  radiusKm: 5,
};
const rules: TimingRules = {
  hours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens: "07:00", closes: "21:00" })),
  closedDates: [],
  mode: "next_open",
  minLeadMin: 30,
  maxDays: 2,
  preordersEnabled: true,
};
const OPEN = gtInstant("2026-10-21", 10 * 60);
const CLOSED = gtInstant("2026-10-21", 21 * 60 + 30);

const noOne: RememberedCustomer = {
  name: "",
  phone: "",
  email: "",
  address: "",
  addressReference: "",
  location: null,
  lastOrderType: null,
  lastPayment: null,
};

const lines = priceCart(
  [
    {
      key: "a",
      productId: "chapin",
      name: "Desayuno chapín",
      imageUrl: null,
      optionIds: [],
      optionNames: ["Revueltos"],
      note: "Sin cebolla",
      quantity: 2,
      unitCents: 4800,
    },
    {
      key: "b",
      productId: "pasta",
      name: "Pasta con mariscos",
      imageUrl: null,
      optionIds: [],
      optionNames: [],
      note: "",
      quantity: 1,
      unitCents: 7800,
    },
  ],
  {
    product: (id) => ({ available: id !== "pasta", optionGroups: [] }),
    priceCents: () => 4800,
  },
);

function setup(over: Partial<OrderSheetProps> = {}, now = OPEN) {
  const props: OrderSheetProps = {
    branchName: "Zona 1",
    lines: lines.lines,
    count: lines.count,
    subtotalCents: lines.totalCents,
    checkout: {
      ...setup.defaults(),
      timing: orderTiming(rules, now),
      bankAccounts: [
        {
          id: "bi",
          bankName: "Banco Industrial",
          accountType: "Monetaria",
          accountNumber: "123-456789-0",
          holderName: "Café El Portal, S.A.",
          instructions: "Envía tu boleta por WhatsApp.",
        },
      ],
      table: null,
      blockedReason: null,
    },
    customer: noOne,
    onQuantity: vi.fn(),
    onClear: vi.fn(),
    onClose: vi.fn(),
    onSubmit: vi.fn(),
    ...over,
  };
  render(<OrderSheet {...props} />);
  return props;
}

const submitButton = () => screen.getByRole("button", { name: /Pedir por WhatsApp/ });

describe("<OrderSheet />", () => {
  it("lista editable: cantidades, quitar y lo que ya no se puede pedir", () => {
    const props = setup();
    expect(screen.getByText("“Sin cebolla”")).toBeTruthy();
    expect(screen.getByText("Se nos acabó aquí.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Quitar uno" }));
    expect(props.onQuantity).toHaveBeenLastCalledWith("a", 1);
    fireEvent.click(screen.getByRole("button", { name: "Quitar" }));
    expect(props.onQuantity).toHaveBeenLastCalledWith("b", 0);
  });

  it('mesa precargada desde el QR: "Comer aquí · Mesa 4"', () => {
    setup({ checkout: { ...setup.defaults(), table: "Mesa 4" } });
    expect(screen.getByText("Zona 1 · Comer aquí · Mesa 4")).toBeTruthy();
    expect(screen.getByLabelText(/^Mesa/)).toHaveProperty("value", "Mesa 4");
  });

  it("pide lo que falta en lugar de enviar, y con todo completo envía", () => {
    const props = setup();
    fireEvent.click(screen.getByLabelText("Para llevar"));
    fireEvent.click(submitButton());
    expect(props.onSubmit).not.toHaveBeenCalled();
    expect(screen.getByText("Escribe tu nombre.")).toBeTruthy();
    expect(screen.getByText("Elige cómo vas a pagar.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText(/^Nombre/), { target: { value: "María López" } });
    fireEvent.click(screen.getByLabelText("Efectivo"));
    fireEvent.click(submitButton());
    expect(props.onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        orderType: "takeout",
        name: "María López",
        payment: "cash",
        scheduledFor: null,
      }),
      expect.objectContaining({ totalCents: 9600 }),
    );
  });

  it("datos recordados del dispositivo", () => {
    setup({
      customer: {
        ...noOne,
        name: "María López",
        phone: "5555-1234",
        lastOrderType: "takeout",
        lastPayment: "cash",
      },
    });
    expect(screen.getByLabelText(/^Nombre/)).toHaveProperty("value", "María López");
    expect(screen.getByLabelText("Para llevar")).toHaveProperty("checked", true);
    expect(screen.getByLabelText("Efectivo")).toHaveProperty("checked", true);
  });

  it("a domicilio: dirección, envío y mínimo", () => {
    setup({ subtotalCents: 3500 });
    fireEvent.click(screen.getByLabelText("A domicilio"));
    expect(screen.getByText("¿Dónde te lo llevamos?")).toBeTruthy();
    expect(screen.getByText("Envío")).toBeTruthy();
    fireEvent.click(submitButton());
    expect(screen.getByText("Escribe tu dirección.")).toBeTruthy();
    expect(screen.getByText("Te faltan Q15.00 para el pedido a domicilio mínimo.")).toBeTruthy();
    expect(submitButton().textContent).toContain("Q50.00");
  });

  it("a domicilio sin permiso de ubicación: ofrece el mapa, que empieza en la sucursal", async () => {
    setup();
    fireEvent.click(screen.getByLabelText("A domicilio"));
    expect(
      screen.getByText(
        "Compartiremos tu ubicación solo con Café El Portal para entregar tu pedido.",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Usar mi ubicación actual" }));
    // jsdom no es un contexto seguro: es como un navegador que no comparte la ubicación.
    expect(
      await screen.findByText(
        "Este navegador no comparte la ubicación. Marca el lugar en el mapa.",
      ),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Elegir en el mapa" }));
    expect(screen.getByTestId("mapa")).toBeTruthy();
    expect(screen.getByText(/A 0 km de Zona 1/)).toBeTruthy();
  });

  it("dirección guardada fuera de cobertura: pasar a recoger o la sucursal que sí entrega", () => {
    setup({
      customer: {
        ...noOne,
        address: "Calzada San Juan, Mixco",
        addressReference: "Frente al parque",
        location: { coords: MIXCO, accuracyM: 20, source: "gps" },
      },
    });
    fireEvent.click(screen.getByLabelText("A domicilio"));
    fireEvent.click(screen.getByRole("button", { name: /Usar mi dirección guardada/ }));
    expect(screen.getByLabelText(/^Dirección/)).toHaveProperty("value", "Calzada San Juan, Mixco");
    expect(screen.getByRole("alert").textContent).toContain(
      "Estás a 10.1 km y esta sucursal entrega hasta 5 km. ¿Prefieres pasar a recoger o pedir a la sucursal más cercana?",
    );
    expect(screen.getByRole("link", { name: "Pedir a Antigua" }).getAttribute("href")).toBe(
      "/cafe-el-portal/antigua",
    );
    fireEvent.click(screen.getByRole("button", { name: "Pasar a recoger" }));
    expect(screen.getByLabelText("Para llevar")).toHaveProperty("checked", true);
  });

  it("transferencia: cuenta con Copiar", () => {
    setup();
    fireEvent.click(screen.getByLabelText("Transferencia"));
    expect(screen.getByText("123-456789-0")).toBeTruthy();
    expect(screen.getByText("A nombre de Café El Portal, S.A.")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Copiar" })).toBeTruthy();
  });

  it("abierta: lo antes posible o programar", () => {
    setup();
    const when = screen.getByRole("group", { name: "¿Para cuándo?" });
    expect(within(when).getByLabelText("Lo antes posible")).toHaveProperty("checked", true);
    fireEvent.click(within(when).getByLabelText("Programar"));
    expect(within(when).getByLabelText("Hora")).toHaveProperty(
      "value",
      expect.stringMatching(/Z$/),
    );
  });

  it("cerrada (para cuando abra): ya trae el primer horario de mañana", () => {
    setup({}, CLOSED);
    const when = screen.getByRole("group", { name: "¿Para cuándo?" });
    expect(within(when).queryByLabelText("Lo antes posible")).toBeNull();
    const day = within(when).getByLabelText("Día") as HTMLSelectElement;
    expect(day.selectedOptions[0]!.textContent).toBe("Mañana");
    const hour = within(when).getByLabelText("Hora") as HTMLSelectElement;
    expect(hour.selectedOptions[0]!.textContent).toBe("7:00");
  });

  it("sucursal que no recibe pedidos: botón desactivado con el motivo", () => {
    setup({ checkout: { ...setup.defaults(), blockedReason: "Abrimos mañana a las 7:00." } });
    expect(submitButton()).toHaveProperty("disabled", true);
    expect(screen.getByText("Abrimos mañana a las 7:00.")).toBeTruthy();
  });
});

// Valores por defecto de `checkout` para sobrescribir solo una parte.
setup.defaults = () => ({
  businessName: "Café El Portal",
  businessSlug: "cafe-el-portal",
  otherBranches: [
    { slug: "antigua", name: "Antigua", location: ANTIGUA, radiusKm: 30, acceptsDelivery: true },
  ],
  branch,
  timing: orderTiming(rules, OPEN),
  bankAccounts: [],
  table: null,
  blockedReason: null,
});
