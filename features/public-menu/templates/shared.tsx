"use client";

import { ImageIcon, PlusIcon, StarIcon } from "lucide-react";
import Image from "next/image";
import type { CSSProperties, ReactNode, RefObject } from "react";
import { cn } from "cn";
import { PRODUCT_TAGS } from "@/features/products/catalog";
import { formatQ } from "@/lib/money";
import type { PublicProduct } from "../payload";

/**
 * Piezas comunes de las 4 plantillas (Clásico, Galería, Minimal y Tarjetas):
 * cambian la disposición, no el contenido ni el comportamiento. Así todas
 * pasan el mismo test (tests/unit/templates.test.tsx).
 */

export type ProductCardProps = {
  product: PublicProduct;
  priceCents: number;
  featured: boolean;
  /** Solo las 2 primeras tarjetas cargan la foto con prioridad. */
  priority?: boolean;
  /** Posición para la cascada de entrada (solo la primera vez); undefined = sin animación. */
  appearIndex?: number;
  /** Abre la hoja; recibe la foto para expandirla. Sin esto la tarjeta es solo de lectura. */
  onOpen?: (photo: HTMLElement | null) => void;
  /** Botón "+" (no se muestra si está agotado o no se puede pedir). */
  onQuickAdd?: (photo: HTMLElement | null) => void;
};

export type MenuSectionProps = {
  id: string;
  name: string;
  description: string | null;
  children: ReactNode;
};

/** Cascada de entrada: 40 ms entre tarjetas, solo la primera vez. */
export function appear(appearIndex: number | undefined): {
  className?: string;
  style?: CSSProperties;
} {
  if (appearIndex === undefined) return {};
  return {
    className: "animate-aparecer",
    style: { animationDelay: `${Math.min(appearIndex, 10) * 40}ms` },
  };
}

/** Título y descripción de la sección (ids que usan las pestañas y el lector de pantalla). */
export function SectionHeading({
  id,
  name,
  description,
}: Pick<MenuSectionProps, "id" | "name" | "description">) {
  return (
    <div>
      <h2 id={`titulo-${id}`} className="type-h3">
        {name}
      </h2>
      {description ? <p className="type-small text-[var(--menu-muted)]">{description}</p> : null}
    </div>
  );
}

/** Contenedor de sección con el ancla que usan las pestañas. */
export function SectionShell({ id, children }: { id: string; children: ReactNode }) {
  return (
    <section
      id={`seccion-${id}`}
      aria-labelledby={`titulo-${id}`}
      className="grid scroll-mt-16 gap-3"
    >
      {children}
    </section>
  );
}

/** Nombre del producto: con onOpen toda la tarjeta es el botón (::after la cubre). */
export function ProductName({
  product,
  featured,
  onOpen,
  photoRef,
  large = false,
  className,
}: Pick<ProductCardProps, "product" | "featured" | "onOpen"> & {
  photoRef: RefObject<HTMLDivElement | null>;
  /** Galería: el nombre como título (type-h3). */
  large?: boolean;
  className?: string;
}) {
  return (
    <h3 className={cn(large ? "type-h3" : "type-body font-semibold", className)}>
      {featured ? (
        <StarIcon
          aria-label="Destacado"
          className="mr-1 inline size-4 -translate-y-px fill-[var(--menu-accent)] text-[var(--menu-accent)]"
        />
      ) : null}
      {onOpen ? (
        <button
          type="button"
          aria-haspopup="dialog"
          onClick={() => onOpen(photoRef.current)}
          className="text-left outline-none after:absolute after:inset-0 after:rounded-[var(--menu-radius)] focus-visible:after:ring-3 focus-visible:after:ring-[var(--menu-primary)]/40"
        >
          {product.name}
        </button>
      ) : (
        product.name
      )}
    </h3>
  );
}

/** Precio, precio tachado, "Agotado" y etiquetas (sin precio si la plantilla lo muestra aparte). */
export function PriceRow({
  product,
  priceCents,
  showPrice = true,
  className,
}: Pick<ProductCardProps, "product" | "priceCents"> & {
  showPrice?: boolean;
  className?: string;
}) {
  const struck = Boolean(product.compareAtCents && product.compareAtCents > priceCents);
  if (!showPrice && !struck && product.available && product.tags.length === 0) return null;
  return (
    <p className={cn("flex flex-wrap items-center gap-x-2 gap-y-1", className)}>
      {showPrice ? (
        <span className="type-price text-[var(--menu-text)]">{formatQ(priceCents)}</span>
      ) : null}
      {struck ? (
        <s className="type-small text-[var(--menu-muted)] tabular-nums">
          {formatQ(product.compareAtCents!)}
        </s>
      ) : null}
      {!product.available ? (
        <span className="type-caption rounded-full bg-[var(--menu-text)] px-2 py-0.5 font-semibold text-[var(--menu-surface)]">
          Agotado
        </span>
      ) : null}
      {product.tags.map((t) => (
        <span
          key={t}
          className="type-caption rounded-full bg-[var(--menu-accent)] px-2 py-0.5 font-semibold text-[var(--menu-on-accent)]"
        >
          {PRODUCT_TAGS.find((x) => x.value === t)?.label ?? t}
        </span>
      ))}
    </p>
  );
}

/** Foto que reserva su proporción (CLS 0) con blurhash mientras carga. */
export function ProductPhoto({
  product,
  photoRef,
  sizes,
  priority = false,
  className,
}: {
  product: PublicProduct;
  photoRef: RefObject<HTMLDivElement | null>;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div
      ref={photoRef}
      className={cn(
        "relative grid place-items-center overflow-hidden bg-[var(--menu-soft)] text-[var(--menu-muted)]",
        !product.available && "grayscale",
        className,
      )}
    >
      {product.imageUrl ? (
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          sizes={sizes}
          priority={priority}
          placeholder={product.blurDataUrl ? "blur" : "empty"}
          blurDataURL={product.blurDataUrl ?? undefined}
          className="object-cover"
        />
      ) : (
        <ImageIcon aria-hidden className="size-5" />
      )}
    </div>
  );
}

/** "+" para agregar directo; no aparece si está agotado o no se puede pedir. */
export function QuickAdd({
  product,
  onQuickAdd,
  photoRef,
  className,
}: Pick<ProductCardProps, "product" | "onQuickAdd"> & {
  photoRef: RefObject<HTMLDivElement | null>;
  className: string;
}) {
  if (!onQuickAdd || !product.available) return null;
  return (
    <button
      type="button"
      onClick={() => onQuickAdd(photoRef.current)}
      aria-label={`Agregar ${product.name}`}
      className={cn(
        "z-10 grid size-11 place-items-center rounded-full border-2 border-[var(--menu-surface)] bg-[var(--menu-primary)] text-[var(--menu-on-primary)] shadow-2 transition-transform duration-(--duration-fast) active:scale-90",
        className,
      )}
    >
      <PlusIcon aria-hidden className="size-5" />
    </button>
  );
}
