"use client";

import { CheckIcon, SparklesIcon, TriangleAlertIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { presetSurface } from "@/features/public-menu/theme";
import type { AppearanceDoc } from "../appearance";
import { paletteIssues, type ColorField as Field, type PaletteColors } from "../contrast";
import { dominantColors, proposePalettes, type LogoPalette } from "../logo-palette";
import { PALETTE_PRESETS } from "../palettes";
import { ColorField, EditorSection, PlanLock } from "./controls";

const FIELD_LABELS: Record<Field, string> = {
  primary: "Principal (botones y precios)",
  accent: "Acento (destacados)",
  bg: "Fondo",
  surface: "Tarjetas",
  text: "Texto",
};
const COLUMN: Record<Field, keyof AppearanceDoc> = {
  primary: "color_primary",
  accent: "color_accent",
  bg: "color_bg",
  surface: "color_surface",
  text: "color_text",
};

export const colorsOf = (doc: AppearanceDoc): PaletteColors => ({
  primary: doc.color_primary,
  accent: doc.color_accent,
  bg: doc.color_bg,
  surface: doc.color_surface,
  text: doc.color_text,
});

const toColumns = (c: PaletteColors) => ({
  color_primary: c.primary,
  color_accent: c.accent,
  color_bg: c.bg,
  color_surface: c.surface,
  color_text: c.text,
});

/** Lee el logo en un canvas pequeño (necesita CORS: el bucket de Storage lo permite). */
async function logoPixels(url: string) {
  const img = new Image();
  img.crossOrigin = "anonymous";
  img.src = url;
  await img.decode();
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, size, size);
  return ctx.getImageData(0, 0, size, size).data;
}

function Swatches({ colors }: { colors: PaletteColors }) {
  return (
    <span className="flex h-10 overflow-hidden rounded-md border border-border">
      {[colors.primary, colors.accent, colors.bg, colors.text].map((c, i) => (
        <span key={i} className="flex-1" style={{ background: c }} />
      ))}
    </span>
  );
}

export function ColorSection({
  doc,
  update,
  logoUrl,
  allowCustom,
  licenseHref,
}: {
  doc: AppearanceDoc;
  update: (patch: Partial<AppearanceDoc>) => void;
  logoUrl: string | null;
  allowCustom: boolean;
  licenseHref: string;
}) {
  const [proposals, setProposals] = useState<LogoPalette[] | null>(null);
  const colors = colorsOf(doc);
  const issues = paletteIssues(colors);
  const custom = doc.palette_preset === "custom" || doc.palette_preset === "logo";

  const extract = async () => {
    if (!logoUrl) return;
    try {
      setProposals(proposePalettes(dominantColors(await logoPixels(logoUrl))));
    } catch {
      toast.error("No pudimos leer tu logo. Prueba subiéndolo otra vez en Ajustes → Negocio.");
    }
  };

  return (
    <EditorSection
      title="Colores"
      description="Todas las paletas listas se leen bien. Si armas la tuya, te avisamos si algo no se lee."
    >
      <div
        role="radiogroup"
        aria-label="Paletas listas"
        className="grid grid-cols-2 gap-3 @xl:grid-cols-4"
      >
        {PALETTE_PRESETS.map((p) => {
          const selected = doc.palette_preset === p.id;
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() =>
                update({
                  palette_preset: p.id,
                  ...toColumns({ ...p, surface: presetSurface(p) }),
                })
              }
              className={cn(
                "grid gap-2 rounded-lg border-2 p-2 text-left transition-colors hover:bg-muted",
                selected ? "border-primary" : "border-transparent bg-muted/40",
              )}
            >
              <Swatches colors={{ ...p, surface: presetSurface(p) }} />
              <span className="type-small flex items-center gap-1 font-semibold">
                {selected ? <CheckIcon aria-hidden className="size-4 text-primary" /> : null}
                {p.name}
              </span>
            </button>
          );
        })}
      </div>

      {allowCustom ? (
        <div className="grid gap-3">
          <div className="flex flex-wrap gap-2">
            {logoUrl ? (
              <Button type="button" variant="outline" onClick={() => void extract()}>
                <SparklesIcon aria-hidden />
                Extraer de mi logo
              </Button>
            ) : null}
            <Button
              type="button"
              variant={custom ? "secondary" : "outline"}
              onClick={() => update({ palette_preset: "custom" })}
            >
              Personalizar color por color
            </Button>
          </div>
          {proposals ? (
            <div
              role="radiogroup"
              aria-label="Paletas de tu logo"
              className="grid gap-3 @lg:grid-cols-3"
            >
              {proposals.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={false}
                  onClick={() => update({ palette_preset: "logo", ...toColumns(p) })}
                  className="grid gap-2 rounded-lg border-2 border-transparent bg-muted/40 p-2 text-left hover:bg-muted"
                >
                  <Swatches colors={p} />
                  <span className="type-small font-semibold">{p.name}</span>
                </button>
              ))}
            </div>
          ) : null}
          {custom ? (
            <div className="grid gap-3 @md:grid-cols-2">
              {(Object.keys(FIELD_LABELS) as Field[]).map((field) => (
                <ColorField
                  key={field}
                  label={FIELD_LABELS[field]}
                  value={colors[field]}
                  onChange={(value) => update({ palette_preset: "custom", [COLUMN[field]]: value })}
                />
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <PlanLock licenseHref={licenseHref}>
          La paleta de tu logo y la personalizada color por color son del plan Pro.
        </PlanLock>
      )}

      {issues.length > 0 ? (
        <div role="status" className="grid gap-2 rounded-md border border-maiz/70 bg-maiz/15 p-3">
          <p className="type-small flex items-center gap-2 font-semibold">
            <TriangleAlertIcon aria-hidden className="size-4" />
            Hay colores que cuestan leer
          </p>
          <ul className="grid gap-2">
            {issues.map((issue) => (
              <li key={issue.id} className="type-small flex flex-wrap items-center gap-2">
                <span className="flex-1">{issue.message}</span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    update({ palette_preset: "custom", [COLUMN[issue.fix.field]]: issue.fix.value })
                  }
                >
                  <span
                    aria-hidden
                    className="size-4 rounded-full border border-border"
                    style={{ background: issue.fix.value }}
                  />
                  Usar {issue.fix.value}
                </Button>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="type-small flex items-center gap-2 text-success">
          <CheckIcon aria-hidden className="size-4" />
          Buen contraste: todo se lee bien (AA).
        </p>
      )}
    </EditorSection>
  );
}
