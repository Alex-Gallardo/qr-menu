"use client";

import { create } from "zustand";
import { clampQuantity } from "@/features/public-menu/cart-line";

/**
 * Carrito del comensal. Por ahora vive en memoria; QRM-024 lo guarda en el
 * dispositivo por sucursal y agrega la barra "3 productos · Q116.00".
 * Los precios son solo para mostrar: el servidor los recalcula al pedir.
 */

export type CartLine = {
  /** Mismo producto, mismas opciones y misma nota = misma línea. */
  key: string;
  productId: string;
  name: string;
  imageUrl: string | null;
  optionIds: string[];
  optionNames: string[];
  note: string;
  quantity: number;
  unitCents: number;
};

export const cartLineKey = (productId: string, optionIds: readonly string[], note: string) =>
  [productId, [...optionIds].sort().join(","), note.trim().toLowerCase()].join("|");

type CartStore = {
  lines: CartLine[];
  add: (line: Omit<CartLine, "key">) => void;
};

export const useCart = create<CartStore>((set) => ({
  lines: [],
  add: (line) =>
    set((state) => {
      const key = cartLineKey(line.productId, line.optionIds, line.note);
      const existing = state.lines.find((l) => l.key === key);
      if (!existing) return { lines: [...state.lines, { ...line, note: line.note.trim(), key }] };
      return {
        lines: state.lines.map((l) =>
          l.key === key ? { ...l, quantity: clampQuantity(l.quantity + line.quantity) } : l,
        ),
      };
    }),
}));

export const cartCount = (lines: readonly CartLine[]) => lines.reduce((n, l) => n + l.quantity, 0);
