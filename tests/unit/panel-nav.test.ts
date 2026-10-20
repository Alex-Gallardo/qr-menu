import { describe, expect, it } from "vitest";
import { resolveBranchSelection } from "@/features/panel/branch-selection";
import { isActive, MOBILE_TABS, navForRole, panelHref } from "@/features/panel/nav";

const B = "biz";
const segments = (role: "owner" | "manager") =>
  navForRole(role).flatMap((g) => g.items.map((i) => i.segment));

describe("navegación del panel", () => {
  it("el dueño ve todas las secciones", () => {
    expect(segments("owner")).toEqual(
      expect.arrayContaining([
        "apariencia",
        "ajustes/pagos",
        "ajustes/licencia",
        "ajustes/negocio",
      ]),
    );
  });

  it("el encargado no ve lo que es solo del dueño", () => {
    const s = segments("manager");
    expect(s).not.toContain("apariencia");
    expect(s).not.toContain("ajustes/pagos");
    expect(s).not.toContain("ajustes/licencia");
    expect(s).toEqual(expect.arrayContaining(["pedidos", "productos", "equipo", "sucursales"]));
  });

  it("las pestañas móviles son Pedidos, Menú, Inicio y Más", () => {
    expect(MOBILE_TABS.map((t) => t.label)).toEqual(["Pedidos", "Menú", "Inicio", "Más"]);
  });

  it("Inicio solo se activa en la raíz; las secciones también en subrutas", () => {
    expect(isActive(`/panel/${B}`, B, "")).toBe(true);
    expect(isActive(`/panel/${B}/pedidos`, B, "")).toBe(false);
    expect(isActive(`/panel/${B}/pedidos/123`, B, "pedidos")).toBe(true);
    expect(isActive(`/panel/${B}/pedidosx`, B, "pedidos")).toBe(false);
  });

  it("'Más' se activa en lo que no tiene pestaña propia", () => {
    expect(isActive(`/panel/${B}/mas`, B, "mas")).toBe(true);
    expect(isActive(`/panel/${B}/ajustes/licencia`, B, "mas")).toBe(true);
    expect(isActive(`/panel/${B}/productos`, B, "mas")).toBe(false);
    expect(isActive(`/panel/${B}`, B, "mas")).toBe(false);
  });

  it("arma los links del panel", () => {
    expect(panelHref(B, "")).toBe(`/panel/${B}`);
    expect(panelHref(B, "ajustes/pagos")).toBe(`/panel/${B}/ajustes/pagos`);
  });
});

describe("resolveBranchSelection", () => {
  const two = ["zona1", "antigua"];

  it("el dueño con varias sucursales ve 'Todas' por defecto", () => {
    expect(resolveBranchSelection({ role: "owner", visibleBranchIds: two, saved: undefined })).toBe(
      "all",
    );
  });

  it("respeta la sucursal guardada si la puede ver", () => {
    expect(resolveBranchSelection({ role: "owner", visibleBranchIds: two, saved: "antigua" })).toBe(
      "antigua",
    );
  });

  it("el encargado nunca ve 'Todas' ni sucursales ajenas", () => {
    expect(
      resolveBranchSelection({ role: "manager", visibleBranchIds: ["antigua"], saved: "all" }),
    ).toBe("antigua");
    expect(
      resolveBranchSelection({ role: "manager", visibleBranchIds: ["antigua"], saved: "zona1" }),
    ).toBe("antigua");
  });

  it("con una sola sucursal no hay 'Todas'", () => {
    expect(
      resolveBranchSelection({ role: "owner", visibleBranchIds: ["unica"], saved: "all" }),
    ).toBe("unica");
  });

  it("sin sucursales visibles devuelve null", () => {
    expect(
      resolveBranchSelection({ role: "manager", visibleBranchIds: [], saved: undefined }),
    ).toBeNull();
  });
});
