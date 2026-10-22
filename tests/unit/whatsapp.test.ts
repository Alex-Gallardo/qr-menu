import { describe, expect, it } from "vitest";
import {
  buildWhatsAppMessage,
  MAX_MESSAGE,
  whatsappUrl,
  type MessageOrder,
} from "@/features/orders/whatsapp";
import { addDays, gtInstant } from "@/lib/gt-time";

const TODAY = "2026-10-21";
const NOW = gtInstant(TODAY, 21 * 60 + 30);

const order = (over: Partial<MessageOrder> = {}): MessageOrder => ({
  number: 42,
  businessName: "Café El Portal",
  branchName: "Zona 10",
  customerName: "María López",
  customerPhone: "+50255551234",
  orderType: "delivery",
  tableLabel: null,
  scheduledFor: null,
  items: [
    {
      name: "Desayuno chapín",
      quantity: 2,
      lineCents: 9000,
      options: [
        { group: "Frijoles", name: "volteados", deltaCents: 0 },
        { group: "Extras", name: "Extra plátanos", deltaCents: 800 },
      ],
      note: null,
    },
    { name: "Americano grande", quantity: 1, lineCents: 1800, options: [], note: null },
  ],
  subtotalCents: 11600,
  deliveryFeeCents: 1500,
  totalCents: 13100,
  payment: "transfer",
  bankName: "Banco Industrial",
  address: "4a avenida 12-30, zona 10",
  addressReference: "portón negro frente a la farmacia",
  location: { lat: 14.6012, lng: -90.5146, accuracyM: 20 },
  note: "sin cebolla, por favor",
  detailUrl: "https://qr-menu.app/cafe-el-portal/zona-10/pedido/7f3a",
  greeting: null,
  farewell: null,
  ...over,
});

describe("mensaje de WhatsApp", () => {
  it("formato de la guía para un pedido a domicilio", () => {
    expect(buildWhatsAppMessage(order(), NOW)).toBe(
      [
        "🧾 *Pedido #0042* — Café El Portal · Zona 10",
        "👤 María López · 5555-1234",
        "🛵 A domicilio · Lo antes posible",
        "",
        "2× Desayuno chapín — Q90.00",
        "   • Frijoles: volteados",
        "   • Extra plátanos (+Q8.00)",
        "1× Americano grande — Q18.00",
        "",
        "Subtotal: Q116.00",
        "Envío: Q15.00",
        "*Total: Q131.00*",
        "💳 Pago: Transferencia (Banco Industrial)",
        "",
        "📍 4a avenida 12-30, zona 10",
        "Referencia: portón negro frente a la farmacia",
        "Google Maps: https://www.google.com/maps/search/?api=1&query=14.6012,-90.5146",
        "Waze: https://waze.com/ul?ll=14.6012,-90.5146&navigate=yes",
        "(precisión ±20 m)",
        "",
        "📝 Nota: sin cebolla, por favor",
        "Detalle: https://qr-menu.app/cafe-el-portal/zona-10/pedido/7f3a",
      ].join("\n"),
    );
  });

  it('programado: "🕒 Para llevar · Programado para mañana 7:30"', () => {
    const text = buildWhatsAppMessage(
      order({
        orderType: "takeout",
        scheduledFor: gtInstant(addDays(TODAY, 1), 7 * 60 + 30),
        deliveryFeeCents: 0,
        totalCents: 11600,
        payment: "cash",
      }),
      NOW,
    );
    expect(text).toContain("🕒 Para llevar · Programado para mañana 7:30");
    expect(text).not.toContain("Subtotal");
    expect(text).not.toContain("📍");
    expect(text).toContain("💳 Pago: Efectivo");
  });

  it("comer aquí con mesa, saludo y despedida del negocio", () => {
    const text = buildWhatsAppMessage(
      order({
        orderType: "dine_in",
        tableLabel: "Mesa 4",
        deliveryFeeCents: 0,
        greeting: "¡Hola! Quiero pedir:",
        farewell: "¡Gracias!",
        customerPhone: null,
        location: null,
      }),
      NOW,
    );
    expect(text.split("\n").slice(0, 4)).toEqual([
      "¡Hola! Quiero pedir:",
      "🧾 *Pedido #0042* — Café El Portal · Zona 10",
      "👤 María López",
      "🍽️ Comer aquí · Mesa 4 · Lo antes posible",
    ]);
    expect(text.endsWith("¡Gracias!")).toBe(true);
    expect(text).not.toContain("Google Maps");
  });

  it("ubicación marcada en el mapa: links sin precisión", () => {
    const text = buildWhatsAppMessage(
      order({ location: { lat: 14.6, lng: -90.5, accuracyM: null } }),
      NOW,
    );
    expect(text).toContain("Waze: https://waze.com/ul?ll=14.6,-90.5&navigate=yes");
    expect(text).not.toContain("precisión");
  });

  it("un pedido enorme se resume por debajo de 1,500 caracteres con el link al detalle", () => {
    const items = Array.from({ length: 60 }, (_, i) => ({
      name: `Platillo número ${i + 1} con nombre largo`,
      quantity: 1,
      lineCents: 5000,
      options: [{ group: "Tamaño", name: "Grande", deltaCents: 500 }],
      note: "sin cebolla",
    }));
    const text = buildWhatsAppMessage(order({ items }), NOW);
    expect(text.length).toBeLessThanOrEqual(MAX_MESSAGE);
    expect(text).toMatch(/… y \d+ productos más \(mira el detalle\)/);
    expect(text).toContain("Detalle: https://qr-menu.app/");
    expect(text).toContain("*Total: Q131.00*");
  });

  it("link de WhatsApp (api.whatsapp.com, no wa.me: su redirección rompe los emojis)", () => {
    expect(whatsappUrl("+50255550000", "🧾 *Pedido #0042*\nHola & más")).toBe(
      "https://api.whatsapp.com/send?phone=50255550000&text=%F0%9F%A7%BE%20*Pedido%20%230042*%0AHola%20%26%20m%C3%A1s",
    );
  });
});
