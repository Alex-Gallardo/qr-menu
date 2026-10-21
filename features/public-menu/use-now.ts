"use client";

import { useSyncExternalStore } from "react";

/**
 * Hora actual en el navegador, redondeada al minuto (se actualiza sola cada
 * minuto). En el servidor y durante la hidratación devuelve null: así la página
 * cacheada no "congela" la hora en que se generó y no hay errores de hidratación;
 * el menú del día se calcula apenas el celular toma el control.
 */
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
let current = Math.floor(Date.now() / 60_000);

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!timer) {
    timer = setInterval(() => {
      const minute = Math.floor(Date.now() / 60_000);
      if (minute !== current) {
        current = minute;
        listeners.forEach((l) => l());
      }
    }, 15_000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

const getSnapshot = () => {
  current = Math.floor(Date.now() / 60_000);
  return current;
};

export function useNowMinute(): Date | null {
  const minute = useSyncExternalStore(subscribe, getSnapshot, () => null);
  return minute === null ? null : new Date(minute * 60_000);
}
