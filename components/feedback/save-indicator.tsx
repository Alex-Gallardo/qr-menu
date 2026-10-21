import { CheckIcon, CloudOffIcon, Loader2Icon } from "lucide-react";
import { cn } from "cn";

export type SaveState = "idle" | "saving" | "saved" | "error";

/**
 * Indicador en línea del guardado automático: "Guardando… → Guardado ✓".
 * No bloquea la pantalla (eso es para el modal "Cargando…").
 */
export function SaveIndicator({
  state,
  onRetry,
  className,
}: {
  state: SaveState;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <span
      role="status"
      aria-live="polite"
      className={cn("type-small inline-flex h-6 items-center gap-1.5 [&_svg]:size-4", className)}
    >
      {state === "saving" ? (
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <Loader2Icon aria-hidden className="animate-spin" />
          Guardando…
        </span>
      ) : state === "saved" ? (
        <span className="flex items-center gap-1.5 text-success">
          <CheckIcon aria-hidden />
          Guardado
        </span>
      ) : state === "error" ? (
        <span className="flex items-center gap-1.5 text-destructive">
          <CloudOffIcon aria-hidden />
          No se guardó
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="font-semibold underline underline-offset-2"
            >
              Reintentar
            </button>
          ) : null}
        </span>
      ) : null}
    </span>
  );
}
