import { describe, expect, it } from "vitest";
import {
  appearanceAllowance,
  canonicalAppearance,
  DEFAULT_APPEARANCE,
  followPrimary,
  lockedChange,
  type AppearanceDoc,
} from "@/features/appearance/appearance";
import { adjustForContrast, fixPalette, paletteIssues } from "@/features/appearance/contrast";
import { bodyFont, fontStack, headingFont } from "@/features/appearance/fonts";
import { dominantColors, proposePalettes } from "@/features/appearance/logo-palette";
import { PALETTE_PRESETS } from "@/features/appearance/palettes";
import { PLAN_CATALOG } from "@/features/licensing/plan-catalog";
import {
  canvasBackground,
  normalizeTheme,
  presetSurface,
  themeStyle,
} from "@/features/public-menu/theme";
import { contrastRatio, hexToHsl, hslToHex } from "@/lib/color";

const plan = (id: string) => appearanceAllowance(PLAN_CATALOG.find((p) => p.id === id)!.features);
const doc = (over: Partial<AppearanceDoc>): AppearanceDoc => ({ ...DEFAULT_APPEARANCE, ...over });

describe("contraste de la paleta", () => {
  it.each(PALETTE_PRESETS)("la paleta lista $name cumple todas las reglas", (p) => {
    expect(
      paletteIssues({
        primary: p.primary,
        accent: p.accent,
        bg: p.bg,
        surface: presetSurface(p),
        text: p.text,
      }),
    ).toEqual([]);
  });

  it("avisa si el texto no se lee y sugiere un tono que sí cumple", () => {
    const issues = paletteIssues({
      primary: "#D23B22",
      accent: "#F6B73C",
      bg: "#FBF6EE",
      surface: "#FFFFFF",
      text: "#B0A8A0",
    });
    const textBg = issues.find((i) => i.id === "text_bg")!;
    expect(textBg.message).toMatch(/casi no se lee sobre el fondo/);
    expect(contrastRatio(textBg.fix.value, "#FBF6EE")).toBeGreaterThanOrEqual(4.5);
  });

  it("un primario muy claro: botones ilegibles y perdidos en el fondo", () => {
    const ids = paletteIssues({
      primary: "#F6E05E",
      accent: "#F6B73C",
      bg: "#FFFFFF",
      surface: "#FFFFFF",
      text: "#111111",
    }).map((i) => i.id);
    expect(ids).toContain("primary_bg");
  });

  it("la sugerencia conserva el tono y cambia lo mínimo", () => {
    const fixed = adjustForContrast("#F08A5D", "#FFFFFF", 4.5);
    expect(contrastRatio(fixed, "#FFFFFF")).toBeGreaterThanOrEqual(4.5);
    expect(Math.abs(hexToHsl(fixed)[0] - hexToHsl("#F08A5D")[0])).toBeLessThan(6);
    expect(adjustForContrast("#111111", "#FFFFFF", 4.5)).toBe("#111111");
  });

  it("fixPalette deja cualquier paleta sin problemas", () => {
    const fixed = fixPalette({
      primary: "#FFD166",
      accent: "#06D6A0",
      bg: "#FFFFFF",
      surface: "#FFFFFF",
      text: "#999999",
    });
    expect(paletteIssues(fixed)).toEqual([]);
  });

  it("HSL ida y vuelta", () => {
    const [h, s, l] = hexToHsl("#2F7A4A");
    expect(hslToHex(h, s, l)).toBe("#2F7A4A");
  });
});

describe("paletas desde el logo", () => {
  const pixels = (...colors: [number, number, number, number, number][]) =>
    colors.flatMap(([r, g, b, a, n]) => Array.from({ length: n }, () => [r, g, b, a]).flat());

  it("toma los colores de marca e ignora blanco, negro y transparente", () => {
    const rgba = pixels(
      [255, 255, 255, 255, 500], // fondo blanco
      [0, 0, 0, 0, 300], // transparente
      [20, 20, 20, 255, 200], // texto negro
      [210, 59, 34, 255, 150], // rojo de marca
      [246, 183, 60, 255, 60], // amarillo
    );
    const colors = dominantColors(rgba);
    expect(colors).toHaveLength(2);
    expect(contrastRatio(colors[0]!, "#D23B22")).toBeLessThan(1.1);
    expect(contrastRatio(colors[1]!, "#F6B73C")).toBeLessThan(1.1);
  });

  it("agrupa tonos casi iguales (antialias)", () => {
    const rgba = pixels([210, 59, 34, 255, 100], [214, 62, 38, 255, 100]);
    expect(dominantColors(rgba)).toHaveLength(1);
  });

  it("propone 3 paletas que cumplen AA (también con un logo sin color)", () => {
    for (const colors of [["#D23B22", "#F6B73C"], ["#F6E05E"], []]) {
      const proposals = proposePalettes(colors);
      expect(proposals).toHaveLength(3);
      for (const p of proposals) expect(paletteIssues(p)).toEqual([]);
    }
  });
});

describe("fuentes", () => {
  it("valida contra el catálogo", () => {
    expect(headingFont("Fraunces")).toBe("Fraunces");
    expect(headingFont("Comic Sans")).toBe("Bricolage Grotesque");
    expect(bodyFont("Fraunces")).toBe("Inter"); // de títulos, no de texto
    expect(fontStack("Pacifico")).toBe("var(--font-pacifico), cursive");
  });
});

describe("tema del menú", () => {
  it("una paleta lista usa sus colores aunque la base diga otra cosa", () => {
    const t = normalizeTheme({ palette_preset: "mar", color_primary: "#000000" });
    expect(t.primary).toBe("#1F6F8B");
  });

  it("paleta personalizada: solo con la función del plan", () => {
    const raw = { palette_preset: "custom", color_primary: "#123456" };
    expect(normalizeTheme(raw).primary).toBe("#123456");
    expect(
      normalizeTheme(raw, {
        customPalette: false,
        imageBg: false,
        videoBg: false,
        removeBranding: false,
      }).primary,
    ).toBe("#D23B22");
  });

  it("fondo: imagen y video solo con https y con el plan", () => {
    const img = { bg_type: "image", bg_value: "https://x.test/a.webp" };
    expect(normalizeTheme(img).background).toEqual({ type: "image", url: "https://x.test/a.webp" });
    expect(
      normalizeTheme({ bg_type: "image", bg_value: "javascript:alert(1)" }).background,
    ).toEqual({
      type: "color",
    });
    expect(
      normalizeTheme(img, {
        customPalette: true,
        imageBg: false,
        videoBg: true,
        removeBranding: true,
      }).background,
    ).toEqual({ type: "color" });
    expect(normalizeTheme({ bg_type: "gradient", bg_value: "#111111,#222222" }).background).toEqual(
      { type: "gradient", from: "#111111", to: "#222222" },
    );
  });

  it("quitar la marca solo con el plan; el loader y las fuentes se validan", () => {
    const t = normalizeTheme(
      { show_powered_by: false, loader_style: "plato", font_heading: "Fraunces" },
      { customPalette: true, imageBg: true, videoBg: true, removeBranding: false },
    );
    expect(t.showPoweredBy).toBe(true);
    expect(t.loader).toBe("plato");
    expect(themeStyle(t)["--font-display"]).toBe("var(--font-fraunces), ui-serif, Georgia, serif");
    expect(normalizeTheme({ loader_style: "<script>" }).loader).toBe("logo");
  });

  it("el fondo de la página lleva la capa oscura sobre la imagen", () => {
    const t = normalizeTheme({
      bg_type: "image",
      bg_value: "https://x.test/a.webp",
      bg_overlay: 0.5,
    });
    expect(canvasBackground(t)).toContain("rgb(0 0 0 / 0.5)");
    expect(canvasBackground(t)).toContain('url("https://x.test/a.webp")');
  });
});

describe("apariencia guardada", () => {
  it("con paleta lista guarda exactamente sus colores y limpia lo que no aplica", () => {
    const out = canonicalAppearance(
      doc({ palette_preset: "noche", color_primary: "#000000", bg_type: "color", bg_value: "x" }),
    );
    expect(out.color_primary).toBe("#F2A541");
    expect(out.color_surface).toBe("#221D19");
    expect(out.bg_value).toBeNull();
  });

  it("plan Gratis: paletas listas sí; personalizada, imagen, video y bienvenida no", () => {
    const free = plan("gratis");
    const base = DEFAULT_APPEARANCE;
    expect(lockedChange(doc({ palette_preset: "mar" }), base, free)).toBeNull();
    expect(lockedChange(doc({ radius: 8, font_heading: "Fraunces" }), base, free)).toBeNull();
    expect(lockedChange(doc({ palette_preset: "custom" }), base, free)).toMatch(/paleta/);
    expect(
      lockedChange(doc({ bg_type: "image", bg_value: "https://x.test/a.webp" }), base, free),
    ).toMatch(/imagen/);
    expect(lockedChange(doc({ bg_type: "video" }), base, free)).toMatch(/video/);
    expect(lockedChange(doc({ splash_style: "fade" }), base, free)).toMatch(/bienvenida/);
    expect(lockedChange(doc({ show_powered_by: false }), base, free)).toMatch(/Negocio/);
  });

  it("si bajó de plan con algo personalizado, puede seguir cambiando lo demás", () => {
    const saved = doc({ palette_preset: "custom", color_primary: "#123456" });
    expect(lockedChange({ ...saved, radius: 4 }, saved, plan("gratis"))).toBeNull();
  });

  it("Pro personaliza todo menos quitar la marca", () => {
    const pro = plan("pro");
    const next = doc({ palette_preset: "logo", bg_type: "video", splash_style: "zoom" });
    expect(lockedChange(next, DEFAULT_APPEARANCE, pro)).toBeNull();
    expect(lockedChange(doc({ show_powered_by: false }), DEFAULT_APPEARANCE, pro)).toMatch(
      /Negocio/,
    );
  });
});

describe("fondo de la bienvenida", () => {
  it("sigue al color principal mientras no se haya cambiado", () => {
    expect(followPrimary(DEFAULT_APPEARANCE, { color_primary: "#1F6F8B" }, true)).toEqual({
      color_primary: "#1F6F8B",
      splash_bg_value: "#1F6F8B",
    });
  });

  it("no lo toca si el dueño eligió otro color o si su plan no personaliza la bienvenida", () => {
    const custom = doc({ splash_bg_value: "#000000" });
    expect(followPrimary(custom, { color_primary: "#1F6F8B" }, true)).toEqual({
      color_primary: "#1F6F8B",
    });
    expect(followPrimary(DEFAULT_APPEARANCE, { color_primary: "#1F6F8B" }, false)).toEqual({
      color_primary: "#1F6F8B",
    });
  });
});
