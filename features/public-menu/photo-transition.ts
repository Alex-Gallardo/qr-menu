"use client";

/**
 * Expande la foto de la tarjeta a la de la hoja con una View Transition (en
 * lugar del layoutId de Motion: cero KB extra). Donde no hay soporte o el
 * usuario pidió menos movimiento, la hoja simplemente sube desde abajo.
 * `update` debe abrir la hoja de forma síncrona (flushSync).
 */
export function expandPhoto(photo: HTMLElement | null, update: () => void) {
  const supported = typeof document.startViewTransition === "function";
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!photo || !supported || reduced) {
    update();
    return;
  }
  const root = document.documentElement;
  photo.style.viewTransitionName = "foto-producto";
  root.dataset.fotoTransicion = "";
  const transition = document.startViewTransition(() => {
    // En el estado nuevo el nombre lo lleva la foto de la hoja.
    photo.style.viewTransitionName = "";
    update();
  });
  void transition.finished.finally(() => delete root.dataset.fotoTransicion);
}
