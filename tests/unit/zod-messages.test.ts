import { describe, expect, it } from "vitest";
import * as admin from "@/features/admin/schemas";
import * as analytics from "@/features/analytics/schemas";
import * as appearance from "@/features/appearance/schemas";
import * as auth from "@/features/auth/schemas";
import * as billing from "@/features/billing/schemas";
import * as branches from "@/features/branches/schemas";
import * as businesses from "@/features/businesses/schemas";
import * as menus from "@/features/menus/schemas";
import * as onboarding from "@/features/onboarding/schemas";
import * as orders from "@/features/orders/schemas";
import * as payments from "@/features/payments/schemas";
import * as products from "@/features/products/schemas";
import * as qr from "@/features/qr/schemas";
import * as reviews from "@/features/reviews/schemas";
import * as schedule from "@/features/schedule/schemas";
import * as team from "@/features/team/schemas";
import { INVALID_DATA, STALE_REFERENCE, validationError, z } from "@/lib/zod";

/** Mensajes de validación en español, sin jerga (guía §1). */

const message = (schema: z.ZodType, input: unknown) => {
  const parsed = schema.safeParse(input);
  if (parsed.success) throw new Error("se esperaba un error");
  return validationError(parsed.error).message;
};

describe("mapa de errores de lib/zod", () => {
  it("ids inválidos: algo quedó desactualizado, no 'Invalid UUID'", () => {
    expect(message(z.uuid(), "demo")).toBe(STALE_REFERENCE);
    expect(message(z.object({ businessId: z.uuid() }), { businessId: "x" })).toBe(STALE_REFERENCE);
  });
  it("faltantes, tipos, textos, listas, números y opciones", () => {
    expect(message(z.object({ name: z.string() }), {})).toBe("Completa los datos que faltan.");
    expect(message(z.string(), 12)).toBe(INVALID_DATA);
    expect(message(z.string().min(1), "")).toBe("Completa este dato.");
    expect(message(z.string().min(3), "a")).toBe("Escribe al menos 3 caracteres.");
    expect(message(z.string().max(1), "ab")).toBe("Usa como máximo 1 carácter.");
    expect(message(z.string().max(80), "a".repeat(81))).toBe("Usa como máximo 80 caracteres.");
    expect(message(z.array(z.string()).min(1), [])).toBe("Elige al menos una opción.");
    expect(message(z.array(z.string()).max(2), ["a", "b", "c"])).toBe("Elige como máximo 2.");
    expect(message(z.number().int().min(0), -1)).toBe("Debe ser al menos 0.");
    expect(message(z.number().positive(), 0)).toBe("Debe ser mayor que 0.");
    expect(message(z.number().max(10), 11)).toBe("Debe ser como máximo 10.");
    expect(message(z.enum(["a", "b"]), "c")).toBe("Elige una de las opciones.");
    expect(message(z.email(), "cafe@")).toBe("Ese correo no parece válido.");
    expect(message(z.url(), "no es link")).toBe("Ese link no parece válido.");
    expect(
      message(
        z.string().refine(() => false),
        "x",
      ),
    ).toBe(INVALID_DATA);
  });
  it("el mensaje propio del esquema gana", () => {
    expect(message(z.string().min(1, "Escribe tu nombre."), "")).toBe("Escribe tu nombre.");
    expect(message(z.uuid({ error: "Esa sucursal no es válida." }), "x")).toBe(
      "Esa sucursal no es válida.",
    );
  });
});

// Barrido: cada esquema real con entradas basura no debe responder en inglés.
const ENGLISH = /\b(invalid|expected|received|too (small|big)|required|must|string|number|uuid)\b/i;
const MODULES = {
  admin,
  analytics,
  appearance,
  auth,
  billing,
  branches,
  businesses,
  menus,
  onboarding,
  orders,
  payments,
  products,
  qr,
  reviews,
  schedule,
  team,
};
const GARBAGE: unknown[] = [
  undefined,
  null,
  {},
  "x",
  42,
  [],
  { businessId: "demo", branchId: "demo", id: "demo", name: "", email: "x@" },
];

describe("esquemas reales", () => {
  const schemas = Object.entries(MODULES).flatMap(([mod, exports]) =>
    Object.entries(exports)
      .filter(([, v]) => v instanceof z.ZodType)
      .map(([name, schema]) => [`${mod}.${name}`, schema as z.ZodType] as const),
  );

  it("hay esquemas que revisar", () => {
    expect(schemas.length).toBeGreaterThan(30);
  });

  it.each(schemas)("%s responde en español", (_, schema) => {
    for (const input of GARBAGE) {
      const parsed = schema.safeParse(input);
      if (parsed.success) continue;
      for (const issue of parsed.error.issues) expect(issue.message).not.toMatch(ENGLISH);
    }
  });
});
