"use client";

import { useLayoutEffect, type RefObject } from "react";

/**
 * Hoja inferior del menú (producto y pedido): un <dialog> modal en columna
 * con cabecera, cuerpo con scroll y pie fijos.
 *
 * - El cuerpo usa `flex-auto` (base = su contenido) y no `flex-1` (base 0 %):
 *   con la altura de la hoja indefinida (solo max-height), WebKit (Safari y
 *   todos los navegadores del iPhone) resuelve 0 % a 0 y el cuerpo desaparecía.
 * - El cuerpo es `relative`: los inputs ocultos (sr-only, position: absolute)
 *   quedan dentro de su scroll; si no, desbordaban el <dialog> y al enfocarlos
 *   el navegador desplazaba toda la hoja (cabecera fuera, hueco abajo).
 */
export const SHEET_DIALOG =
  "product-sheet animate-subir mx-auto mt-auto mb-0 flex w-full max-w-[480px] flex-col overflow-hidden rounded-t-[calc(var(--menu-radius)*1.25)] border-0 bg-[var(--menu-surface)] p-0 text-[var(--menu-text)] shadow-3 backdrop:bg-black/50 open:flex";
/** Cabecera y pie llevan `shrink-0`: nunca se encogen. */
export const SHEET_BODY = "relative min-h-0 flex-auto overflow-y-auto overscroll-contain";

/**
 * Abre la hoja como modal antes del primer pintado (dentro de la View
 * Transition ya debe estar abierta) y la mantiene en su lugar: el <dialog>
 * no tiene scroll propio, así que si algo lo desplaza vuelve a 0.
 */
export function useSheet(ref: RefObject<HTMLDialogElement | null>) {
  useLayoutEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (!dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", ""); // jsdom
    }
    const pin = () => {
      if (dialog.scrollTop !== 0) dialog.scrollTop = 0;
    };
    dialog.addEventListener("scroll", pin);
    return () => dialog.removeEventListener("scroll", pin);
  }, [ref]);
}
