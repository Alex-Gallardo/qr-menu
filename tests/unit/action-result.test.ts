import { describe, expect, it } from "vitest";
import { actionError } from "@/lib/action-result";
import { AccessError, LimitExceededError } from "@/lib/errors";

describe("actionError", () => {
  it("convierte errores de la app en mensajes para el usuario", () => {
    expect(
      actionError(new AccessError("branch_forbidden", "No tienes acceso a esa sucursal.")),
    ).toEqual({
      ok: false,
      message: "No tienes acceso a esa sucursal.",
    });
    expect(
      actionError(new LimitExceededError("branches", 1, "Tu plan incluye 1 sucursal.")),
    ).toEqual({
      ok: false,
      message: "Tu plan incluye 1 sucursal.",
    });
  });

  it("relanza los errores inesperados (para que lleguen a Sentry)", () => {
    expect(() => actionError(new Error("boom"))).toThrow("boom");
  });
});
