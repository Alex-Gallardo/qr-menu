import { describe, expect, it } from "vitest";
import {
  crossesMidnight,
  findOverlap,
  formatDuration,
  formatSlotRange,
  isWithinSlot,
  slotDuration,
  slotsOverlap,
  slotTimeProblem,
  sortSlots,
  timelineSegments,
  type Slot,
} from "@/features/schedule/slots";

const slot = (id: string, start_time: string, end_time: string, is_active = true): Slot => ({
  id,
  key: "custom",
  name: id,
  start_time,
  end_time,
  is_active,
});

const desayuno = slot("desayuno", "06:30", "11:00");
const almuerzo = slot("almuerzo", "11:30", "15:30");
const cena = slot("cena", "17:30", "21:30");
const noche = slot("noche", "22:00", "02:00");
const min = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3));

describe("Desayuno, Almuerzo y Cena", () => {
  it("no se cruzan entre sí", () => {
    expect(slotsOverlap(desayuno, almuerzo)).toBe(false);
    expect(slotsOverlap(almuerzo, cena)).toBe(false);
    expect(findOverlap(cena, [desayuno, almuerzo, cena])).toBeNull();
  });

  it("calcula duración y rango legible", () => {
    expect(formatDuration(slotDuration(desayuno))).toBe("4 h 30 min");
    expect(formatDuration(slotDuration(almuerzo))).toBe("4 h");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatSlotRange(cena)).toBe("17:30–21:30");
  });

  it("se ordenan por hora de inicio", () => {
    expect(sortSlots([cena, desayuno, almuerzo]).map((s) => s.id)).toEqual([
      "desayuno",
      "almuerzo",
      "cena",
    ]);
  });
});

describe("cruce de medianoche", () => {
  it("22:00–02:00 dura 4 h y termina al día siguiente", () => {
    expect(crossesMidnight(noche)).toBe(true);
    expect(slotDuration(noche)).toBe(240);
    expect(formatSlotRange(noche)).toBe("22:00–02:00 (termina al día siguiente)");
  });

  it("incluye las 23:59 y la 01:00, pero no las 02:00", () => {
    expect(isWithinSlot(min("23:59"), noche)).toBe(true);
    expect(isWithinSlot(min("00:00"), noche)).toBe(true);
    expect(isWithinSlot(min("01:00"), noche)).toBe(true);
    expect(isWithinSlot(min("02:00"), noche)).toBe(false);
    expect(isWithinSlot(min("21:59"), noche)).toBe(false);
  });

  it("detecta choques que pasan por la medianoche", () => {
    expect(slotsOverlap(noche, slot("madrugada", "01:00", "05:00"))).toBe(true);
    expect(slotsOverlap(noche, slot("tarde", "21:00", "22:30"))).toBe(true);
    expect(slotsOverlap(noche, desayuno)).toBe(false);
  });

  it("en la línea de tiempo se parte en dos tramos", () => {
    expect(timelineSegments(noche)).toEqual([
      { left: (22 / 24) * 100, width: (2 / 24) * 100 },
      { left: 0, width: (2 / 24) * 100 },
    ]);
  });
});

describe("validación", () => {
  it("una franja que termina cuando empieza otra no choca", () => {
    expect(slotsOverlap(slot("a", "06:00", "11:00"), slot("b", "11:00", "15:00"))).toBe(false);
  });

  it("detecta choques y no cuenta las pausadas ni a sí misma", () => {
    const brunch = slot("brunch", "10:00", "12:00");
    expect(findOverlap(brunch, [desayuno, almuerzo])?.id).toBe("desayuno");
    expect(
      findOverlap(brunch, [
        { ...desayuno, is_active: false },
        { ...almuerzo, is_active: false },
      ]),
    ).toBeNull();
    expect(findOverlap({ ...desayuno, start_time: "07:00" }, [desayuno])).toBeNull();
  });

  it("pide horas válidas, distintas y de al menos 30 minutos", () => {
    expect(slotTimeProblem(desayuno)).toBeNull();
    expect(slotTimeProblem(noche)).toBeNull();
    expect(slotTimeProblem(slot("x", "7:00", "11:00"))).toMatch(/06:30/);
    expect(slotTimeProblem(slot("x", "25:00", "11:00"))).not.toBeNull();
    expect(slotTimeProblem(slot("x", "11:00", "11:00"))).toMatch(/distinta/);
    expect(slotTimeProblem(slot("x", "11:00", "11:15"))).toMatch(/30 minutos/);
  });
});
