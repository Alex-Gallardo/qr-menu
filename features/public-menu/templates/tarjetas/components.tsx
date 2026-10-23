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
 * Plantilla Tarjetas: cuadrícula de 2 columnas con foto cuadrada; la
 * descripción completa se ve al abrir el producto. Mismo contenido y
 * comportamiento que Clásico.
 */

export function MenuSection({ id, name, description, children }: MenuSectionProps) {
  return (
    <SectionShell id={id}>
      <SectionHeading id={id} name={name} description={description} />
      <ul className="grid grid-cols-2 gap-3">{children}</ul>
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
        "relative flex flex-col overflow-hidden rounded-[var(--menu-radius)] border border-[var(--menu-line)] bg-[var(--menu-surface)] shadow-1",
        entry.className,
      )}
      style={entry.style}
    >
      <div className="relative">
        <ProductPhoto
          product={product}
          photoRef={photoRef}
          sizes="(max-width: 480px) 50vw, 240px"
          priority={priority}
          className="aspect-square w-full"
        />
        <QuickAdd
          product={product}
          onQuickAdd={onQuickAdd}
          photoRef={photoRef}
          className="absolute right-2 bottom-2"
        />
      </div>
      <div
        className={cn("grid flex-1 content-start gap-1 p-3", !product.available && "opacity-60")}
      >
        <ProductName
          product={product}
          featured={featured}
          onOpen={onOpen}
          photoRef={photoRef}
          className="line-clamp-2"
        />
        <PriceRow product={product} priceCents={priceCents} className="mt-auto pt-1" />
      </div>
    </li>
  );
}
