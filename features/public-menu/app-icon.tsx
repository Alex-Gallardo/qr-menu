import { ImageResponse } from "next/og";
import { readableTextOn } from "@/lib/color";
import { iconCanUseLogo, type MenuIconVariant } from "./pwa";

/**
 * Ícono de la app del menú: el logo del negocio sobre su color de fondo o,
 * sin logo usable, la inicial sobre su color principal. Android pide 192 y
 * 512 ("maskable" con margen porque recorta en círculo o gota); iPhone, 180
 * sin transparencia.
 */

const SIZES: Record<MenuIconVariant, { size: number; content: number }> = {
  "192": { size: 192, content: 0.8 },
  "512": { size: 512, content: 0.8 },
  maskable: { size: 512, content: 0.6 },
  apple: { size: 180, content: 0.76 },
};

export function menuAppIcon(
  variant: MenuIconVariant,
  brand: { name: string; logoUrl: string | null; primary: string; bg: string },
) {
  const { size, content } = SIZES[variant];
  const box = Math.round(size * content);
  const logo = iconCanUseLogo(brand.logoUrl) ? brand.logoUrl : null;
  return new ImageResponse(
    logo ? (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: brand.bg,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- Satori solo dibuja <img> */}
        <img
          src={logo}
          width={box}
          height={box}
          alt=""
          style={{ objectFit: "contain", borderRadius: Math.round(box * 0.18) }}
        />
      </div>
    ) : (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: brand.primary,
          color: readableTextOn(brand.primary),
          fontSize: Math.round(box * 0.62),
          fontWeight: 700,
        }}
      >
        {(brand.name.trim()[0] ?? "M").toUpperCase()}
      </div>
    ),
    {
      width: size,
      height: size,
      // Cambia cuando cambian el logo o los colores: que el navegador revalide.
      headers: { "cache-control": "public, max-age=3600, stale-while-revalidate=86400" },
    },
  );
}
