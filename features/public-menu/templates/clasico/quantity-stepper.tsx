"use client";

import { MinusIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { cn } from "cn";
import { MAX_QUANTITY } from "../../cart-line";

/**
 * − cantidad + con los colores del menú. `removable`: en 1, el "−" se vuelve
 * papelera y baja a 0 (quitar la línea del pedido).
 */
export function QuantityStepper({
  label,
  value,
  onChange,
  removable = false,
  removeLabel = "Quitar",
  compact = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  removable?: boolean;
  removeLabel?: string;
  /** 40 px (líneas del pedido) en lugar de 48 px. */
  compact?: boolean;
}) {
  const removing = removable && value === 1;
  const button = cn(
    "grid place-items-center rounded-full disabled:opacity-40",
    compact ? "size-10" : "size-12",
  );
  const icon = compact ? "size-4" : "size-5";
  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center rounded-full border border-[var(--menu-line)]"
    >
      <button
        type="button"
        aria-label={removing ? removeLabel : "Quitar uno"}
        disabled={!removable && value <= 1}
        onClick={() => onChange(value - 1)}
        className={button}
      >
        {removing ? (
          <Trash2Icon aria-hidden className={icon} />
        ) : (
          <MinusIcon aria-hidden className={icon} />
        )}
      </button>
      <output aria-live="polite" className="type-price w-6 text-center">
        {value}
      </output>
      <button
        type="button"
        aria-label="Agregar uno"
        disabled={value >= MAX_QUANTITY}
        onClick={() => onChange(value + 1)}
        className={button}
      >
        <PlusIcon aria-hidden className={icon} />
      </button>
    </div>
  );
}
