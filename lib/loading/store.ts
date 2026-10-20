"use client";

import { create } from "zustand";
import { createLoadingController, HIDDEN, type LoadingView } from "./controller";

export type LoaderStyle = "logo" | "puntos" | "plato";

type LoadingStore = LoadingView & {
  /** Estilo del indicador (el negocio lo elige en Apariencia). */
  loader: LoaderStyle;
  /** Logo del negocio para el loader "logo"; sin logo se usa el de la plataforma. */
  logoUrl: string | null;
  /** Color del indicador (el primario del negocio en el menú público). */
  color: string | null;
};

/** Estado global del modal "Cargando…" (lo lee <LoadingOverlay/>). */
export const useLoading = create<LoadingStore>(() => ({
  ...HIDDEN,
  loader: "logo",
  logoUrl: null,
  color: null,
}));

const controller = createLoadingController((view) => useLoading.setState(view));

/**
 * Envuelve una acción que bloquea la pantalla (enviar pedido, subir imagen,
 * publicar, iniciar turno…). El modal aparece solo si tarda más de 300 ms.
 *
 *   await withLoading("Preparando tu pedido…", () => createOrder(input));
 *
 * Recibe un AbortSignal: "Cancelar" lo aborta y la promesa se rechaza con
 * LoadingCancelledError.
 */
export function withLoading<T>(message: string, action: (signal: AbortSignal) => Promise<T>) {
  return controller.run(message, action);
}

export const cancelLoading = () => controller.cancel();
export const retryLoading = () => controller.retry();

/** El menú público usa el loader, logo y color del negocio. */
export function configureLoader(
  config: Partial<Pick<LoadingStore, "loader" | "logoUrl" | "color">>,
) {
  useLoading.setState(config);
}
