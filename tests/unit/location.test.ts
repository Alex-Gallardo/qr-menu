import { describe, expect, it } from "vitest";
import { formatCoords, isValidCoords, mapLinks, roundCoords } from "@/features/location/lib/coords";
import { GEO_MESSAGES, geoErrorMessage } from "@/features/location/lib/geolocate";
import { distanceKm } from "@/features/location/lib/haversine";

const zona1 = { lat: 14.642, lng: -90.513 };
const antigua = { lat: 14.5586, lng: -90.7295 };

describe("coordenadas", () => {
  it("valida rangos y tipos", () => {
    expect(isValidCoords(zona1)).toBe(true);
    expect(isValidCoords({ lat: 91, lng: 0 })).toBe(false);
    expect(isValidCoords({ lat: Number.NaN, lng: 0 })).toBe(false);
    expect(isValidCoords({ lat: "14", lng: "-90" })).toBe(false);
    expect(isValidCoords(null)).toBe(false);
  });

  it("redondea a 6 decimales y formatea", () => {
    expect(roundCoords({ lat: 14.60120049, lng: -90.51460051 })).toEqual({
      lat: 14.6012,
      lng: -90.514601,
    });
    expect(formatCoords({ lat: 14.6012, lng: -90.5146 })).toBe("14.601200, -90.514600");
  });

  it("arma links de Google Maps y Waze", () => {
    expect(mapLinks({ lat: 14.6012, lng: -90.5146 })).toEqual({
      google: "https://www.google.com/maps/search/?api=1&query=14.6012,-90.5146",
      waze: "https://waze.com/ul?ll=14.6012,-90.5146&navigate=yes",
    });
  });
});

describe("distanceKm", () => {
  it("Zona 1 → Antigua ≈ 25 km en línea recta", () => {
    const d = distanceKm(zona1, antigua);
    expect(d).toBeGreaterThan(24);
    expect(d).toBeLessThan(26);
  });

  it("es simétrica y 0 en el mismo punto", () => {
    expect(distanceKm(zona1, antigua)).toBe(distanceKm(antigua, zona1));
    expect(distanceKm(zona1, zona1)).toBe(0);
  });
});

describe("geolocalización", () => {
  it("traduce los errores del navegador a mensajes sin culpa", () => {
    expect(geoErrorMessage(1)).toBe(GEO_MESSAGES.denied);
    expect(geoErrorMessage(2)).toBe(GEO_MESSAGES.unavailable);
    expect(geoErrorMessage(3)).toBe(GEO_MESSAGES.timeout);
  });
});
