import { describe, expect, it } from "vitest";
import { decideRoute, safeNext, type RouteContext } from "@/lib/auth/route-rules";

const base: RouteContext = {
  pathname: "/",
  search: "",
  isUser: false,
  isStaffSession: false,
  hasStaffDevice: false,
  maintenance: false,
  isServerAction: false,
};
const ctx = (over: Partial<RouteContext>) => ({ ...base, ...over });

describe("decideRoute", () => {
  it.each(["/panel", "/panel/abc/pedidos", "/onboarding", "/admin", "/admin/pagos"])(
    "sin sesión, %s redirige a /entrar con next",
    (pathname) => {
      expect(decideRoute(ctx({ pathname, search: "?x=1" }))).toEqual({
        type: "redirect",
        to: `/entrar?next=${encodeURIComponent(`${pathname}?x=1`)}`,
      });
    },
  );

  it.each(["/panel/abc/menus/x", "/staff/pedidos", "/entrar"])(
    "una Server Action en %s nunca se redirige (la acción valida la sesión)",
    (pathname) => {
      expect(decideRoute(ctx({ pathname, isServerAction: true }))).toEqual({ type: "next" });
      expect(decideRoute(ctx({ pathname, isServerAction: true, isUser: true }))).toEqual({
        type: "next",
      });
    },
  );

  it("en mantenimiento una Server Action también se detiene", () => {
    expect(
      decideRoute(ctx({ pathname: "/panel/abc", isServerAction: true, maintenance: true })),
    ).toEqual({ type: "maintenance" });
  });

  it("con sesión deja pasar al panel", () => {
    expect(decideRoute(ctx({ pathname: "/panel", isUser: true }))).toEqual({ type: "next" });
  });

  it("una sesión anónima de staff no entra al panel", () => {
    expect(decideRoute(ctx({ pathname: "/panel", isStaffSession: true })).type).toBe("redirect");
  });

  it("no confunde prefijos parecidos (/paneles es público)", () => {
    expect(decideRoute(ctx({ pathname: "/paneles" }))).toEqual({ type: "next" });
  });

  it("el menú público no requiere sesión", () => {
    expect(decideRoute(ctx({ pathname: "/cafe-el-portal/zona-1" }))).toEqual({ type: "next" });
  });

  it("/staff sin dispositivo ni sesión redirige; con dispositivo autorizado pasa", () => {
    expect(decideRoute(ctx({ pathname: "/staff" })).type).toBe("redirect");
    expect(decideRoute(ctx({ pathname: "/staff", hasStaffDevice: true }))).toEqual({
      type: "next",
    });
    expect(decideRoute(ctx({ pathname: "/staff/pedidos", isStaffSession: true }))).toEqual({
      type: "next",
    });
    expect(decideRoute(ctx({ pathname: "/staff", isUser: true }))).toEqual({ type: "next" });
  });

  it("con sesión, /entrar y /registro llevan a next o al panel", () => {
    expect(decideRoute(ctx({ pathname: "/entrar", isUser: true }))).toEqual({
      type: "redirect",
      to: "/panel",
    });
    expect(
      decideRoute(ctx({ pathname: "/entrar", search: "?next=%2Fadmin", isUser: true })),
    ).toEqual({ type: "redirect", to: "/admin" });
  });

  it("con sesión, /entrar/2fa sigue accesible (verificación del admin)", () => {
    expect(decideRoute(ctx({ pathname: "/entrar/2fa", isUser: true }))).toEqual({ type: "next" });
  });

  describe("mantenimiento", () => {
    it.each(["/", "/cafe-el-portal", "/panel", "/staff", "/registro"])("bloquea %s", (pathname) => {
      expect(decideRoute(ctx({ pathname, maintenance: true, isUser: true }))).toEqual({
        type: "maintenance",
      });
    });

    it.each(["/admin", "/entrar", "/auth/callback", "/mantenimiento", "/api/monitoring"])(
      "deja pasar %s",
      (pathname) => {
        expect(decideRoute(ctx({ pathname, maintenance: true, isUser: true })).type).not.toBe(
          "maintenance",
        );
      },
    );
  });
});

describe("safeNext", () => {
  it("acepta rutas internas", () => {
    expect(safeNext("/panel/abc?tab=1")).toBe("/panel/abc?tab=1");
  });

  it.each([null, "", "https://evil.com", "//evil.com", "/\\evil.com", "panel"])(
    "rechaza %s",
    (value) => {
      expect(safeNext(value)).toBe("/panel");
    },
  );
});
