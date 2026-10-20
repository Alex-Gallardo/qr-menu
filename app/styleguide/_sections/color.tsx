import { PlusIcon } from "lucide-react";
import { PALETTE_PRESETS, type PalettePreset } from "@/features/appearance/palettes";
import { BRAND_COLORS } from "@/lib/brand-tokens";
import { contrastRatio, meetsAA, readableTextOn } from "@/lib/color";
import { formatQ } from "@/lib/money";
import { Section } from "./section";

export function ColorSection() {
  return (
    <Section
      id="color"
      number={2}
      title="Color"
      description="Tokens de la marca con su contraste contra blanco y contra frijol. Debajo, las 8 paletas que puede elegir cada negocio, aplicadas a una tarjeta de producto."
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {BRAND_COLORS.map((c) => (
          <div
            key={c.token}
            className="flex overflow-hidden rounded-lg border border-border bg-card shadow-1"
          >
            <div
              className="type-caption grid w-20 shrink-0 place-items-center font-semibold"
              style={{ background: c.hex, color: readableTextOn(c.hex) }}
            >
              Aa
            </div>
            <div className="min-w-0 p-3">
              <p className="font-mono text-sm font-semibold">{c.token}</p>
              <p className="type-caption text-muted-foreground">
                {c.hex} · {c.use}
              </p>
              <p className="type-caption mt-1 tabular-nums">
                <Ratio fg="#FFFFFF" bg={c.hex} label="blanco" />
                {" · "}
                <Ratio fg="#231A17" bg={c.hex} label="frijol" />
              </p>
            </div>
          </div>
        ))}
      </div>

      <h3 className="type-h3 mt-10">Paletas para negocios</h3>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PALETTE_PRESETS.map((p) => (
          <PaletteCard key={p.id} palette={p} />
        ))}
      </div>
    </Section>
  );
}

function Ratio({ fg, bg, label }: { fg: string; bg: string; label: string }) {
  const ok = meetsAA(fg, bg);
  return (
    <span className={ok ? "font-semibold text-success" : "text-muted-foreground"}>
      {label} {contrastRatio(fg, bg).toFixed(1)}
      {ok ? " AA" : ""}
    </span>
  );
}

function PaletteCard({ palette: p }: { palette: PalettePreset }) {
  const surface = p.dark ? "#221D19" : "#FFFFFF";
  return (
    <div
      className="rounded-lg border border-border p-3"
      style={{ background: p.bg, color: p.text }}
    >
      <p className="type-caption font-semibold">{p.name}</p>
      <div
        className="mt-2 flex items-center gap-3 rounded-md p-3 shadow-1"
        style={{ background: surface }}
      >
        <div className="min-w-0 flex-1">
          <p className="type-small font-semibold">Desayuno chapín</p>
          <span
            className="type-caption mt-1 inline-block rounded-full px-2 font-semibold"
            style={{ background: p.accent, color: readableTextOn(p.accent) }}
          >
            Popular
          </span>
          <p className="type-price mt-1">{formatQ(4500)}</p>
        </div>
        <span
          aria-hidden
          className="grid size-10 place-items-center rounded-full"
          style={{ background: p.primary, color: readableTextOn(p.primary) }}
        >
          <PlusIcon className="size-5" />
        </span>
      </div>
      <div className="mt-2 flex gap-1">
        {[p.primary, p.accent, p.bg, p.text].map((hex, i) => (
          <span
            key={i}
            title={hex}
            className="h-4 flex-1 rounded-sm border border-black/10"
            style={{ background: hex }}
          />
        ))}
      </div>
    </div>
  );
}
