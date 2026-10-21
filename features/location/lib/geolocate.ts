import { roundCoords, type Coords } from "./coords";

export type GeoResult =
  { ok: true; coords: Coords; accuracyM: number } | { ok: false; message: string };

/** Mensajes sin culpa para cada motivo por el que no hay ubicación. */
export const GEO_MESSAGES = {
  denied: "Sin problema: marca el lugar en el mapa o escribe la dirección.",
  unavailable: "No pudimos encontrar tu ubicación. Marca el lugar en el mapa.",
  timeout: "Tu ubicación está tardando. Marca el lugar en el mapa o probemos otra vez.",
  unsupported: "Este navegador no comparte la ubicación. Marca el lugar en el mapa.",
} as const;

export function geoErrorMessage(code: number | undefined): string {
  if (code === 1) return GEO_MESSAGES.denied; // PERMISSION_DENIED
  if (code === 3) return GEO_MESSAGES.timeout; // TIMEOUT
  return GEO_MESSAGES.unavailable; // POSITION_UNAVAILABLE u otro
}

/**
 * Pide la ubicación solo cuando el usuario toca el botón (nunca al abrir la página).
 * Requiere HTTPS (o localhost) y permiso del usuario.
 */
export function geolocate(signal?: AbortSignal): Promise<GeoResult> {
  if (
    typeof navigator === "undefined" ||
    !("geolocation" in navigator) ||
    !window.isSecureContext
  ) {
    return Promise.resolve({ ok: false, message: GEO_MESSAGES.unsupported });
  }
  return new Promise((resolve) => {
    let done = false;
    const finish = (result: GeoResult) => {
      if (done) return;
      done = true;
      resolve(result);
    };
    signal?.addEventListener("abort", () => finish({ ok: false, message: GEO_MESSAGES.timeout }));
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        finish({
          ok: true,
          coords: roundCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          accuracyM: Math.round(pos.coords.accuracy),
        }),
      (err) => finish({ ok: false, message: geoErrorMessage(err.code) }),
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  });
}
