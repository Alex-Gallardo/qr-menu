"use client";

import { ImageIcon, MinusIcon, PlusIcon, Trash2Icon, XIcon } from "lucide-react";
import Image from "next/image";
import { useLayoutEffect, useRef } from "react";
import { cn } from "cn";
import { productsLabel, type PricedLine } from "@/features/cart/cart";
import { MAX_QUANTITY } from "../../cart-line";
import { formatQ } from "@/lib/money";

export type OrderSheetProps = {
  branchName: string;
  lines: PricedLine[];
  count: number;
  totalCents: number;
  onQuantity: (key: string, quantity: number) => void;
  onClear: () => void;
  onClose: () => void;
};

/**
 * Hoja "Tu pedido" (plantilla Clásico): lista editable con los precios de hoy
 * en esta sucursal. QRM-025 le agrega debajo el tipo de pedido, los datos y el
 * pago. Se carga bajo demanda, como la hoja de producto.
 */
export function OrderSheet({
  branchName,
  lines,
  count,
  totalCents,
  onQuantity,
  onClear,
  onClose,
}: OrderSheetProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog || dialog.open) return;
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", ""); // jsdom
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="pedido-titulo"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="product-sheet animate-subir mx-auto mt-auto mb-0 flex max-h-[92dvh] w-full max-w-[480px] flex-col overflow-hidden rounded-t-[calc(var(--menu-radius)*1.25)] border-0 bg-[var(--menu-surface)] p-0 text-[var(--menu-text)] shadow-3 backdrop:bg-black/50 open:flex"
    >
      <header className="flex items-center gap-3 border-b border-[var(--menu-line)] py-2 pr-2 pl-4">
        <div className="min-w-0 flex-1">
          <h2 id="pedido-titulo" className="type-h3">
            Tu pedido
          </h2>
          <p className="type-small text-[var(--menu-muted)]">{branchName}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="grid size-11 place-items-center rounded-full hover:bg-[var(--menu-soft)]"
        >
          <XIcon aria-hidden className="size-5" />
        </button>
      </header>

      {lines.length === 0 ? (
        <div className="grid justify-items-center gap-3 px-4 py-10 text-center">
          <p className="type-body text-[var(--menu-muted)]">Tu pedido está vacío.</p>
          <button
            type="button"
            onClick={onClose}
            className="h-12 rounded-full bg-[var(--menu-primary)] px-6 font-semibold text-[var(--menu-on-primary)]"
          >
            Ver el menú
          </button>
        </div>
      ) : (
        <>
          <ul className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
            {lines.map((line) => (
              <li
                key={line.key}
                className="flex gap-3 border-b border-[var(--menu-line)] py-3 last:border-0"
              >
                <span
                  className={cn(
                    "relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-[calc(var(--menu-radius)*0.6)] bg-[var(--menu-soft)] text-[var(--menu-muted)]",
                    line.issue && "grayscale",
                  )}
                >
                  {line.imageUrl ? (
                    <Image src={line.imageUrl} alt="" fill sizes="56px" className="object-cover" />
                  ) : (
                    <ImageIcon aria-hidden className="size-5" />
                  )}
                </span>
                <div className="grid min-w-0 flex-1 gap-0.5">
                  <p className="type-body flex items-start justify-between gap-2 font-semibold">
                    <span className={cn(line.issue && "opacity-60")}>{line.name}</span>
                    {line.issue ? null : (
                      <span className="type-price shrink-0">{formatQ(line.lineCents)}</span>
                    )}
                  </p>
                  {line.optionNames.length > 0 ? (
                    <p className="type-small text-[var(--menu-muted)]">
                      {line.optionNames.join(", ")}
                    </p>
                  ) : null}
                  {line.note ? (
                    <p className="type-small text-[var(--menu-muted)] italic">“{line.note}”</p>
                  ) : null}
                  {line.issue ? (
                    <p className="type-small flex items-center justify-between gap-2 font-semibold text-destructive">
                      {line.issue}
                      <button
                        type="button"
                        onClick={() => onQuantity(line.key, 0)}
                        className="h-10 shrink-0 rounded-full px-3 text-[var(--menu-text)] underline underline-offset-4"
                      >
                        Quitar
                      </button>
                    </p>
                  ) : (
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <span className="type-small text-[var(--menu-muted)] tabular-nums">
                        {formatQ(line.unitCents)} c/u
                      </span>
                      <div
                        role="group"
                        aria-label={`Cantidad de ${line.name}`}
                        className="flex items-center rounded-full border border-[var(--menu-line)]"
                      >
                        <button
                          type="button"
                          aria-label={line.quantity === 1 ? `Quitar ${line.name}` : "Quitar uno"}
                          onClick={() => onQuantity(line.key, line.quantity - 1)}
                          className="grid size-10 place-items-center rounded-full"
                        >
                          {line.quantity === 1 ? (
                            <Trash2Icon aria-hidden className="size-4" />
                          ) : (
                            <MinusIcon aria-hidden className="size-4" />
                          )}
                        </button>
                        <output aria-live="polite" className="type-price w-6 text-center">
                          {line.quantity}
                        </output>
                        <button
                          type="button"
                          aria-label="Agregar uno"
                          disabled={line.quantity >= MAX_QUANTITY}
                          onClick={() => onQuantity(line.key, line.quantity + 1)}
                          className="grid size-10 place-items-center rounded-full disabled:opacity-40"
                        >
                          <PlusIcon aria-hidden className="size-4" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ul>

          <footer className="grid gap-3 border-t border-[var(--menu-line)] bg-[var(--menu-surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            <p className="flex items-baseline justify-between">
              <span className="type-body">
                Total <span className="text-[var(--menu-muted)]">· {productsLabel(count)}</span>
              </span>
              <span className="type-h3 tabular-nums">{formatQ(totalCents)}</span>
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClear}
                className="h-12 rounded-full border border-[var(--menu-line)] px-4 font-semibold"
              >
                Vaciar
              </button>
              <button
                type="button"
                onClick={onClose}
                className="h-12 flex-1 rounded-full bg-[var(--menu-primary)] px-4 font-semibold text-[var(--menu-on-primary)]"
              >
                Seguir viendo el menú
              </button>
            </div>
          </footer>
        </>
      )}
    </dialog>
  );
}
