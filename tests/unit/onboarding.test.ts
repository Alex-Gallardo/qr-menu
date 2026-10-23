import { describe, expect, it } from "vitest";
import {
  checklist,
  maxStep,
  minutesToPublish,
  parseStep,
  resumeStep,
  SAMPLE_PRODUCTS,
  whatsappTestUrl,
} from "@/features/onboarding/onboarding";
import { businessStepSchema, productsStepSchema } from "@/features/onboarding/schemas";

/** QRM-039: asistente de alta en 4 pasos. */

const ID = "6f1c2b9e-3a4d-4e5f-8a7b-1c2d3e4f5a6b";
const none = { hasBusiness: false, hasLogo: false, products: 0, published: false };
const created = { ...none, hasBusiness: true };

describe("pasos", () => {
  it("retoma donde se quedó", () => {
    expect(resumeStep(none)).toBe(1);
    expect(resumeStep(created)).toBe(2);
    expect(resumeStep({ ...created, hasLogo: true })).toBe(3);
    expect(resumeStep({ ...created, products: 3 })).toBe(4);
  });

  it("no deja saltar pasos con datos que faltan", () => {
    expect(maxStep(none)).toBe(1);
    expect(maxStep(created)).toBe(3);
    expect(parseStep("4", created)).toBe(3);
    expect(parseStep("3", none)).toBe(1);
    expect(parseStep("1", { ...created, products: 2 })).toBe(1);
    expect(parseStep("9", created)).toBe(2);
    expect(parseStep(null, { ...created, products: 1 })).toBe(4);
  });
});

describe("mensaje de prueba de WhatsApp", () => {
  it("abre api.whatsapp.com hacia el número de la sucursal (los emojis no se rompen)", () => {
    const url = new URL(whatsappTestUrl("+50255551234", "QR Menu"));
    expect(url.host).toBe("api.whatsapp.com");
    expect(url.searchParams.get("phone")).toBe("50255551234");
    expect(url.searchParams.get("text")).toContain("mensaje de prueba de QR Menu ✅");
  });
});

describe("lista final y tiempo a publicar", () => {
  it("marca lo hecho", () => {
    const items = checklist({
      hoursCustomized: false,
      products: 8,
      bankAccounts: 1,
      pushDevices: 0,
      teamMembers: 0,
    });
    expect(items.map((i) => [i.key, i.done])).toEqual([
      ["horarios", false],
      ["productos", true],
      ["pagos", true],
      ["avisos", false],
      ["equipo", false],
    ]);
  });
  it("minutos desde el alta", () => {
    const start = new Date("2026-10-23T12:00:00Z");
    expect(minutesToPublish(start, new Date("2026-10-23T12:08:40Z"))).toBe(9);
    expect(minutesToPublish(start, start)).toBe(0);
  });
});

describe("validación", () => {
  const step1 = {
    name: "Café La Esquina",
    slug: "cafe-la-esquina",
    branchName: "Zona 10",
    address: "6a. avenida 12-34",
    addressReference: "",
    city: "Guatemala",
    location: { lat: 14.6, lng: -90.51 },
    whatsapp: "5555-1234",
  };

  it("paso 1: WhatsApp de Guatemala a E.164; referencia vacía → null", () => {
    const out = businessStepSchema.parse(step1);
    expect(out.whatsapp).toBe("+50255551234");
    expect(out.addressReference).toBeNull();
  });

  it("paso 1: WhatsApp, dirección y pin inválidos se rechazan", () => {
    expect(businessStepSchema.safeParse({ ...step1, whatsapp: "123" }).success).toBe(false);
    expect(businessStepSchema.safeParse({ ...step1, address: "x" }).success).toBe(false);
    expect(businessStepSchema.safeParse({ ...step1, location: { lat: 200, lng: 0 } }).success).toBe(
      false,
    );
    expect(businessStepSchema.safeParse({ ...step1, location: null }).success).toBe(true);
  });

  it("paso 3: de 1 a 5 productos con precio mayor que cero; los ejemplos pasan", () => {
    const row = (name: string, price: string) => ({
      name,
      price,
      imageUrl: null,
      imageBlurhash: null,
    });
    const samples = SAMPLE_PRODUCTS.map((p) => row(p.name, p.price));
    expect(productsStepSchema.safeParse({ businessId: ID, products: samples }).success).toBe(true);
    expect(productsStepSchema.safeParse({ businessId: ID, products: [] }).success).toBe(false);
    expect(
      productsStepSchema.safeParse({ businessId: ID, products: [...samples, row("Extra", "5")] })
        .success,
    ).toBe(false);
    expect(
      productsStepSchema.safeParse({ businessId: ID, products: [row("Agua", "0")] }).success,
    ).toBe(false);
  });
});
