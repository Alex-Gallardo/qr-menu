"use client";

import { useEffect, useRef, useState } from "react";
import type { SaveState } from "@/components/feedback/save-indicator";
import { runAction } from "@/lib/action-client";

type SaveResult = { ok: boolean; message?: string };

/**
 * Guardado automático: espera `delay` ms sin cambios y guarda. Si llega otro
 * cambio mientras guarda, vuelve a guardar al terminar (nunca dos a la vez y
 * siempre con el valor más nuevo). Al salir de la página guarda lo pendiente
 * y avisa si el navegador se cierra con cambios sin guardar.
 */
export function useAutosave<T>(value: T, save: (value: T) => Promise<SaveResult>, delay = 800) {
  const [state, setState] = useState<SaveState>("idle");
  const [error, setError] = useState<string | null>(null);
  const latest = useRef(value);
  const saveRef = useRef(save);
  const dirty = useRef(false);
  const inFlight = useRef(false);
  const again = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const first = useRef(true);

  const flush = useRef(async () => {
    if (inFlight.current) {
      again.current = true;
      return;
    }
    inFlight.current = true;
    dirty.current = false;
    setState("saving");
    const res: SaveResult = await runAction(() => saveRef.current(latest.current));
    inFlight.current = false;
    if (again.current) {
      again.current = false;
      void flush.current();
      return;
    }
    if (res.ok) {
      setState("saved");
      setError(null);
    } else {
      dirty.current = true;
      setState("error");
      setError(res.message ?? "No se guardó.");
    }
  });

  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    latest.current = value;
    if (first.current) {
      first.current = false;
      return;
    }
    dirty.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush.current(), delay);
  }, [value, delay]);

  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (dirty.current || inFlight.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    const pending = flush.current;
    return () => {
      window.removeEventListener("beforeunload", warn);
      // Navegación dentro de la app: guarda lo que quedó en espera.
      clearTimeout(timer.current);
      if (dirty.current && !inFlight.current) void pending();
    };
  }, []);

  return {
    state,
    error,
    /** "Reintentar" del indicador. */
    retry: () => void flush.current(),
  };
}
