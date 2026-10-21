import { describe, expect, it } from "vitest";
import {
  organizationJsonLd,
  restaurantJsonLd,
  serializeJsonLd,
} from "@/features/public-menu/json-ld";
import type { BranchMenuPayload } from "@/features/public-menu/payload";

const business = {
  name: "Café El Portal",
  description: "Desayunos chapines",
  logo_url: null,
  cover_url: "https://x/cover.webp",
};
const branch = {
  name: "Antigua",
  address: "5a Avenida Norte 12",
  city: "Antigua Guatemala",
  lat: 14.5586,
  lng: -90.7295,
  whatsapp_e164: "+50255551234",
  phone: null,
  hours: [{ weekday: 1, opens: "07:00", closes: "21:00" }],
};
const payload = {
  products: {
    chapin: {
      id: "chapin",
      name: "Desayuno chapín",
      description: "Huevos y frijoles",
      imageUrl: null,
      blurhash: null,
      blurDataUrl: null,
      priceCents: 4800,
      compareAtCents: null,
      tags: [],
      available: true,
      prepMinutes: null,
      optionGroups: [],
    },
    pasta: {
      id: "pasta",
      name: "Pasta",
      description: null,
      imageUrl: null,
      blurhash: null,
      blurDataUrl: null,
      priceCents: 7800,
      compareAtCents: null,
      tags: [],
      available: false,
      prepMinutes: null,
      optionGroups: [],
    },
  },
  menus: [
    {
      id: "carta",
      name: "Carta",
      description: null,
      template: "clasico",
      isDefault: true,
      sections: [
        {
          id: "s",
          name: "Fuertes",
          description: null,
          items: [
            { productId: "chapin", priceCents: 4800, featured: false },
            { productId: "pasta", priceCents: 7800, featured: false },
          ],
        },
      ],
    },
  ],
  resolver: { slots: [], menus: [], rules: [], overrides: [] },
} satisfies BranchMenuPayload;

describe("JSON-LD del menú público", () => {
  it("Restaurant con dirección, geo, horario y menú con precios en GTQ", () => {
    const ld = restaurantJsonLd(
      business,
      branch,
      payload,
      "https://qrmenu.app/cafe-el-portal/antigua",
    );
    expect(ld).toMatchObject({
      "@type": "Restaurant",
      name: "Café El Portal · Antigua",
      telephone: "+50255551234",
      address: { addressLocality: "Antigua Guatemala", addressCountry: "GT" },
      geo: { latitude: 14.5586, longitude: -90.7295 },
      openingHoursSpecification: [
        { dayOfWeek: "https://schema.org/Monday", opens: "07:00", closes: "21:00" },
      ],
    });
    const item = ld.hasMenu[0]!.hasMenuSection[0]!.hasMenuItem[0]!;
    expect(item).toMatchObject({
      name: "Desayuno chapín",
      offers: { price: "48.00", priceCurrency: "GTQ" },
    });
    expect(ld.hasMenu[0]!.hasMenuSection[0]!.hasMenuItem[1]!.offers.availability).toBe(
      "https://schema.org/OutOfStock",
    );
  });

  it("sin coordenadas no inventa geo", () => {
    expect(
      restaurantJsonLd(business, { ...branch, lat: null, lng: null }, payload, "u"),
    ).not.toHaveProperty("geo");
  });

  it("el negocio enlaza cada sucursal", () => {
    const ld = organizationJsonLd(
      business,
      [{ ...branch, url: "https://qrmenu.app/cafe-el-portal/antigua" }],
      "https://qrmenu.app/cafe-el-portal",
    );
    expect(ld.department).toEqual([
      expect.objectContaining({
        "@type": "Restaurant",
        url: "https://qrmenu.app/cafe-el-portal/antigua",
      }),
    ]);
  });

  it("escapa < para no poder cerrar el <script>", () => {
    expect(serializeJsonLd({ name: "</script><script>alert(1)" })).not.toContain("</script>");
  });
});
