"use client";

import { Toaster as Sonner } from "sonner";

/**
 * Toasts arriba (como pide la guía), con la tipografía y radios de la marca.
 * Uso: toast.success("¡Listo!"), toast("Cuenta eliminada", { action: { label: "Deshacer", onClick } }).
 */
export function Toaster() {
  return (
    <Sonner
      position="top-center"
      duration={4000}
      offset={16}
      mobileOffset={12}
      toastOptions={{
        classNames: {
          toast:
            "!rounded-lg !border !border-border !bg-card !text-card-foreground !shadow-3 !font-sans !text-sm",
          actionButton: "!bg-primary !text-primary-foreground !font-semibold !rounded-md",
          success: "[&_[data-icon]]:!text-success",
          error: "[&_[data-icon]]:!text-destructive",
        },
      }}
    />
  );
}
