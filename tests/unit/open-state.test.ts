import { describe, expect, it } from "vitest";
import { openState } from "@/features/branches/hours";

const m = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
// Lunes a sábado 07:00–22:00; viernes y sábado hasta las 02:00; domingo cerrado.
const rows = [
  ...[1, 2, 3, 4].map((weekday) => ({ weekday, opens: "07:00", closes: "22:00" })),
  { weekday: 5, opens: "07:00", closes: "02:00" },
  { weekday: 6, opens: "09:00", closes: "02:00" },
];

describe("estado de horario de la sucursal", () => {
  it("abierto: dice a qué hora cierra", () => {
    expect(openState(rows, { weekday: 2, minutes: m("12:00") })).toEqual({
      open: true,
      label: "Abierto · cierra 22:00",
    });
  });

  it("antes de abrir: abre hoy", () => {
    expect(openState(rows, { weekday: 2, minutes: m("06:30") })).toEqual({
      open: false,
      label: "Cerrado · abre a las 07:00",
    });
  });

  it("después de cerrar: abre mañana", () => {
    expect(openState(rows, { weekday: 2, minutes: m("22:00") })).toEqual({
      open: false,
      label: "Cerrado · abre mañana a las 07:00",
    });
  });

  it("turno que cruza la medianoche: el sábado a la 01:00 sigue abierto (viernes)", () => {
    expect(openState(rows, { weekday: 6, minutes: m("01:00") })).toEqual({
      open: true,
      label: "Abierto · cierra 02:00",
    });
    expect(openState(rows, { weekday: 6, minutes: m("02:30") }).label).toBe(
      "Cerrado · abre a las 09:00",
    );
  });

  it("domingo cerrado: el sábado tarde avisa el lunes", () => {
    expect(openState(rows, { weekday: 0, minutes: m("12:00") }).label).toBe(
      "Cerrado · abre mañana a las 07:00",
    );
    expect(
      openState(
        rows.filter((r) => r.weekday !== 1),
        { weekday: 0, minutes: m("12:00") },
      ).label,
    ).toBe("Cerrado · abre el martes a las 07:00");
  });

  it("sin horario cargado: Cerrado", () => {
    expect(openState([], { weekday: 2, minutes: 600 })).toEqual({ open: false, label: "Cerrado" });
  });
});
