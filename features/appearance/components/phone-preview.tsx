"use client";

import type { CSSProperties } from "react";
import { fontStack } from "@/features/appearance/fonts";
import type { PublicProduct } from "@/features/public-menu/payload";
import { Splash } from "@/features/public-menu/components/splash";
import type { SplashConfig } from "@/features/public-menu/splash";
import {
  MenuFooter,
  MenuHeader,
  MenuSection,
  MenuShell,
  ProductCard,
} from "@/features/public-menu/templates/clasico/components";
import type { MenuTheme } from "@/features/public-menu/theme";

/** Productos de ejemplo si el negocio todavía no tiene. */
const SAMPLE: PublicProduct[] = [
  {
    id: "muestra-1",
    name: "Desayuno chapín",
    description: "Huevos al gusto, frijoles, plátanos, queso fresco y crema.",
    imageUrl: null,
    blurhash: null,
    blurDataUrl: null,
    priceCents: 4500,
    compareAtCents: null,
    tags: ["popular"],
    available: true,
    prepMinutes: null,
    optionGroups: [],
  },
  {
    id: "muestra-2",
    name: "Café de olla",
    description: "Con canela y piloncillo.",
    imageUrl: null,
    blurhash: null,
    blurDataUrl: null,
    priceCents: 1800,
    compareAtCents: null,
    tags: [],
    available: true,
    prepMinutes: null,
    optionGroups: [],
  },
];

/**
 * Vista previa en un marco de celular con los componentes reales del menú:
 * cambia en el mismo render que el control (sin ir al servidor). `replay`
 * vuelve a montar la bienvenida para verla otra vez ("Reproducir").
 */
export function PhonePreview({
  theme,
  splash,
  replay,
  business,
}: {
  theme: MenuTheme;
  /** null = sin bienvenida (o aún no se pidió reproducirla). */
  splash: SplashConfig | null;
  replay: number;
  business: {
    name: string;
    description: string | null;
    logoUrl: string | null;
    coverUrl: string | null;
    branchName: string;
    products: PublicProduct[];
  };
}) {
  const products = business.products.length > 0 ? business.products : SAMPLE;
  return (
    <div
      data-testid="vista-previa"
      className="h-[min(680px,calc(100dvh-8rem))] w-[340px] max-w-full overflow-hidden rounded-[32px] border-[10px] border-frijol bg-frijol shadow-3"
      // La bienvenida usa la fuente de títulos del negocio, como en el menú real.
      style={{ "--font-display": fontStack(theme.fontHeading) } as CSSProperties}
    >
      <div className="relative h-full overflow-hidden rounded-[22px]">
        <Splash
          key={replay}
          config={splash}
          storageKey="vista-previa"
          name={business.name}
          logoUrl={business.logoUrl}
          contained
        >
          <MenuShell theme={theme} className="min-h-full">
            <MenuHeader
              name={business.name}
              branchName={business.branchName}
              description={business.description}
              logoUrl={business.logoUrl}
              coverUrl={business.coverUrl}
              hours={{ open: true, label: "Abierto" }}
              selectorHref={null}
              theme={theme}
            />
            <div className="mt-6 px-4">
              <MenuSection id="vista-previa" name="Lo más pedido" description={null}>
                {products.map((p, i) => (
                  <ProductCard
                    key={p.id}
                    product={p}
                    priceCents={p.priceCents}
                    featured={i === 0}
                  />
                ))}
              </MenuSection>
            </div>
            <MenuFooter showPoweredBy={theme.showPoweredBy} />
          </MenuShell>
        </Splash>
      </div>
    </div>
  );
}
