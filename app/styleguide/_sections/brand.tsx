import type { ReactNode } from "react";
import { cn } from "cn";
import { Logo, LogoSymbol } from "@/components/brand/logo";
import { PoweredBy } from "@/components/brand/powered-by";
import { BRAND } from "@/lib/brand";
import { Section } from "./section";

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
      <div className="mt-6 flex flex-wrap items-center gap-6">
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
