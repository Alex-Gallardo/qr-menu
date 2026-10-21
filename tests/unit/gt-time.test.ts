import { describe, expect, it } from "vitest";
import {
  addDays,
  dateOnly,
  formatDateEs,
  gtInstant,
  guatemalaNow,
  todayInGuatemala,
} from "@/lib/gt-time";

describe("hora de Guatemala", () => {
  it("a las 01:30 UTC todavía es el día anterior en Guatemala (UTC-6)", () => {
    // 2026-12-25 01:30 UTC = 2026-12-24 19:30 en Guatemala (jueves)
    expect(guatemalaNow(new Date("2026-12-25T01:30:00Z"))).toEqual({
      date: "2026-12-24",
      weekday: 4,
      minutes: 19 * 60 + 30,
    });
  });

  it("medianoche en Guatemala es 06:00 UTC", () => {
    expect(guatemalaNow(new Date("2026-10-21T06:00:00Z"))).toEqual({
      date: "2026-10-21",
      weekday: 3,
      minutes: 0,
    });
    expect(todayInGuatemala(new Date("2026-10-21T05:59:00Z"))).toBe("2026-10-20");
  });

  it("fechas legibles en español, sin año si es el actual", () => {
    const now = new Date("2026-10-21T15:00:00Z");
    expect(formatDateEs("2026-12-24", now)).toBe("jueves, 24 de diciembre");
    expect(formatDateEs("2027-01-01", now)).toBe("viernes, 1 de enero de 2027");
  });

  it("fecha de la base a texto", () => {
    expect(dateOnly(new Date("2026-12-24T00:00:00Z"))).toBe("2026-12-24");
  });

  it("suma días cruzando meses y años", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
  });

  it("hora local de Guatemala → instante UTC", () => {
    expect(gtInstant("2026-12-24", 17 * 60 + 30).toISOString()).toBe("2026-12-24T23:30:00.000Z");
    expect(guatemalaNow(gtInstant("2026-12-24", 0))).toMatchObject({
      date: "2026-12-24",
      minutes: 0,
    });
  });
});
