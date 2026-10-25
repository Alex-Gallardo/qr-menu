"use client";

import { PlayIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Splash } from "@/features/public-menu/components/splash";
import {
  normalizeSplash,
  SPLASH_EASING_LABELS,
  SPLASH_LOGO_SIZES,
  SPLASH_STYLES,
  type SplashEasing,
  type SplashStyle,
} from "@/features/public-menu/splash";
import {
  MenuHeader,
  MenuSection,
  MenuShell,
  ProductCard,
} from "@/features/public-menu/templates/clasico/components";
import { themeFromPreset } from "@/features/public-menu/theme";
import { useStyleguideTheme } from "./theme-context";

const photo = (id: string) => `https://images.unsplash.com/photo-${id}?w=1200&q=80&auto=format`;

const BACKGROUNDS = [
  { value: "color", label: "Color" },
  { value: "gradient", label: "Degradado" },
  { value: "image", label: "Imagen" },
] as const;

/**
 * Sección 12 · Bienvenida. Es el componente real del menú público (Splash) en
 * un marco de celular: 4 estilos × 3 curvas, 3 fondos y 3 tamaños de logo,
 * con "Reproducir" (como tendrá Apariencia en QRM-033).
 */
export function SplashDemo() {
  const [style, setStyle] = useState<SplashStyle>("lift");
  const [easing, setEasing] = useState<SplashEasing>("suave");
  const [bgType, setBgType] = useState<(typeof BACKGROUNDS)[number]["value"]>("color");
  const [logoSize, setLogoSize] = useState<number>(112);
  const [durationMs, setDurationMs] = useState(1800);
  const [run, setRun] = useState(0);

  const { menuPalette } = useStyleguideTheme();
  const theme = themeFromPreset(menuPalette);
  const accent = theme.accent;
  const config = normalizeSplash(
    {
      splash_style: style,
      splash_bg_type: bgType,
      splash_bg_value:
        bgType === "color"
          ? theme.primary
          : bgType === "gradient"
            ? `${theme.primary},${accent}`
            : photo("1517248135467-4c7edcad34c4"),
      splash_logo_size: logoSize,
      splash_show_name: true,
      splash_tagline: "Desde 1998",
      splash_duration_ms: durationMs,
      splash_easing: easing,
      splash_frequency: "always",
    },
    theme,
    true,
  );
  const replay = () => setRun((n) => n + 1);

  return (
    <div className="flex flex-wrap items-start gap-6">
      <div
        data-testid="splash-390"
        className="h-[640px] w-[360px] max-w-full overflow-hidden rounded-[28px] border-8 border-frijol shadow-3"
      >
        <Splash
          key={`${run}-${style}-${easing}-${bgType}-${logoSize}-${durationMs}`}
          config={config}
          storageKey="styleguide"
          name="Café El Portal"
          logoUrl={null}
          contained
        >
          <MenuShell theme={theme}>
            <MenuHeader
              name="Café El Portal"
              branchName="Antigua"
              description="Desayunos chapines, almuerzos ejecutivos y buen café desde 1998."
              logoUrl={null}
              coverUrl={photo("1517248135467-4c7edcad34c4")}
              hours={{ open: true, label: "Abierto · cierra 22:00" }}
              selectorHref={null}
            />
            <div className="mt-6 px-4">
              <MenuSection id="splash-demo" name="Desayunos" description={null}>
                <ProductCard
                  product={{
                    id: "chapin",
                    name: "Desayuno chapín",
                    description: "Huevos al gusto, frijoles, plátanos, queso fresco y crema.",
                    imageUrl: photo("1533089860892-a7c6f0a88666"),
                    blurhash: null,
                    blurDataUrl: null,
                    priceCents: 4500,
                    compareAtCents: null,
                    tags: ["popular"],
                    available: true,
                    prepMinutes: null,
                    optionGroups: [],
                  }}
                  priceCents={4500}
                  featured
                />
              </MenuSection>
            </div>
          </MenuShell>
        </Splash>
      </div>

      <div className="grid max-w-sm gap-4">
        <Choice label="Estilo" options={SPLASH_STYLES} value={style} onChange={setStyle} />
        <Choice
          label="Curva"
          options={(Object.keys(SPLASH_EASING_LABELS) as SplashEasing[]).map((value) => ({
            value,
            label: SPLASH_EASING_LABELS[value],
          }))}
          value={easing}
          onChange={setEasing}
        />
        <Choice label="Fondo" options={BACKGROUNDS} value={bgType} onChange={setBgType} />
        <Choice
          label="Logo"
          options={SPLASH_LOGO_SIZES.map((s) => ({
            value: s,
            label: s === 80 ? "Chico" : s === 112 ? "Mediano" : "Grande",
          }))}
          value={logoSize}
          onChange={setLogoSize}
        />
        <label className="grid gap-1">
          <span className="type-small font-semibold">
            Duración total: {(durationMs / 1000).toFixed(1)} s
          </span>
          <input
            type="range"
            min={1200}
            max={3000}
            step={100}
            value={durationMs}
            onChange={(e) => setDurationMs(Number(e.target.value))}
            className="accent-primary"
          />
        </label>
        <Button type="button" onClick={replay} className="justify-self-start">
          <PlayIcon aria-hidden />
          Reproducir
        </Button>
        <p className="type-small text-muted-foreground">
          Solo anima transform y opacity. Tocar el panel la salta (las mismas animaciones, 6 veces
          más rápido). Con “reducir movimiento” es un fundido de 300 ms. En el menú real se muestra
          según la frecuencia del negocio (siempre, una vez por sesión o solo la primera visita).
        </p>
      </div>
    </div>
  );
}

function Choice<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="grid gap-1.5">
      <span className="type-small font-semibold">{label}</span>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            aria-pressed={value === o.value}
            onClick={() => onChange(o.value)}
            className="type-small h-10 rounded-full border border-border bg-card px-3 font-semibold aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground"
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
