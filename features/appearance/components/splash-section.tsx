"use client";

import { PlayIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ImageUploader } from "@/features/media/components/image-uploader";
import {
  SPLASH_EASING_LABELS,
  SPLASH_LOGO_SIZES,
  SPLASH_STYLES,
  type SplashEasing,
} from "@/features/public-menu/splash";
import { parseGradient } from "@/features/public-menu/theme";
import type { AppearanceDoc } from "../appearance";
import { Choice, ColorField, EditorSection, PlanLock } from "./controls";

const FREQUENCIES = [
  { value: "always", label: "Siempre" },
  { value: "once_per_session", label: "Una vez por visita" },
  { value: "first_visit", label: "Solo la primera vez" },
] as const;

export function SplashSection({
  businessId,
  doc,
  update,
  allowCustom,
  licenseHref,
  onReplay,
}: {
  businessId: string;
  doc: AppearanceDoc;
  update: (patch: Partial<AppearanceDoc>) => void;
  allowCustom: boolean;
  licenseHref: string;
  onReplay: () => void;
}) {
  const color = /^#[0-9a-fA-F]{6}$/.test(doc.splash_bg_value)
    ? doc.splash_bg_value
    : doc.color_primary;
  const gradient = parseGradient(doc.splash_bg_value) ?? {
    from: doc.color_primary,
    to: doc.color_accent,
  };
  const off = !allowCustom;

  return (
    <EditorSection
      title="Bienvenida"
      description="El panel con tu logo que se levanta y revela el menú. El menú carga detrás: nunca lo retrasa."
    >
      <Button type="button" variant="secondary" onClick={onReplay} className="justify-self-start">
        <PlayIcon aria-hidden />
        Reproducir
      </Button>

      {off ? (
        <PlanLock licenseHref={licenseHref}>
          Tu plan usa la bienvenida estándar: se levanta con tu color principal, 1.8 s, una vez por
          visita. Personalizarla es del plan Pro.
        </PlanLock>
      ) : null}

      <fieldset disabled={off} className="grid gap-4 disabled:opacity-60">
        <Choice
          label="Estilo"
          options={SPLASH_STYLES}
          value={doc.splash_style}
          onChange={(splash_style) => update({ splash_style })}
        />
        {doc.splash_style !== "none" ? (
          <>
            <Choice
              label="Fondo"
              value={doc.splash_bg_type}
              onChange={(type) =>
                update(
                  type === "color"
                    ? { splash_bg_type: type, splash_bg_value: color }
                    : type === "gradient"
                      ? { splash_bg_type: type, splash_bg_value: `${gradient.from},${gradient.to}` }
                      : { splash_bg_type: type },
                )
              }
              options={[
                { value: "color", label: "Color" },
                { value: "gradient", label: "Degradado" },
                { value: "image", label: "Imagen" },
              ]}
            />
            {doc.splash_bg_type === "color" ? (
              <ColorField
                label="Color"
                value={color}
                onChange={(v) => update({ splash_bg_value: v })}
              />
            ) : null}
            {doc.splash_bg_type === "gradient" ? (
              <div className="grid gap-3 @md:grid-cols-2">
                <ColorField
                  label="Color de arriba"
                  value={gradient.from}
                  onChange={(from) => update({ splash_bg_value: `${from},${gradient.to}` })}
                />
                <ColorField
                  label="Color de abajo"
                  value={gradient.to}
                  onChange={(to) => update({ splash_bg_value: `${gradient.from},${to}` })}
                />
              </div>
            ) : null}
            {doc.splash_bg_type === "image" ? (
              <ImageUploader
                businessId={businessId}
                kind="splash"
                value={/^https:/.test(doc.splash_bg_value) ? doc.splash_bg_value : null}
                label="Fondo de la bienvenida"
                onUploaded={async (img) => {
                  update({ splash_bg_type: "image", splash_bg_value: img.url });
                  return { ok: true };
                }}
                onRemove={() => update({ splash_bg_type: "color", splash_bg_value: color })}
              />
            ) : null}
            <Choice
              label="Tamaño del logo"
              value={doc.splash_logo_size}
              onChange={(splash_logo_size) => update({ splash_logo_size })}
              options={SPLASH_LOGO_SIZES.map((s) => ({
                value: s,
                label: s === 80 ? "Chico" : s === 112 ? "Mediano" : "Grande",
              }))}
            />
            <label className="flex items-center justify-between gap-3">
              <span className="type-small font-semibold">Mostrar el nombre del negocio</span>
              <Switch
                checked={doc.splash_show_name}
                onCheckedChange={(splash_show_name) => update({ splash_show_name })}
              />
            </label>
            {doc.splash_show_name ? (
              <label className="grid gap-1.5">
                <span className="type-small font-semibold">Frase (opcional)</span>
                <Input
                  value={doc.splash_tagline ?? ""}
                  maxLength={80}
                  placeholder="Ej.: Desde 1998"
                  onChange={(e) => update({ splash_tagline: e.target.value || null })}
                />
              </label>
            ) : null}
            <label className="grid gap-1">
              <span className="type-small font-semibold">
                Duración total: {(doc.splash_duration_ms / 1000).toFixed(1)} s
              </span>
              <input
                type="range"
                min={1200}
                max={3000}
                step={100}
                value={doc.splash_duration_ms}
                onChange={(e) => update({ splash_duration_ms: Number(e.target.value) })}
                className="accent-primary"
              />
            </label>
            <Choice
              label="Curva"
              value={doc.splash_easing}
              onChange={(splash_easing) => update({ splash_easing })}
              options={(Object.keys(SPLASH_EASING_LABELS) as SplashEasing[]).map((value) => ({
                value,
                label: SPLASH_EASING_LABELS[value],
              }))}
            />
            <Choice
              label="¿Cuándo se muestra?"
              value={doc.splash_frequency}
              onChange={(splash_frequency) => update({ splash_frequency })}
              options={FREQUENCIES}
            />
          </>
        ) : null}
      </fieldset>
    </EditorSection>
  );
}
