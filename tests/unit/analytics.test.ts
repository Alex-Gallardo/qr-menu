import { describe, expect, it } from "vitest";
import {
  avgTicket,
  conversion,
  delta,
  deltaLabel,
  funnel,
  gtMidnight,
  hourLabel,
  hoursSeries,
  parsePeriod,
  periodRanges,
  toCsv,
} from "@/features/analytics/metrics";
import { eventBatchSchema } from "@/features/analytics/schemas";

/** QRM-038: analíticas con filtro por sucursal. */

const ID = "6f1c2b9e-3a4d-4e5f-8a7b-1c2d3e4f5a6b";

describe("periodos (hora de Guatemala)", () => {
  // 23 oct 2026, 1:30 a. m. en Guatemala = 07:30 UTC.
  const now = new Date("2026-10-23T07:30:00Z");

  it("la medianoche es la de Guatemala (06:00 UTC), no la de UTC", () => {
    expect(gtMidnight(now).toISOString()).toBe("2026-10-23T06:00:00.000Z");
    // 11 p. m. del 22 en Guatemala sigue siendo el 22.
    expect(gtMidnight(new Date("2026-10-23T05:00:00Z")).toISOString()).toBe(
      "2026-10-22T06:00:00.000Z",
    );
  });

  it("hoy se compara con el mismo día de la semana pasada, hasta la misma hora", () => {
    const r = periodRanges("hoy", now);
    expect(r.current.from.toISOString()).toBe("2026-10-23T06:00:00.000Z");
    expect(r.current.to).toEqual(now);
    expect(r.previous.from.toISOString()).toBe("2026-10-16T06:00:00.000Z");
    expect(r.previous.to.toISOString()).toBe("2026-10-16T07:30:00.000Z");
  });

  it("7 días incluye hoy y se compara con los 7 anteriores; 30 con los 30 anteriores", () => {
    const week = periodRanges("7d", now);
    expect(week.current.from.toISOString()).toBe("2026-10-17T06:00:00.000Z");
    expect(week.previous.from.toISOString()).toBe("2026-10-10T06:00:00.000Z");
    const month = periodRanges("30d", now);
    expect(month.current.from.toISOString()).toBe("2026-09-24T06:00:00.000Z");
    expect(month.previous.to.toISOString()).toBe("2026-09-23T07:30:00.000Z");
  });

  it("sin analíticas completas (Gratis) solo hay hoy; con ellas, 7 días por defecto", () => {
    expect(parsePeriod("30d", false)).toBe("hoy");
    expect(parsePeriod("30d", true)).toBe("30d");
    expect(parsePeriod("raro", true)).toBe("7d");
    expect(parsePeriod(null, true)).toBe("7d");
  });
});

describe("números", () => {
  it("cambio contra el periodo anterior", () => {
    expect(delta(15, 10)).toBe(50);
    expect(delta(5, 10)).toBe(-50);
    expect(delta(0, 0)).toBe(0);
    expect(delta(3, 0)).toBeNull();
    expect(deltaLabel(50)).toBe("+50 %");
    expect(deltaLabel(-50)).toBe("−50 %");
    expect(deltaLabel(null)).toBe("nuevo");
  });

  it("conversión y ticket promedio sin dividir entre cero", () => {
    expect(conversion(3, 40)).toBe(8);
    expect(conversion(3, 0)).toBeNull();
    expect(avgTicket(15000, 3)).toBe(5000);
    expect(avgTicket(0, 0)).toBe(0);
  });

  it("embudo: % del primer paso y del anterior; los pedidos al final", () => {
    const steps = funnel({
      visitors: 100,
      viewedProduct: 60,
      addedToCart: 30,
      startedCheckout: 20,
      orders: 10,
    });
    expect(steps.map((s) => s.value)).toEqual([100, 60, 30, 20, 10]);
    expect(steps.map((s) => s.ofFirst)).toEqual([100, 60, 30, 20, 10]);
    expect(steps.map((s) => s.ofPrevious)).toEqual([null, 60, 50, 67, 50]);
    expect(steps.at(-1)?.label).toBe("Pidieron");
  });

  it("pedidos por hora: 24 horas con ceros", () => {
    const s = hoursSeries([
      { hour: 13, orders: 4 },
      { hour: 8, orders: 1 },
    ]);
    expect(s).toHaveLength(24);
    expect(s[13]).toEqual({ hour: 13, orders: 4 });
    expect(s[0]?.orders).toBe(0);
    expect([hourLabel(0), hourLabel(7), hourLabel(12), hourLabel(21)]).toEqual([
      "12 a. m.",
      "7 a. m.",
      "12 p. m.",
      "9 p. m.",
    ]);
  });
});

describe("CSV", () => {
  it("separador ;, BOM, comillas y sin fórmulas de Excel", () => {
    const csv = toCsv(
      ["Fecha", "Sucursal", "Pedidos"],
      [
        ["2026-10-23", 'Zona 1; "Centro"', 3],
        ["2026-10-23", "=HYPERLINK(1)", null],
      ],
    );
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('2026-10-23;"Zona 1; ""Centro""";3\r\n');
    expect(csv).toContain("2026-10-23;'=HYPERLINK(1);\r\n");
  });
});

describe("lote de eventos", () => {
  const base = { businessId: ID, branchId: ID, sessionId: "abc12345-xyz" };
  it("acepta los eventos del menú", () => {
    const ok = eventBatchSchema.safeParse({
      ...base,
      events: [
        { event: "page_view", source: "qr" },
        { event: "add_to_cart", productId: ID, quantity: 2 },
      ],
    });
    expect(ok.success).toBe(true);
  });
  it("rechaza eventos del servidor, lotes vacíos o enormes y sesiones raras", () => {
    expect(eventBatchSchema.safeParse({ ...base, events: [{ event: "qr_scan" }] }).success).toBe(
      false,
    );
    expect(eventBatchSchema.safeParse({ ...base, events: [] }).success).toBe(false);
    expect(
      eventBatchSchema.safeParse({
        ...base,
        events: Array.from({ length: 26 }, () => ({ event: "page_view" })),
      }).success,
    ).toBe(false);
    expect(
      eventBatchSchema.safeParse({ ...base, sessionId: "<x>", events: [{ event: "page_view" }] })
        .success,
    ).toBe(false);
  });
});
