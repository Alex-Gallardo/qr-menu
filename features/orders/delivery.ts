import type { Coords } from "@/features/location/lib/coords";
import { distanceKm } from "@/features/location/lib/haversine";

/**
 * Entrega a domicilio (puro): dónde, de dónde salió la ubicación, si la
 * sucursal llega hasta ahí (Haversine contra su radio) y qué ofrecer si no.
 * El servidor repite la cobertura al crear el pedido (QRM-027).
 */

/** gps = "Usar mi ubicación actual"; mapa = pin puesto a mano; manual = solo dirección escrita. */
export type LocationSource = "gps" | "mapa" | "manual";

export type DeliveryLocation = {
  coords: Coords | null;
  accuracyM: number | null;
  source: LocationSource;
};

/** Precisión peor que esto: se pide ajustar el pin. */
export const POOR_ACCURACY_M = 150;

export type CoverageBranch = {
  /** Dónde está la sucursal (null = no la marcó en el mapa: no se puede medir). */
  location: Coords | null;
  /** null = sin límite. */
  radiusKm: number | null;
};

export type Coverage =
  | { ok: true; distanceKm: number | null }
  | { ok: false; distanceKm: number; radiusKm: number; message: string };

const km = (n: number) => n.toLocaleString("es-GT", { maximumFractionDigits: 1 });

export function deliveryCoverage(branch: CoverageBranch, point: Coords): Coverage {
  if (!branch.location) return { ok: true, distanceKm: null };
  const distance = distanceKm(branch.location, point);
  if (branch.radiusKm === null || distance <= branch.radiusKm)
    return { ok: true, distanceKm: distance };
  return {
    ok: false,
    distanceKm: distance,
    radiusKm: branch.radiusKm,
    message: `Estás a ${km(distance)} km y esta sucursal entrega hasta ${km(branch.radiusKm)} km.`,
  };
}

export type OtherBranch = CoverageBranch & {
  slug: string;
  name: string;
  acceptsDelivery: boolean;
};

/** La sucursal más cercana que sí entrega en ese punto (para "Pedir a Antigua"). */
export function branchThatDelivers(branches: readonly OtherBranch[], point: Coords) {
  return (
    branches
      .filter((b) => b.acceptsDelivery && b.location)
      .map((b) => ({ branch: b, coverage: deliveryCoverage(b, point) }))
      .filter((x) => x.coverage.ok)
      .sort((a, b) => (a.coverage.distanceKm ?? 0) - (b.coverage.distanceKm ?? 0))[0]?.branch ??
    null
  );
}

/**
 * Problema con la ubicación de un pedido a domicilio, o null si está bien.
 * Si la sucursal exige ubicación, hace falta el pin (GPS o mapa); si no,
 * basta la dirección escrita con su referencia.
 */
export function locationProblem(
  location: DeliveryLocation | null,
  branch: CoverageBranch & { requiresLocation: boolean },
): string | null {
  if (!location?.coords) {
    if (branch.requiresLocation || location?.source !== "manual")
      return "Marca dónde te lo llevamos: usa tu ubicación o elige en el mapa.";
    return null;
  }
  const coverage = deliveryCoverage(branch, location.coords);
  return coverage.ok ? null : coverage.message;
}

/**
 * Navegadores dentro de apps (Instagram, Facebook, TikTok…): suelen bloquear
 * la ubicación, así que se ofrece primero el mapa y "Abrir en el navegador".
 */
export function inAppBrowser(userAgent: string): "Instagram" | "Facebook" | "TikTok" | null {
  if (/Instagram/i.test(userAgent)) return "Instagram";
  if (/FBAN|FBAV|FB_IAB|FBIOS/i.test(userAgent)) return "Facebook";
  if (/musical_ly|BytedanceWebview|TikTok/i.test(userAgent)) return "TikTok";
  return null;
}
