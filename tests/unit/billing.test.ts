import { describe, expect, it } from "vitest";
import {
  amountCents,
  FEATURE_LABELS,
  nextPeriod,
  planWithFeature,
  usageRows,
} from "@/features/billing/billing";
import { paymentSchema, receiptUploadSchema } from "@/features/billing/schemas";
import { FEATURES, PLAN_CATALOG } from "@/features/licensing/plan-catalog";

/** QRM-041: licencia en el panel (Mi plan, boleta, invitación a mejorar). */

const ID = "6f1c2b9e-3a4d-4e5f-8a7b-1c2d3e4f5a6b";

describe("precios y periodos", () => {
  it("anual = 10 meses (2 gratis)", () => {
    expect(amountCents(149, "monthly")).toBe(14_900);
    expect(amountCents(149, "annual")).toBe(149_000);
    expect(amountCents(99, "monthly")).toBe(9_900);
  });

  it("si aún no vence, el pago se suma al final (no se pierden días)", () => {
    const now = new Date("2026-10-23T12:00:00Z");
    const ends = new Date("2026-11-05T12:00:00Z");
    const p = nextPeriod(ends, "monthly", now);
    expect(p.start).toEqual(ends);
    expect(p.end.toISOString()).toBe("2026-12-05T12:00:00.000Z");
    expect(nextPeriod(ends, "annual", now).end.toISOString()).toBe("2027-11-05T12:00:00.000Z");
  });

  it("si ya venció, empieza hoy; fin de mes no se pasa al siguiente", () => {
    const now = new Date("2027-01-31T15:00:00Z");
    const p = nextPeriod(new Date("2027-01-01T00:00:00Z"), "monthly", now);
    expect(p.start).toEqual(now);
    expect(p.end.toISOString()).toBe("2027-02-28T15:00:00.000Z");
    expect(nextPeriod(null, "monthly", now).start).toEqual(now);
  });
});

describe("funciones y límites", () => {
  it("cada función tiene nombre y el plan más barato que la incluye", () => {
    for (const f of FEATURES) expect(FEATURE_LABELS[f]).toBeTruthy();
    expect(planWithFeature("video_bg", PLAN_CATALOG)?.id).toBe("pro");
    expect(planWithFeature("remove_branding", PLAN_CATALOG)?.id).toBe("negocio");
  });

  it("uso: ilimitado, no incluido y lleno", () => {
    const rows = usageRows(PLAN_CATALOG[1]!.limits, {
      branches: 1,
      products: 40,
      menus: 2,
      time_slots: 3,
      qr: 5,
      managers: 1,
      staff: 4,
      storage_mb: 100,
    });
    const by = (r: string) => rows.find((x) => x.resource === r)!;
    expect(by("branches")).toMatchObject({ used: 1, limit: 1, pct: 100, full: true });
    expect(by("products")).toMatchObject({ limit: null, pct: null, full: false });
    expect(by("managers")).toMatchObject({ used: 1, limit: 2, pct: 50, full: false });
    const free = usageRows(PLAN_CATALOG[0]!.limits, {
      branches: 1,
      products: 0,
      menus: 0,
      time_slots: 0,
      qr: 0,
      managers: 0,
      staff: 0,
      storage_mb: 0,
    });
    expect(free.find((x) => x.resource === "staff")).toMatchObject({ limit: 0, pct: null });
  });
});

describe("boleta", () => {
  const base = {
    businessId: ID,
    planId: "pro",
    period: "monthly",
    method: "transfer",
    bank: "Banco Industrial",
    reference: "123456",
    amount: "149.00",
    receiptPath: `${ID}/abc.jpg`,
  };
  it("pide banco, referencia, monto y la foto", () => {
    expect(paymentSchema.safeParse(base).success).toBe(true);
    expect(paymentSchema.safeParse({ ...base, receiptPath: "" }).success).toBe(false);
    expect(paymentSchema.safeParse({ ...base, amount: "0" }).success).toBe(false);
    expect(paymentSchema.safeParse({ ...base, reference: "1" }).success).toBe(false);
    expect(paymentSchema.safeParse({ ...base, planId: "gratis" }).success).toBe(false);
  });
  it("foto o PDF de hasta 8 MB", () => {
    expect(
      receiptUploadSchema.safeParse({ businessId: ID, type: "application/pdf", bytes: 1000 })
        .success,
    ).toBe(true);
    expect(
      receiptUploadSchema.safeParse({ businessId: ID, type: "image/gif", bytes: 1000 }).success,
    ).toBe(false);
    expect(
      receiptUploadSchema.safeParse({ businessId: ID, type: "image/jpeg", bytes: 9 * 1024 * 1024 })
        .success,
    ).toBe(false);
  });
});
