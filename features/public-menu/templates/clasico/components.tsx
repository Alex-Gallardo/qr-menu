"use client";

import { ArrowLeftRightIcon, ImageIcon, PlusIcon, StarIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { cn } from "cn";
import { PoweredBy } from "@/components/brand/powered-by";
import { PRODUCT_TAGS } from "@/features/products/catalog";
import { formatQ } from "@/lib/money";
import type { PublicProduct } from "../../payload";
import { fontClasses } from "@/features/appearance/font-loaders";
import { canvasBackground, heroBackground, themeStyle, type MenuTheme } from "../../theme";

/**
 * Plantilla Clásico: lista con la foto a la derecha. Estos componentes son los
 * mismos que muestra /styleguide (sección 11): lo que se ve allí es lo que ve
 * el cliente. Solo usan las variables --menu-* del tema del negocio.
 */

/**
 * Columna de 480 px con los colores y las fuentes del negocio. Su fondo
 * (degradado, imagen o el poster del video) se ve a los lados en pantallas
 * grandes; en el celular, en la portada (MenuHeader).
 */
export function MenuShell({
  theme,
  children,
  className,
}: {
  theme: MenuTheme;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      style={
        {
          ...themeStyle(theme),
          background: canvasBackground(theme),
          fontFamily: "var(--menu-font-body)",
        } as CSSProperties
      }
      className={cn(
        "min-h-dvh text-[var(--menu-text)]",
        fontClasses(theme.fontHeading, theme.fontBody),
        className,
      )}
    >
      <div className="mx-auto w-full max-w-[480px] bg-[var(--menu-bg)] pb-16">{children}</div>
    </div>
  );
}

/** Video de fondo en la portada: sin sonido y solo si el celular no ahorra datos ni movimiento. */
function HeroVideo({ url, poster }: { url: string; poster: string | null }) {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const saveData = (navigator as { connection?: { saveData?: boolean } }).connection?.saveData;
    if (!reduce && !saveData) video.play().catch(() => {});
  }, [url]);
  return (
    <video
      ref={ref}
      src={url}
      poster={poster ?? undefined}
      muted
      loop
      playsInline
      preload="metadata"
      aria-hidden
      className="absolute inset-0 size-full object-cover"
    />
  );
}

export function MenuHeader({
  name,
  branchName,
  description,
  logoUrl,
  coverUrl,
  hours,
  selectorHref,
  theme,
}: {
  name: string;
  branchName: string;
  description: string | null;
  logoUrl: string | null;
  coverUrl: string | null;
  /** Estado de horario (se calcula en el celular; null mientras tanto). */
  hours: { open: boolean; label: string } | null;
  selectorHref: string | null;
  /** Fondo del negocio para la portada (video, o degradado/imagen si no hay foto). */
  theme?: MenuTheme;
}) {
  const bg = theme?.background;
  const hero = theme && !coverUrl ? heroBackground(theme) : null;
  return (
    <header>
      {/* La portada reserva su proporción 16:9: no empuja nada al cargar. */}
      <div className="relative aspect-[16/9] w-full overflow-hidden bg-[var(--menu-soft)]">
        {bg?.type === "video" ? (
          <>
            <HeroVideo url={bg.url} poster={bg.poster ?? coverUrl} />
            <span
              aria-hidden
              className="absolute inset-0 bg-black"
              style={{ opacity: theme!.overlay }}
            />
          </>
        ) : hero ? (
          <div aria-hidden className="size-full" style={{ background: hero }} />
        ) : coverUrl ? (
          <Image
            src={coverUrl}
            alt=""
            fill
            priority
            sizes="(max-width: 480px) 100vw, 480px"
            className="object-cover"
          />
        ) : (
          <div
            aria-hidden
            className="size-full bg-[radial-gradient(circle_at_30%_20%,var(--menu-accent),transparent_55%),linear-gradient(135deg,var(--menu-primary),color-mix(in_oklab,var(--menu-primary)_70%,black))]"
          />
        )}
      </div>
      <div className="relative -mt-10 grid gap-1.5 px-4">
        <span className="relative grid size-20 place-items-center overflow-hidden rounded-full border-4 border-[var(--menu-bg)] bg-[var(--menu-surface)] shadow-2">
          {logoUrl ? (
            <Image
              src={logoUrl}
              alt={`Logo de ${name}`}
              fill
              sizes="80px"
              className="object-cover"
            />
          ) : (
            <span className="font-heading text-3xl font-bold text-[var(--menu-primary)]">
              {name.slice(0, 1)}
            </span>
          )}
        </span>
        <h1 className="type-h1 mt-1">{name}</h1>
        <p className="type-small flex min-h-6 flex-wrap items-center gap-x-2 gap-y-1">
          <span className="font-semibold">{branchName}</span>
          {hours ? (
            <>
              <span aria-hidden className="text-[var(--menu-muted)]">
                ·
              </span>
              <span
                className={cn(
                  "font-semibold",
                  hours.open ? "text-success" : "text-[var(--menu-muted)]",
                )}
              >
                {hours.label}
              </span>
            </>
          ) : null}
        </p>
        {description ? (
          <p className="type-small line-clamp-2 text-[var(--menu-muted)]">{description}</p>
        ) : null}
        {selectorHref ? (
          <Link
            href={selectorHref}
            className="type-small inline-flex h-10 items-center gap-1.5 justify-self-start font-semibold text-[var(--menu-primary)] underline-offset-4 hover:underline"
          >
            <ArrowLeftRightIcon aria-hidden className="size-4" />
            Cambiar sucursal
          </Link>
        ) : null}
      </div>
    </header>
  );
}

/** Chips de franja: "Desayunos · Almuerzo · ahora · Cena". */
export function SlotChips({
  slots,
  selectedId,
  currentId,
  onSelect,
}: {
  slots: { id: string; name: string }[];
  selectedId: string | null;
  currentId: string | null;
  onSelect: (slotId: string) => void;
}) {
  if (slots.length < 2) return null;
  return (
    <nav aria-label="Menú por franja" className="mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
      {slots.map((slot) => (
        <button
          key={slot.id}
          type="button"
          aria-pressed={selectedId === slot.id}
          onClick={() => onSelect(slot.id)}
          className="type-small h-10 shrink-0 rounded-full border border-[var(--menu-line)] bg-[var(--menu-surface)] px-4 font-semibold whitespace-nowrap transition-colors aria-pressed:border-[var(--menu-primary)] aria-pressed:bg-[var(--menu-primary)] aria-pressed:text-[var(--menu-on-primary)]"
        >
          {slot.name}
          {currentId === slot.id ? <span className="font-normal opacity-80"> · ahora</span> : null}
        </button>
      ))}
    </nav>
  );
}

/**
 * Pestañas de secciones fijas arriba al hacer scroll, con scroll-spy: se marca
 * la sección que está en pantalla y tocar una lleva a ella.
 */
export function SectionTabs({ sections }: { sections: { id: string; name: string }[] }) {
  const [active, setActive] = useState(sections[0]?.id ?? null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const targets = sections
      .map((s) => document.getElementById(`seccion-${s.id}`))
      .filter((el): el is HTMLElement => el !== null);
    if (targets.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const top = visible.sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0]!;
        setActive(top.target.id.replace("seccion-", ""));
      },
      // Franja de lectura: debajo de las pestañas fijas, mitad superior de la pantalla.
      { rootMargin: "-64px 0px -55% 0px" },
    );
    targets.forEach((t) => observer.observe(t));
    return () => observer.disconnect();
  }, [sections]);

  useEffect(() => {
    const tab = navRef.current?.querySelector<HTMLElement>(`[data-tab="${active}"]`);
    tab?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [active]);

  if (sections.length < 2) return null;
  return (
    <nav
      ref={navRef}
      aria-label="Secciones del menú"
      className="sticky top-0 z-20 mt-4 flex gap-1 overflow-x-auto border-b border-[var(--menu-line)] bg-[var(--menu-bg)]/95 px-3 backdrop-blur"
    >
      {sections.map((s) => (
        <a
          key={s.id}
          href={`#seccion-${s.id}`}
          data-tab={s.id}
          aria-current={active === s.id ? "true" : undefined}
          onClick={() => setActive(s.id)}
          className="type-small relative flex h-12 shrink-0 items-center px-3 font-semibold whitespace-nowrap text-[var(--menu-muted)] aria-[current=true]:text-[var(--menu-text)] aria-[current=true]:after:absolute aria-[current=true]:after:inset-x-3 aria-[current=true]:after:bottom-0 aria-[current=true]:after:h-0.5 aria-[current=true]:after:rounded-full aria-[current=true]:after:bg-[var(--menu-primary)]"
        >
          {s.name}
        </a>
      ))}
    </nav>
  );
}

export function MenuSection({
  id,
  name,
  description,
  children,
}: {
  id: string;
  name: string;
  description: string | null;
  children: ReactNode;
}) {
  return (
    <section
      id={`seccion-${id}`}
      aria-labelledby={`titulo-${id}`}
      className="grid scroll-mt-16 gap-3"
    >
      <div>
        <h2 id={`titulo-${id}`} className="type-h3">
          {name}
        </h2>
        {description ? <p className="type-small text-[var(--menu-muted)]">{description}</p> : null}
      </div>
      <ul className="grid gap-3">{children}</ul>
    </section>
  );
}

/**
 * Tarjeta Clásico: texto a la izquierda, foto 4:3 a la derecha. La foto
 * reserva su espacio (CLS 0) y muestra el blurhash mientras carga. Tocarla
 * abre la hoja de producto; el "+" agrega directo si no hay opciones
 * obligatorias (si las hay, también abre la hoja).
 */
export function ProductCard({
  product,
  priceCents,
  featured,
  priority = false,
  appearIndex,
  onOpen,
  onQuickAdd,
}: {
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
}) {
  const soldOut = !product.available;
  const photoRef = useRef<HTMLDivElement>(null);
  return (
    <li
      className={cn(
        "relative rounded-[var(--menu-radius)] border border-[var(--menu-line)] bg-[var(--menu-surface)] shadow-1",
        appearIndex !== undefined && "animate-aparecer",
      )}
      style={
        appearIndex !== undefined
          ? { animationDelay: `${Math.min(appearIndex, 10) * 40}ms` }
          : undefined
      }
    >
      <div className="flex gap-3 p-3">
        <div className={cn("grid min-w-0 flex-1 content-start gap-1", soldOut && "opacity-60")}>
          <h3 className="type-body font-semibold">
            {featured ? (
              <StarIcon
                aria-label="Destacado"
                className="mr-1 inline size-4 -translate-y-px fill-[var(--menu-accent)] text-[var(--menu-accent)]"
              />
            ) : null}
            {onOpen ? (
              // Toda la tarjeta es el botón (::after la cubre); el "+" queda encima.
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
          {product.description ? (
            <p className="type-small line-clamp-2 text-[var(--menu-muted)]">
              {product.description}
            </p>
          ) : null}
          <p className="mt-auto flex flex-wrap items-center gap-x-2 gap-y-1 pt-1">
            <span className="type-price text-[var(--menu-text)]">{formatQ(priceCents)}</span>
            {product.compareAtCents && product.compareAtCents > priceCents ? (
              <s className="type-small text-[var(--menu-muted)] tabular-nums">
                {formatQ(product.compareAtCents)}
              </s>
            ) : null}
            {soldOut ? (
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
        </div>
        <div
          ref={photoRef}
          className={cn(
            "relative grid aspect-[4/3] w-28 shrink-0 place-items-center self-start overflow-hidden rounded-[calc(var(--menu-radius)*0.75)] bg-[var(--menu-soft)] text-[var(--menu-muted)]",
            soldOut && "grayscale",
          )}
        >
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              sizes="112px"
              priority={priority}
              placeholder={product.blurDataUrl ? "blur" : "empty"}
              blurDataURL={product.blurDataUrl ?? undefined}
              className="object-cover"
            />
          ) : (
            <ImageIcon aria-hidden className="size-5" />
          )}
        </div>
      </div>
      {onQuickAdd && !soldOut ? (
        // Esquina inferior derecha de la foto (p-3 + 84 px de alto − 44 px del botón + 6 px).
        <button
          type="button"
          onClick={() => onQuickAdd(photoRef.current)}
          aria-label={`Agregar ${product.name}`}
          className="absolute top-[58px] right-1.5 z-10 grid size-11 place-items-center rounded-full border-2 border-[var(--menu-surface)] bg-[var(--menu-primary)] text-[var(--menu-on-primary)] shadow-2 transition-transform duration-(--duration-fast) active:scale-90"
        >
          <PlusIcon aria-hidden className="size-5" />
        </button>
      ) : null}
    </li>
  );
}

export function MenuNotice({
  icon,
  tone,
  children,
}: {
  icon: ReactNode;
  tone: "closed" | "info";
  children: ReactNode;
}) {
  return (
    <p
      role="status"
      className={cn(
        "type-small mx-4 mt-3 flex items-center gap-2 rounded-[var(--menu-radius)] px-4 py-3 font-semibold [&_svg]:size-5 [&_svg]:shrink-0",
        tone === "closed"
          ? "bg-[color-mix(in_oklab,var(--color-destructive)_12%,var(--menu-surface))] text-destructive"
          : "bg-[var(--menu-soft)]",
      )}
    >
      {icon}
      {children}
    </p>
  );
}

export function MenuFooter({ showPoweredBy }: { showPoweredBy: boolean }) {
  if (!showPoweredBy) return null;
  return (
    <footer className="mt-10 flex justify-center px-4 text-[var(--menu-muted)]">
      <PoweredBy />
    </footer>
  );
}
