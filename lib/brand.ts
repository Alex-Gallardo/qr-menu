/**
 * Marca de la plataforma. El nombre comercial visible se toma de variables de
 * entorno para poder cambiarlo sin tocar componentes, emails ni metadatos.
 */
export const BRAND = {
  name: process.env.NEXT_PUBLIC_BRAND_NAME ?? "QR Menu",
  tagline: process.env.NEXT_PUBLIC_BRAND_TAGLINE ?? "Tu menú del día, a un toque.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
} as const;
