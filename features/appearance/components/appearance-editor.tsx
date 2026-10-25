"use client";

import { ExternalLinkIcon, SmartphoneIcon, XIcon } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import { cn } from "cn";
import { Loader } from "@/components/feedback/loaders";
import { SaveIndicator } from "@/components/feedback/save-indicator";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import type { PublicProduct } from "@/features/public-menu/payload";
import type { MenuTemplateId } from "@/features/public-menu/templates";
import { normalizeSplash } from "@/features/public-menu/splash";
import { normalizeTheme } from "@/features/public-menu/theme";
import { BRAND } from "@/lib/brand";
import { useAutosave } from "@/lib/use-autosave";
import { validationError } from "@/lib/zod";
import { saveAppearance } from "../actions";
import { followPrimary, type AppearanceAllowance, type AppearanceDoc } from "../appearance";
import { fontClasses } from "../font-loaders";
import { BODY_FONTS, fontStack, HEADING_FONTS } from "../fonts";
import { appearanceSchema } from "../schemas";
import { BackgroundSection } from "./background-section";
import { ColorSection } from "./color-section";
import { Choice, EditorSection, PlanLock } from "./controls";
import { PhonePreview } from "./phone-preview";
import { SplashSection } from "./splash-section";

const ALL_FONTS = [...HEADING_FONTS, ...BODY_FONTS].map((f) => f.name);

const RADII = [
  { value: 4, label: "Rectos" },
  { value: 16, label: "Suaves" },
  { value: 24, label: "Redondos" },
] as const;

const LOADERS = [
  { value: "logo", label: "Tu logo latiendo" },
  { value: "puntos", label: "Puntos" },
  { value: "plato", label: "Plato girando" },
] as const;

/**
 * Apariencia: colores, fondo, fuentes, bordes, bienvenida, loader y marca,
 * con guardado automático y vista previa en un marco de celular que cambia al
 * instante (todo en el navegador; el servidor solo guarda).
 */
export function AppearanceEditor({
  businessId,
  initial,
  allow,
  business,
  licenseHref,
  menuHref,
}: {
  businessId: string;
  initial: AppearanceDoc;
  allow: AppearanceAllowance;
  business: {
    name: string;
    description: string | null;
    logoUrl: string | null;
    coverUrl: string | null;
    branchName: string;
    /** Plantilla del menú predeterminado (la vista previa la usa). */
    template: MenuTemplateId;
    products: PublicProduct[];
  };
  licenseHref: string;
  /** Menú real de la primera sucursal ("Ver mi menú"); null si aún no hay sucursal. */
  menuHref: string | null;
}) {
  const [doc, setDoc] = useState(initial);
  const [replay, setReplay] = useState(0);
  const dialogRef = useRef<HTMLDialogElement>(null);

  const playSplash = () => setReplay((n) => n + 1);
  const update = (patch: Partial<AppearanceDoc>) => {
    setDoc((d) => ({ ...d, ...followPrimary(d, patch, allow.customSplash) }));
    // Al tocar la bienvenida se vuelve a reproducir para ver el cambio.
    if (Object.keys(patch).some((k) => k.startsWith("splash_"))) playSplash();
  };

  const save = useCallback(
    async (value: AppearanceDoc) => {
      const input = { ...value, businessId };
      // Se valida aquí para avisar sin ir al servidor; la acción vuelve a validar.
      const parsed = appearanceSchema.safeParse(input);
      if (!parsed.success) return validationError(parsed.error);
      return saveAppearance(input);
    },
    [businessId],
  );
  const autosave = useAutosave(doc, save);

  const theme = useMemo(() => normalizeTheme(doc, allow), [doc, allow]);
  const splash = useMemo(
    () =>
      replay > 0
        ? normalizeSplash({ ...doc, splash_frequency: "always" }, theme, allow.customSplash)
        : null,
    [replay, doc, theme, allow.customSplash],
  );

  const preview = (
    <PhonePreview theme={theme} splash={splash} replay={replay} business={business} />
  );

  return (
    <div
      className={cn(
        "grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start",
        fontClasses(...ALL_FONTS),
      )}
    >
      <div className="grid gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <SaveIndicator state={autosave.state} onRetry={autosave.retry} />
          {menuHref ? (
            <Button asChild variant="ghost" size="sm">
              <a href={menuHref} target="_blank" rel="noopener noreferrer">
                <ExternalLinkIcon aria-hidden />
                Ver mi menú
              </a>
            </Button>
          ) : null}
        </div>
        {autosave.error ? (
          <p
            role="alert"
            className="type-small rounded-md bg-destructive/10 px-3 py-2 text-destructive"
          >
            {autosave.error}
          </p>
        ) : null}

        <ColorSection
          doc={doc}
          update={update}
          logoUrl={business.logoUrl}
          allowCustom={allow.customPalette}
          licenseHref={licenseHref}
        />

        <BackgroundSection
          businessId={businessId}
          doc={doc}
          update={update}
          allow={allow}
          licenseHref={licenseHref}
        />

        <EditorSection title="Fuentes" description="Una para los títulos y otra para el texto.">
          <FontPicker
            label="Títulos"
            fonts={HEADING_FONTS}
            value={doc.font_heading}
            sample={business.name}
            onChange={(font_heading) => update({ font_heading })}
          />
          <FontPicker
            label="Texto"
            fonts={BODY_FONTS}
            value={doc.font_body}
            sample="Huevos, frijoles y plátanos · Q45.00"
            onChange={(font_body) => update({ font_body })}
          />
        </EditorSection>

        <EditorSection
          title="Bordes"
          description="Qué tan redondeadas se ven las fotos y tarjetas."
        >
          <Choice
            label="Estilo"
            options={RADII}
            value={RADII.find((r) => r.value === doc.radius)?.value ?? doc.radius}
            onChange={(radius) => update({ radius })}
          />
          <label className="grid gap-1">
            <span className="type-small font-semibold">Radio: {doc.radius} px</span>
            <input
              type="range"
              min={0}
              max={28}
              step={1}
              value={doc.radius}
              onChange={(e) => update({ radius: Number(e.target.value) })}
              className="accent-primary"
            />
          </label>
        </EditorSection>

        <SplashSection
          businessId={businessId}
          doc={doc}
          update={update}
          allowCustom={allow.customSplash}
          licenseHref={licenseHref}
          onReplay={() => {
            playSplash();
            if (window.matchMedia("(max-width: 1279px)").matches) dialogRef.current?.showModal();
          }}
        />

        <EditorSection
          title="Indicador de carga"
          description='Lo que ve el cliente mientras espera ("Preparando tu pedido…").'
        >
          <div
            role="radiogroup"
            aria-label="Indicador de carga"
            className="grid gap-3 @lg:grid-cols-3"
          >
            {LOADERS.map((l) => (
              <button
                key={l.value}
                type="button"
                role="radio"
                aria-checked={doc.loader_style === l.value}
                onClick={() => update({ loader_style: l.value })}
                className="grid justify-items-center gap-3 rounded-lg border-2 border-transparent bg-muted/40 p-4 hover:bg-muted aria-checked:border-primary"
              >
                <span style={{ color: theme.primary }}>
                  <Loader style={l.value} logoUrl={business.logoUrl} />
                </span>
                <span className="type-small font-semibold">{l.label}</span>
              </button>
            ))}
          </div>
        </EditorSection>

        <EditorSection title={`Pie "Hecho con ${BRAND.name}"`}>
          <label className="flex items-center justify-between gap-3">
            <span className="type-body">Mostrar el pie al final del menú</span>
            <Switch
              checked={!allow.removeBranding || doc.show_powered_by}
              disabled={!allow.removeBranding}
              onCheckedChange={(show_powered_by) => update({ show_powered_by })}
            />
          </label>
          {!allow.removeBranding ? (
            <PlanLock licenseHref={licenseHref}>Quitar el pie es del plan Negocio.</PlanLock>
          ) : null}
        </EditorSection>
      </div>

      <aside
        aria-label="Vista previa"
        className="hidden justify-items-center gap-3 xl:sticky xl:top-6 xl:grid"
      >
        {preview}
      </aside>

      {/* En el celular la vista previa se abre en un diálogo. */}
      <Button
        type="button"
        className="fixed right-4 bottom-[calc(5rem+env(safe-area-inset-bottom))] z-40 shadow-3 lg:bottom-6 xl:hidden"
        onClick={() => dialogRef.current?.showModal()}
      >
        <SmartphoneIcon aria-hidden />
        Vista previa
      </Button>
      <dialog
        ref={dialogRef}
        aria-label="Vista previa"
        className="m-auto bg-transparent p-0 backdrop:bg-frijol/60 backdrop:backdrop-blur-sm xl:hidden"
        onClick={(e) => {
          if (e.target === e.currentTarget) dialogRef.current?.close();
        }}
      >
        <div className="grid justify-items-center gap-3">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => dialogRef.current?.close()}
          >
            <XIcon aria-hidden />
            Cerrar
          </Button>
          {preview}
        </div>
      </dialog>
    </div>
  );
}

function FontPicker({
  label,
  fonts,
  value,
  sample,
  onChange,
}: {
  label: string;
  fonts: readonly { name: string }[];
  value: string;
  sample: string;
  onChange: (name: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label={`Fuente de ${label.toLowerCase()}`} className="grid gap-1.5">
      <span className="type-small font-semibold">{label}</span>
      <div className="grid gap-2 @md:grid-cols-2">
        {fonts.map((f) => (
          <button
            key={f.name}
            type="button"
            role="radio"
            aria-checked={value === f.name}
            onClick={() => onChange(f.name)}
            className="grid gap-0.5 rounded-lg border-2 border-transparent bg-muted/40 px-3 py-2 text-left hover:bg-muted aria-checked:border-primary"
          >
            <span
              className="truncate text-lg"
              style={{ fontFamily: fontStack(f.name as Parameters<typeof fontStack>[0]) }}
            >
              {sample}
            </span>
            <span className="type-caption text-muted-foreground">{f.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
