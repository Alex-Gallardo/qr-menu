import { z } from "zod";
import { safeHttpsUrl } from "@/lib/safe-url";
import { BODY_FONTS, HEADING_FONTS } from "./fonts";
import { PALETTE_PRESETS } from "./palettes";

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Usa un color como #D23B22.");
const httpsUrl = z
  .string()
  .max(500)
  .refine((v) => safeHttpsUrl(v) !== null, "Esa dirección no es válida.");

const fontName = (list: readonly { name: string }[]) =>
  z.enum(list.map((f) => f.name) as [string, ...string[]], "Elige una fuente del catálogo.");

/** Apariencia que guarda el editor (columnas de `themes`). */
export const appearanceSchema = z
  .object({
    businessId: z.uuid(),
    palette_preset: z.enum(
      ["custom", "logo", ...PALETTE_PRESETS.map((p) => p.id)],
      "Elige una paleta.",
    ),
    color_primary: hex,
    color_accent: hex,
    color_bg: hex,
    color_surface: hex,
    color_text: hex,
    bg_type: z.enum(["color", "gradient", "image", "video"]),
    bg_value: z.string().max(500).nullable(),
    bg_video_url: httpsUrl.nullable(),
    bg_poster_url: httpsUrl.nullable(),
    bg_overlay: z.number().min(0).max(0.8),
    font_heading: fontName(HEADING_FONTS),
    font_body: fontName(BODY_FONTS),
    radius: z.number().int().min(0).max(28),
    loader_style: z.enum(["logo", "puntos", "plato"]),
    show_powered_by: z.boolean(),
    splash_style: z.enum(["lift", "fade", "zoom", "none"]),
    splash_bg_type: z.enum(["color", "gradient", "image"]),
    splash_bg_value: z.string().max(500),
    splash_logo_size: z.union([z.literal(80), z.literal(112), z.literal(144)]),
    splash_show_name: z.boolean(),
    splash_tagline: z.string().trim().max(80, "Usa como máximo 80 caracteres.").nullable(),
    splash_duration_ms: z.number().int().min(1200).max(3000),
    splash_easing: z.enum(["suave", "elastico", "rapido"]),
    splash_frequency: z.enum(["always", "once_per_session", "first_visit"]),
  })
  .superRefine((v, ctx) => {
    const gradient = /^#[0-9a-fA-F]{6},#[0-9a-fA-F]{6}$/;
    if (v.bg_type === "gradient" && !gradient.test(v.bg_value ?? ""))
      ctx.addIssue({
        code: "custom",
        path: ["bg_value"],
        message: "Elige los dos colores del degradado.",
      });
    if (v.bg_type === "image" && !safeHttpsUrl(v.bg_value))
      ctx.addIssue({ code: "custom", path: ["bg_value"], message: "Sube la imagen del fondo." });
    if (v.bg_type === "video" && !v.bg_video_url)
      ctx.addIssue({ code: "custom", path: ["bg_video_url"], message: "Sube el video del fondo." });
    const splashOk =
      v.splash_bg_type === "color"
        ? /^#[0-9a-fA-F]{6}$/.test(v.splash_bg_value)
        : v.splash_bg_type === "gradient"
          ? gradient.test(v.splash_bg_value)
          : safeHttpsUrl(v.splash_bg_value) !== null;
    if (!splashOk)
      ctx.addIssue({
        code: "custom",
        path: ["splash_bg_value"],
        message: "Revisa el fondo de la bienvenida.",
      });
  });

export type AppearanceInput = z.infer<typeof appearanceSchema>;
