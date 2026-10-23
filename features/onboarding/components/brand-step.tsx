"use client";

import { CheckIcon, PlayIcon } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { cn } from "cn";
import { SaveIndicator } from "@/components/feedback/save-indicator";
import { Button } from "@/components/ui/button";
import { saveAppearance } from "@/features/appearance/actions";
import {
  followPrimary,
  type AppearanceAllowance,
  type AppearanceDoc,
} from "@/features/appearance/appearance";
import { logoPixels, toColumns } from "@/features/appearance/components/color-section";
import { Choice, EditorSection, PlanLock } from "@/features/appearance/components/controls";
import { PhonePreview } from "@/features/appearance/components/phone-preview";
import type { PaletteColors } from "@/features/appearance/contrast";
import { fontClasses } from "@/features/appearance/font-loaders";
import { BODY_FONTS, HEADING_FONTS } from "@/features/appearance/fonts";
import {
  dominantColors,
  proposePalettes,
  type LogoPalette,
} from "@/features/appearance/logo-palette";
import { PALETTE_PRESETS } from "@/features/appearance/palettes";
import { appearanceSchema } from "@/features/appearance/schemas";
import { setBusinessImage } from "@/features/media/actions";
import { ImageUploader } from "@/features/media/components/image-uploader";
import { MENU_TEMPLATES, type MenuTemplate } from "@/features/menus/structure";
import type { PublicProduct } from "@/features/public-menu/payload";
import { normalizeSplash, SPLASH_STYLES } from "@/features/public-menu/splash";
import { normalizeTheme, presetSurface } from "@/features/public-menu/theme";
import { runAction } from "@/lib/action-client";
import { useAutosave } from "@/lib/use-autosave";
import { saveTemplateStep } from "../actions";

const ALL_FONTS = [...HEADING_FONTS, ...BODY_FONTS].map((f) => f.name);

/**
 * Paso 2: logo → 3 paletas sacadas de él (o una lista), plantilla y estilo de
 * bienvenida con "Reproducir". Todo se guarda solo y se ve en el celular.
 */
export function BrandStep({
  businessId,
  initialDoc,
  allow,
  allTemplates,
  licenseHref,
  business,
}: {
  businessId: string;
  initialDoc: AppearanceDoc;
  allow: AppearanceAllowance;
  allTemplates: boolean;
  licenseHref: string;
  business: {
    name: string;
    logoUrl: string | null;
    branchName: string;
    template: MenuTemplate;
    products: PublicProduct[];
  };
}) {
  const router = useRouter();
  const [doc, setDoc] = useState(initialDoc);
  const [logoUrl, setLogoUrl] = useState(business.logoUrl);
  const [template, setTemplate] = useState<MenuTemplate>(business.template);
  const [proposals, setProposals] = useState<LogoPalette[] | null>(null);
  const [replay, setReplay] = useState(0);

  const update = (patch: Partial<AppearanceDoc>) => {
    setDoc((d) => ({ ...d, ...followPrimary(d, patch, allow.customSplash) }));
    if (Object.keys(patch).some((k) => k.startsWith("splash_"))) setReplay((n) => n + 1);
  };

  const save = useCallback(
    async (value: AppearanceDoc) => {
      const input = { ...value, businessId };
      const parsed = appearanceSchema.safeParse(input);
      if (!parsed.success)
        return { ok: false, message: parsed.error.issues[0]?.message ?? "Revisa los datos." };
      return saveAppearance(input);
    },
    [businessId],
  );
  const autosave = useAutosave(doc, save);

  // Con logo (recién subido o de antes) se proponen 3 paletas a partir de sus colores.
  useEffect(() => {
    if (!logoUrl || !allow.customPalette) return;
    let cancelled = false;
    logoPixels(logoUrl)
      .then((pixels) => {
        if (!cancelled) setProposals(proposePalettes(dominantColors(pixels)));
      })
      .catch(() => {
        if (!cancelled) setProposals(null);
      });
    return () => {
      cancelled = true;
    };
  }, [logoUrl, allow.customPalette]);

  async function persistLogo(url: string | null) {
    const res = await runAction(() => setBusinessImage({ businessId, field: "logo_url", url }));
    if (res.ok) setLogoUrl(url);
    return res;
  }

  async function pickTemplate(value: MenuTemplate) {
    const before = template;
    setTemplate(value);
    const res = await runAction(() => saveTemplateStep({ businessId, template: value }));
    if (!res.ok) {
      setTemplate(before);
      toast.error(res.message);
    }
  }

  const theme = useMemo(() => normalizeTheme(doc, allow), [doc, allow]);
  const splash = useMemo(
    () =>
      replay > 0
        ? normalizeSplash({ ...doc, splash_frequency: "always" }, theme, allow.customSplash)
        : null,
    [replay, doc, theme, allow.customSplash],
  );

  const choose = (palette_preset: AppearanceDoc["palette_preset"], colors: PaletteColors) =>
    update({ palette_preset, ...toColumns(colors) });

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-start">
      <div className={cn("grid gap-6", fontClasses(...ALL_FONTS))}>
        <SaveIndicator state={autosave.state} onRetry={autosave.retry} />

        <EditorSection
          title="Tu logo"
          description="Cuadrado y en PNG si puedes. Con él te proponemos colores."
        >
          <div className="w-40">
            <ImageUploader
              businessId={businessId}
              kind="logo"
              value={logoUrl}
              onUploaded={(image) => persistLogo(image.url)}
              onRemove={() => void persistLogo(null)}
            />
          </div>
        </EditorSection>

        <EditorSection
          title="Colores"
          description={
            proposals
              ? "Sacamos estas paletas de tu logo. También puedes elegir una lista."
              : "Elige una paleta. Todas se leen bien."
          }
        >
          {proposals ? (
            <PaletteGrid
              label="Paletas de tu logo"
              options={proposals.map((p) => ({ id: p.id, name: p.name, colors: p }))}
              selected={(p) =>
                doc.palette_preset === "logo" && doc.color_primary === p.colors.primary
              }
              onPick={(p) => choose("logo", p.colors)}
            />
          ) : null}
          <PaletteGrid
            label="Paletas listas"
            options={PALETTE_PRESETS.map((p) => ({
              id: p.id,
              name: p.name,
              colors: { ...p, surface: presetSurface(p) },
            }))}
            selected={(p) => doc.palette_preset === p.id}
            onPick={(p) => choose(p.id as AppearanceDoc["palette_preset"], p.colors)}
          />
        </EditorSection>

        <EditorSection title="Plantilla" description="Cómo se acomodan tus productos.">
          <Choice
            label="Plantilla del menú"
            value={template}
            onChange={(t) => void pickTemplate(t)}
            options={MENU_TEMPLATES.map((t) => ({
              value: t.value,
              label: t.label,
              locked: !t.free && !allTemplates,
            }))}
          />
          {!allTemplates ? (
            <PlanLock licenseHref={licenseHref}>
              Galería, Minimal y Tarjetas son del plan Pro.
            </PlanLock>
          ) : null}
        </EditorSection>

        <EditorSection
          title="Bienvenida"
          description="Lo primero que ven al abrir tu menú: tu logo que se levanta y revela el menú."
        >
          <Choice
            label="Estilo"
            value={doc.splash_style}
            onChange={(splash_style) => update({ splash_style })}
            disabled={!allow.customSplash}
            options={SPLASH_STYLES}
          />
          <Button
            type="button"
            variant="secondary"
            className="justify-self-start"
            onClick={() => setReplay((n) => n + 1)}
          >
            <PlayIcon aria-hidden />
            Reproducir
          </Button>
        </EditorSection>

        <div className="flex flex-wrap justify-between gap-3">
          <Button type="button" variant="ghost" onClick={() => router.push("/onboarding?paso=1")}>
            Atrás
          </Button>
          <Button type="button" size="lg" onClick={() => router.push("/onboarding?paso=3")}>
            Siguiente: tus productos
          </Button>
        </div>
      </div>

      <aside
        aria-label="Vista previa"
        className="grid justify-items-center gap-2 lg:sticky lg:top-6"
      >
        <PhonePreview
          theme={theme}
          splash={splash}
          replay={replay}
          business={{
            name: business.name,
            description: null,
            logoUrl,
            coverUrl: null,
            branchName: business.branchName,
            template,
            products: business.products,
          }}
        />
        <p className="type-caption text-muted-foreground">Así se ve en un celular.</p>
      </aside>
    </div>
  );
}

type PaletteOption = { id: string; name: string; colors: PaletteColors };

function PaletteGrid({
  label,
  options,
  selected,
  onPick,
}: {
  label: string;
  options: PaletteOption[];
  selected: (p: PaletteOption) => boolean;
  onPick: (p: PaletteOption) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid gap-2">
      <span className="type-small font-semibold">{label}</span>
      <div className="grid grid-cols-2 gap-3 @xl:grid-cols-4">
        {options.map((p) => {
          const on = selected(p);
          return (
            <button
              key={p.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onPick(p)}
              className={cn(
                "grid gap-2 rounded-lg border-2 p-2 text-left transition-colors hover:bg-muted",
                on ? "border-primary" : "border-transparent bg-muted/40",
              )}
            >
              <span className="flex h-8 overflow-hidden rounded-md border border-border">
                {[
                  p.colors.primary,
                  p.colors.accent,
                  p.colors.bg,
                  p.colors.surface,
                  p.colors.text,
                ].map((c, i) => (
                  <span key={i} className="flex-1" style={{ background: c }} />
                ))}
              </span>
              <span className="type-small flex items-center gap-1 font-semibold">
                {on ? <CheckIcon aria-hidden className="size-4 text-primary" /> : null}
                {p.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
