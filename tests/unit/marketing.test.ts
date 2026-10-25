import { describe, expect, it } from "vitest";
import {
  comparisonRows,
  FAQ,
  HERO,
  landingSeo,
  planCards,
  salesWhatsappUrl,
} from "@/features/marketing/content";
import { landingJsonLd } from "@/features/marketing/json-ld";
import { ROBOTS_DISALLOW } from "@/features/public-menu/seo";

/** QRM-043: landing, precios, legal, SEO y GA4. */

describe("SEO de la landing (guía §10)", () => {
  it("title ≤ 60 y description ≤ 155 caracteres, con la marca", () => {
    for (const brand of ["QR Menu", "Cartita"]) {
      const seo = landingSeo(brand);
      expect(seo.title.length).toBeLessThanOrEqual(60);
      expect(seo.title).toContain(brand);
      expect(seo.description.length).toBeLessThanOrEqual(155);
    }
  });
  it("H1 y microcopy del hero", () => {
    expect(HERO.title).toBe("Tu menú del día, a un toque");
    expect(HERO.micro).toContain("Sin comisiones");
  });
  it("robots: se indexan precios y legal; no invitaciones ni el panel", () => {
    expect(ROBOTS_DISALLOW).toContain("/invitacion");
    expect(ROBOTS_DISALLOW.some((p) => p.startsWith("/precios") || p.startsWith("/legal"))).toBe(
      false,
    );
  });
});

describe("precios", () => {
  it("Gratis, Pro (resaltado) y Negocio con los precios de lista o los de la base", () => {
    const cards = planCards();
    expect(cards.map((c) => [c.id, c.priceGtq, c.highlight])).toEqual([
      ["gratis", 0, false],
      ["pro", 149, true],
      ["negocio", 299, false],
    ]);
    expect(planCards({ pro: 159 }).find((c) => c.id === "pro")?.priceGtq).toBe(159);
  });
  it("cada plan dice lo que incluye", () => {
    const [gratis, pro, negocio] = planCards();
    expect(gratis!.bullets).toContain("1 sucursal");
    expect(gratis!.bullets).toContain("25 productos");
    expect(pro!.bullets).toContain("Staff con PIN");
    expect(negocio!.bullets).toContain("3 sucursales incluidas");
    expect(negocio!.bullets).toContain("Quitar el pie de la marca");
  });
});

describe("datos estructurados", () => {
  it("Organization, SoftwareApplication con ofertas en GTQ y FAQPage", () => {
    const [org, app, faq] = landingJsonLd({
      url: "https://x.app/",
      name: "QR Menu",
      description: "d",
      logoUrl: "https://x.app/icon.svg",
      plans: planCards(),
      faq: FAQ,
    }) as unknown as [
      Record<string, unknown>,
      { offers: { price: string; priceCurrency: string }[] },
      { mainEntity: unknown[] },
    ];
    expect(org["@type"]).toBe("Organization");
    expect(app.offers.map((o) => [o.price, o.priceCurrency])).toEqual([
      ["0", "GTQ"],
      ["149", "GTQ"],
      ["299", "GTQ"],
    ]);
    expect(faq.mainEntity).toHaveLength(FAQ.length);
  });
});

describe("contenido", () => {
  it("las preguntas de la guía, con respuesta", () => {
    const qs = FAQ.map((f) => f.q).join(" ");
    for (const word of [
      "comisión",
      "instalar",
      "pago",
      "sucursales",
      "cerrado",
      "cancelo",
      "datos",
    ])
      expect(qs.toLowerCase()).toContain(word);
    expect(FAQ.every((f) => f.a.length > 20)).toBe(true);
  });
  it("comparativa: carta, foto por WhatsApp y la app", () => {
    const c = comparisonRows("QR Menu");
    expect(c.columns).toEqual(["Carta impresa", "Foto por WhatsApp", "QR Menu"]);
    expect(c.rows.every((r) => r.values.length === 3)).toBe(true);
  });
  it("WhatsApp de ventas con el mensaje de la guía", () => {
    const url = new URL(salesWhatsappUrl("50255551234", "Cartita"));
    expect(url.searchParams.get("phone")).toBe("50255551234");
    expect(url.searchParams.get("text")).toBe("Hola, quiero mi Cartita");
  });
});
