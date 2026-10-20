"use client";

import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { cancelLoading, retryLoading, useLoading } from "@/lib/loading/store";
import { Loader } from "./loaders";

const SLOW_MESSAGE = "Está tardando más de lo normal";

/**
 * Modal global "Cargando…". Usa <dialog> nativo con showModal(): fondo inerte,
 * foco atrapado y Escape desactivado (salvo en el estado lento, donde cancela).
 * Se monta una vez en el layout raíz y se controla con withLoading().
 */
export function LoadingOverlay() {
  const { visible, message, slow, loader, logoUrl, color } = useLoading();
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (visible && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } else if (!visible && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [visible]);

  return (
    <dialog
      ref={ref}
      aria-label="Cargando"
      onCancel={(e) => {
        e.preventDefault();
        if (slow) cancelLoading();
      }}
      className="m-auto w-[min(20rem,calc(100%-2rem))] rounded-xl border border-border bg-card p-6 text-center text-card-foreground shadow-3 backdrop:bg-frijol/40 backdrop:backdrop-blur-sm open:animate-in open:fade-in-0 open:zoom-in-95"
    >
      <div role="status" aria-live="polite" className="grid justify-items-center gap-4">
        <span className="text-primary" style={color ? { color } : undefined}>
          <Loader style={loader} logoUrl={logoUrl} />
        </span>
        <p className="type-body font-semibold">{slow ? SLOW_MESSAGE : message}</p>
        {slow ? (
          <p className="type-small -mt-2 text-muted-foreground">
            Puede ser el internet. ¿Probamos otra vez?
          </p>
        ) : null}
      </div>
      {slow ? (
        <div className="mt-5 grid gap-2">
          <Button autoFocus onClick={retryLoading}>
            Reintentar
          </Button>
          <Button variant="ghost" onClick={cancelLoading}>
            Cancelar
          </Button>
        </div>
      ) : null}
    </dialog>
  );
}
