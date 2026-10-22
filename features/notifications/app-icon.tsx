import { ImageResponse } from "next/og";

/**
 * Íconos PNG de las apps instalables (Android pide 192 y 512; iPhone, 180 sin
 * transparencia). Se dibujan con el logo (el mismo de app/icon.svg) sobre el
 * fondo de la marca. "maskable" deja margen: Android recorta el ícono en círculo o gota.
 */

export const APP_ICON_VARIANTS = ["192", "512", "maskable"] as const;
export type AppIconVariant = (typeof APP_ICON_VARIANTS)[number];

const BACKGROUND = "#FBF6EE";

const LOGO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48"><path d="M14 6h18l8 8v18a6 6 0 0 1-6 6H21l-10 7 2.4-7H14a6 6 0 0 1-6-6V12a6 6 0 0 1 6-6Z" fill="#D23B22"/><path d="M32 6v5a3 3 0 0 0 3 3h5Z" fill="#F6B73C"/><g fill="#fff"><rect x="14" y="16" width="13" height="3" rx="1.5"/><rect x="14" y="22" width="19" height="3" rx="1.5"/><rect x="14" y="28" width="10" height="3" rx="1.5"/></g></svg>`;
const logoDataUri = () => `data:image/svg+xml;base64,${Buffer.from(LOGO_SVG).toString("base64")}`;

export function appIcon(size: number, logoRatio: number) {
  const logo = Math.round(size * logoRatio);
  return new ImageResponse(
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: BACKGROUND,
      }}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- Satori solo dibuja <img> */}
      <img src={logoDataUri()} width={logo} height={logo} alt="" />
    </div>,
    { width: size, height: size },
  );
}

export function appIconFor(variant: AppIconVariant) {
  if (variant === "maskable") return appIcon(512, 0.56);
  return appIcon(Number(variant), 0.72);
}
