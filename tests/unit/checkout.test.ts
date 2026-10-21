import { describe, expect, it } from "vitest";
import {
  checkoutProblems,
  defaultOrderType,
  orderTotals,
  orderTypes,
  payMethods,
  tableFromParam,
  type CheckoutBranch,
  type CheckoutInput,
} from "@/features/orders/checkout";

const branch = (over: Partial<CheckoutBranch> = {}): CheckoutBranch => ({
  acceptsDineIn: true,
  acceptsTakeout: true,
  acceptsDelivery: true,
  acceptsTransfer: true,
  deliveryFeeCents: 1500,
  minOrderCents: 5000,
  hasBankAccounts: true,
  ...over,
});

const input = (over: Partial<CheckoutInput> = {}): CheckoutInput => ({
  orderType: "takeout",
  table: "",
  name: "María López",
  phone: "5555-1234",
  email: "",
  address: "",
  addressReference: "",
  scheduledFor: null,
  payment: "cash",
  note: "",
  ...over,
});

const ctx = (over: Partial<Parameters<typeof checkoutProblems>[1]> = {}) => ({
  branch: branch(),
  subtotalCents: 11600,
  asap: true,
  validTimes: ["2026-10-22T13:30:00.000Z"],
  ...over,
});

describe("lo que ofrece la sucursal", () => {
  it("tipos de pedido según la sucursal", () => {
    expect(orderTypes(branch())).toEqual(["dine_in", "takeout", "delivery"]);
    expect(orderTypes(branch({ acceptsDineIn: false, acceptsDelivery: false }))).toEqual([
      "takeout",
    ]);
  });

  it("transferencia solo si la acepta y tiene cuentas", () => {
    expect(payMethods(branch())).toContain("transfer");
    expect(payMethods(branch({ hasBankAccounts: false }))).toEqual(["cash", "card_on_site"]);
    expect(payMethods(branch({ acceptsTransfer: false }))).toEqual(["cash", "card_on_site"]);
  });

  it('mesa precargada desde el QR: "Comer aquí · Mesa 4"', () => {
    expect(tableFromParam("4")).toBe("Mesa 4");
    expect(tableFromParam("Terraza 2")).toBe("Terraza 2");
    expect(tableFromParam('<script>"')).toBe("script");
    expect(tableFromParam("   ")).toBeNull();
    expect(defaultOrderType(["dine_in", "takeout"], { table: "Mesa 4", last: "takeout" })).toBe(
      "dine_in",
    );
    expect(defaultOrderType(["dine_in", "takeout"], { table: null, last: "takeout" })).toBe(
      "takeout",
    );
    expect(defaultOrderType(["takeout"], { table: "Mesa 4", last: "delivery" })).toBe("takeout");
  });

  it("totales: envío y mínimo solo a domicilio", () => {
    expect(orderTotals(11600, "delivery", branch())).toEqual({
      subtotalCents: 11600,
      deliveryFeeCents: 1500,
      totalCents: 13100,
      missingCents: 0,
    });
    expect(orderTotals(3500, "delivery", branch()).missingCents).toBe(1500);
    expect(orderTotals(3500, "takeout", branch())).toMatchObject({
      totalCents: 3500,
      missingCents: 0,
    });
  });
});

describe("datos del pedido", () => {
  it("completo para llevar: sin problemas", () => {
    expect(checkoutProblems(input(), ctx())).toEqual({});
  });

  it("nombre obligatorio; teléfono y correo opcionales pero válidos", () => {
    expect(checkoutProblems(input({ name: " ", phone: "123", email: "maria@" }), ctx())).toEqual({
      name: "Escribe tu nombre.",
      phone: "Revisa el número (8 dígitos).",
      email: "Revisa el correo.",
    });
    expect(checkoutProblems(input({ phone: "" }), ctx())).toEqual({});
  });

  it("a domicilio: dirección, teléfono y mínimo", () => {
    const p = checkoutProblems(
      input({ orderType: "delivery", phone: "", address: "" }),
      ctx({ subtotalCents: 3500 }),
    );
    expect(p).toEqual({
      phone: "Déjanos un teléfono por si el repartidor no te encuentra.",
      address: "Escribe tu dirección.",
      total: "Te faltan Q15.00 para el pedido a domicilio mínimo.",
    });
  });

  it("tipo o pago que la sucursal no ofrece", () => {
    expect(
      checkoutProblems(
        input({ orderType: "delivery", payment: "transfer", address: "4a avenida 12-30" }),
        ctx({ branch: branch({ acceptsDelivery: false, hasBankAccounts: false }) }),
      ),
    ).toEqual({ orderType: "Elige cómo lo quieres.", payment: "Elige cómo vas a pagar." });
  });

  it("¿para cuándo?: cerrada exige programar; un horario que no se ofrece no vale", () => {
    expect(checkoutProblems(input(), ctx({ asap: false }))).toEqual({
      scheduledFor: "Elige para cuándo lo quieres.",
    });
    expect(
      checkoutProblems(input({ scheduledFor: "2026-10-22T13:30:00.000Z" }), ctx({ asap: false })),
    ).toEqual({});
    expect(checkoutProblems(input({ scheduledFor: "2026-10-22T13:31:00.000Z" }), ctx())).toEqual({
      scheduledFor: "Ese horario ya no está disponible. Elige otro.",
    });
  });

  it("carrito vacío", () => {
    expect(checkoutProblems(input(), ctx({ subtotalCents: 0 }))).toEqual({
      total: "Agrega al menos un producto.",
    });
  });
});
