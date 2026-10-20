import { describe, expect, it } from "vitest";
import { defaultWeek, toWeek, weekSummary } from "@/features/branches/hours";
import { branchFormSchema, type BranchFormInput } from "@/features/branches/schemas";
import { centsToInput, parseQ } from "@/lib/money";
import { formatPhone, toE164 } from "@/lib/phone";

describe("teléfonos", () => {
  it.each([
    ["5555-1234", "+50255551234"],
    ["+502 5555 1234", "+50255551234"],
    ["50222334455", "+50222334455"],
    ["+1 415 555 0100", "+14155550100"],
    ["1234-5678", null],
    ["5555", null],
    ["", null],
  ])("%s → %s", (input, expected) => {
    expect(toE164(input)).toBe(expected);
  });

  it("formatea números de Guatemala", () => {
    expect(formatPhone("+50255551234")).toBe("5555-1234");
  });
});

describe("montos", () => {
  it.each([
    ["45", 4500],
    ["45.5", 4550],
    ["Q 1,490.00", 149000],
    ["0", 0],
    ["-5", null],
    ["abc", null],
    ["1.234", null],
  ])("%s → %s", (input, expected) => {
    expect(parseQ(input)).toBe(expected);
  });

  it("de centavos a texto del input", () => {
    expect(centsToInput(4500)).toBe("45");
    expect(centsToInput(4550)).toBe("45.50");
    expect(centsToInput(null)).toBe("");
  });
});

describe("horario", () => {
  it("agrupa días seguidos con el mismo horario", () => {
    const week = toWeek([
      ...[1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens: "07:00", closes: "21:00" })),
      { weekday: 0, opens: "08:00", closes: "15:00" },
    ]);
    expect(weekSummary(week)).toBe("Lun–Sáb 07:00–21:00 · Dom 08:00–15:00");
  });

  it("omite los días cerrados", () => {
    expect(weekSummary(defaultWeek())).toBe("Lun–Sáb 08:00–20:00");
  });
});

const valid: BranchFormInput = {
  businessId: "8f9d0a5e-7f3c-4c5b-9a2e-1d2c3b4a5f6e",
  name: "Zona 10",
  slug: "zona-10",
  address: "4a avenida 12-30",
  address_reference: "",
  city: "Ciudad de Guatemala",
  whatsapp: "5555-1234",
  phone: "",
  google_place_id: "",
  accepts_dine_in: true,
  accepts_takeout: true,
  accepts_delivery: true,
  accepts_transfer: true,
  delivery_fee: "15",
  delivery_radius_km: "5",
  min_order: "50",
  delivery_requires_location: true,
  preorder_mode: "next_open",
  preorder_min_lead_min: "30",
  preorder_max_days: "2",
  is_active: true,
  hours: defaultWeek(),
};

const issues = (input: BranchFormInput) =>
  branchFormSchema.safeParse(input).error?.issues.map((i) => i.path.join(".")) ?? [];

describe("branchFormSchema", () => {
  it("convierte a lo que guarda la base (E.164, centavos, solo días abiertos)", () => {
    const out = branchFormSchema.parse(valid);
    expect(out.data).toMatchObject({
      whatsapp_e164: "+50255551234",
      delivery_fee_cents: 1500,
      delivery_radius_km: 5,
      min_order_cents: 5000,
      address_reference: null,
      preorder_min_lead_min: 30,
    });
    expect(out.hours).toHaveLength(6);
  });

  it("sin domicilio no guarda costos de entrega", () => {
    const out = branchFormSchema.parse({ ...valid, accepts_delivery: false, delivery_fee: "abc" });
    expect(out.data).toMatchObject({
      delivery_fee_cents: 0,
      delivery_radius_km: null,
      min_order_cents: 0,
    });
  });

  it("radio vacío = sin límite", () => {
    expect(
      branchFormSchema.parse({ ...valid, delivery_radius_km: "" }).data.delivery_radius_km,
    ).toBeNull();
  });

  it("valida WhatsApp, link, montos y radio", () => {
    expect(issues({ ...valid, whatsapp: "1234" })).toContain("whatsapp");
    expect(issues({ ...valid, slug: "Zona 10" })).toContain("slug");
    expect(issues({ ...valid, delivery_fee: "quince" })).toContain("delivery_fee");
    expect(issues({ ...valid, delivery_radius_km: "500" })).toContain("delivery_radius_km");
  });

  it("exige al menos un tipo de pedido y un día abierto", () => {
    expect(
      issues({ ...valid, accepts_dine_in: false, accepts_takeout: false, accepts_delivery: false }),
    ).toContain("accepts_dine_in");
    expect(
      issues({ ...valid, hours: defaultWeek().map((d) => ({ ...d, open: false })) }),
    ).toContain("hours");
  });

  it("marca el día con horario inválido", () => {
    const hours = defaultWeek();
    hours[1] = { ...hours[1]!, opens: "09:00", closes: "09:00" };
    expect(issues({ ...valid, hours })).toContain("hours.1.closes");
  });

  it("acepta turnos que cruzan la medianoche", () => {
    const hours = defaultWeek();
    hours[5] = { ...hours[5]!, opens: "18:00", closes: "02:00" };
    expect(branchFormSchema.safeParse({ ...valid, hours }).success).toBe(true);
  });
});
