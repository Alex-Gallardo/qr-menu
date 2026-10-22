import { describe, expect, it } from "vitest";
import { isValidPin, lockMessage, lockState, wrongPinMessage } from "@/features/staff/pin";

const NOW = new Date("2026-10-21T18:00:00Z");
const ago = (ms: number) => new Date(NOW.getTime() - ms);
const MIN = 60_000;

describe("PIN del staff", () => {
  it("4 a 6 dígitos", () => {
    expect(["1234", "123456", "0000"].every(isValidPin)).toBe(true);
    expect(["123", "1234567", "12a4", " 1234", ""].some(isValidPin)).toBe(false);
  });

  it("sin fallos: 5 intentos", () => {
    expect(lockState(null, NOW)).toEqual({ locked: false, remaining: 5 });
  });

  it("cada fallo resta un intento; al quinto se bloquea 5 minutos", () => {
    expect(lockState({ count: 3, windowStart: ago(MIN) }, NOW)).toEqual({
      locked: false,
      remaining: 2,
    });
    expect(lockState({ count: 5, windowStart: ago(MIN) }, NOW)).toEqual({
      locked: true,
      retryAfterSec: 240,
    });
    expect(lockState({ count: 5, windowStart: ago(5 * MIN + 1000) }, NOW)).toEqual({
      locked: false,
      remaining: 5,
    });
  });

  it("fallos de hace más de 15 minutos ya no cuentan", () => {
    expect(lockState({ count: 4, windowStart: ago(16 * MIN) }, NOW)).toEqual({
      locked: false,
      remaining: 5,
    });
  });

  it("mensajes", () => {
    expect(wrongPinMessage(4)).toBe("PIN incorrecto. Te quedan 4 intentos.");
    expect(wrongPinMessage(1)).toBe("PIN incorrecto. Te queda 1 intento.");
    expect(wrongPinMessage(0)).toBe("Demasiados intentos. Espera 5 minutos y vuelve a probar.");
    expect(lockMessage(30)).toBe("Demasiados intentos. Espera 1 minuto y vuelve a probar.");
  });
});
