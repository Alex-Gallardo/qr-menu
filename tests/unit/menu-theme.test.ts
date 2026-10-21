import { describe, expect, it } from "vitest";
import { normalizeTheme, themeFromPreset, themeStyle } from "@/features/public-menu/theme";
import { blurhashToDataUrl } from "@/lib/images/blurhash-url";

describe("tema del menú", () => {
  it("sin tema usa la paleta Tomate", () => {
    expect(normalizeTheme(null)).toMatchObject({
      primary: "#D23B22",
      bg: "#FBF6EE",
      radius: 16,
      showPoweredBy: true,
    });
  });

  it("descarta colores que no son #RRGGBB (no se puede inyectar CSS)", () => {
    const t = normalizeTheme({
      color_primary: "red;}body{display:none",
      color_bg: "#123456",
      radius: 99,
    });
    expect(t.primary).toBe("#D23B22");
    expect(t.bg).toBe("#123456");
    expect(t.radius).toBe(28);
  });

  it("variables CSS con texto legible sobre el primario", () => {
    const style = themeStyle(themeFromPreset("noche"));
    expect(style["--menu-bg"]).toBe("#15120F");
    expect(style["--menu-on-primary"]?.toUpperCase()).toBe("#231A17"); // texto oscuro sobre ámbar
    expect(themeStyle(themeFromPreset("tomate"))["--menu-on-primary"]?.toUpperCase()).toBe(
      "#FFFFFF",
    );
    expect(style["--menu-radius"]).toBe("16px");
  });
});

describe("blurhash a imagen diminuta", () => {
  it("genera un BMP de 8×6 en data URL", () => {
    const url = blurhashToDataUrl("LEHV6nWB2yk8pyo0adR*.7kCMdnj")!;
    expect(url.startsWith("data:image/bmp;base64,Qk")).toBe(true);
    const bytes = Buffer.from(url.split(",")[1]!, "base64");
    expect(bytes.readInt32LE(18)).toBe(8);
    expect(bytes.readInt32LE(22)).toBe(-6);
    expect(bytes.length).toBe(54 + 24 * 6);
    expect(url.length).toBeLessThan(300);
  });

  it("sin blurhash o inválido: null", () => {
    expect(blurhashToDataUrl(null)).toBeNull();
    expect(blurhashToDataUrl("no-es-blurhash")).toBeNull();
  });
});
