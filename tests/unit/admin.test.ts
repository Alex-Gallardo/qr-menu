import { describe, expect, it } from "vitest";
import {
  announcementApplies,
  featureChoicesFrom,
  featureOverrides,
  limitOverridesToForm,
  mrrCents,
  parseAudience,
  parseLimitOverrides,
  parseSlugList,
} from "@/features/admin/admin";
import { ADMIN_NAV, can } from "@/features/admin/permissions";
import { idsOverLimit, nextTransition, reminderDue } from "@/features/licensing/lifecycle";

/** QRM-042: super admin y ciclo de vida de licencias. */

const DAY = 24 * 60 * 60 * 1000;
const now = new Date("2026-10-24T12:00:00Z");
const lic = (
  status: "trial" | "active" | "grace" | "suspended",
  endsInDays: number,
  plan = "pro",
) => ({
  plan_id: plan,
  status,
  ends_at: new Date(now.getTime() + endsInDays * DAY),
  grace_days: 7,
});

describe("ciclo de vida (criterio: vencida → gracia → Gratis)", () => {
  it("activa vencida pasa a gracia", () => {
    expect(nextTransition(lic("active", -0.1), now)).toEqual({ kind: "grace", status: "grace" });
    expect(nextTransition(lic("active", 1), now)).toBeNull();
  });
  it("gracia sin pago al final pasa a Gratis; antes, no", () => {
    expect(nextTransition(lic("grace", -6), now)).toBeNull();
    expect(nextTransition(lic("grace", -7.1), now)).toEqual({
      kind: "downgraded",
      status: "active",
      plan_id: "gratis",
      from: "pro",
    });
  });
  it("la prueba vencida pasa directo a Gratis (sin gracia)", () => {
    expect(nextTransition(lic("trial", -0.1, "negocio"), now)).toMatchObject({
      kind: "downgraded",
      from: "negocio",
    });
  });
  it("Gratis, suspendida o vigente: nada", () => {
    expect(nextTransition(lic("active", -30, "gratis"), now)).toBeNull();
    expect(nextTransition(lic("suspended", -30), now)).toBeNull();
    expect(nextTransition(lic("trial", 3), now)).toBeNull();
  });

  it("recordatorios a los 7, 3 y 1 día, una sola vez cada uno", () => {
    expect(reminderDue(lic("active", 10), [], now)).toBeNull();
    expect(reminderDue(lic("active", 6.5), [], now)).toBe(7);
    expect(reminderDue(lic("active", 6.5), [7], now)).toBeNull();
    expect(reminderDue(lic("trial", 2.5), [7], now)).toBe(3);
    // Si un día falló el cron, no se manda el de 7 tarde: el que toca.
    expect(reminderDue(lic("trial", 0.5), [], now)).toBe(1);
    expect(reminderDue(lic("grace", 0.5), [], now)).toBeNull();
    expect(reminderDue(lic("active", 0.5, "gratis"), [], now)).toBeNull();
  });

  it("al bajar se conservan los primeros y se ocultan los demás", () => {
    expect(idsOverLimit(["a", "b", "c"], 1)).toEqual(["b", "c"]);
    expect(idsOverLimit(["a", "b"], 0)).toEqual(["a", "b"]);
    expect(idsOverLimit(["a", "b"], null)).toEqual([]);
  });
});

describe("permisos de la plataforma", () => {
  it("admin todo; soporte entra y ve auditoría; ventas crea negocios", () => {
    expect(can("admin", "payments.verify")).toBe(true);
    expect(can("support", "businesses.impersonate")).toBe(true);
    expect(can("support", "payments.verify")).toBe(false);
    expect(can("sales", "businesses.create")).toBe(true);
    expect(can("sales", "audit.view")).toBe(false);
    expect(can("none", "businesses.view")).toBe(false);
    expect(can(null, "businesses.view")).toBe(false);
  });
  it("la navegación de soporte no muestra pagos ni configuración", () => {
    expect(ADMIN_NAV.filter((i) => can("support", i.permission)).map((i) => i.label)).toEqual([
      "Tablero",
      "Negocios",
      "Auditoría",
    ]);
  });
});

describe("licencias a la medida", () => {
  it("MRR: solo activas pagadas, con precio especial", () => {
    expect(
      mrrCents([
        { status: "active", plan_id: "pro", price_gtq: 149, price_override_gtq: null },
        { status: "active", plan_id: "pro", price_gtq: 149, price_override_gtq: 99 },
        { status: "trial", plan_id: "negocio", price_gtq: 299, price_override_gtq: null },
        { status: "active", plan_id: "gratis", price_gtq: 0, price_override_gtq: null },
      ]),
    ).toBe(24_800);
  });
  it("límites: vacío = plan, ∞ = ilimitado, número = ese; ida y vuelta", () => {
    const out = parseLimitOverrides({ branches: "5", products: "∞", menus: "" });
    expect(out).toEqual({ branches: 5, products: null });
    expect(limitOverridesToForm(out)).toMatchObject({ branches: "5", products: "∞", menus: "" });
    expect(parseLimitOverrides({})).toBeNull();
    expect(() => parseLimitOverrides({ qr: "muchos" })).toThrow();
  });
  it("funciones: del plan, sí o no ↔ {add, remove}", () => {
    const o = featureOverrides({ remove_branding: "on", staff_pin: "off", video_bg: "plan" });
    expect(o).toEqual({ add: ["remove_branding"], remove: ["staff_pin"] });
    expect(featureChoicesFrom(o)).toMatchObject({
      remove_branding: "on",
      staff_pin: "off",
      video_bg: "plan",
    });
    expect(featureOverrides({})).toBeNull();
  });
});

describe("anuncios y configuración", () => {
  const base = { starts_at: new Date(now.getTime() - DAY), ends_at: null, is_active: true };
  const biz = { id: "6f1c2b9e-3a4d-4e5f-8a7b-1c2d3e4f5a6b", planId: "pro" };
  it("audiencia: todos, un plan o un negocio; fechas y activo", () => {
    expect(parseAudience("all")).toEqual({ kind: "all" });
    expect(parseAudience("plan:pro")).toEqual({ kind: "plan", planId: "pro" });
    expect(parseAudience("cualquiera")).toBeNull();
    expect(announcementApplies({ ...base, audience: "all" }, biz, now)).toBe(true);
    expect(announcementApplies({ ...base, audience: "plan:negocio" }, biz, now)).toBe(false);
    expect(announcementApplies({ ...base, audience: `business:${biz.id}` }, biz, now)).toBe(true);
    expect(announcementApplies({ ...base, audience: "all", is_active: false }, biz, now)).toBe(
      false,
    );
    expect(
      announcementApplies(
        { ...base, audience: "all", ends_at: new Date(now.getTime() - 1) },
        biz,
        now,
      ),
    ).toBe(false);
  });
  it("links reservados: minúsculas, sin repetidos ni basura", () => {
    expect(parseSlugList("Promo, promo\nnavidad  x!y")).toEqual(["promo", "navidad"]);
  });
});
