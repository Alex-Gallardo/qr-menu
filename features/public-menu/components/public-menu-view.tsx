"use client";

import {
  ArrowLeftRightIcon,
  CalendarOffIcon,
  ClockIcon,
  ImageIcon,
  PauseCircleIcon,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "cn";
import { minutesOf, openState } from "@/features/branches/hours";
import { PRODUCT_TAGS } from "@/features/products/catalog";
import { resolveActiveMenu } from "@/features/schedule/resolve-active-menu";
import { guatemalaNow, gtInstant } from "@/lib/gt-time";
import { formatQ } from "@/lib/money";
import type { BranchMenuPayload, PublicMenu } from "../payload";
import { useNowMinute } from "../use-now";
import { rememberBranch } from "./remember-branch";

type Props = {
  business: {
    slug: string;
    name: string;
    description: string | null;
    logoUrl: string | null;
    coverUrl: string | null;
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
 * Menú público de una sucursal. El servidor entrega todos los menús activos y
 * el celular decide cuál toca con la hora de Guatemala (resolveActiveMenu); los
 * chips de franja dejan ver otro menú del día. La plantilla visual completa
 * llega en QRM-021.
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
  const fallbackMenu = payload.menus.find((m) => m.isDefault) ?? payload.menus[0] ?? null;
  const menu: PublicMenu | null =
    (shown?.menuId ? payload.menus.find((m) => m.id === shown.menuId) : null) ??
    (shown ? null : fallbackMenu);
  const hours = now ? openState(branch.hours, guatemalaNow(now)) : null;
  const currentSlotId =
    active?.status === "open" || active?.status === "default" ? active.slot?.id : null;

  return (
    <div className="mx-auto min-h-dvh w-full max-w-[480px] bg-background pb-16">
      <header className="relative">
        <div className="aspect-[16/9] w-full overflow-hidden bg-muted">
          {business.coverUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={business.coverUrl}
              alt=""
              className="size-full object-cover"
              fetchPriority="high"
            />
          ) : null}
        </div>
        <div className="-mt-10 grid gap-2 px-4">
          <span className="grid size-20 place-items-center overflow-hidden rounded-full border-4 border-background bg-card shadow-2">
            {business.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={business.logoUrl}
                alt={`Logo de ${business.name}`}
                className="size-full object-cover"
              />
            ) : (
              <span className="type-h3 text-primary">{business.name.slice(0, 1)}</span>
            )}
          </span>
          <h1 className="type-h1">{business.name}</h1>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="type-body font-semibold">{branch.name}</span>
            {hours ? (
              <span
                className={cn(
                  "type-small font-semibold",
                  hours.open ? "text-success" : "text-muted-foreground",
                )}
              >
                {hours.label}
              </span>
            ) : null}
            {selectorHref ? (
              <Link
                href={selectorHref}
                className="type-small inline-flex items-center gap-1 font-semibold text-tomate-700 underline-offset-4 hover:underline"
              >
                <ArrowLeftRightIcon aria-hidden className="size-4" />
                Cambiar sucursal
              </Link>
            ) : null}
          </div>
          {business.description ? (
            <p className="type-small text-muted-foreground">{business.description}</p>
          ) : null}
        </div>
      </header>

      {!branch.isActive ? (
        <Notice icon={<PauseCircleIcon />} tone="muted">
          Esta sucursal está en pausa: puedes ver el menú, pero por ahora no recibe pedidos.
        </Notice>
      ) : null}

      {slots.length > 1 ? (
        <nav aria-label="Menú por franja" className="mt-4 flex gap-2 overflow-x-auto px-4 pb-1">
          {slots.map((slot) => {
            const selected = pickedSlot ? pickedSlot === slot.id : currentSlotId === slot.id;
            return (
              <button
                key={slot.id}
                type="button"
                aria-pressed={selected}
                onClick={() => setPickedSlot(pickedSlot === slot.id ? null : slot.id)}
                className="type-small h-10 shrink-0 rounded-full border border-border bg-card px-4 font-semibold whitespace-nowrap aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
              >
                {slot.name}
                {currentSlotId === slot.id ? " · ahora" : ""}
              </button>
            );
          })}
        </nav>
      ) : null}

      {shown?.status === "closed" ? (
        <Notice icon={<CalendarOffIcon />} tone="closed">
          {shown.message}
        </Notice>
      ) : shown?.status === "upcoming" && !pickedSlot ? (
        <Notice icon={<ClockIcon />} tone="muted">
          {shown.message}. Mientras tanto, mira lo que viene.
        </Notice>
      ) : null}

      {menu ? (
        <main className="mt-4 grid gap-6 px-4" aria-label={menu.name}>
          <div>
            <h2 className="type-h2">{menu.name}</h2>
            {menu.description ? (
              <p className="type-small text-muted-foreground">{menu.description}</p>
            ) : null}
          </div>
          {menu.sections.map((section) => (
            <section key={section.id} aria-labelledby={`sec-${section.id}`} className="grid gap-3">
              <h3 id={`sec-${section.id}`} className="type-h3">
                {section.name}
              </h3>
              {section.description ? (
                <p className="type-small -mt-2 text-muted-foreground">{section.description}</p>
              ) : null}
              <ul className="grid gap-3">
                {section.items.map((item) => {
                  const product = payload.products[item.productId];
                  if (!product) return null;
                  return (
                    <li
                      key={item.productId}
                      className={cn(
                        "flex gap-3 rounded-lg border border-border bg-card p-3 shadow-1",
                        !product.available && "opacity-60",
                      )}
                    >
                      <div className="grid min-w-0 flex-1 content-start gap-1">
                        <p className="type-body font-semibold">
                          {item.featured ? <span aria-label="Destacado">★ </span> : null}
                          {product.name}
                        </p>
                        {product.description ? (
                          <p className="type-small line-clamp-2 text-muted-foreground">
                            {product.description}
                          </p>
                        ) : null}
                        <p className="type-small flex flex-wrap items-center gap-2">
                          <span className="font-semibold tabular-nums">
                            {formatQ(item.priceCents)}
                          </span>
                          {product.compareAtCents && product.compareAtCents > item.priceCents ? (
                            <s className="text-muted-foreground tabular-nums">
                              {formatQ(product.compareAtCents)}
                            </s>
                          ) : null}
                          {!product.available ? (
                            <span className="type-caption rounded-full bg-destructive/10 px-2 py-0.5 font-semibold text-destructive">
                              Agotado
                            </span>
                          ) : null}
                          {product.tags.map((t) => (
                            <span key={t} className="type-caption rounded-full bg-nube px-2 py-0.5">
                              {PRODUCT_TAGS.find((x) => x.value === t)?.label ?? t}
                            </span>
                          ))}
                        </p>
                      </div>
                      <span className="grid aspect-[4/3] w-24 shrink-0 place-items-center overflow-hidden rounded-md bg-muted text-muted-foreground">
                        {product.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={product.imageUrl}
                            alt={product.name}
                            loading="lazy"
                            className="size-full object-cover"
                          />
                        ) : (
                          <ImageIcon aria-hidden className="size-5" />
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </main>
      ) : shown?.status !== "closed" ? (
        <p className="type-body mt-8 px-4 text-center text-muted-foreground">
          Este menú todavía no tiene productos.
        </p>
      ) : null}
    </div>
  );
}

function Notice({
  icon,
  tone,
  children,
}: {
  icon: React.ReactNode;
  tone: "closed" | "muted";
  children: React.ReactNode;
}) {
  return (
    <p
      role="status"
      className={cn(
        "type-small mx-4 mt-4 flex items-center gap-2 rounded-lg px-4 py-3 font-semibold [&_svg]:size-5 [&_svg]:shrink-0",
        tone === "closed" ? "bg-destructive/10 text-destructive" : "bg-muted text-foreground",
      )}
    >
      {icon}
      {children}
    </p>
  );
}
