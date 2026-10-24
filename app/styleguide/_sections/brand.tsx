import { XIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";
import { Logo, LogoSymbol } from "@/components/brand/logo";
import { PoweredBy } from "@/components/brand/powered-by";
import { BRAND } from "@/lib/brand";
import { Section } from "./section";

// Lo que no se hace con el logo: cada ejemplo usa el componente real deformado.
const MISUSES = [
  { label: "No estirar", className: "scale-x-150" },
  { label: "No rotar", className: "-rotate-12" },
  {
    label: "No recolorear",
    className: "[&_span]:!text-chile [&_svg>*:first-child]:!fill-whatsapp",
  },
  { label: "No poner sobre fondos con poco contraste", className: "", bg: "bg-maiz" },
  { label: "No agregar sombras ni efectos", className: "drop-shadow-[4px_4px_0_#C62E2E]" },
] as const;

export function BrandSection() {
  return (
    <Section
      id="marca"
      number={1}
      title="Marca"
      description="Logo provisional: tarjeta de menú con la esquina doblada y la cola de un globo de chat. El nombre sale de NEXT_PUBLIC_BRAND_NAME."
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile label="Horizontal">
          <Logo />
        </Tile>
        <Tile label="Símbolo">
          <LogoSymbol className="size-16" title={BRAND.name} />
        </Tile>
        <Tile label="Monocromo claro" className="bg-frijol text-masa">
          <Logo mono />
        </Tile>
        <Tile label="Monocromo oscuro" className="text-frijol">
          <Logo mono />
        </Tile>
      </div>

      <h3 className="type-h3 mt-8">Área de respeto</h3>
      <p className="type-small mt-1 max-w-prose text-muted-foreground">
        Alrededor del logo queda libre, como mínimo, la mitad del alto del símbolo. Tamaño mínimo:
        24 px de alto en pantalla.
      </p>
      <div className="mt-4 flex flex-wrap items-end gap-6">
        <div className="relative inline-grid rounded-md bg-[repeating-linear-gradient(45deg,var(--color-nube)_0_6px,transparent_6px_12px)] p-4 outline-2 outline-dashed outline-tomate/50">
          <div className="bg-background">
            <Logo />
          </div>
        </div>
        <div className="grid justify-items-center gap-1">
          <LogoSymbol className="size-6" title={BRAND.name} />
          <span className="type-caption text-muted-foreground">Mínimo · 24 px</span>
        </div>
      </div>

      <h3 className="type-h3 mt-8">Usos incorrectos</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {MISUSES.map((m) => (
          <figure
            key={m.label}
            className="overflow-hidden rounded-lg border border-destructive/40 bg-card shadow-1"
          >
            <div
              className={cn(
                "relative grid h-24 place-items-center overflow-hidden",
                "bg" in m ? m.bg : "",
              )}
            >
              <Logo className={m.className} />
              <XIcon
                aria-hidden
                className="absolute top-2 right-2 size-5 rounded-full bg-destructive p-0.5 text-white"
              />
            </div>
            <figcaption className="type-caption border-t border-border px-3 py-2 text-destructive">
              {m.label}
            </figcaption>
          </figure>
        ))}
      </div>

      <h3 className="type-h3 mt-8">Tagline y firma</h3>
      <div className="mt-4 flex flex-wrap items-center gap-6">
        <p className="type-h3 font-display">“{BRAND.tagline}”</p>
        <PoweredBy />
      </div>
    </Section>
  );
}

function Tile({
  label,
  className,
  children,
}: {
  label: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <figure className="overflow-hidden rounded-lg border border-border bg-card shadow-1">
      <div className={cn("grid h-32 place-items-center", className)}>{children}</div>
      <figcaption className="type-caption border-t border-border px-3 py-2 text-muted-foreground">
        {label}
      </figcaption>
    </figure>
  );
}
