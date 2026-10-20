/** Paletas listas que el negocio puede elegir para su menú. Todas cumplen contraste AA. */
export type PalettePreset = {
  id: string;
  name: string;
  primary: string;
  accent: string;
  bg: string;
  text: string;
  dark?: boolean;
};

export const PALETTE_PRESETS: readonly PalettePreset[] = [
  {
    id: "tomate",
    name: "Tomate",
    primary: "#D23B22",
    accent: "#F6B73C",
    bg: "#FBF6EE",
    text: "#231A17",
  },
  {
    id: "aguacate",
    name: "Aguacate",
    primary: "#2F7A4A",
    accent: "#E9C46A",
    bg: "#F6F8F1",
    text: "#1B2A20",
  },
  {
    id: "cafe-de-olla",
    name: "Café de olla",
    primary: "#7B4A2E",
    accent: "#D9A05B",
    bg: "#F8F1E7",
    text: "#2A1C14",
  },
  {
    id: "jacaranda",
    name: "Jacaranda",
    primary: "#6D4AA8",
    accent: "#F2B5D4",
    bg: "#F8F5FC",
    text: "#231B33",
  },
  { id: "mar", name: "Mar", primary: "#1F6F8B", accent: "#F4A259", bg: "#F3F8FA", text: "#102A35" },
  {
    id: "maiz",
    name: "Maíz",
    primary: "#A06A00",
    accent: "#3F8F5A",
    bg: "#FFF9EA",
    text: "#2B2210",
  },
  {
    id: "noche",
    name: "Noche (oscura)",
    primary: "#F2A541",
    accent: "#E5654A",
    bg: "#15120F",
    text: "#F5EFE8",
    dark: true,
  },
  {
    id: "minimal",
    name: "Minimal",
    primary: "#111111",
    accent: "#D23B22",
    bg: "#FFFFFF",
    text: "#111111",
  },
];
