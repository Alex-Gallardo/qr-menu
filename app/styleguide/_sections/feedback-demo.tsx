"use client";

import { UtensilsCrossedIcon, XIcon } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { EmptyState } from "@/components/feedback/empty-state";
import { FormMessage } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { computeEntitlements, type EffectiveStatus } from "@/features/licensing/entitlements";
import { ProductPicker } from "@/features/menus/components/product-picker";
import { Announcements } from "@/features/panel/components/announcements";
import { LicenseBanner } from "@/features/panel/components/license-banner";
import { InstallBanner } from "@/features/public-menu/components/install-app";
import { MenuShell } from "@/features/public-menu/templates/clasico/components";
import { SHEET_BODY, SHEET_DIALOG, useSheet } from "@/features/public-menu/templates/clasico/sheet";
import { themeFromPreset } from "@/features/public-menu/theme";
import { formatQ } from "@/lib/money";
import { useStyleguideTheme } from "./theme-context";
import { ToastDemo } from "./toast-demo";

const PICKER_PRODUCTS = [
  ["Desayuno chapín", 4500, "Desayunos"],
  ["Panqueques con miel", 3800, "Desayunos"],
  ["Pepián de pollo", 6500, "Almuerzos"],
  ["Hilachas", 6000, "Almuerzos"],
  ["Café de olla", 1500, "Bebidas"],
  ["Atol de elote", 1200, "Bebidas"],
].map(([name, price, category], i) => ({
  id: `demo-${i}`,
  name: name as string,
  price_cents: price as number,
  image_url: null,
  is_available: i !== 3,
  category: { name: category as string },
}));

// Base real (sin licencia = Gratis); cada banner cambia solo estado y días.
const BASE = computeEntitlements({
  license: null,
  plan: null,
  freePlan: { id: "gratis", limits: {}, features: [] },
});
const LICENSE_CASES: { status: EffectiveStatus; daysLeft: number; pendingPayment?: boolean }[] = [
  { status: "trial", daysLeft: 5 },
  { status: "grace", daysLeft: 3 },
  { status: "suspended", daysLeft: 0 },
  { status: "active", daysLeft: 20, pendingPayment: true },
];

/** Sección 14 · mensajes, estados vacíos, toasts, modal, hoja inferior y banners. */
export function FeedbackDemo() {
  const { menuPalette } = useStyleguideTheme();
  const [picker, setPicker] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [installShown, setInstallShown] = useState(true);
  const theme = themeFromPreset(menuPalette);

  return (
    <div className="grid gap-8">
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="grid content-start gap-3">
          <FormMessage tone="success">¡Listo! Guardamos tus cambios.</FormMessage>
          <FormMessage tone="error">No pudimos guardar la foto. Probemos otra vez.</FormMessage>
        </div>
        <EmptyState
          icon={<UtensilsCrossedIcon />}
          title="Aún no tienes productos"
          action={<Button size="sm">Agregar mi primer producto</Button>}
        >
          Agrega tus platillos una vez y úsalos en todos tus menús.
        </EmptyState>
      </div>

      <div className="grid gap-3">
        <h3 className="type-h3">Toasts y cuenta para transferencia</h3>
        <ToastDemo />
      </div>

      <div className="grid gap-3">
        <h3 className="type-h3">Modal y hoja inferior</h3>
        <p className="type-small max-w-prose text-muted-foreground">
          En el panel, modales centrados (Esc o fuera para cerrar). En el menú del cliente, hojas
          que suben desde abajo con cabecera y pie fijos.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setPicker(true)}>
            Abrir modal (agregar productos)
          </Button>
          <Button variant="outline" onClick={() => setSheet(true)}>
            Abrir hoja inferior
          </Button>
        </div>
        {picker ? (
          <ProductPicker
            sectionName="Desayunos"
            products={PICKER_PRODUCTS}
            alreadyIn={new Set(["demo-0"])}
            onAdd={(ids) => {
              setPicker(false);
              toast.success(
                ids.length === 1 ? "Agregamos 1 producto" : `Agregamos ${ids.length} productos`,
              );
            }}
            onClose={() => setPicker(false)}
          />
        ) : null}
        {sheet ? (
          <MenuShell theme={theme} className="min-h-0">
            <DemoSheet onClose={() => setSheet(false)} />
          </MenuShell>
        ) : null}
      </div>

      <div className="grid gap-3">
        <h3 className="type-h3">Banners</h3>
        <p className="type-small text-muted-foreground">
          Licencia y anuncios arriba del panel; “instalar la app” al final del menú.
        </p>
        <div className="grid gap-px overflow-hidden rounded-lg border border-border">
          {LICENSE_CASES.map((c) => (
            <LicenseBanner
              key={`${c.status}-${c.pendingPayment ?? false}`}
              businessId="demo"
              entitlements={{ ...BASE, status: c.status, daysLeft: c.daysLeft }}
              isOwner
              pendingPayment={c.pendingPayment}
            />
          ))}
          <Announcements
            items={[
              {
                id: "styleguide-demo",
                title: "Nuevo:",
                body: "ya puedes programar pedidos para mañana. Actívalo en Sucursales.",
              },
            ]}
          />
        </div>
        <MenuShell
          theme={theme}
          className="min-h-0 max-w-[480px] overflow-hidden rounded-lg [&>div]:pb-4"
        >
          {installShown ? (
            <InstallBanner
              businessName="Café El Portal"
              onInstall={() => toast("En el menú real abre el aviso del sistema para instalar.")}
              onDismiss={() => setInstallShown(false)}
            />
          ) : (
            <Button variant="link" className="mx-4 mt-4" onClick={() => setInstallShown(true)}>
              Mostrar otra vez
            </Button>
          )}
        </MenuShell>
      </div>
    </div>
  );
}

function DemoSheet({ onClose }: { onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useSheet(ref);
  return (
    <dialog
      ref={ref}
      aria-labelledby="sg-sheet-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      className={`${SHEET_DIALOG} max-h-[85dvh]`}
    >
      <header className="flex shrink-0 items-center justify-between gap-2 border-b border-[var(--menu-line)] p-4">
        <h2 id="sg-sheet-title" className="type-h3">
          Hoja inferior
        </h2>
        <button
          type="button"
          aria-label="Cerrar"
          onClick={onClose}
          className="grid size-10 place-items-center rounded-full bg-[var(--menu-soft)]"
        >
          <XIcon aria-hidden className="size-5" />
        </button>
      </header>
      <div className={`${SHEET_BODY} grid gap-3 p-4`}>
        {Array.from({ length: 12 }, (_, i) => (
          <p key={i} className="type-body">
            Fila {i + 1}: el cuerpo tiene su propio scroll; cabecera y pie quedan fijos.
          </p>
        ))}
      </div>
      <footer className="shrink-0 border-t border-[var(--menu-line)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <button
          type="button"
          onClick={onClose}
          className="type-body h-12 w-full rounded-full bg-[var(--menu-primary)] font-semibold text-[var(--menu-on-primary)]"
        >
          Listo · {formatQ(4500)}
        </button>
      </footer>
    </dialog>
  );
}
