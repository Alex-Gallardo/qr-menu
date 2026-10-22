"use client";

import { ClockIcon, ImageIcon, MinusIcon, PlusIcon, XIcon } from "lucide-react";
import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "cn";
import { PRODUCT_TAGS } from "@/features/products/catalog";
import { describeGroup, type OptionGroup } from "@/features/products/options";
import { formatQ } from "@/lib/money";
import {
  clampQuantity,
  defaultSelection,
  MAX_NOTE,
  MAX_QUANTITY,
  priceLine,
  toggleOption,
} from "../../cart-line";
import type { PublicProduct } from "../../payload";

export type ProductSheetLine = {
  productId: string;
  optionIds: string[];
  optionNames: string[];
  note: string;
  quantity: number;
  unitCents: number;
};

export type ProductSheetProps = {
  product: PublicProduct;
  /** Precio en este menú y sucursal (producto → menú → sucursal). */
  priceCents: number;
  /** null = se puede pedir; si no, por qué no (sucursal en pausa…). */
  blockedReason: string | null;
  /** Otro platillo de la sección para cuando este se acabó. */
  suggestion: { id: string; name: string } | null;
  /** Recibe la foto de la hoja para que vuele a la barra del carrito. */
  onAdd: (line: ProductSheetLine, photo: HTMLElement | null) => void;
  onSuggest: (productId: string) => void;
  onClose: () => void;
};

/**
 * Hoja de producto (plantilla Clásico): foto grande, descripción, grupos de
 * opciones, nota y cantidad, con "Agregar · Q54.00" que se actualiza al elegir.
 * Es un <dialog> nativo que sube desde abajo; la foto de la tarjeta se expande
 * a la de la hoja con una View Transition donde el navegador la soporta.
 * Se carga bajo demanda (no pesa en el JS inicial del menú).
 */
export function ProductSheet(props: ProductSheetProps) {
  // Cambiar de producto (sugerencia) reinicia la selección.
  return <Sheet key={props.product.id} {...props} />;
}

function Sheet({
  product,
  priceCents,
  blockedReason,
  suggestion,
  onAdd,
  onSuggest,
  onClose,
}: ProductSheetProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const photoRef = useRef<HTMLDivElement>(null);
  const groups = product.optionGroups;
  const [selected, setSelected] = useState(() => defaultSelection(groups));
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState("");
  const [showProblems, setShowProblems] = useState(false);

  // En layout effect: dentro de la View Transition la hoja ya debe estar abierta.
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", ""); // jsdom
  }, []);

  const line = priceLine({ priceCents, groups, selectedOptionIds: selected, quantity });
  const problemFor = (groupId: string) =>
    showProblems ? line.problems.find((p) => p.groupId === groupId)?.message : undefined;
  const soldOut = !product.available;

  function add() {
    if (!line.ok) {
      setShowProblems(true);
      const first = line.problems[0]?.groupId;
      const el = first ? ref.current?.querySelector<HTMLElement>(`[data-group="${first}"]`) : null;
      el?.scrollIntoView?.({ block: "center", behavior: "smooth" });
      el?.querySelector<HTMLInputElement>("input:not(:disabled)")?.focus({ preventScroll: true });
      return;
    }
    onAdd(
      {
        productId: product.id,
        optionIds: selected,
        optionNames: line.optionNames,
        note: note.trim(),
        quantity: line.quantity,
        unitCents: line.unitCents,
      },
      photoRef.current,
    );
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="hoja-titulo"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      // Tocar fuera de la hoja (el fondo) la cierra.
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="product-sheet animate-subir mx-auto mt-auto mb-0 flex max-h-[92dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[calc(var(--menu-radius)*1.25)] border-0 bg-[var(--menu-surface)] p-0 text-[var(--menu-text)] shadow-3 backdrop:bg-black/50 open:flex"
    >
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
        <div
          ref={photoRef}
          className={cn(
            "relative grid aspect-[4/3] w-full place-items-center overflow-hidden bg-[var(--menu-soft)] text-[var(--menu-muted)] [view-transition-name:foto-producto]",
            soldOut && "grayscale",
          )}
        >
          {product.imageUrl ? (
            <Image
              src={product.imageUrl}
              alt={product.name}
              fill
              sizes="(max-width: 480px) 100vw, 480px"
              placeholder={product.blurDataUrl ? "blur" : "empty"}
              blurDataURL={product.blurDataUrl ?? undefined}
              className="object-cover"
            />
          ) : (
            <ImageIcon aria-hidden className="size-8" />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="absolute top-3 right-3 grid size-11 place-items-center rounded-full bg-[var(--menu-surface)]/90 text-[var(--menu-text)] shadow-2 backdrop-blur"
          >
            <XIcon aria-hidden className="size-5" />
          </button>
        </div>

        <div className="grid gap-5 p-4">
          <div className="grid gap-1.5">
            <h2 id="hoja-titulo" className="type-h2">
              {product.name}
            </h2>
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="type-price">{formatQ(priceCents)}</span>
              {product.compareAtCents && product.compareAtCents > priceCents ? (
                <s className="type-small text-[var(--menu-muted)] tabular-nums">
                  {formatQ(product.compareAtCents)}
                </s>
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
            {product.description ? (
              <p className="type-body text-[var(--menu-muted)]">{product.description}</p>
            ) : null}
            {product.prepMinutes ? (
              <p className="type-small flex items-center gap-1.5 text-[var(--menu-muted)]">
                <ClockIcon aria-hidden className="size-4" />
                Listo en unos {product.prepMinutes} min
              </p>
            ) : null}
          </div>

          {soldOut ? (
            <div
              role="status"
              className="type-small grid gap-2 rounded-[var(--menu-radius)] bg-[var(--menu-soft)] p-4"
            >
              <p className="font-semibold">
                Este se nos acabó aquí.
                {suggestion ? ` ¿Te animas con ${withArticle(suggestion.name)}?` : null}
              </p>
              {suggestion ? (
                <button
                  type="button"
                  onClick={() => onSuggest(suggestion.id)}
                  className="h-10 justify-self-start rounded-full bg-[var(--menu-primary)] px-4 font-semibold text-[var(--menu-on-primary)]"
                >
                  Ver {suggestion.name}
                </button>
              ) : null}
            </div>
          ) : (
            <>
              {groups.map((group) => (
                <OptionGroupField
                  key={group.id}
                  group={group}
                  selected={selected}
                  problem={problemFor(group.id)}
                  onToggle={(optionId) => setSelected((s) => toggleOption(group, s, optionId))}
                />
              ))}

              <label className="grid gap-1.5">
                <span className="type-small font-semibold">
                  Nota para la cocina <span className="font-normal">(opcional)</span>
                </span>
                <textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value.slice(0, MAX_NOTE))}
                  maxLength={MAX_NOTE}
                  rows={2}
                  placeholder="Sin cebolla, bien cocido…"
                  className="type-body resize-none rounded-[calc(var(--menu-radius)*0.75)] border border-[var(--menu-line)] bg-[var(--menu-bg)] px-3 py-2 outline-none placeholder:text-[var(--menu-muted)] focus-visible:border-[var(--menu-primary)] focus-visible:ring-3 focus-visible:ring-[var(--menu-primary)]/25"
                />
                <span className="type-caption justify-self-end text-[var(--menu-muted)] tabular-nums">
                  {note.length}/{MAX_NOTE}
                </span>
              </label>
            </>
          )}
        </div>
      </div>

      {soldOut ? null : (
        <footer className="grid gap-2 border-t border-[var(--menu-line)] bg-[var(--menu-surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {blockedReason ? (
            <p role="status" className="type-small text-center text-[var(--menu-muted)]">
              {blockedReason}
            </p>
          ) : null}
          <div className="flex items-center gap-3">
            <div
              role="group"
              aria-label="Cantidad"
              className="flex items-center rounded-full border border-[var(--menu-line)]"
            >
              <button
                type="button"
                aria-label="Quitar uno"
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => clampQuantity(q - 1))}
                className="grid size-12 place-items-center rounded-full disabled:opacity-40"
              >
                <MinusIcon aria-hidden className="size-5" />
              </button>
              <output aria-live="polite" className="type-price w-6 text-center">
                {quantity}
              </output>
              <button
                type="button"
                aria-label="Agregar uno"
                disabled={quantity >= MAX_QUANTITY}
                onClick={() => setQuantity((q) => clampQuantity(q + 1))}
                className="grid size-12 place-items-center rounded-full disabled:opacity-40"
              >
                <PlusIcon aria-hidden className="size-5" />
              </button>
            </div>
            <button
              type="button"
              onClick={add}
              disabled={blockedReason !== null}
              className="type-body flex h-12 flex-1 items-center justify-center gap-1 rounded-full bg-[var(--menu-primary)] px-4 font-semibold text-[var(--menu-on-primary)] transition-transform active:scale-[0.96] disabled:opacity-50"
            >
              Agregar · <span className="tabular-nums">{formatQ(line.totalCents)}</span>
            </button>
          </div>
        </footer>
      )}
    </dialog>
  );
}

function OptionGroupField({
  group,
  selected,
  problem,
  onToggle,
}: {
  group: OptionGroup;
  selected: readonly string[];
  problem: string | undefined;
  onToggle: (optionId: string) => void;
}) {
  // Obligatorio de 1 → radios; lo demás → casillas (una opcional se puede quitar).
  const radio = group.min_select === 1 && group.max_select === 1;
  const count = group.options.filter((o) => selected.includes(o.id)).length;
  const full = !radio && count >= group.max_select;
  const required = group.min_select > 0;

  return (
    <fieldset
      data-group={group.id}
      aria-invalid={problem ? true : undefined}
      aria-describedby={problem ? `problema-${group.id}` : undefined}
      className={cn(
        "grid min-w-0 gap-1 rounded-[var(--menu-radius)] border border-transparent transition-colors",
        problem &&
          "border-destructive bg-[color-mix(in_oklab,var(--color-destructive)_6%,transparent)] p-3",
      )}
    >
      <legend className="w-full">
        <span className="flex items-center justify-between gap-2">
          <span className="type-h3">{group.name}</span>
          <span
            className={cn(
              "type-caption shrink-0 rounded-full px-2 py-0.5 font-semibold",
              required && count < group.min_select
                ? "bg-[var(--menu-text)] text-[var(--menu-surface)]"
                : "bg-[var(--menu-soft)] text-[var(--menu-muted)]",
            )}
          >
            {describeGroup(group)}
          </span>
        </span>
      </legend>
      {problem ? (
        <p
          id={`problema-${group.id}`}
          role="alert"
          className="type-small font-semibold text-destructive"
        >
          {problem}
        </p>
      ) : null}
      <ul className="grid">
        {group.options.map((option) => {
          const checked = selected.includes(option.id);
          const disabled = !option.is_available || (full && !checked);
          return (
            <li key={option.id}>
              <label
                className={cn(
                  "flex min-h-12 items-center gap-3 border-b border-[var(--menu-line)] py-2 last:border-0",
                  disabled ? "opacity-50" : "cursor-pointer",
                )}
              >
                <input
                  type={radio ? "radio" : "checkbox"}
                  name={`grupo-${group.id}`}
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onToggle(option.id)}
                  className="size-5 shrink-0 accent-[var(--menu-primary)]"
                />
                <span className="type-body flex-1">
                  {option.name}
                  {!option.is_available ? (
                    <span className="type-caption ml-2 font-semibold">Agotado</span>
                  ) : null}
                </span>
                {option.price_delta_cents !== 0 ? (
                  <span className="type-small text-[var(--menu-muted)] tabular-nums">
                    {option.price_delta_cents > 0 ? "+" : "−"}
                    {formatQ(Math.abs(option.price_delta_cents))}
                  </span>
                ) : null}
              </label>
            </li>
          );
        })}
      </ul>
    </fieldset>
  );
}

/** "Huevos rancheros" → "unos Huevos rancheros"; "Pupusa" → "una Pupusa". */
export function withArticle(name: string) {
  const first = name.split(/\s+/)[0]!.toLowerCase();
  const plural = first.endsWith("s");
  const feminine = /a$|as$|ión$|iones$/.test(first);
  const article = plural ? (feminine ? "unas" : "unos") : feminine ? "una" : "un";
  return `${article} ${name}`;
}
