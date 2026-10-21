"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { OrderType, PayMethod } from "@/features/orders/checkout";

/**
 * Datos del comensal recordados en su dispositivo (nunca en el servidor hasta
 * que pide): nombre, teléfono, correo, dirección y lo último que eligió. Así
 * el segundo pedido es "Ver pedido" → "Pedir por WhatsApp".
 */

export type CustomerData = {
  name: string;
  phone: string;
  email: string;
  address: string;
  addressReference: string;
  lastOrderType: OrderType | null;
  lastPayment: PayMethod | null;
};

const EMPTY: CustomerData = {
  name: "",
  phone: "",
  email: "",
  address: "",
  addressReference: "",
  lastOrderType: null,
  lastPayment: null,
};

type CustomerState = CustomerData & {
  remember: (data: Partial<CustomerData>) => void;
  forget: () => void;
};

export const useCustomer = create<CustomerState>()(
  persist(
    (set) => ({
      ...EMPTY,
      remember: (data) => set(data),
      forget: () => set(EMPTY),
    }),
    {
      name: "qrm:comensal",
      version: 1,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): CustomerData => ({
        name: state.name,
        phone: state.phone,
        email: state.email,
        address: state.address,
        addressReference: state.addressReference,
        lastOrderType: state.lastOrderType,
        lastPayment: state.lastPayment,
      }),
      skipHydration: true,
    },
  ),
);

/** La mesa del QR (?mesa=4) se recuerda en la pestaña, por sucursal. */
export const tableKey = (branchId: string) => `qrm:mesa:${branchId}`;
