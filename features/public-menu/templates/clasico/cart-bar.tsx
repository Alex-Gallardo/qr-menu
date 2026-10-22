"use client";

import { ChevronRightIcon } from "lucide-react";
import type { CSSProperties } from "react";
import { cn } from "cn";
import { productsLabel } from "@/features/cart/cart";
import { formatQ } from "@/lib/money";
import { springEasing } from "../../splash";

// Resorte de la guía para la barra (stiffness 380, damping 32), en CSS.
const SPRING = springEasing(380, 32);

/**
 * Barra del carrito (plantilla Clásico): "3 productos · Q116.00 · Ver pedido".
 * Aparece con resorte al primer producto y el contador rebota con cada uno.
 * `announce` se lee en voz alta (aria-live) al agregar.
 */
export function CartBar({
  count,
  totalCents,
  issues = 0,
  announce,
  onOpen,
  position = "fixed",
}: {
  count: number;
  totalCents: number;
  /** Productos que ya no se pueden pedir (agotados, fuera del menú). */
  issues?: number;
  announce: string;
  onOpen: () => void;
  /** "sticky" dentro de un marco con scroll (styleguide, vista previa de Apariencia). */
  position?: "fixed" | "sticky";
}) {
  return (
    <>
      <p aria-live="polite" className="sr-only">
        {announce}
      </p>
      {count > 0 || issues > 0 ? (
        <div
          className={cn(
            "animate-barra bottom-0 z-30 w-full px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]",
            position === "fixed" ? "fixed inset-x-0 mx-auto max-w-[480px]" : "sticky",
          )}
          style={{ "--barra-ease": SPRING } as CSSProperties}
        >
          <button
            type="button"
            onClick={onOpen}
            aria-haspopup="dialog"
            className="flex h-14 w-full items-center gap-3 rounded-full bg-[var(--menu-primary)] pr-4 pl-2 text-left font-semibold text-[var(--menu-on-primary)] shadow-3 transition-transform duration-(--duration-fast) active:scale-[0.98]"
          >
            <span
              key={count}
              data-cart-target
              className="animate-rebote-contador grid size-10 shrink-0 place-items-center rounded-full bg-[var(--menu-on-primary)] text-[var(--menu-primary)] tabular-nums"
            >
              {count}
            </span>
            <span className="type-small min-w-0 flex-1 truncate">
              {productsLabel(count)} · <span className="tabular-nums">{formatQ(totalCents)}</span>
              {issues > 0 ? (
                <span className="font-normal opacity-85"> · revisar {issues}</span>
              ) : null}
            </span>
            <span className="type-small flex shrink-0 items-center">
              Ver pedido
              <ChevronRightIcon aria-hidden className="size-5" />
            </span>
          </button>
        </div>
      ) : null}
    </>
  );
}
