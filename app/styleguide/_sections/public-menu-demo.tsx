"use client";

import { CalendarOffIcon, ClockIcon } from "lucide-react";
import { useState } from "react";
import { PALETTE_PRESETS } from "@/features/appearance/palettes";
import type { PublicProduct } from "@/features/public-menu/payload";
import {
  MenuFooter,
  MenuHeader,
  MenuNotice,
  MenuSection,
  MenuShell,
  ProductCard,
  SectionTabs,
  SlotChips,
} from "@/features/public-menu/templates/clasico/components";
import { themeFromPreset } from "@/features/public-menu/theme";

const photo = (id: string) => `https://images.unsplash.com/photo-${id}?w=1200&q=80&auto=format`;

const product = (
  over: Partial<PublicProduct> & Pick<PublicProduct, "id" | "name">,
): PublicProduct => ({
  description: null,
  imageUrl: null,
  blurhash: null,
  blurDataUrl: null,
  priceCents: 4500,
  compareAtCents: null,
  tags: [],
  available: true,
  prepMinutes: null,
  optionGroups: [],
  ...over,
});

/** Las mismas variantes que pueden salir en un menú real. */
const SECTIONS = [
  {
    id: "desayunos",
    name: "Desayunos",
    description: "Hasta las 11:00",
    items: [
      {
        featured: true,
        priceCents: 4500,
        product: product({
          id: "chapin",
          name: "Desayuno chapín",
          description:
            "Huevos al gusto, frijoles, plátanos fritos, queso fresco, crema y tortillas recién hechas.",
          imageUrl: photo("1533089860892-a7c6f0a88666"),
          tags: ["popular"],
        }),
      },
      {
        featured: false,
        priceCents: 3500,
        product: product({
          id: "panqueques",
          name: "Panqueques con frutos rojos",
          description: "Tres panqueques esponjosos con miel de maple.",
          imageUrl: photo("1541519227354-08fa5d50c44d"),
          compareAtCents: 4200,
          tags: ["vegetariano", "nuevo"],
        }),
      },
    ],
  },
  {
    id: "fuertes",
    name: "Platos fuertes",
    description: null,
    items: [
      {
        featured: false,
        priceCents: 7800,
        product: product({
          id: "pasta",
          name: "Pasta con mariscos",
          description: "Linguine con camarón y calamar en salsa de tomate.",
          imageUrl: photo("1563379926898-05f4575a45d8"),
          available: false,
        }),
      },
      {
        featured: false,
        priceCents: 3000,
        product: product({ id: "sopa", name: "Sopa del día", description: "Pregunta al mesero." }),
      },
    ],
  },
];

/**
 * Sección 11 · Menú público con la plantilla Clásico. Son los componentes
 * reales (features/public-menu/templates/clasico): si se cambian, cambia aquí
 * y en el menú de cada negocio.
 */
export function PublicMenuDemo() {
  const [paletteId, setPaletteId] = useState("tomate");
  const [slot, setSlot] = useState("almuerzo");

  return (
    <div className="grid gap-6">
      <div role="group" aria-label="Paleta" className="flex flex-wrap gap-2">
        {PALETTE_PRESETS.map((p) => (
          <button
            key={p.id}
            type="button"
            aria-pressed={paletteId === p.id}
            onClick={() => setPaletteId(p.id)}
            className="type-small inline-flex h-10 items-center gap-2 rounded-full border border-border bg-card px-3 font-semibold aria-pressed:ring-3 aria-pressed:ring-ring/40"
          >
            <span aria-hidden className="size-4 rounded-full" style={{ background: p.primary }} />
            {p.name}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-start gap-6">
        {/* Marco de 390 px (iPhone 12–15): la medida del criterio "pixel perfect". */}
        <div
          data-testid="menu-390"
          className="h-[760px] w-[390px] max-w-full overflow-y-auto rounded-[28px] border-8 border-frijol shadow-3"
        >
          <MenuShell theme={themeFromPreset(paletteId)}>
            <MenuHeader
              name="Café El Portal"
              branchName="Antigua"
              description="Desayunos chapines, almuerzos ejecutivos y buen café desde 1998."
              logoUrl={null}
              coverUrl={photo("1517248135467-4c7edcad34c4")}
              hours={{ open: true, label: "Abierto · cierra 22:00" }}
              selectorHref="#publico"
            />
            <SlotChips
              slots={[
                { id: "desayuno", name: "Desayunos" },
                { id: "almuerzo", name: "Almuerzo" },
                { id: "cena", name: "Cena" },
              ]}
              selectedId={slot}
              currentId="almuerzo"
              onSelect={setSlot}
            />
            <MenuNotice icon={<ClockIcon />} tone="info">
              La cena empieza a las 17:30. Mientras tanto, mira lo que viene.
            </MenuNotice>
            <SectionTabs sections={SECTIONS.map((s) => ({ id: `demo-${s.id}`, name: s.name }))} />
            <div className="mt-4 grid gap-8 px-4">
              {SECTIONS.map((section) => (
                <MenuSection
                  key={section.id}
                  id={`demo-${section.id}`}
                  name={section.name}
                  description={section.description}
                >
                  {section.items.map((item) => (
                    <ProductCard
                      key={item.product.id}
                      product={item.product}
                      priceCents={item.priceCents}
                      featured={item.featured}
                    />
                  ))}
                </MenuSection>
              ))}
            </div>
            <MenuFooter showPoweredBy />
          </MenuShell>
        </div>

        <div className="grid max-w-sm gap-3">
          <h3 className="type-h3">Avisos</h3>
          <MenuShell theme={themeFromPreset(paletteId)}>
            <div className="grid gap-2 py-2">
              <MenuNotice icon={<CalendarOffIcon />} tone="closed">
                Cerrado: Feriado
              </MenuNotice>
              <MenuNotice icon={<ClockIcon />} tone="info">
                El desayuno empieza mañana a las 06:30.
              </MenuNotice>
            </div>
          </MenuShell>
          <p className="type-small text-muted-foreground">
            Tarjeta Clásico: texto a la izquierda y foto 4:3 a la derecha que reserva su espacio
            (CLS 0) con el blurhash mientras carga. Variantes: destacado ★, etiquetas, precio
            tachado, agotado (foto en gris) y sin foto.
          </p>
        </div>
      </div>
    </div>
  );
}
