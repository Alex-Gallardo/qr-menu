import { describe, expect, it } from "vitest";
import {
  ago,
  canTransition,
  isFinal,
  matchesFilter,
  primaryAction,
} from "@/features/orders/status";

const NOW = new Date("2026-10-21T18:00:00Z");

describe("estados del pedido", () => {
  it("avanza en orden y se puede cancelar hasta antes de entregar", () => {
    expect(canTransition("new", "accepted")).toBe(true);
    expect(canTransition("accepted", "ready")).toBe(true);
    expect(canTransition("ready", "delivered")).toBe(true);
    expect(canTransition("preparing", "cancelled")).toBe(true);
    expect(canTransition("new", "delivered")).toBe(false);
    expect(canTransition("delivered", "cancelled")).toBe(false);
    expect(canTransition("cancelled", "new")).toBe(false);
    expect([isFinal("delivered"), isFinal("cancelled"), isFinal("ready")]).toEqual([
      true,
      true,
      false,
    ]);
  });

  it("botón principal según estado y tipo", () => {
    expect(primaryAction("new", "takeout")).toEqual({ to: "accepted", label: "Aceptar" });
    expect(primaryAction("preparing", "delivery")?.label).toBe("Listo para enviar");
    expect(primaryAction("ready", "dine_in")?.label).toBe("Servido");
    expect(primaryAction("ready", "delivery")?.label).toBe("Entregado");
    expect(primaryAction("delivered", "takeout")).toBeNull();
  });

  it("filtros: activos, programados a futuro, entregados y cancelados", () => {
    const later = new Date(NOW.getTime() + 3_600_000);
    const earlier = new Date(NOW.getTime() - 3_600_000);
    expect(matchesFilter({ status: "new", scheduledFor: null }, "activos", NOW)).toBe(true);
    expect(matchesFilter({ status: "new", scheduledFor: later }, "activos", NOW)).toBe(false);
    expect(matchesFilter({ status: "new", scheduledFor: later }, "programados", NOW)).toBe(true);
    // Ya llegó su hora: pasa a activos.
    expect(matchesFilter({ status: "accepted", scheduledFor: earlier }, "activos", NOW)).toBe(true);
    expect(matchesFilter({ status: "delivered", scheduledFor: null }, "entregados", NOW)).toBe(
      true,
    );
    expect(matchesFilter({ status: "cancelled", scheduledFor: null }, "activos", NOW)).toBe(false);
  });

  it("tiempo transcurrido", () => {
    expect(ago(NOW, NOW)).toBe("ahora");
    expect(ago(new Date(NOW.getTime() - 3 * 60_000), NOW)).toBe("hace 3 min");
    expect(ago(new Date(NOW.getTime() - 2 * 3_600_000), NOW)).toBe("hace 2 h");
    expect(ago(new Date(NOW.getTime() - 26 * 3_600_000), NOW)).toBe("hace 1 día");
  });
});
