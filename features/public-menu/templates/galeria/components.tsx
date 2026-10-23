"use client";

import { useRef } from "react";
import { cn } from "cn";
import {
  appear,
  PriceRow,
  ProductName,
  ProductPhoto,
  QuickAdd,
  SectionHeading,
  SectionShell,
  type MenuSectionProps,
  type ProductCardProps,
} from "../shared";

/**
 * Plantilla Galería: fotos grandes a lo ancho, para negocios que se venden
 * por la vista. Mismo contenido y comportamiento que Clásico.
 */

export function MenuSection({ id, name, description, children }: MenuSectionProps) {
  return (
    <SectionShell id={id}>
      <SectionHeading id={id} name={name} description={description} />
      <ul className="grid gap-5">{children}</ul>
    </SectionShell>
  );
}

export function ProductCard({
  product,
  priceCents,
  featured,
  priority = false,
  appearIndex,
  onOpen,
  onQuickAdd,
}: ProductCardProps) {
  const photoRef = useRef<HTMLDivElement>(null);
  const entry = appear(appearIndex);
  return (
    <li
      className={cn(
        "relative overflow-hidden rounded-[var(--menu-radius)] border border-[var(--menu-line)] bg-[var(--menu-surface)] shadow-1",
        entry.className,
      )}
      style={entry.style}
    >
      <div className="relative">
        <ProductPhoto
          product={product}
          photoRef={photoRef}
          sizes="(max-width: 480px) 100vw, 480px"
          priority={priority}
          className="aspect-[4/3] w-full"
        />
        <QuickAdd
          product={product}
          onQuickAdd={onQuickAdd}
          photoRef={photoRef}
          className="absolute right-3 bottom-3"
        />
      </div>
      <div className={cn("grid gap-1 p-4", !product.available && "opacity-60")}>
        <ProductName
          product={product}
          featured={featured}
          onOpen={onOpen}
          photoRef={photoRef}
          large
        />
        {product.description ? (
          <p className="type-small line-clamp-3 text-[var(--menu-muted)]">{product.description}</p>
        ) : null}
        <PriceRow product={product} priceCents={priceCents} className="pt-1" />
      </div>
    </li>
  );
}
