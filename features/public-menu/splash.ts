import { readableTextOn } from "@/lib/color";
import { safeHttpsUrl } from "@/lib/safe-url";
import type { MenuTheme } from "./theme";

/**
 * Bienvenida (splash) del menú público, puro: lo que el negocio guardó en
 * Apariencia (o los valores de la plataforma si su plan no la personaliza),
 * normalizado y convertido en tiempos y variables CSS. La animación es CSS
 * (solo transform/opacity) y arranca antes de que hidrate React.
 */

export type SplashStyle = "lift" | "fade" | "zoom" | "none";
export type SplashEasing = "suave" | "elastico" | "rapido";
export type SplashFrequency = "always" | "once_per_session" | "first_visit";

export const SPLASH_STYLES: { value: SplashStyle; label: string }[] = [
  { value: "lift", label: "Levantar" },
  { value: "fade", label: "Desvanecer" },
  { value: "zoom", label: "Alejar" },
  { value: "none", label: "Sin bienvenida" },
];
export const SPLASH_EASING_LABELS: Record<SplashEasing, string> = {
  suave: "Suave",
  elastico: "Elástica",
  rapido: "Rápida",
};
export const SPLASH_LOGO_SIZES = [80, 112, 144] as const;

export type SplashBackground =
  | { type: "color"; color: string }
  | { type: "gradient"; from: string; to: string }
  | { type: "image"; url: string };

export type SplashConfig = {
  style: Exclude<SplashStyle, "none">;
  background: SplashBackground;
  /** Color del nombre y la frase (legible sobre el fondo). */
  textColor: string;
  /** Color de la inicial cuando el negocio no tiene logo. */
  letterColor: string;
  logoSize: (typeof SPLASH_LOGO_SIZES)[number];
  showName: boolean;
  tagline: string | null;
  holdMs: number;
  durationMs: number;
  easing: SplashEasing;
  frequency: SplashFrequency;
};

export type RawSplash = Partial<{
  splash_style: string;
  splash_bg_type: string;
  splash_bg_value: string;
  splash_logo_size: number;
  splash_show_name: boolean;
  splash_tagline: string | null;
  splash_hold_ms: number;
  splash_duration_ms: number;
  splash_easing: string;
  splash_frequency: string;
}>;

export const ENTER_MS = 350;
const MIN_EXIT_MS = 400;
export const MIN_DURATION_MS = 1200;
export const MAX_DURATION_MS = 3000;

const HEX = /^#[0-9a-fA-F]{6}$/;
const pick = <T extends string>(value: unknown, allowed: readonly T[], fallback: T): T =>
  allowed.includes(value as T) ? (value as T) : fallback;
const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

function background(raw: RawSplash, theme: MenuTheme): SplashBackground {
  const value = raw.splash_bg_value?.trim() ?? "";
  if (raw.splash_bg_type === "gradient") {
    // Guardado como "#D23B22,#F6B73C".
    const [from, to] = value.split(",").map((s) => s.trim());
    if (from && to && HEX.test(from) && HEX.test(to)) return { type: "gradient", from, to };
  }
  if (raw.splash_bg_type === "image") {
    const url = safeHttpsUrl(value);
    if (url) return { type: "image", url };
  }
  if (raw.splash_bg_type === "color" && HEX.test(value)) return { type: "color", color: value };
  // Por defecto: el color primario del negocio.
  return { type: "color", color: theme.primary };
}

/**
 * Configuración final. Sin la función "custom_splash" del plan se usa la
 * bienvenida estándar (Levantar, color primario, 1.8 s, una vez por sesión).
 * null = el negocio eligió "Sin bienvenida".
 */
export function normalizeSplash(
  raw: RawSplash | null,
  theme: MenuTheme,
  custom: boolean,
): SplashConfig | null {
  const r: RawSplash = custom && raw ? raw : {};
  const style = pick(r.splash_style, ["lift", "fade", "zoom", "none"], "lift");
  if (style === "none") return null;

  const durationMs = clamp(
    Math.round(r.splash_duration_ms ?? 1800),
    MIN_DURATION_MS,
    MAX_DURATION_MS,
  );
  const holdMs = clamp(Math.round(r.splash_hold_ms ?? 700), 0, durationMs - ENTER_MS - MIN_EXIT_MS);
  const size = r.splash_logo_size ?? 112;
  const bg = background(r, theme);
  const tagline = r.splash_tagline?.trim().slice(0, 80) || null;

  return {
    style,
    background: bg,
    textColor:
      bg.type === "image" ? "#FFFFFF" : readableTextOn(bg.type === "color" ? bg.color : bg.from),
    letterColor: bg.type === "color" ? bg.color : bg.type === "gradient" ? bg.from : theme.primary,
    logoSize: SPLASH_LOGO_SIZES.reduce((best, s) =>
      Math.abs(s - size) < Math.abs(best - size) ? s : best,
    ),
    showName: r.splash_show_name ?? true,
    tagline,
    holdMs,
    durationMs,
    easing: pick(r.splash_easing, ["suave", "elastico", "rapido"], "suave"),
    frequency: pick(
      r.splash_frequency,
      ["always", "once_per_session", "first_visit"],
      "once_per_session",
    ),
  };
}

/** Entrada 350 ms → pausa (hold) → salida con el resto de la duración total. */
export function splashTiming(config: Pick<SplashConfig, "holdMs" | "durationMs">) {
  const waitMs = ENTER_MS + config.holdMs;
  return { enterMs: ENTER_MS, holdMs: config.holdMs, waitMs, exitMs: config.durationMs - waitMs };
}

/**
 * Resorte (masa 1) como curva CSS `linear()`: el panel sube con un pequeño
 * rebote sin cargar ninguna librería de animación.
 */
export function springEasing(stiffness: number, damping: number, points = 32) {
  const w0 = Math.sqrt(stiffness);
  const zeta = damping / (2 * w0);
  const x = (t: number) => {
    if (zeta < 1) {
      const wd = w0 * Math.sqrt(1 - zeta * zeta);
      return (
        1 - Math.exp(-zeta * w0 * t) * (Math.cos(wd * t) + ((zeta * w0) / wd) * Math.sin(wd * t))
      );
    }
    return 1 - Math.exp(-w0 * t) * (1 + w0 * t); // amortiguado crítico (o más)
  };
  // Hasta que el rebote es imperceptible (0.1 %).
  const settle = Math.log(1000) / (Math.min(zeta, 1) * w0);
  const values = Array.from({ length: points + 1 }, (_, i) =>
    i === points ? 1 : Number(x((settle * i) / points).toFixed(3)),
  );
  return `linear(${values.join(", ")})`;
}

export const SPLASH_EASINGS: Record<SplashEasing, string> = {
  suave: "cubic-bezier(0.76, 0, 0.24, 1)",
  elastico: springEasing(260, 24),
  rapido: "cubic-bezier(0.4, 0, 0.2, 1)",
};

/** Variables CSS que leen las animaciones de globals.css. */
export function splashVars(config: SplashConfig): Record<string, string> {
  const t = splashTiming(config);
  const bg = config.background;
  return {
    "--splash-bg":
      bg.type === "color"
        ? bg.color
        : bg.type === "gradient"
          ? `linear-gradient(160deg, ${bg.from}, ${bg.to})`
          : "#000000",
    "--splash-text": config.textColor,
    "--splash-letter": config.letterColor,
    "--splash-logo": `${config.logoSize}px`,
    "--splash-hold": `${t.holdMs}ms`,
    "--splash-wait": `${t.waitMs}ms`,
    "--splash-exit": `${t.exitMs}ms`,
    "--splash-ease": SPLASH_EASINGS[config.easing],
  };
}
