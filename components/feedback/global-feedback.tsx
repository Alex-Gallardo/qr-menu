"use client";

import dynamic from "next/dynamic";

/*
 * Avisos (sonner) y el modal "Cargando…" para toda la app, cargados después de
 * hidratar: no pesan en la primera pintura (la landing llega a Lighthouse ≥ 95
 * en celular). Siempre quedan montados antes de que alguien toque algo.
 */
const Toaster = dynamic(() => import("./toaster").then((m) => m.Toaster), { ssr: false });
const LoadingOverlay = dynamic(() => import("./loading-overlay").then((m) => m.LoadingOverlay), {
  ssr: false,
});

export function GlobalFeedback() {
  return (
    <>
      <LoadingOverlay />
      <Toaster />
    </>
  );
}
