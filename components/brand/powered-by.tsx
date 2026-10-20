import { cn } from "cn";
import { BRAND } from "@/lib/brand";
import { LogoSymbol } from "./logo";

/** Pie discreto del menú público. Se puede quitar en el plan Negocio. */
export function PoweredBy({ className }: { className?: string }) {
  return (
    <a
      href={BRAND.url}
      target="_blank"
      rel="noopener"
      className={cn(
        "type-caption inline-flex items-center gap-1.5 opacity-70 transition-opacity hover:opacity-100",
        className,
      )}
    >
      <LogoSymbol mono className="size-4" />
      Hecho con {BRAND.name}
    </a>
  );
}
