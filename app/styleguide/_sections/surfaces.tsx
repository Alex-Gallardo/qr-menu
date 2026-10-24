import { cn } from "cn";
import { Section } from "./section";

const RADII = [
  { token: "sm", cls: "rounded-sm", px: "8", use: "Chips, celdas" },
  { token: "md", cls: "rounded-md", px: "12", use: "Botones, inputs" },
  { token: "lg", cls: "rounded-lg", px: "16", use: "Tarjetas" },
  { token: "xl", cls: "rounded-xl", px: "24", use: "Hojas y paneles" },
  { token: "full", cls: "rounded-full", px: "∞", use: "Píldoras, avatares" },
] as const;

const BORDERS = [
  { label: "Divisor · 1 px border", cls: "border border-border" },
  { label: "Input · 1 px input", cls: "border border-input" },
  { label: "Foco · ring 3 px", cls: "border border-ring ring-3 ring-ring/30" },
  { label: "Error · destructive", cls: "border border-destructive ring-3 ring-destructive/20" },
  { label: "Nuevo · primary + ring", cls: "border border-primary ring-2 ring-primary/20" },
  { label: "Heredado · punteado", cls: "border-2 border-dashed border-border" },
] as const;

const SHADOWS = [
  { cls: "shadow-1", use: "Tarjetas en reposo" },
  { cls: "shadow-2", use: "Barra del carrito, menús flotantes" },
  { cls: "shadow-3", use: "Hojas y modales" },
] as const;

export function SurfacesSection() {
  return (
    <Section
      id="superficies"
      number={5}
      title="Radios, bordes y sombras"
      description="Radios sm 8, md 12, lg 16, xl 24 y full. Bordes de 1 px con el anillo de foco de 3 px. Tres niveles de sombra suaves y cálidas (frijol, no negro)."
    >
      <div className="flex flex-wrap gap-4">
        {RADII.map((r) => (
          <div key={r.token} className="w-24 text-center">
            <div className={cn("mx-auto size-20 border border-border bg-nube", r.cls)} />
            <p className="type-caption mt-2 font-mono">
              {r.token} · {r.px}
            </p>
            <p className="type-caption text-muted-foreground">{r.use}</p>
          </div>
        ))}
      </div>
      <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {BORDERS.map((b) => (
          <div
            key={b.label}
            className={cn("type-small grid h-16 place-items-center rounded-md bg-card", b.cls)}
          >
            {b.label}
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-6">
        {SHADOWS.map((s) => (
          <div
            key={s.cls}
            className={cn("grid h-24 w-44 place-items-center rounded-lg bg-card p-3", s.cls)}
          >
            <span className="type-caption text-center">
              <span className="block font-mono">{s.cls}</span>
              <span className="text-muted-foreground">{s.use}</span>
            </span>
          </div>
        ))}
      </div>
    </Section>
  );
}
