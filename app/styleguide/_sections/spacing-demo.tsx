"use client";

import { useSyncExternalStore } from "react";

const subscribe = (fn: () => void) => {
  window.addEventListener("resize", fn);
  return () => window.removeEventListener("resize", fn);
};

const STEPS = [
  ["xl", 1280],
  ["lg", 1024],
  ["md", 768],
  ["sm", 640],
] as const;

/** Ancho de esta ventana y el breakpoint que aplica (para probar al redimensionar). */
export function CurrentBreakpoint() {
  const width = useSyncExternalStore(
    subscribe,
    () => window.innerWidth,
    () => 0,
  );
  const active = STEPS.find(([, px]) => width >= px)?.[0] ?? "base";
  return (
    <p className="type-small mt-3 text-muted-foreground" aria-live="polite">
      {width ? (
        <>
          Esta ventana: <strong className="tabular-nums">{width} px</strong> · breakpoint{" "}
          <strong className="font-mono">{active}</strong>
        </>
      ) : null}
    </p>
  );
}
