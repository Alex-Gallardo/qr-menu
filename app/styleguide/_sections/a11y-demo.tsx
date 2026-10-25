"use client";

import { PlusIcon } from "lucide-react";
import { useState } from "react";
import { cn } from "cn";
import { SaveIndicator } from "@/components/feedback/save-indicator";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { MenuShell } from "@/features/public-menu/templates/clasico/components";
import { QuantityStepper } from "@/features/public-menu/templates/clasico/quantity-stepper";
import { themeFromPreset } from "@/features/public-menu/theme";
import { BRAND_COLORS } from "@/lib/brand-tokens";
import { contrastRatio, meetsAA } from "@/lib/color";
import { formatQ } from "@/lib/money";
import { useStyleguideTheme } from "./theme-context";

const hex = (token: string) =>
  token === "blanco" ? "#FFFFFF" : BRAND_COLORS.find((c) => c.token === token)!.hex;

// Pares de texto/fondo que usa la interfaz (texto normal: AA = 4.5:1).
const PAIRS = [
  { fg: "frijol", bg: "masa", use: "Texto principal" },
  { fg: "canela", bg: "masa", use: "Texto secundario" },
  { fg: "blanco", bg: "tomate", use: "Botón primario" },
  { fg: "tomate-700", bg: "masa", use: "Enlaces" },
  { fg: "frijol", bg: "maiz", use: "Chips “Aceptado”, límites" },
  { fg: "frijol", bg: "nube", use: "Anuncios, superficies" },
] as const;

const PRICE = 4500;

/** Sección 17 · foco visible, objetivos táctiles, contraste y aria-live. */
export function A11yDemo() {
  const { menuPalette } = useStyleguideTheme();
  const [quantity, setQuantity] = useState(1);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  const save = () => {
    setSaveState("saving");
    setTimeout(() => setSaveState("saved"), 900);
  };

  return (
    <div className="grid gap-8">
      <div className="grid gap-3">
        <h3 className="type-h3">Foco visible</h3>
        <p className="type-small max-w-prose text-muted-foreground">
          Recorre con Tab: cada control muestra un anillo de 3 px (ring) solo con teclado
          (focus-visible). Nunca se quita el contorno sin reemplazo.
        </p>
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card p-4">
          <Button>Botón</Button>
          <Button variant="outline">Contorno</Button>
          <Input aria-label="Campo de ejemplo" placeholder="Campo" className="w-48" />
          <Switch aria-label="Interruptor de ejemplo" defaultChecked />
          <a
            href="#accesibilidad"
            className="type-body font-semibold text-tomate-700 underline underline-offset-4 outline-none focus-visible:rounded-sm focus-visible:ring-3 focus-visible:ring-ring/50"
          >
            Enlace
          </a>
        </div>
      </div>

      <div className="grid gap-3">
        <h3 className="type-h3">Objetivos táctiles de 44–48 px</h3>
        <p className="type-small max-w-prose text-muted-foreground">
          Botones de 48 px por defecto (56 en las acciones del menú); píldoras e interruptor con
          área de 44 px. Los botones chicos (40 px) solo se usan en el panel, con espacio alrededor.
        </p>
        <div className="flex flex-wrap items-end gap-6 rounded-lg border border-border bg-card p-4">
          {[
            { label: "Botón · 48", node: <Button>Agregar</Button> },
            {
              label: "Ícono · 48",
              node: (
                <Button size="icon" aria-label="Agregar">
                  <PlusIcon />
                </Button>
              ),
            },
            { label: "Grande · 56", node: <Button size="lg">Pedir</Button> },
            {
              label: "Interruptor · área 44",
              node: <Switch aria-label="Disponible" defaultChecked />,
            },
          ].map((t) => (
            <figure key={t.label} className="grid justify-items-center gap-2">
              <div className="rounded-md outline-1 outline-offset-2 outline-dashed outline-primary/40">
                {t.node}
              </div>
              <figcaption className="type-caption text-muted-foreground">{t.label}</figcaption>
            </figure>
          ))}
        </div>
      </div>

      <div className="grid gap-3">
        <h3 className="type-h3">Contraste</h3>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {PAIRS.map((p) => {
            const ratio = contrastRatio(hex(p.fg), hex(p.bg));
            const ok = meetsAA(hex(p.fg), hex(p.bg));
            return (
              <li
                key={`${p.fg}-${p.bg}`}
                className="flex overflow-hidden rounded-lg border border-border bg-card shadow-1"
              >
                <span
                  className="type-body grid w-20 shrink-0 place-items-center font-semibold"
                  style={{ color: hex(p.fg), background: hex(p.bg) }}
                >
                  Aa
                </span>
                <span className="type-caption grid gap-0.5 p-3">
                  <span className="font-mono font-semibold">
                    {p.fg} / {p.bg}
                  </span>
                  <span>{p.use}</span>
                  <span
                    className={cn(
                      "font-semibold tabular-nums",
                      ok ? "text-success" : "text-destructive",
                    )}
                  >
                    {ratio.toFixed(2)}:1 · {ok ? "AA" : "No cumple"}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
        <p className="type-small text-muted-foreground">
          Las paletas de los negocios se verifican igual al elegirlas (sección Color) y Apariencia
          sugiere un tono si no cumple.
        </p>
      </div>

      <div className="grid gap-3">
        <h3 className="type-h3">aria-live en carrito y carga</h3>
        <p className="type-small max-w-prose text-muted-foreground">
          Los lectores de pantalla anuncian los cambios sin mover el foco: la cantidad y el total
          del carrito, “Guardando… → Guardado ✓” y el modal de carga.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <MenuShell
            theme={themeFromPreset(menuPalette)}
            className="min-h-0 overflow-hidden rounded-lg [&>div]:grid [&>div]:gap-3 [&>div]:p-4"
          >
            <div className="flex items-center justify-between gap-3">
              <span className="type-body font-semibold">Desayuno chapín</span>
              <QuantityStepper
                label="Cantidad de Desayuno chapín"
                value={quantity}
                onChange={(q) => setQuantity(Math.max(1, q))}
              />
            </div>
            <p aria-live="polite" className="type-small text-[var(--menu-muted)]">
              {quantity} en tu pedido · {formatQ(quantity * PRICE)}
            </p>
          </MenuShell>
          <div className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4">
            <Button variant="outline" onClick={save} loading={saveState === "saving"}>
              Guardar cambio
            </Button>
            <SaveIndicator state={saveState} />
          </div>
        </div>
      </div>
    </div>
  );
}
