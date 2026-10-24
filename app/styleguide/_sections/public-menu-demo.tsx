"use client";

import { CalendarOffIcon, ClockIcon } from "lucide-react";
import { useState } from "react";
import { gtInstant, todayInGuatemala } from "@/lib/gt-time";
import { addLine, priceCart, setLineQuantity, type CartLine } from "@/features/cart/cart";
import { TEMPLATE_PARTS } from "@/features/public-menu/templates";
import { orderTiming, type TimingRules } from "@/features/orders/preorder";
import type { PublicProduct } from "@/features/public-menu/payload";
import {
  MenuFooter,
  MenuHeader,
  MenuNotice,
  MenuShell,
  SectionTabs,
  SlotChips,
} from "@/features/public-menu/templates/clasico/components";
import { CartBar } from "@/features/public-menu/templates/clasico/cart-bar";
import { OrderSheet } from "@/features/public-menu/templates/clasico/order-sheet";
import { ProductSheet } from "@/features/public-menu/templates/clasico/product-sheet";
import { themeFromPreset } from "@/features/public-menu/theme";
import { useStyleguideTheme } from "./theme-context";

// Sucursal de ejemplo para la hoja de pedido: abre de 7:00 a 21:00, programa con 30 min.
const DEMO_RULES: TimingRules = {
  hours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens: "07:00", closes: "21:00" })),
  closedDates: [],
  mode: "next_open",
  minLeadMin: 30,
  maxDays: 2,
  preordersEnabled: true,
};
const DEMO_BRANCH = {
  acceptsDineIn: true,
  acceptsTakeout: true,
  acceptsDelivery: true,
  acceptsTransfer: true,
  deliveryFeeCents: 1500,
  minOrderCents: 5000,
  hasBankAccounts: true,
  requiresLocation: true,
  location: { lat: 14.6427, lng: -90.5133 },
  radiusKm: 5,
};
const DEMO_ACCOUNTS = [
  {
    id: "bi",
    bankName: "Banco Industrial",
    accountType: "Monetaria",
    accountNumber: "000-000000-0",
    holderName: "Café El Portal, S.A.",
    instructions: "Envía la foto de tu boleta por WhatsApp.",
  },
];

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
          prepMinutes: 15,
          optionGroups: [
            {
              id: "huevos",
              name: "Huevos",
              min_select: 1,
              max_select: 1,
              options: [
                {
                  id: "estrellados",
                  name: "Estrellados",
                  price_delta_cents: 0,
                  is_available: true,
                },
                { id: "revueltos", name: "Revueltos", price_delta_cents: 0, is_available: true },
                { id: "rancheros", name: "Rancheros", price_delta_cents: 500, is_available: true },
              ],
            },
            {
              id: "extras",
              name: "Extras",
              min_select: 0,
              max_select: 3,
              options: [
                { id: "aguacate", name: "Aguacate", price_delta_cents: 600, is_available: true },
                { id: "queso", name: "Queso extra", price_delta_cents: 500, is_available: true },
                { id: "chorizo", name: "Chorizo", price_delta_cents: 1000, is_available: false },
              ],
            },
          ],
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
  // Paleta y plantilla: el selector de arriba del styleguide.
  const { menuPalette: paletteId, template } = useStyleguideTheme();
  const { MenuSection, ProductCard } = TEMPLATE_PARTS[template];
  const [slot, setSlot] = useState("almuerzo");
  const [sheetId, setSheetId] = useState<string | null>(null);
  const [lines, setLines] = useState<CartLine[]>([]);
  const [orderOpen, setOrderOpen] = useState(false);
  const [branchOpen, setBranchOpen] = useState(true);
  const all = SECTIONS.flatMap((s) => s.items);
  const sheetItem = all.find((i) => i.product.id === sheetId);
  const cart = priceCart(lines, {
    product: (id) => all.find((i) => i.product.id === id)?.product,
    priceCents: (id) => all.find((i) => i.product.id === id)?.priceCents,
  });
  const add = (product: PublicProduct, line: Omit<CartLine, "key" | "name" | "imageUrl">) =>
    setLines((l) => addLine(l, { ...line, name: product.name, imageUrl: product.imageUrl }));

  return (
    <div className="grid gap-6">
      <p className="type-small text-muted-foreground">
        Cambia la paleta y la plantilla con el selector de arriba.
      </p>

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
                      onOpen={() => setSheetId(item.product.id)}
                      onQuickAdd={() =>
                        add(item.product, {
                          productId: item.product.id,
                          optionIds: [],
                          optionNames: [],
                          note: "",
                          quantity: 1,
                          unitCents: item.priceCents,
                        })
                      }
                    />
                  ))}
                </MenuSection>
              ))}
            </div>
            <MenuFooter showPoweredBy />
            <CartBar
              position="sticky"
              count={cart.count}
              totalCents={cart.totalCents}
              issues={cart.issues}
              announce=""
              onOpen={() => setOrderOpen(true)}
            />
            {orderOpen ? (
              <OrderSheet
                branchName="Antigua"
                lines={cart.lines}
                count={cart.count}
                subtotalCents={cart.totalCents}
                checkout={{
                  businessName: "Café El Portal",
                  businessSlug: "cafe-el-portal",
                  otherBranches: [
                    {
                      slug: "antigua",
                      name: "Antigua",
                      location: { lat: 14.5586, lng: -90.7295 },
                      radiusKm: 30,
                      acceptsDelivery: true,
                    },
                  ],
                  branch: DEMO_BRANCH,
                  // Hoy a las 10:00 (abierta) o a las 21:30 (cerrada, para cuando abra).
                  timing: orderTiming(
                    DEMO_RULES,
                    gtInstant(todayInGuatemala(), branchOpen ? 600 : 1290),
                  ),
                  bankAccounts: DEMO_ACCOUNTS,
                  table: branchOpen ? "Mesa 4" : null,
                  blockedReason: null,
                }}
                customer={{
                  name: "",
                  phone: "",
                  email: "",
                  address: "",
                  addressReference: "",
                  location: null,
                  lastOrderType: null,
                  lastPayment: null,
                }}
                onSubmit={() => setOrderOpen(false)}
                onQuantity={(key, q) => setLines((l) => setLineQuantity(l, key, q))}
                onClear={() => {
                  setLines([]);
                  setOrderOpen(false);
                }}
                onClose={() => setOrderOpen(false)}
              />
            ) : null}
            {sheetItem ? (
              <ProductSheet
                product={sheetItem.product}
                priceCents={sheetItem.priceCents}
                blockedReason={null}
                suggestion={
                  sheetItem.product.available ? null : { id: "sopa", name: "Sopa del día" }
                }
                onAdd={(line) => {
                  add(sheetItem.product, line);
                  setSheetId(null);
                }}
                onSuggest={setSheetId}
                onClose={() => setSheetId(null)}
              />
            ) : null}
          </MenuShell>
        </div>

        <div className="grid max-w-sm gap-3">
          <h3 className="type-h3">Avisos</h3>
          <MenuShell
            theme={themeFromPreset(paletteId)}
            className="min-h-0 overflow-hidden rounded-lg [&>div]:pb-0"
          >
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
          <p className="type-small text-muted-foreground">
            Toca una tarjeta para abrir la <strong>hoja de producto</strong> (prueba el Desayuno
            chapín: huevos obligatorios y extras hasta 3, con el total que se actualiza) o el
            agotado para ver la sugerencia. El “+” agrega directo cuando no hay opciones
            obligatorias.
          </p>
          <p className="type-small text-muted-foreground">
            Al agregar aparece la <strong>barra del carrito</strong> con resorte y el contador
            rebota; “Ver pedido” abre la <strong>hoja de pedido</strong>: cantidades, cómo lo quiere
            (con la mesa del QR), ¿para cuándo?, datos, pago con cuentas para transferencia y “Pedir
            por WhatsApp”. En el menú real el carrito y los datos se guardan en el dispositivo.
          </p>
          <div role="group" aria-label="Sucursal de ejemplo" className="flex flex-wrap gap-2">
            {[
              { open: true, label: "Abierta · Mesa 4" },
              { open: false, label: "Cerrada · para cuando abra" },
            ].map((o) => (
              <button
                key={o.label}
                type="button"
                aria-pressed={branchOpen === o.open}
                onClick={() => setBranchOpen(o.open)}
                className="type-small h-10 rounded-full border border-border bg-card px-3 font-semibold aria-pressed:ring-3 aria-pressed:ring-ring/40"
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
