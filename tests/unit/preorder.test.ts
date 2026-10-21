import { describe, expect, it } from "vitest";
import {
  orderTiming,
  scheduledLabel,
  timeLabel,
  validateScheduledFor,
  type TimingRules,
} from "@/features/orders/preorder";
import { addDays, gtInstant, guatemalaNow } from "@/lib/gt-time";

// Miércoles 21 de octubre de 2026 en Guatemala.
const TODAY = "2026-10-21";
const at = (minutes: number, date = TODAY) => gtInstant(date, minutes);
const h = (hh: number, mm = 0) => hh * 60 + mm;
const everyDay = (opens: string, closes: string) =>
  [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens, closes }));

const rules = (over: Partial<TimingRules> = {}): TimingRules => ({
  hours: everyDay("07:00", "21:00"),
  closedDates: [],
  mode: "next_open",
  minLeadMin: 30,
  maxDays: 2,
  preordersEnabled: true,
  ...over,
});

describe("¿Para cuándo?", () => {
  it("el día de prueba es miércoles", () => {
    expect(guatemalaNow(at(h(10)))).toMatchObject({ date: TODAY, weekday: 3 });
  });

  it("abierta: lo antes posible o programar desde ahora + 30 min, cada 15, hasta 15 min antes de cerrar", () => {
    const t = orderTiming(rules(), at(h(10, 5)));
    expect(t).toMatchObject({ openNow: true, asap: true, notice: null, blocked: null });
    expect(t.days.map((d) => d.label)).toEqual(["Hoy", "Mañana", "El viernes"]);
    expect(t.days[0]!.times[0]!.label).toBe("10:45");
    expect(t.days[0]!.times.at(-1)!.label).toBe("20:45");
    expect(t.days[1]!.times[0]!.label).toBe("7:00");
  });

  it('cerrada "para cuando abra": "puedes dejar tu pedido para mañana desde las 7:00"', () => {
    const t = orderTiming(rules(), at(h(21, 30)));
    expect(t).toMatchObject({ openNow: false, asap: false, blocked: null });
    expect(t.notice).toBe(
      "Ahorita estamos cerrados, pero puedes dejar tu pedido para mañana desde las 7:00.",
    );
    expect(t.days[0]!.times[2]!.label).toBe("7:30");
  });

  it("respeta la anticipación mínima al abrir (6:50 + 30 min → 7:30)", () => {
    const t = orderTiming(rules(), at(h(6, 50)));
    expect(t.days[0]).toMatchObject({ label: "Hoy" });
    expect(t.days[0]!.times[0]!.label).toBe("7:30");
  });

  it('modo "no permitir": cerrado no se puede pedir y dice cuándo abre', () => {
    const t = orderTiming(rules({ mode: "off" }), at(h(21, 30)));
    expect(t).toMatchObject({ asap: false, days: [], blocked: "Abrimos mañana a las 7:00." });
    expect(t.notice).toBe(
      "Ahorita estamos cerrados. Abrimos mañana a las 7:00. Puedes ver el menú igual.",
    );
  });

  it('modo "no permitir" abierta: solo lo antes posible', () => {
    expect(orderTiming(rules({ mode: "off" }), at(h(10)))).toMatchObject({ asap: true, days: [] });
  });

  it("sin pedidos programados en el plan se comporta como no permitir", () => {
    const t = orderTiming(rules({ preordersEnabled: false }), at(h(21, 30)));
    expect(t).toMatchObject({ asap: false, days: [] });
    expect(t.blocked).not.toBeNull();
  });

  it('modo "siempre": cerrada también se puede pedir', () => {
    const t = orderTiming(rules({ mode: "always" }), at(h(23)));
    expect(t.asap).toBe(true);
    expect(t.notice).toContain("puedes dejar tu pedido");
  });

  it("los días máximos limitan hasta dónde se ofrece", () => {
    expect(orderTiming(rules({ maxDays: 0 }), at(h(10))).days.map((d) => d.label)).toEqual(["Hoy"]);
    expect(orderTiming(rules({ maxDays: 0 }), at(h(21, 30))).days).toEqual([]);
  });

  it("una fecha especial Cerrado se salta (mañana cerrado → el viernes)", () => {
    const t = orderTiming(rules({ closedDates: [addDays(TODAY, 1)] }), at(h(21, 30)));
    expect(t.days.map((d) => d.label)).toEqual(["El viernes"]);
    expect(t.notice).toContain("para el viernes desde las 7:00");
  });

  it("hoy cerrado por fecha especial: no está abierta aunque sea su horario", () => {
    const t = orderTiming(rules({ closedDates: [TODAY], mode: "off" }), at(h(10)));
    expect(t.openNow).toBe(false);
    expect(t.blocked).toBe("Abrimos mañana a las 7:00.");
  });

  it("un turno que cruza la medianoche sigue abierto a la 1:00", () => {
    const t = orderTiming(rules({ hours: everyDay("18:00", "02:00") }), at(h(1)));
    expect(t.openNow).toBe(true);
    expect(t.days[0]!.times.map((x) => x.label)).toContain("1:45");
    expect(t.days[0]!.times.map((x) => x.label)).not.toContain("2:00");
  });

  it("sin horario cargado: no se puede pedir", () => {
    const t = orderTiming(rules({ hours: [], mode: "off" }), at(h(10)));
    expect(t.blocked).toBe("Por ahora no estamos recibiendo pedidos.");
  });
});

describe("validación del servidor", () => {
  it("acepta un horario ofrecido y rechaza uno inventado", () => {
    const now = at(h(21, 30));
    const offered = new Date(orderTiming(rules(), now).days[0]!.times[2]!.at);
    expect(validateScheduledFor(rules(), offered, now)).toBeNull();
    expect(validateScheduledFor(rules(), at(h(3), addDays(TODAY, 1)), now)).toBe(
      "Ese horario ya no está disponible. Elige otro.",
    );
    expect(validateScheduledFor(rules(), at(h(7, 7), addDays(TODAY, 1)), now)).not.toBeNull();
  });

  it("lo antes posible solo con la sucursal abierta (o en modo siempre)", () => {
    expect(validateScheduledFor(rules(), null, at(h(10)))).toBeNull();
    expect(validateScheduledFor(rules({ mode: "off" }), null, at(h(22)))).toBe(
      "Abrimos mañana a las 7:00.",
    );
    expect(validateScheduledFor(rules(), null, at(h(22)))).toBe(
      "Elige para cuándo quieres tu pedido.",
    );
  });
});

describe("etiquetas", () => {
  it("horas y fechas cortas", () => {
    expect([timeLabel(450), timeLabel(13 * 60 + 5)]).toEqual(["7:30", "13:05"]);
    const now = at(h(21, 30));
    expect(scheduledLabel(at(h(7, 30), addDays(TODAY, 1)).toISOString(), now)).toBe("mañana 7:30");
    expect(scheduledLabel(at(h(20)).toISOString(), now)).toBe("hoy 20:00");
    expect(scheduledLabel(at(h(8), addDays(TODAY, 2)).toISOString(), now)).toBe("viernes 23 8:00");
  });
});
