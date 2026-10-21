import { describe, expect, it } from "vitest";
import {
  normalizeSplash,
  springEasing,
  splashTiming,
  splashVars,
  SPLASH_EASINGS,
} from "@/features/public-menu/splash";
import { themeFromPreset } from "@/features/public-menu/theme";

const theme = themeFromPreset("aguacate");

describe("normalizeSplash", () => {
  it("sin datos: la estándar con el color primario del negocio", () => {
    expect(normalizeSplash(null, theme, true)).toMatchObject({
      style: "lift",
      background: { type: "color", color: theme.primary },
      logoSize: 112,
      showName: true,
      tagline: null,
      holdMs: 700,
      durationMs: 1800,
      easing: "suave",
      frequency: "once_per_session",
    });
  });

  it("respeta la configuración del negocio con bienvenida personalizada", () => {
    const config = normalizeSplash(
      {
        splash_style: "zoom",
        splash_bg_type: "gradient",
        splash_bg_value: "#D23B22, #F6B73C",
        splash_logo_size: 144,
        splash_show_name: false,
        splash_tagline: "  Desde 1998  ",
        splash_hold_ms: 500,
        splash_duration_ms: 2400,
        splash_easing: "elastico",
        splash_frequency: "always",
      },
      theme,
      true,
    );
    expect(config).toMatchObject({
      style: "zoom",
      background: { type: "gradient", from: "#D23B22", to: "#F6B73C" },
      letterColor: "#D23B22",
      logoSize: 144,
      showName: false,
      tagline: "Desde 1998",
      holdMs: 500,
      durationMs: 2400,
      easing: "elastico",
      frequency: "always",
    });
  });

  it("sin la función del plan se ignora lo personalizado", () => {
    const config = normalizeSplash(
      { splash_style: "fade", splash_duration_ms: 3000, splash_frequency: "always" },
      theme,
      false,
    );
    expect(config).toMatchObject({
      style: "lift",
      durationMs: 1800,
      frequency: "once_per_session",
    });
  });

  it('"Sin bienvenida" → null (solo con la función del plan)', () => {
    expect(normalizeSplash({ splash_style: "none" }, theme, true)).toBeNull();
    expect(normalizeSplash({ splash_style: "none" }, theme, false)).not.toBeNull();
  });

  it("acota tiempos, tamaños y valores raros", () => {
    const config = normalizeSplash(
      {
        splash_style: "explotar",
        splash_bg_type: "color",
        splash_bg_value: "red; background: url(x)",
        splash_logo_size: 100,
        splash_hold_ms: 5000,
        splash_duration_ms: 500,
        splash_easing: "rebote",
      },
      theme,
      true,
    )!;
    expect(config.style).toBe("lift");
    expect(config.background).toEqual({ type: "color", color: theme.primary });
    expect(config.logoSize).toBe(112);
    expect(config.durationMs).toBe(1200);
    // Entrada 350 + pausa + salida mínima de 400 caben en 1.2 s.
    expect(config.holdMs).toBe(450);
    expect(config.easing).toBe("suave");
  });

  it("imagen: solo https sin caracteres que rompan el CSS o el HTML", () => {
    const img = (url: string) =>
      normalizeSplash({ splash_bg_type: "image", splash_bg_value: url }, theme, true)!.background;
    expect(img("https://x.supabase.co/storage/v1/object/public/media/a.webp")).toEqual({
      type: "image",
      url: "https://x.supabase.co/storage/v1/object/public/media/a.webp",
    });
    expect(img("javascript:alert(1)").type).toBe("color");
    expect(img('https://x.co/a.jpg") , url("y').type).toBe("color");
    expect(img("http://x.co/a.jpg").type).toBe("color");
  });

  it("el texto se lee sobre el fondo", () => {
    expect(
      normalizeSplash({ splash_bg_type: "color", splash_bg_value: "#FBF6EE" }, theme, true)!
        .textColor,
    ).not.toBe("#FFFFFF");
    expect(
      normalizeSplash(
        { splash_bg_type: "image", splash_bg_value: "https://x.co/a.jpg" },
        theme,
        true,
      )!.textColor,
    ).toBe("#FFFFFF");
  });
});

describe("tiempos y curvas", () => {
  it("1.8 s por defecto: 350 de entrada, 700 de pausa, 750 de salida", () => {
    expect(splashTiming({ holdMs: 700, durationMs: 1800 })).toEqual({
      enterMs: 350,
      holdMs: 700,
      waitMs: 1050,
      exitMs: 750,
    });
  });

  it("el resorte empieza en 0, rebota un poco por encima de 1 y termina en 1", () => {
    const values = springEasing(260, 24)
      .replace(/^linear\(|\)$/g, "")
      .split(", ")
      .map(Number);
    expect(values[0]).toBe(0);
    expect(values.at(-1)).toBe(1);
    expect(Math.max(...values)).toBeGreaterThan(1);
    expect(Math.max(...values)).toBeLessThan(1.1);
  });

  it("variables CSS con la curva elegida", () => {
    const vars = splashVars(normalizeSplash({ splash_easing: "rapido" }, theme, true)!);
    expect(vars).toMatchObject({
      "--splash-bg": theme.primary,
      "--splash-logo": "112px",
      "--splash-wait": "1050ms",
      "--splash-exit": "750ms",
      "--splash-ease": SPLASH_EASINGS.rapido,
    });
  });
});
