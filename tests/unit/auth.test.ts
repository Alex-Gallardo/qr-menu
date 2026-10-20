import { describe, expect, it } from "vitest";
import { authErrorMessage, GENERIC_AUTH_ERROR } from "@/features/auth/errors";
import { newPasswordSchema, signInSchema, signUpSchema, totpSchema } from "@/features/auth/schemas";
import { parseMaintenance } from "@/lib/platform/maintenance";

describe("esquemas de auth", () => {
  it("normaliza el correo (espacios y mayúsculas)", () => {
    const r = signInSchema.parse({ email: "  Duenio@QRMenu.TEST ", password: "x" });
    expect(r.email).toBe("duenio@qrmenu.test");
  });

  it("rechaza correos inválidos con mensaje en español", () => {
    const r = signInSchema.safeParse({ email: "no-es-correo", password: "x" });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe("Ese correo no parece válido.");
  });

  it("registro exige nombre y contraseña de 8+ caracteres", () => {
    expect(
      signUpSchema.safeParse({ fullName: "A", email: "a@b.co", password: "12345678" }).success,
    ).toBe(false);
    expect(
      signUpSchema.safeParse({ fullName: "Ana", email: "a@b.co", password: "1234567" }).success,
    ).toBe(false);
    expect(
      signUpSchema.safeParse({ fullName: "Ana", email: "a@b.co", password: "12345678" }).success,
    ).toBe(true);
  });

  it("la nueva contraseña debe coincidir con la confirmación", () => {
    const r = newPasswordSchema.safeParse({ password: "12345678", confirm: "87654321" });
    expect(r.error?.issues[0]?.path).toEqual(["confirm"]);
  });

  it("el código 2FA son exactamente 6 dígitos", () => {
    expect(totpSchema.safeParse({ factorId: "f", code: "123456" }).success).toBe(true);
    expect(totpSchema.safeParse({ factorId: "f", code: "12345" }).success).toBe(false);
    expect(totpSchema.safeParse({ factorId: "f", code: "12a456" }).success).toBe(false);
  });
});

describe("mensajes de error", () => {
  it("traduce códigos conocidos de Supabase", () => {
    expect(authErrorMessage({ code: "invalid_credentials" })).toMatch(/no coinciden/);
    expect(authErrorMessage({ code: "mfa_verification_failed" })).toMatch(/código no es válido/);
  });

  it("usa un mensaje genérico amable para lo desconocido (sin detalles técnicos)", () => {
    expect(authErrorMessage({ code: "unexpected_failure", message: "stack trace" })).toBe(
      GENERIC_AUTH_ERROR,
    );
    expect(authErrorMessage(null)).toBe(GENERIC_AUTH_ERROR);
  });
});

describe("parseMaintenance", () => {
  it("solo se activa con enabled === true", () => {
    expect(parseMaintenance({ enabled: true, message: "Volvemos" })).toEqual({
      enabled: true,
      message: "Volvemos",
    });
    expect(parseMaintenance({ enabled: "true" }).enabled).toBe(false);
    expect(parseMaintenance(null)).toEqual({ enabled: false, message: "" });
  });
});
