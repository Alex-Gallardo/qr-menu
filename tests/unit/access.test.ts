import { describe, expect, it } from "vitest";
import type { Entitlements } from "@/features/licensing/entitlements";
import { checkLimit, limitMessage } from "@/features/licensing/limits";
import { PLAN_CATALOG } from "@/features/licensing/plan-catalog";
import { assertAccess, visibleBranchIds, type Membership } from "@/lib/auth/access";
import { AccessError } from "@/lib/errors";

const ZONA1 = "zona-1-id";
const ANTIGUA = "antigua-id";

const owner: Membership = {
  memberId: "m1",
  businessId: "b",
  role: "owner",
  allBranches: true,
  branchIds: [],
};
const managerAntigua: Membership = {
  memberId: "m2",
  businessId: "b",
  role: "manager",
  allBranches: false,
  branchIds: [ANTIGUA],
};

const ent = (over: Partial<Entitlements> = {}): Entitlements => ({
  planId: "pro",
  licensedPlanId: "pro",
  status: "active",
  limits: PLAN_CATALOG.find((p) => p.id === "pro")!.limits,
  features: PLAN_CATALOG.find((p) => p.id === "pro")!.features,
  readOnly: false,
  panelAccess: true,
  menuOnline: true,
  endsAt: null,
  graceEndsAt: null,
  daysLeft: null,
  ...over,
});

const codeOf = (fn: () => void) => {
  try {
    fn();
    return "ok";
  } catch (e) {
    return e instanceof AccessError ? e.accessCode : "otro";
  }
};

describe("assertAccess", () => {
  it("encargado no ve otra sucursal; sí la suya", () => {
    expect(codeOf(() => assertAccess(managerAntigua, ent(), { branchId: ZONA1 }))).toBe(
      "branch_forbidden",
    );
    expect(codeOf(() => assertAccess(managerAntigua, ent(), { branchId: ANTIGUA }))).toBe("ok");
  });

  it("el dueño ve todas las sucursales", () => {
    expect(codeOf(() => assertAccess(owner, ent(), { branchId: ZONA1 }))).toBe("ok");
    expect(visibleBranchIds(managerAntigua, [ZONA1, ANTIGUA])).toEqual([ANTIGUA]);
    expect(visibleBranchIds(owner, [ZONA1, ANTIGUA])).toEqual([ZONA1, ANTIGUA]);
  });

  it("sin membresía no hay acceso", () => {
    expect(codeOf(() => assertAccess(null, ent()))).toBe("forbidden");
  });

  it("opciones solo del dueño", () => {
    expect(codeOf(() => assertAccess(managerAntigua, ent(), { roles: ["owner"] }))).toBe(
      "role_forbidden",
    );
    expect(codeOf(() => assertAccess(owner, ent(), { roles: ["owner"] }))).toBe("ok");
  });

  it("funciones según la licencia", () => {
    expect(codeOf(() => assertAccess(owner, ent(), { feature: "preorders" }))).toBe("ok");
    expect(codeOf(() => assertAccess(owner, ent({ features: [] }), { feature: "preorders" }))).toBe(
      "feature_unavailable",
    );
  });

  it("suspendida: se puede ver pero no escribir", () => {
    expect(codeOf(() => assertAccess(owner, ent({ readOnly: true })))).toBe("ok");
    expect(codeOf(() => assertAccess(owner, ent({ readOnly: true }), { write: true }))).toBe(
      "read_only",
    );
  });

  it("cancelada: sin acceso al panel", () => {
    expect(codeOf(() => assertAccess(owner, ent({ panelAccess: false })))).toBe("license_inactive");
  });

  it("los mensajes son para el usuario (sin jerga)", () => {
    try {
      assertAccess(owner, ent({ features: [] }), { feature: "preorders" });
    } catch (e) {
      expect((e as AccessError).userMessage).toBe(
        "Tu plan no incluye los pedidos fuera de horario. Mejora tu plan para usarlo.",
      );
    }
  });
});

describe("checkLimit", () => {
  const gratis = PLAN_CATALOG.find((p) => p.id === "gratis")!.limits;
  const pro = PLAN_CATALOG.find((p) => p.id === "pro")!.limits;

  it("Gratis no crea una 2.ª sucursal (y sugiere Negocio)", () => {
    expect(checkLimit(gratis, "branches", 0).ok).toBe(true);
    const r = checkLimit(gratis, "branches", 1);
    expect(r).toMatchObject({ ok: false, limit: 1 });
    expect(!r.ok && r.message).toBe("Tu plan incluye 1 sucursal. Pasa a Negocio para agregar más.");
  });

  it("Gratis permite 25 productos; el 26 sugiere Pro", () => {
    expect(checkLimit(gratis, "products", 24).ok).toBe(true);
    const r = checkLimit(gratis, "products", 25);
    expect(!r.ok && r.message).toBe("Tu plan incluye 25 productos. Pasa a Pro para agregar más.");
  });

  it("null es ilimitado", () => {
    expect(checkLimit(pro, "products", 10_000).ok).toBe(true);
  });

  it("límite 0 y sin plan que lo cubra", () => {
    expect(limitMessage("managers", 0, 1)).toBe(
      "Tu plan no incluye encargados. Pasa a Pro para agregar más.",
    );
    expect(limitMessage("branches", 3, 4)).toBe(
      "Tu plan incluye 3 sucursales. Escríbenos para ampliarlo.",
    );
  });

  it("agregar varios a la vez", () => {
    expect(checkLimit(gratis, "qr", 0, 2).ok).toBe(false);
  });
});
