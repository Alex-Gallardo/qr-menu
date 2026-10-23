import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";
import { menuAppIcon } from "@/features/public-menu/app-icon";
import {
  branchManifest,
  iconCanUseLogo,
  installOffer,
  isInAppBrowser,
  menuAppPaths,
  shortAppName,
} from "@/features/public-menu/pwa";

// pngjs viene con qrcode: sirve para leer el PNG generado.
const require = createRequire(import.meta.url);
const { PNG } = require(require.resolve("pngjs", { paths: [require.resolve("qrcode")] })) as {
  PNG: { sync: { read: (b: Buffer) => { width: number; height: number; data: Buffer } } };
};

const base = {
  business: { name: "Café El Portal", slug: "cafe-el-portal", description: null },
  branch: { name: "Zona 1", slug: "zona-1" },
  multiBranch: false,
  theme: { primary: "#D23B22", bg: "#FBF6EE" },
};

describe("app del menú", () => {
  it("rutas de la sucursal", () => {
    const p = menuAppPaths("cafe-el-portal", "zona-1");
    expect(p.manifest).toBe("/cafe-el-portal/zona-1/manifest.webmanifest");
    expect(p.icon("maskable")).toBe("/cafe-el-portal/zona-1/app-icon/maskable");
    expect(p.start).toBe("/cafe-el-portal/zona-1?source=pwa");
    expect(p.scope).toBe("/cafe-el-portal/");
  });

  it("manifiesto con el nombre, los colores y los íconos del negocio", () => {
    const m = branchManifest(base);
    expect(m).toMatchObject({
      id: "/cafe-el-portal/zona-1",
      name: "Café El Portal",
      short_name: "Café El",
      start_url: "/cafe-el-portal/zona-1?source=pwa",
      scope: "/cafe-el-portal/",
      display: "standalone",
      theme_color: "#D23B22",
      background_color: "#FBF6EE",
    });
    expect(m.icons?.map((i) => [i.sizes, i.purpose])).toEqual([
      ["192x192", "any"],
      ["512x512", "any"],
      ["512x512", "maskable"],
    ]);
    // Con varias sucursales se puede instalar cada una: el nombre dice cuál.
    expect(branchManifest({ ...base, multiBranch: true }).name).toBe("Café El Portal · Zona 1");
  });

  it("nombre corto de hasta 12 caracteres sin cortar palabras", () => {
    expect(shortAppName("Tacos Don Pepe Gourmet")).toBe("Tacos Don");
    expect(shortAppName("  Pupusería  ")).toBe("Pupusería");
    expect(shortAppName("Supercalifragilístico")).toBe("Supercalifra");
  });

  it("solo los logos PNG o JPEG van en el ícono (next/og no dibuja WebP)", () => {
    expect(iconCanUseLogo("https://x.test/logos/a.png")).toBe(true);
    expect(iconCanUseLogo("https://x.test/logos/a.jpg?v=2")).toBe(true);
    expect(iconCanUseLogo("https://x.test/logos/a.webp")).toBe(false);
    expect(iconCanUseLogo(null)).toBe(false);
  });

  it("cuándo ofrecer instalar", () => {
    const c = {
      standalone: false,
      isIOS: false,
      inAppBrowser: false,
      hasPrompt: false,
      dismissed: false,
    };
    expect(installOffer({ ...c, hasPrompt: true })).toBe("prompt");
    expect(installOffer({ ...c, isIOS: true })).toBe("ios");
    expect(installOffer(c)).toBeNull(); // el navegador no dejó instalar
    expect(installOffer({ ...c, hasPrompt: true, standalone: true })).toBeNull();
    expect(installOffer({ ...c, isIOS: true, dismissed: true })).toBeNull();
    expect(installOffer({ ...c, isIOS: true, inAppBrowser: true })).toBeNull();
    expect(isInAppBrowser("Mozilla/5.0 (iPhone) Instagram 300.0")).toBe(true);
    expect(isInAppBrowser("Mozilla/5.0 (iPhone) Version/17.5 Safari/604.1")).toBe(false);
  });

  it("ícono sin logo: la inicial sobre el color principal, en el tamaño pedido", async () => {
    const brand = { name: "Café El Portal", logoUrl: null, primary: "#D23B22", bg: "#FBF6EE" };
    for (const [variant, size] of [
      ["192", 192],
      ["512", 512],
      ["apple", 180],
    ] as const) {
      const png = PNG.sync.read(Buffer.from(await menuAppIcon(variant, brand).arrayBuffer()));
      expect([png.width, png.height]).toEqual([size, size]);
      // Esquina: color principal sin transparencia (iPhone no acepta íconos transparentes).
      expect([...png.data.subarray(0, 4)]).toEqual([0xd2, 0x3b, 0x22, 255]);
    }
  });
});
