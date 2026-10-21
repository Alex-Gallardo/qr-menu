"use client";

import { CheckIcon, ImageIcon, SearchIcon } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { matchesSearch } from "@/features/products/catalog";
import { formatQ } from "@/lib/money";
import type { PickerProduct } from "../server";

/**
 * Selector de productos del catálogo para una sección: buscar, marcar varios y
 * agregarlos de una vez. Los que ya están en la sección aparecen marcados y fijos.
 */
export function ProductPicker({
  sectionName,
  products,
  alreadyIn,
  onAdd,
  onClose,
}: {
  sectionName: string;
  products: PickerProduct[];
  alreadyIn: ReadonlySet<string>;
  onAdd: (productIds: string[]) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    const dialog = ref.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  const filtered = products.filter((p) => matchesSearch([p.name, p.category?.name], query));
  const groups = [...new Set(filtered.map((p) => p.category?.name ?? "Sin categoría"))].map(
    (name) => ({
      name,
      items: filtered.filter((p) => (p.category?.name ?? "Sin categoría") === name),
    }),
  );

  const toggle = (id: string) =>
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

  return (
    <dialog
      ref={ref}
      aria-labelledby="picker-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className="m-auto flex max-h-[min(44rem,calc(100dvh-2rem))] w-[min(32rem,calc(100%-2rem))] flex-col rounded-xl border border-border bg-card p-0 text-card-foreground shadow-3 backdrop:bg-frijol/50 open:flex"
    >
      <div className="grid gap-3 border-b border-border p-4">
        <h2 id="picker-title" className="type-h3">
          Agregar a “{sectionName || "Sección"}”
        </h2>
        <label className="relative block">
          <span className="sr-only">Buscar producto</span>
          <SearchIcon
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            type="search"
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar en tu catálogo"
            className="pl-11"
          />
        </label>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {groups.length === 0 ? (
          <p className="type-body p-6 text-center text-muted-foreground">
            {products.length === 0
              ? "Tu catálogo está vacío. Agrega productos primero."
              : `No encontramos “${query}”.`}
          </p>
        ) : null}
        {groups.map((group) => (
          <section key={group.name} className="grid gap-1 py-1" aria-label={group.name}>
            <h3 className="type-caption px-2 pt-2 font-semibold text-muted-foreground">
              {group.name}
            </h3>
            {group.items.map((p) => {
              const fixed = alreadyIn.has(p.id);
              const checked = fixed || selected.includes(p.id);
              return (
                <button
                  key={p.id}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  aria-disabled={fixed}
                  onClick={() => !fixed && toggle(p.id)}
                  className={cn(
                    "flex min-h-14 items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-muted",
                    checked && "bg-primary/5",
                    fixed && "cursor-default opacity-60",
                  )}
                >
                  <span
                    aria-hidden
                    className={cn(
                      "grid size-6 shrink-0 place-items-center rounded-sm border-2",
                      checked
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input",
                    )}
                  >
                    {checked ? <CheckIcon className="size-4" /> : null}
                  </span>
                  <span className="grid aspect-[4/3] w-12 shrink-0 place-items-center overflow-hidden rounded-sm bg-muted text-muted-foreground">
                    {p.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.image_url}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : (
                      <ImageIcon className="size-4" />
                    )}
                  </span>
                  <span className="grid min-w-0 flex-1">
                    <span className="type-body truncate font-medium">{p.name}</span>
                    <span className="type-caption text-muted-foreground tabular-nums">
                      {formatQ(p.price_cents)}
                      {fixed ? " · ya está en la sección" : ""}
                      {!p.is_available ? " · agotado" : ""}
                    </span>
                  </span>
                </button>
              );
            })}
          </section>
        ))}
      </div>

      <div className="flex gap-2 border-t border-border p-4">
        <Button type="button" variant="ghost" className="flex-1" onClick={onClose}>
          Cancelar
        </Button>
        <Button
          type="button"
          className="flex-1"
          disabled={selected.length === 0}
          onClick={() => onAdd(selected)}
        >
          {selected.length === 0
            ? "Elige productos"
            : `Agregar ${selected.length === 1 ? "1 producto" : `${selected.length} productos`}`}
        </Button>
      </div>
    </dialog>
  );
}
