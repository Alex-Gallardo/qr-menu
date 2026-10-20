import { cn } from "cn";
import { LogoSymbol } from "@/components/brand/logo";
import type { LoaderStyle } from "@/lib/loading/store";

/** Indicadores de carga: logo latiendo, puntos o plato girando. Usan currentColor. */
export function Loader({
  style,
  logoUrl,
  className,
}: {
  style: LoaderStyle;
  logoUrl?: string | null;
  className?: string;
}) {
  if (style === "puntos") {
    return (
      <span aria-hidden className={cn("flex h-12 items-center gap-2", className)}>
        {[0, 1, 2].map((i) => (
          <span
            key={i}
            className="size-3 animate-rebote rounded-full bg-current"
            style={{ animationDelay: `${i * 140}ms` }}
          />
        ))}
      </span>
    );
  }

  if (style === "plato") {
    return (
      <svg aria-hidden viewBox="0 0 48 48" className={cn("size-12 animate-giro", className)}>
        <circle
          cx="24"
          cy="24"
          r="20"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          opacity="0.25"
        />
        <circle
          cx="24"
          cy="24"
          r="13"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          opacity="0.4"
        />
        <path
          d="M24 4a20 20 0 0 1 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="3"
          strokeLinecap="round"
        />
        <circle cx="24" cy="24" r="3" fill="currentColor" />
      </svg>
    );
  }

  return logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- logo del negocio, ya optimizado al subirlo
    <img
      src={logoUrl}
      alt=""
      className={cn("size-14 animate-latido rounded-md object-contain", className)}
    />
  ) : (
    <LogoSymbol className={cn("size-14 animate-latido", className)} />
  );
}
