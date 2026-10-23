"use client";

import { useRef } from "react";
import { cn } from "cn";
import { formatQ } from "@/lib/money";
import {
  appear,
  PriceRow,
  ProductName,
  QuickAdd,
  SectionHeading,
  SectionShell,
  type MenuSectionProps,
  type ProductCardProps,
} from "../shared";

/**
 * Plantilla Minimal: tipográfica, como una carta impresa (nombre · · · precio)
 * y sin fotos en la lista; la foto se ve al abrir el producto. Mismo
 * contenido y comportamiento que Clásico.
 */

export function MenuSection({ id, name, description, children }: MenuSectionProps) {
  return (
    <SectionShell id={id}>
      <SectionHeading id={id} name={name} description={description} />
      <ul className="divide-y divide-[var(--menu-line)] border-y border-[var(--menu-line)]">
        {children}
      </ul>
    </SectionShell>
  );
}

export function ProductCard({
  product,
  priceCents,
  featured,
  appearIndex,
  onOpen,
  onQuickAdd,
}: ProductCardProps) {
  // Sin foto en la lista: la hoja abre sin la transición de la foto.
  const photoRef = useRef<HTMLDivElement>(null);
  const entry = appear(appearIndex);
  return (
    <li
      className={cn("relative flex items-center gap-3 py-3", entry.className)}
      style={entry.style}
    >
      <div className={cn("grid min-w-0 flex-1 gap-1", !product.available && "opacity-60")}>
        <div className="flex items-baseline gap-2">
          <ProductName
            product={product}
            featured={featured}
            onOpen={onOpen}
            photoRef={photoRef}
            className="min-w-0"
          />
          <span
            aria-hidden
            className="min-w-4 flex-1 translate-y-[-0.3em] border-b border-dotted border-[var(--menu-muted)]"
          />
          <span className="type-price shrink-0 text-[var(--menu-text)]">{formatQ(priceCents)}</span>
        </div>
        {product.description ? (
          <p className="type-small line-clamp-2 text-[var(--menu-muted)]">{product.description}</p>
        ) : null}
        <PriceRow product={product} priceCents={priceCents} showPrice={false} />
      </div>
      <QuickAdd
        product={product}
        onQuickAdd={onQuickAdd}
        photoRef={photoRef}
        className="relative shrink-0 shadow-none"
      />
    </li>
  );
}
