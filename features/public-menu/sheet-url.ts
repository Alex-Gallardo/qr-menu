"use client";

import { useSyncExternalStore } from "react";

/**
 * Las hojas del menú viven en la URL (?producto=id, ?pedido=1): el botón
 * "atrás" del celular las cierra en lugar de salir del menú, y el link se
 * puede compartir. Se lee sin useSearchParams para no sacar el menú del HTML
 * prerenderizado.
 */

const listeners = new Set<() => void>();
/** Parámetros cuya entrada del historial agregamos nosotros (cerrar = atrás). */
const pushed = new Set<string>();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  const onPop = () => {
    pushed.clear();
    listener();
  };
  listeners.add(listener);
  window.addEventListener("popstate", onPop);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", onPop);
  };
}

const read = (param: string) => new URLSearchParams(window.location.search).get(param);

function sheetParam(param: string) {
  return {
    /** Valor del parámetro (null en el servidor y con la hoja cerrada). */
    useValue: () =>
      useSyncExternalStore(
        subscribe,
        () => read(param),
        () => null,
      ),
    open(value: string) {
      const url = new URL(window.location.href);
      url.searchParams.set(param, value);
      if (read(param)) window.history.replaceState(null, "", url);
      else {
        window.history.pushState(null, "", url);
        pushed.add(param);
      }
      emit();
    },
    close() {
      if (pushed.has(param)) {
        pushed.delete(param);
        window.history.back(); // popstate avisa a los suscriptores
        return;
      }
      // Llegó con el link: se quita sin salir del menú.
      const url = new URL(window.location.href);
      url.searchParams.delete(param);
      window.history.replaceState(null, "", url);
      emit();
    },
  };
}

const productSheet = sheetParam("producto");
const orderSheet = sheetParam("pedido");

export const useOpenProductId = productSheet.useValue;
export const openProductSheet = productSheet.open;
export const closeProductSheet = productSheet.close;

export const useOrderSheetOpen = () => orderSheet.useValue() !== null;
export const openOrderSheet = () => orderSheet.open("1");
export const closeOrderSheet = orderSheet.close;
