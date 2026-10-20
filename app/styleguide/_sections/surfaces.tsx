import { cn } from "cn";
import { Section } from "./section";

const RADII = [
  { token: "sm", cls: "rounded-sm", px: "8" },
  { token: "md", cls: "rounded-md", px: "12" },
  { token: "lg", cls: "rounded-lg", px: "16" },
  { token: "xl", cls: "rounded-xl", px: "24" },
  { token: "full", cls: "rounded-full", px: "∞" },
] as const;

const SHADOWS = ["shadow-1", "shadow-2", "shadow-3"] as const;

export function SurfacesSection() {
  return (
    <Section
      id="superficies"
      number={5}
      title="Radios y sombras"
      description="Radios sm 8, md 12, lg 16, xl 24 y full. Tres niveles de sombra suaves."
    >
      <div className="flex flex-wrap gap-4">
        {RADII.map((r) => (
          <div key={r.token} className="text-center">
            <div className={cn("size-20 border border-border bg-nube", r.cls)} />
            <p className="type-caption mt-2 font-mono">
              {r.token} · {r.px}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-8 flex flex-wrap gap-6">
        {SHADOWS.map((s) => (
          <div key={s} className={cn("grid h-24 w-40 place-items-center rounded-lg bg-card", s)}>
            <span className="type-caption font-mono">{s}</span>
          </div>
        ))}
      </div>
    </Section>
  );
}
