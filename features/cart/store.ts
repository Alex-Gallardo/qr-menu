"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { addLine, enterBranch, isExpired, setLineQuantity, type Cart, type CartLine } from "./cart";

export type { Cart, CartLine } from "./cart";

type BranchRef = Pick<Cart, "branchId" | "branchSlug" | "branchName">;

type CartState = {
  /** Un carrito por negocio (id del negocio → carrito de una de sus sucursales). */
  carts: Record<string, Cart>;
  /** Al abrir una sucursal. Devuelve el carrito de otra sucursal que se vació, si había. */
  enter: (businessId: string, branch: BranchRef) => Cart | null;
  add: (businessId: string, line: Omit<CartLine, "key">) => void;
  setQuantity: (businessId: string, key: string, quantity: number) => void;
  clear: (businessId: string) => void;
  /** "Volver a Antigua": recupera el carrito que se vació al cambiar de sucursal. */
  restore: (businessId: string, cart: Cart) => void;
};

/**
 * Carrito guardado en el dispositivo (localStorage). Se hidrata a mano
 * (`useCart.persist.rehydrate()`) después de montar el menú, para que el HTML
 * del servidor y el primer render del celular coincidan.
 */
export const useCart = create<CartState>()(
  persist(
    (set, get) => {
      const update = (businessId: string, change: (lines: CartLine[]) => CartLine[]) =>
        set((state) => {
          const cart = state.carts[businessId];
          if (!cart) return state;
          return {
            carts: {
              ...state.carts,
              [businessId]: { ...cart, lines: change(cart.lines), updatedAt: Date.now() },
            },
          };
        });

      return {
        carts: {},
        enter: (businessId, branch) => {
          const now = Date.now();
          const { cart, replaced } = enterBranch(get().carts[businessId], branch, now);
          // De paso se olvidan los carritos vencidos de otros negocios.
          const others = Object.fromEntries(
            Object.entries(get().carts).filter(
              ([id, c]) => id !== businessId && !isExpired(c, now),
            ),
          );
          set({ carts: { ...others, [businessId]: cart } });
          return replaced;
        },
        add: (businessId, line) => update(businessId, (lines) => addLine(lines, line)),
        setQuantity: (businessId, key, quantity) =>
          update(businessId, (lines) => setLineQuantity(lines, key, quantity)),
        clear: (businessId) => update(businessId, () => []),
        restore: (businessId, cart) =>
          set((state) => ({
            carts: { ...state.carts, [businessId]: { ...cart, updatedAt: Date.now() } },
          })),
      };
    },
    {
      name: "qrm:carrito",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ carts: state.carts }),
      skipHydration: true,
    },
  ),
);
