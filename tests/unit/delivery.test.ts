import { describe, expect, it } from "vitest";
import {
  branchThatDelivers,
  deliveryCoverage,
  inAppBrowser,
  locationProblem,
  type OtherBranch,
} from "@/features/orders/delivery";

// Zona 1 (Ciudad de Guatemala) y Antigua, a ~25 km.
const ZONA_1 = { lat: 14.6427, lng: -90.5133 };
const ANTIGUA = { lat: 14.5586, lng: -90.7295 };
const CERCA = { lat: 14.6227, lng: -90.5133 }; // ~2.2 km al sur de Zona 1
const MIXCO = { lat: 14.6331, lng: -90.6064 }; // ~10 km al oeste

const zona1 = { location: ZONA_1, radiusKm: 5 };

describe("cobertura", () => {
  it("dentro del radio: ok con la distancia", () => {
    expect(deliveryCoverage(zona1, CERCA)).toEqual({ ok: true, distanceKm: 2.22 });
  });

  it('fuera del radio: "Estás a 10.1 km y esta sucursal entrega hasta 5 km."', () => {
    const c = deliveryCoverage(zona1, MIXCO);
    expect(c.ok).toBe(false);
    expect(c.ok ? "" : c.message).toBe("Estás a 10.1 km y esta sucursal entrega hasta 5 km.");
  });

  it("sin radio o sin ubicación de la sucursal: no se limita", () => {
    expect(deliveryCoverage({ location: ZONA_1, radiusKm: null }, ANTIGUA).ok).toBe(true);
    expect(deliveryCoverage({ location: null, radiusKm: 5 }, ANTIGUA)).toEqual({
      ok: true,
      distanceKm: null,
    });
  });

  it("sugiere la sucursal que sí entrega, la más cercana", () => {
    const others: OtherBranch[] = [
      { slug: "zona-1", name: "Zona 1", location: ZONA_1, radiusKm: 5, acceptsDelivery: true },
      { slug: "antigua", name: "Antigua", location: ANTIGUA, radiusKm: 30, acceptsDelivery: true },
      { slug: "mixco", name: "Mixco", location: MIXCO, radiusKm: 8, acceptsDelivery: false },
    ];
    expect(branchThatDelivers(others, MIXCO)?.name).toBe("Antigua");
    expect(branchThatDelivers(others, CERCA)?.name).toBe("Zona 1");
    expect(branchThatDelivers(others.slice(0, 1), ANTIGUA)).toBeNull();
  });
});

describe("ubicación del pedido", () => {
  const exige = { ...zona1, requiresLocation: true };
  const noExige = { ...zona1, requiresLocation: false };

  it("con pin dentro del radio, sea GPS o mapa", () => {
    expect(locationProblem({ coords: CERCA, accuracyM: 20, source: "gps" }, exige)).toBeNull();
    expect(locationProblem({ coords: CERCA, accuracyM: null, source: "mapa" }, exige)).toBeNull();
  });

  it("sin pin: hace falta si la sucursal lo exige", () => {
    const msg = "Marca dónde te lo llevamos: usa tu ubicación o elige en el mapa.";
    expect(locationProblem(null, exige)).toBe(msg);
    expect(locationProblem({ coords: null, accuracyM: null, source: "manual" }, exige)).toBe(msg);
  });

  it("solo dirección escrita si la sucursal lo permite", () => {
    expect(
      locationProblem({ coords: null, accuracyM: null, source: "manual" }, noExige),
    ).toBeNull();
    expect(locationProblem(null, noExige)).not.toBeNull();
  });

  it("fuera de cobertura no se puede pedir a domicilio", () => {
    expect(locationProblem({ coords: MIXCO, accuracyM: 20, source: "gps" }, exige)).toContain(
      "Estás a 10.1 km",
    );
  });
});

describe("navegadores dentro de apps", () => {
  it("Instagram, Facebook y TikTok", () => {
    expect(
      inAppBrowser(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 Instagram 330.0.0.40.92",
      ),
    ).toBe("Instagram");
    expect(inAppBrowser("Mozilla/5.0 (Linux; Android 14) [FB_IAB/FB4A;FBAV/450.0.0.0;]")).toBe(
      "Facebook",
    );
    expect(inAppBrowser("Mozilla/5.0 (Linux; Android 13) musical_ly_2023 BytedanceWebview")).toBe(
      "TikTok",
    );
    expect(
      inAppBrowser(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
      ),
    ).toBeNull();
  });
});
