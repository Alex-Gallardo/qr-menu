export type Coords = { lat: number; lng: number };

/** Centro por defecto: Ciudad de Guatemala. */
export const GUATEMALA_CITY: Coords = { lat: 14.6349, lng: -90.5069 };

export function isValidCoords(value: unknown): value is Coords {
  if (!value || typeof value !== "object") return false;
  const { lat, lng } = value as Partial<Coords>;
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/** 6 decimales ≈ 11 cm: suficiente y evita ruido de GPS. */
export function roundCoords({ lat, lng }: Coords): Coords {
  const r = (n: number) => Math.round(n * 1e6) / 1e6;
  return { lat: r(lat), lng: r(lng) };
}

/** "14.601200, -90.514600" para copiar o mostrar. */
export function formatCoords({ lat, lng }: Coords) {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

/** Links para abrir la ubicación en Google Maps y Waze. */
export function mapLinks({ lat, lng }: Coords) {
  return {
    google: `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`,
    waze: `https://waze.com/ul?ll=${lat},${lng}&navigate=yes`,
  };
}
