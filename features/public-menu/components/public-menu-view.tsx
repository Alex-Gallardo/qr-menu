"use client";

import { CalendarOffIcon, ClockIcon, PauseCircleIcon } from "lucide-react";
import { useEffect, useState, type ComponentType } from "react";
import { flushSync } from "react-dom";
import { toast } from "sonner";
import { minutesOf, openState } from "@/features/branches/hours";
import { priceCart } from "@/features/cart/cart";
import { useCart } from "@/features/cart/store";
import { hasRequiredGroups } from "@/features/products/options";
import { resolveActiveMenu } from "@/features/schedule/resolve-active-menu";
import { guatemalaNow, gtInstant } from "@/lib/gt-time";
import type { BranchMenuPayload, PublicMenu, PublicProduct } from "../payload";
import { flyToCart } from "../fly-to-cart";
import { expandPhoto } from "../photo-transition";
import {
  closeOrderSheet,
  closeProductSheet,
  openOrderSheet,
  openProductSheet,
  useOpenProductId,
  useOrderSheetOpen,
} from "../sheet-url";
import { CartBar } from "../templates/clasico/cart-bar";
import {
  MenuFooter,
  MenuHeader,
  MenuNotice,
  MenuSection,
  MenuShell,
  ProductCard,
  SectionTabs,
  SlotChips,
} from "../templates/clasico/components";
import type { OrderSheetProps } from "../templates/clasico/order-sheet";
import type { ProductSheetLine, ProductSheetProps } from "../templates/clasico/product-sheet";
import type { MenuTheme } from "../theme";
import { useBranchCart } from "../use-branch-cart";
import { useNowMinute } from "../use-now";
import { rememberBranch } from "./remember-branch";

// Las hojas se descargan bajo demanda (y en segundo plano tras cargar el menú).
let sheetModule: Promise<typeof import("../templates/clasico/product-sheet")> | null = null;
const loadSheet = () => (sheetModule ??= import("../templates/clasico/product-sheet"));
let orderModule: Promise<typeof import("../templates/clasico/order-sheet")> | null = null;
const loadOrder = () => (orderModule ??= import("../templates/clasico/order-sheet"));

const PAUSED = "Esta sucursal no recibe pedidos por ahora.";

type Props = {
  business: {
    id: string;
    slug: string;
    name: string;
    description: string | null;
    logoUrl: string | null;
    coverUrl: string | null;
    theme: MenuTheme;
  };
  branch: {
    id: string;
    slug: string;
    name: string;
    isActive: boolean;
    hours: { weekday: number; opens: string; closes: string }[];
  };
  payload: BranchMenuPayload;
  /** Link al selector si el negocio tiene varias sucursales. */
  selectorHref: string | null;
};

/**
 * Menú público de una sucursal con la plantilla Clásico. El servidor entrega
 * todos los menús activos y el celular decide cuál toca con la hora de
 * Guatemala (resolveActiveMenu); los chips de franja muestran otro menú de hoy.
 * (Galería, Minimal y Tarjetas llegan en QRM-034; mientras tanto, Clásico.)
 */
export function PublicMenuView({ business, branch, payload, selectorHref }: Props) {
  const now = useNowMinute();
  const [pickedSlot, setPickedSlot] = useState<string | null>(null);
  const input = { branchId: branch.id, ...payload.resolver };
  const slots = payload.resolver.slots.filter((s) => s.is_active);

  useEffect(() => rememberBranch(business.slug, branch.slug), [business.slug, branch.slug]);

  // Menú que toca ahora (o el de la franja que el cliente eligió).
  const active = now ? resolveActiveMenu(input, now) : null;
  const pickedStart = slots.find((s) => s.id === pickedSlot)?.start_time;
  const picked =
    now && pickedStart
      ? resolveActiveMenu(input, gtInstant(guatemalaNow(now).date, minutesOf(pickedStart)))
      : null;
  const shown = picked ?? active;
  // Antes de saber la hora (HTML cacheado) se muestra el predeterminado: hay
  // contenido real desde el primer pintado y luego cambia con un fundido.
  const fallbackMenu = payload.menus.find((m) => m.isDefault) ?? payload.menus[0] ?? null;
  const menu: PublicMenu | null =
    (shown?.menuId ? payload.menus.find((m) => m.id === shown.menuId) : null) ??
    (shown ? null : fallbackMenu);
  const hours = now ? openState(branch.hours, guatemalaNow(now)) : null;
  const currentSlotId =
    active?.status === "open" || active?.status === "default" ? (active.slot?.id ?? null) : null;

  // Cascada de entrada solo la primera vez; al cambiar de menú, fundido.
  const [firstMenuId] = useState(() => menu?.id ?? null);
  const cascade = menu?.id === firstMenuId;

  // Hoja de producto (?producto=id) y carrito.
  const openId = useOpenProductId();
  const [Sheet, setSheet] = useState<ComponentType<ProductSheetProps> | null>(null);
  const orderOpen = useOrderSheetOpen();
  const [Order, setOrder] = useState<ComponentType<OrderSheetProps> | null>(null);
  const cartLines = useBranchCart(business, branch);
  const [announce, setAnnounce] = useState("");

  useEffect(() => {
    const id = window.setTimeout(() => void loadSheet().then(loadOrder), 2000);
    return () => window.clearTimeout(id);
  }, []);
  useEffect(() => {
    // Llegó con el link de un producto: se carga la hoja y se abre.
    if (openId && !Sheet) void loadSheet().then((m) => setSheet(() => m.ProductSheet));
  }, [openId, Sheet]);
  useEffect(() => {
    if (orderOpen && !Order) void loadOrder().then((m) => setOrder(() => m.OrderSheet));
  }, [orderOpen, Order]);

  const items = (menu?.sections ?? []).flatMap((s) => s.items);
  const priceIn = (productId: string) =>
    (
      items.find((i) => i.productId === productId) ??
      payload.menus
        .flatMap((m) => m.sections.flatMap((s) => s.items))
        .find((i) => i.productId === productId)
    )?.priceCents ??
    payload.products[productId]?.priceCents ??
    0;

  async function openSheet(productId: string, photo: HTMLElement | null) {
    const { ProductSheet } = await loadSheet();
    expandPhoto(photo, () =>
      flushSync(() => {
        setSheet(() => ProductSheet);
        openProductSheet(productId);
      }),
    );
  }

  // Lo del carrito con los precios y la disponibilidad de hoy en esta sucursal.
  const cart = priceCart(cartLines, {
    product: (id) => payload.products[id],
    priceCents: (id) =>
      payload.menus.some((m) => m.sections.some((s) => s.items.some((i) => i.productId === id)))
        ? priceIn(id)
        : undefined,
  });

  function addLine(product: PublicProduct, line: ProductSheetLine, photo: HTMLElement | null) {
    useCart
      .getState()
      .add(business.id, { ...line, name: product.name, imageUrl: product.imageUrl });
    flyToCart(photo);
    setAnnounce(`Agregado: ${line.quantity} × ${product.name}.`);
  }

  function quickAdd(product: PublicProduct, photo: HTMLElement | null) {
    if (hasRequiredGroups(product.optionGroups)) return void openSheet(product.id, photo);
    addLine(
      product,
      {
        productId: product.id,
        optionIds: [],
        optionNames: [],
        note: "",
        quantity: 1,
        unitCents: priceIn(product.id),
      },
      photo,
    );
  }

  async function openOrder() {
    const { OrderSheet } = await loadOrder();
    setOrder(() => OrderSheet);
    openOrderSheet();
  }

  function clearCart() {
    const before = useCart.getState().carts[business.id];
    useCart.getState().clear(business.id);
    closeOrderSheet();
    if (before?.lines.length)
      toast("Vaciamos tu pedido", {
        action: {
          label: "Deshacer",
          onClick: () => useCart.getState().restore(business.id, before),
        },
      });
  }

  const sheetProduct = openId ? payload.products[openId] : undefined;
  // Si se acabó, otro de su misma sección (o del menú) que sí haya.
  const suggestion = (() => {
    if (!sheetProduct || sheetProduct.available) return null;
    const section = menu?.sections.find((s) =>
      s.items.some((i) => i.productId === sheetProduct.id),
    );
    const pick = [...(section?.items ?? []), ...items]
      .map((i) => payload.products[i.productId])
      .find((p) => p && p.available && p.id !== sheetProduct.id);
    return pick ? { id: pick.id, name: pick.name } : null;
  })();

  return (
    <MenuShell theme={business.theme}>
      <MenuHeader
        name={business.name}
        branchName={branch.name}
        description={business.description}
        logoUrl={business.logoUrl}
        coverUrl={business.coverUrl}
        hours={hours}
        selectorHref={selectorHref}
      />

      {!branch.isActive ? (
        <MenuNotice icon={<PauseCircleIcon />} tone="info">
          Esta sucursal está en pausa: puedes ver el menú, pero por ahora no recibe pedidos.
        </MenuNotice>
      ) : null}

      <SlotChips
        slots={slots}
        selectedId={pickedSlot ?? currentSlotId}
        currentId={currentSlotId}
        onSelect={(id) => setPickedSlot(id === currentSlotId ? null : id)}
      />

      {shown?.status === "closed" ? (
        <MenuNotice icon={<CalendarOffIcon />} tone="closed">
          {shown.message}
        </MenuNotice>
      ) : shown?.status === "upcoming" && !pickedSlot ? (
        <MenuNotice icon={<ClockIcon />} tone="info">
          {shown.message}. Mientras tanto, mira lo que viene.
        </MenuNotice>
      ) : null}

      {menu ? (
        <div key={menu.id} className={cascade ? undefined : "animate-fundido"}>
          <SectionTabs sections={menu.sections.map((s) => ({ id: s.id, name: s.name }))} />
          <main className="mt-4 grid gap-8 px-4" aria-label={menu.name}>
            {menu.description ? (
              <p className="type-small -mb-4 text-[var(--menu-muted)]">{menu.description}</p>
            ) : null}
            {menu.sections.map((section, sectionIndex) => (
              <MenuSection
                key={section.id}
                id={section.id}
                name={section.name}
                description={section.description}
              >
                {section.items.map((item, itemIndex) => {
                  const product = payload.products[item.productId];
                  if (!product) return null;
                  const position =
                    menu.sections.slice(0, sectionIndex).reduce((n, s) => n + s.items.length, 0) +
                    itemIndex;
                  return (
                    <ProductCard
                      key={item.productId}
                      product={product}
                      priceCents={item.priceCents}
                      featured={item.featured}
                      priority={position < 2}
                      appearIndex={cascade ? position : undefined}
                      onOpen={(photo) => void openSheet(product.id, photo)}
                      onQuickAdd={branch.isActive ? (photo) => quickAdd(product, photo) : undefined}
                    />
                  );
                })}
              </MenuSection>
            ))}
          </main>
        </div>
      ) : shown?.status !== "closed" ? (
        <p className="type-body mt-8 px-4 text-center text-[var(--menu-muted)]">
          Este menú todavía no tiene productos.
        </p>
      ) : null}

      <MenuFooter showPoweredBy={business.theme.showPoweredBy} />
      {/* Espacio para que la barra del carrito no tape lo último del menú. */}
      {cart.lines.length > 0 ? <div aria-hidden className="h-20" /> : null}

      <CartBar
        count={cart.count}
        totalCents={cart.totalCents}
        issues={cart.issues}
        announce={announce}
        onOpen={() => void openOrder()}
      />

      {sheetProduct && Sheet ? (
        <Sheet
          product={sheetProduct}
          priceCents={priceIn(sheetProduct.id)}
          blockedReason={branch.isActive ? null : PAUSED}
          suggestion={suggestion}
          onAdd={(line, photo) => {
            addLine(sheetProduct, line, photo);
            closeProductSheet();
          }}
          onSuggest={(id) => openProductSheet(id)}
          onClose={closeProductSheet}
        />
      ) : null}

      {orderOpen && Order ? (
        <Order
          branchName={branch.name}
          lines={cart.lines}
          count={cart.count}
          totalCents={cart.totalCents}
          onQuantity={(key, quantity) => useCart.getState().setQuantity(business.id, key, quantity)}
          onClear={clearCart}
          onClose={closeOrderSheet}
        />
      ) : null}
    </MenuShell>
  );
}
