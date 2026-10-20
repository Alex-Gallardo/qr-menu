import { PALETTE_PRESETS } from "@/features/appearance/palettes";

/**
 * Valores iniciales de platform_settings. En la base se editan desde el super admin;
 * el seed solo los crea si no existen.
 */

/** [negocio] vive en la raíz: estos links no se pueden registrar. */
export const RESERVED_SLUGS = [
  "panel",
  "admin",
  "staff",
  "api",
  "entrar",
  "registro",
  "recuperar",
  "auth",
  "precios",
  "demo",
  "legal",
  "styleguide",
  "q",
  "onboarding",
  "ayuda",
  "soporte",
  "mantenimiento",
  "monitoring",
  "qr-menu",
  "qrmenu",
] as const;

export const MIN_SLUG_LENGTH = 3;

/** Catálogo curado de Google Fonts para los menús de los negocios. */
export const FONT_CATALOG = {
  heading: [
    "Bricolage Grotesque",
    "Fraunces",
    "Playfair Display",
    "DM Serif Display",
    "Pacifico",
    "Lobster Two",
  ],
  body: ["Inter", "Nunito", "Poppins", "Lato", "DM Sans", "Work Sans"],
} as const;

export const SPLASH_DEFAULTS = {
  style: "lift",
  logo_size: 112,
  show_name: true,
  hold_ms: 700,
  duration_ms: 1800,
  easing: "suave",
  frequency: "once_per_session",
} as const;

export const PLATFORM_SETTINGS_DEFAULTS: Record<string, unknown> = {
  maintenance_mode: { enabled: false, message: "" },
  reserved_slugs: [...RESERVED_SLUGS],
  trial_days: 14,
  founder_trial_days: 60,
  grace_days: 7,
  font_catalog: FONT_CATALOG,
  palette_presets: PALETTE_PRESETS.map((p) => p.id),
  splash_defaults: SPLASH_DEFAULTS,
};
