"use client";

import { useSyncExternalStore } from "react";

/**
 * La hoja de producto abierta vive en la URL (?producto=id): el botón "atrás"
 * del celular la cierra en lugar de salir del menú, y el link se puede
 * compartir. Se lee sin useSearchParams para no sacar el menú del HTML
 * prerenderizado.
 */

const PARAM = "producto";
const listeners = new Set<() => void>();
/** true si la entrada del historial la agregamos nosotros (entonces cerrar = atrás). */
let pushed = false;

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  const onPop = () => {
    pushed = false;
    listener();
  };
  listeners.add(listener);
  window.addEventListener("popstate", onPop);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("popstate", onPop);
  };
}

const read = () => new URLSearchParams(window.location.search).get(PARAM);

/** Id del producto con la hoja abierta (null en el servidor y sin hoja). */
export function useOpenProductId() {
  return useSyncExternalStore(subscribe, read, () => null);
}

export function openProductSheet(productId: string) {
  const url = new URL(window.location.href);
  url.searchParams.set(PARAM, productId);
  if (read()) window.history.replaceState(null, "", url);
  else {
    window.history.pushState(null, "", url);
    pushed = true;
  }
  emit();
}

export function closeProductSheet() {
  if (pushed) {
    pushed = false;
    window.history.back(); // popstate avisa a los suscriptores
    return;
  }
  // Llegó con el link (?producto=…): se quita sin salir del menú.
  const url = new URL(window.location.href);
  url.searchParams.delete(PARAM);
  window.history.replaceState(null, "", url);
  emit();
}
