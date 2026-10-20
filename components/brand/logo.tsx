import { cn } from "cn";
import { BRAND } from "@/lib/brand";

/**
 * Símbolo: una tarjeta de menú con la esquina superior doblada y la cola de un
 * globo de chat (menú + pedido por mensaje). Logo provisional hasta tener el definitivo.
 */
export function LogoSymbol({
  className,
  title,
  mono = false,
}: {
  className?: string;
  title?: string;
  /** Monocromo: usa currentColor para el cuerpo. */
  mono?: boolean;
}) {
  return (
    <svg
      viewBox="0 0 48 48"
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      className={cn("size-10", className)}
    >
      {title ? <title>{title}</title> : null}
      <path
        d="M14 6h18l8 8v18a6 6 0 0 1-6 6H21l-10 7 2.4-7H14a6 6 0 0 1-6-6V12a6 6 0 0 1 6-6Z"
        fill={mono ? "currentColor" : "var(--color-tomate)"}
      />
      <path
        d="M32 6v5a3 3 0 0 0 3 3h5Z"
        fill={mono ? "currentColor" : "var(--color-maiz)"}
        opacity={mono ? 0.55 : 1}
      />
      <g fill={mono ? "var(--color-masa)" : "#fff"} opacity={mono ? 0.9 : 1}>
        <rect x="14" y="16" width="13" height="3" rx="1.5" />
        <rect x="14" y="22" width="19" height="3" rx="1.5" />
        <rect x="14" y="28" width="10" height="3" rx="1.5" />
      </g>
    </svg>
  );
}

/** Logo horizontal: símbolo + wordmark en minúsculas con el nombre configurable. */
export function Logo({ className, mono = false }: { className?: string; mono?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoSymbol mono={mono} />
      <span
        className={cn(
          "font-display text-2xl font-bold tracking-tight lowercase",
          mono ? "text-current" : "text-tomate",
        )}
      >
        {BRAND.name}
      </span>
    </span>
  );
}
