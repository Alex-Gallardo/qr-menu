import type { Coords } from "./coords";

const EARTH_RADIUS_KM = 6371;

/** Distancia en línea recta en km (fórmula de Haversine), con 2 decimales. */
export function distanceKm(a: Coords, b: Coords): number {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(h)) * 100) / 100;
}
