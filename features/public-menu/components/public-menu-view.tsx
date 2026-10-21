"use client";

import { CalendarOffIcon, ClockIcon, PauseCircleIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { minutesOf, openState } from "@/features/branches/hours";
import { resolveActiveMenu } from "@/features/schedule/resolve-active-menu";
import { guatemalaNow, gtInstant } from "@/lib/gt-time";
import type { BranchMenuPayload, PublicMenu } from "../payload";
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
import type { MenuTheme } from "../theme";
import { useNowMinute } from "../use-now";
import { rememberBranch } from "./remember-branch";

type Props = {
  business: {
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
    </MenuShell>
  );
}
