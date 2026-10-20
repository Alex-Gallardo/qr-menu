/** Paleta de la marca de la plataforma (landing, panel, emails). Espejo de app/globals.css. */
export const BRAND_COLORS = [
  { token: "tomate", hex: "#D23B22", use: "Primario, CTAs, logo" },
  { token: "tomate-700", hex: "#A82E1A", use: "Hover, enlaces sobre fondo claro" },
  { token: "masa", hex: "#FBF6EE", use: "Fondo principal" },
  { token: "nube", hex: "#F1EBE3", use: "Superficies y tarjetas del panel" },
  { token: "frijol", hex: "#231A17", use: "Texto principal, fondo en modo oscuro" },
  { token: "canela", hex: "#7A6A60", use: "Texto secundario" },
  { token: "maiz", hex: "#F6B73C", use: "Acentos, badges, estrellas" },
  { token: "aguacate", hex: "#3F8F5A", use: "Éxito, “Disponible”" },
  { token: "chile", hex: "#C62E2E", use: "Errores y acciones destructivas" },
] as const;
