"use client";

import { useState } from "react";
import { Field } from "@/components/forms/field";
import { PrefixedInput } from "@/components/forms/prefixed-input";
import { RadioCards } from "@/components/forms/radio-cards";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Choice, EditorSection } from "@/features/appearance/components/controls";
import { PREORDER_OPTIONS } from "@/features/branches/components/branch-form";
import { orderTiming, type TimingRules } from "@/features/orders/preorder";
import { MenuShell } from "@/features/public-menu/templates/clasico/components";
import { WhenField } from "@/features/public-menu/templates/clasico/order-sheet";
import { QuantityStepper } from "@/features/public-menu/templates/clasico/quantity-stepper";
import { themeFromPreset } from "@/features/public-menu/theme";
import { PinKeypad } from "@/features/staff/components/pin-pad";
import { gtInstant } from "@/lib/gt-time";
import { useStyleguideTheme } from "./theme-context";

// Sucursal abierta de 7:00 a 21:00 que acepta programar con 30 min: "¿Para cuándo?".
// Fecha fija (lunes 10:00) para que el servidor y el navegador muestren lo mismo.
const RULES: TimingRules = {
  hours: [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({ weekday, opens: "07:00", closes: "21:00" })),
  closedDates: [],
  mode: "next_open",
  minLeadMin: 30,
  maxDays: 2,
  preordersEnabled: true,
};
const TIMING = orderTiming(RULES, gtInstant("2026-10-26", 600));

/** Sección 8 · los controles reales de los formularios del panel y del menú. */
export function FormsDemo() {
  const { menuPalette } = useStyleguideTheme();
  const [available, setAvailable] = useState(true);
  const [logoSize, setLogoSize] = useState<"s" | "m" | "l" | "xl">("m");
  const [preorder, setPreorder] = useState<(typeof PREORDER_OPTIONS)[number]["value"]>("next_open");
  const [quantity, setQuantity] = useState(2);
  const [when, setWhen] = useState<string | null>(null);

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <EditorSection title="Texto" description="Normal, con ayuda, con error y deshabilitado.">
        <Field id="sg-normal" label="Nombre del negocio" hint="Así lo verán tus clientes.">
          <Input id="sg-normal" placeholder="Café El Portal" />
        </Field>
        <Field id="sg-error" label="Correo" error="Ese correo no parece válido.">
          <Input id="sg-error" defaultValue="cafe@" aria-invalid />
        </Field>
        <Field id="sg-disabled" label="Link">
          <Input id="sg-disabled" defaultValue="cafe-el-portal" disabled />
        </Field>
        <Field id="sg-desc" label="Descripción" hint="Qué lleva y cómo se sirve.">
          <Textarea
            id="sg-desc"
            rows={3}
            defaultValue="Huevos al gusto, frijoles volteados, plátanos fritos y crema."
          />
        </Field>
        <Field id="sg-cat" label="Categoría">
          <NativeSelect id="sg-cat" defaultValue="desayunos">
            <option value="">Sin categoría</option>
            <option value="desayunos">Desayunos</option>
            <option value="bebidas">Bebidas</option>
          </NativeSelect>
        </Field>
      </EditorSection>

      <EditorSection
        title="Teléfono, precio y medidas"
        description="Prefijo o sufijo fijo: el cliente solo escribe el número."
      >
        <Field id="sg-phone" label="WhatsApp de la sucursal" hint="8 dígitos, sin el +502.">
          <PrefixedInput id="sg-phone" prefix="+502" inputMode="tel" defaultValue="5555 1234" />
        </Field>
        <Field id="sg-price" label="Precio">
          <PrefixedInput id="sg-price" prefix="Q" inputMode="decimal" defaultValue="45.00" />
        </Field>
        <Field
          id="sg-price-error"
          label="Precio en oferta"
          error="Debe ser menor que el precio normal."
        >
          <PrefixedInput
            id="sg-price-error"
            prefix="Q"
            inputMode="decimal"
            defaultValue="50.00"
            invalid
          />
        </Field>
        <Field id="sg-radius" label="Radio de entrega">
          <PrefixedInput id="sg-radius" suffix="km" inputMode="decimal" defaultValue="5" />
        </Field>
      </EditorSection>

      <EditorSection
        title="Interruptor y opciones"
        description="Interruptor con área táctil de 44 px; píldoras y tarjetas para elegir una opción."
      >
        <label className="flex min-h-11 items-center justify-between gap-3">
          <span className="type-body font-semibold">Disponible hoy</span>
          <Switch checked={available} onCheckedChange={setAvailable} />
        </label>
        <label className="flex min-h-11 items-center justify-between gap-3 opacity-80">
          <span className="type-body font-semibold">Deshabilitado</span>
          <Switch disabled />
        </label>
        <Choice
          label="Tamaño del logo"
          options={[
            { value: "s", label: "Chico" },
            { value: "m", label: "Mediano" },
            { value: "l", label: "Grande" },
            { value: "xl", label: "Gigante", locked: true },
          ]}
          value={logoSize}
          onChange={setLogoSize}
        />
        <RadioCards
          label="Pedidos fuera de horario"
          options={PREORDER_OPTIONS}
          value={preorder}
          onChange={setPreorder}
          className="grid gap-2"
        />
      </EditorSection>

      <EditorSection
        title="En el menú del cliente"
        description="Con la paleta elegida arriba: cantidad y “¿Para cuándo?” de la hoja de pedido."
      >
        <MenuShell
          theme={themeFromPreset(menuPalette)}
          className="min-h-0 overflow-hidden rounded-lg [&>div]:grid [&>div]:gap-5 [&>div]:p-4"
        >
          <div className="flex items-center justify-between gap-3">
            <span className="type-body font-semibold">Cantidad</span>
            <QuantityStepper
              label="Cantidad"
              value={quantity}
              onChange={(q) => setQuantity(Math.max(1, q))}
            />
          </div>
          <WhenField timing={TIMING} value={when} onChange={setWhen} />
        </MenuShell>
      </EditorSection>

      <EditorSection
        title="Teclado de PIN"
        description="El staff abre su turno en la tablet autorizada. Aquí el teclado físico no se captura y ningún PIN abre turno."
      >
        <div className="grid place-items-center rounded-lg bg-background py-6">
          <PinKeypad
            businessName="Café El Portal"
            logoUrl={null}
            branchName="Zona 1"
            deviceName="Tablet de caja"
            captureKeyboard={false}
            onSubmit={async () => {
              await new Promise((r) => setTimeout(r, 600));
              return "Ese PIN no es correcto. Prueba otra vez.";
            }}
          />
        </div>
      </EditorSection>
    </div>
  );
}
