import { describe, expect, it } from "vitest";
import {
  computeEntitlements,
  hasFeature,
  parseLimits,
  type LicenseInput,
} from "@/features/licensing/entitlements";
import { PLAN_CATALOG } from "@/features/licensing/plan-catalog";

const plan = (id: string) => {
  const p = PLAN_CATALOG.find((x) => x.id === id)!;
  return { id: p.id, limits: p.limits, features: p.features };
};
const freePlan = plan("gratis");
const now = new Date("2026-10-20T12:00:00Z");
const days = (n: number) => new Date(now.getTime() + n * 24 * 60 * 60 * 1000);

const license = (over: Partial<LicenseInput>): LicenseInput => ({
  plan_id: "pro",
  status: "active",
  ends_at: days(10),
  grace_days: 7,
  limit_overrides: null,
  feature_overrides: null,
  ...over,
});

const compute = (l: LicenseInput) =>
  computeEntitlements({ license: l, plan: plan(l.plan_id), freePlan, now });

describe("computeEntitlements", () => {
  it("prueba vigente: todo lo del plan y días restantes", () => {
    const e = compute(license({ status: "trial", ends_at: days(3) }));
    expect(e).toMatchObject({ status: "trial", planId: "pro", daysLeft: 3, menuOnline: true });
    expect(hasFeature(e, "preorders")).toBe(true);
  });

  it("prueba vencida: baja directo a Gratis (sin gracia)", () => {
    const e = compute(license({ status: "trial", ends_at: days(-1) }));
    expect(e).toMatchObject({ status: "free", planId: "gratis", licensedPlanId: "pro" });
    expect(e.limits.branches).toBe(1);
    expect(hasFeature(e, "preorders")).toBe(false);
    expect(e.menuOnline).toBe(true); // el menú sigue vivo con límites de Gratis
  });

  it("activa vencida: gracia con el plan completo durante grace_days", () => {
    const e = compute(license({ status: "active", ends_at: days(-3) }));
    expect(e).toMatchObject({ status: "grace", planId: "pro", daysLeft: 4 });
  });

  it("después de la gracia: Gratis (aunque el cron no haya corrido)", () => {
    expect(compute(license({ status: "active", ends_at: days(-8) })).status).toBe("free");
    expect(compute(license({ status: "grace", ends_at: days(-8) })).status).toBe("free");
  });

  it("suspendida: panel en solo lectura y menú fuera de línea", () => {
    const e = compute(license({ status: "suspended" }));
    expect(e).toMatchObject({
      status: "suspended",
      readOnly: true,
      panelAccess: true,
      menuOnline: false,
    });
  });

  it("cancelada: sin panel ni menú", () => {
    const e = compute(license({ status: "cancelled" }));
    expect(e).toMatchObject({ status: "cancelled", panelAccess: false, menuOnline: false });
  });

  it("plan Gratis no vence", () => {
    const e = compute(license({ plan_id: "gratis", ends_at: days(-400) }));
    expect(e).toMatchObject({ status: "free", planId: "gratis", daysLeft: null });
  });

  it("ajustes del super admin: límites y funciones agregadas o quitadas", () => {
    const e = compute(
      license({
        plan_id: "negocio",
        limit_overrides: { branches: 5, products: null },
        feature_overrides: { add: ["remove_branding"], remove: ["video_bg", "inexistente"] },
      }),
    );
    expect(e.limits.branches).toBe(5);
    expect(e.limits.products).toBeNull();
    expect(hasFeature(e, "remove_branding")).toBe(true);
    expect(hasFeature(e, "video_bg")).toBe(false);
  });

  it("los ajustes no se aplican si la licencia se degradó a Gratis", () => {
    const e = compute(
      license({ status: "trial", ends_at: days(-1), limit_overrides: { branches: 5 } }),
    );
    expect(e.limits.branches).toBe(1);
  });

  it("sin licencia se trata como Gratis", () => {
    const e = computeEntitlements({ license: null, plan: null, freePlan, now });
    expect(e).toMatchObject({ status: "free", planId: "gratis", panelAccess: true });
  });
});

describe("parseLimits", () => {
  it("null es ilimitado; lo inválido o ausente es 0", () => {
    expect(parseLimits({ branches: null, products: -3, menus: "x", qr: 2.7 })).toMatchObject({
      branches: null,
      products: 0,
      menus: 0,
      qr: 2,
      staff: 0,
    });
  });
});
