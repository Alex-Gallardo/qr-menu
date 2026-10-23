import { describe, expect, it } from "vitest";
import { ROBOTS_DISALLOW, sitemapEntries } from "@/features/public-menu/seo";
import { SECURITY_HEADERS } from "@/lib/security-headers";

const BASE = "https://qr-menu.app";
const DATE = new Date("2026-10-22T12:00:00Z");

describe("sitemap.xml", () => {
  it("landing, selector de negocios con varias sucursales y cada sucursal", () => {
    const urls = sitemapEntries(BASE, [
      {
        slug: "cafe-el-portal",
        updatedAt: DATE,
        branches: [{ slug: "zona-1" }, { slug: "antigua" }],
      },
      { slug: "tacos-don-pepe", updatedAt: DATE, branches: [{ slug: "centro" }] },
      { slug: "sin-sucursales", updatedAt: DATE, branches: [] },
    ]).map((e) => e.url);
    expect(urls).toEqual([
      "https://qr-menu.app/",
      "https://qr-menu.app/cafe-el-portal",
      "https://qr-menu.app/cafe-el-portal/zona-1",
      "https://qr-menu.app/cafe-el-portal/antigua",
      // Una sola sucursal: /{negocio} muestra lo mismo con canónica a la sucursal.
      "https://qr-menu.app/tacos-don-pepe/centro",
    ]);
  });
});

describe("robots.txt", () => {
  it("bloquea panel, staff, cuenta y confirmaciones de pedido; no los menús", () => {
    for (const path of [
      "/panel",
      "/staff",
      "/admin",
      "/api",
      "/entrar",
      "/styleguide",
      "/*/*/pedido/",
    ])
      expect(ROBOTS_DISALLOW).toContain(path);
    expect(ROBOTS_DISALLOW.some((p) => p === "/" || p.startsWith("/cafe"))).toBe(false);
  });
});

describe("encabezados de seguridad", () => {
  const header = (key: string) => SECURITY_HEADERS.find((h) => h.key === key)?.value;

  it("ningún otro sitio puede meter la app en un iframe (la propia app sí)", () => {
    expect(header("X-Frame-Options")).toBe("SAMEORIGIN");
    expect(header("Content-Security-Policy")).toBe("frame-ancestors 'self'");
  });

  it("ubicación solo para la app (pedido a domicilio); sin cámara ni micrófono", () => {
    expect(header("Permissions-Policy")).toContain("geolocation=(self)");
    expect(header("Permissions-Policy")).toContain("camera=()");
    expect(header("X-Content-Type-Options")).toBe("nosniff");
    expect(header("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });
});
