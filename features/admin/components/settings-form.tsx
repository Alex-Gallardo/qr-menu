"use client";

import { PlusIcon, Trash2Icon } from "lucide-react";
import { useState } from "react";
import { Field } from "@/components/forms/field";
import { PrefixedInput } from "@/components/forms/prefixed-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { EditorSection } from "@/features/appearance/components/controls";
import { saveSettingsAction, setPlanPriceAction } from "../actions";
import { useAdminAction } from "./use-admin-action";

type Account = { bank: string; type: string; number: string; holder: string };

/** Configuración global: mantenimiento, días de prueba/gracia, slugs reservados y cuentas de pago. */
export function SettingsForm({
  initial,
  builtInSlugs,
}: {
  initial: {
    maintenanceEnabled: boolean;
    maintenanceMessage: string;
    trialDays: number;
    founderTrialDays: number;
    graceDays: number;
    reservedSlugs: string;
    paymentAccounts: Account[];
  };
  builtInSlugs: string[];
}) {
  const { pending, run } = useAdminAction();
  const [s, setS] = useState(initial);
  const set = (patch: Partial<typeof s>) => setS((v) => ({ ...v, ...patch }));
  const setAccount = (i: number, patch: Partial<Account>) =>
    set({ paymentAccounts: s.paymentAccounts.map((a, j) => (j === i ? { ...a, ...patch } : a)) });
  const n = (v: string) => Number(v.replace(/\D/g, "")) || 0;

  return (
    <div className="grid gap-6">
      <EditorSection
        title="Modo mantenimiento"
        description="Todos (menos el super admin) ven la página de mantenimiento con este mensaje."
      >
        <label className="flex items-center justify-between gap-3">
          <span className="type-body">Activar mantenimiento</span>
          <Switch
            checked={s.maintenanceEnabled}
            aria-label="Activar mantenimiento"
            onCheckedChange={(maintenanceEnabled) => set({ maintenanceEnabled })}
          />
        </label>
        <Field id="c-msg" label="Mensaje">
          <Input
            id="c-msg"
            value={s.maintenanceMessage}
            onChange={(e) => set({ maintenanceMessage: e.target.value })}
          />
        </Field>
      </EditorSection>

      <EditorSection title="Licencias">
        <div className="grid gap-4 sm:grid-cols-3">
          <Field id="c-trial" label="Días de prueba">
            <Input
              id="c-trial"
              inputMode="numeric"
              value={String(s.trialDays)}
              onChange={(e) => set({ trialDays: n(e.target.value) })}
            />
          </Field>
          <Field id="c-founder" label="Días de prueba (fundadores)">
            <Input
              id="c-founder"
              inputMode="numeric"
              value={String(s.founderTrialDays)}
              onChange={(e) => set({ founderTrialDays: n(e.target.value) })}
            />
          </Field>
          <Field id="c-grace" label="Días de gracia">
            <Input
              id="c-grace"
              inputMode="numeric"
              value={String(s.graceDays)}
              onChange={(e) => set({ graceDays: n(e.target.value) })}
            />
          </Field>
        </div>
      </EditorSection>

      <EditorSection
        title="Links reservados"
        description={`Además de los de la app (${builtInSlugs.length}): uno por línea.`}
      >
        <textarea
          aria-label="Links reservados"
          rows={4}
          value={s.reservedSlugs}
          onChange={(e) => set({ reservedSlugs: e.target.value })}
          className="type-body w-full rounded-md border border-input bg-card px-3 py-2 font-mono"
        />
      </EditorSection>

      <EditorSection
        title="Cuentas para pagar licencias"
        description="Se muestran en Mi plan de cada negocio."
      >
        <ul className="grid gap-3">
          {s.paymentAccounts.map((a, i) => (
            <li
              key={i}
              className="grid gap-3 rounded-lg border border-border p-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto] sm:items-end"
            >
              <Field id={`pa-bank-${i}`} label="Banco">
                <Input
                  id={`pa-bank-${i}`}
                  value={a.bank}
                  onChange={(e) => setAccount(i, { bank: e.target.value })}
                />
              </Field>
              <Field id={`pa-type-${i}`} label="Tipo">
                <Input
                  id={`pa-type-${i}`}
                  value={a.type}
                  placeholder="Monetaria"
                  onChange={(e) => setAccount(i, { type: e.target.value })}
                />
              </Field>
              <Field id={`pa-num-${i}`} label="Número">
                <Input
                  id={`pa-num-${i}`}
                  value={a.number}
                  onChange={(e) => setAccount(i, { number: e.target.value })}
                />
              </Field>
              <Field id={`pa-holder-${i}`} label="A nombre de">
                <Input
                  id={`pa-holder-${i}`}
                  value={a.holder}
                  onChange={(e) => setAccount(i, { holder: e.target.value })}
                />
              </Field>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Quitar cuenta"
                onClick={() =>
                  set({ paymentAccounts: s.paymentAccounts.filter((_, j) => j !== i) })
                }
              >
                <Trash2Icon aria-hidden />
              </Button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          className="justify-self-start"
          onClick={() =>
            set({
              paymentAccounts: [
                ...s.paymentAccounts,
                { bank: "", type: "", number: "", holder: "" },
              ],
            })
          }
        >
          <PlusIcon aria-hidden />
          Agregar cuenta
        </Button>
      </EditorSection>

      <Button
        type="button"
        size="lg"
        className="justify-self-start"
        disabled={pending}
        onClick={() => run(() => saveSettingsAction(s))}
      >
        Guardar configuración
      </Button>
    </div>
  );
}

/** Precio de lista de los planes pagados (Q/mes; anual = 10 meses). */
export function PlanPrices({
  plans,
}: {
  plans: { id: "pro" | "negocio"; name: string; price: number }[];
}) {
  const { pending, run } = useAdminAction();
  const [prices, setPrices] = useState(
    Object.fromEntries(plans.map((p) => [p.id, String(p.price)])),
  );
  return (
    <EditorSection title="Precios de los planes" description="Mensual. El anual cobra 10 meses.">
      <div className="grid gap-3 sm:grid-cols-2">
        {plans.map((p) => (
          <div key={p.id} className="flex items-end gap-2">
            <Field id={`price-${p.id}`} label={p.name}>
              <PrefixedInput
                id={`price-${p.id}`}
                prefix="Q"
                inputMode="numeric"
                value={prices[p.id]}
                onChange={(e) =>
                  setPrices({ ...prices, [p.id]: e.target.value.replace(/\D/g, "") })
                }
              />
            </Field>
            <Button
              type="button"
              size="sm"
              disabled={pending}
              onClick={() =>
                run(() => setPlanPriceAction({ planId: p.id, priceGtq: Number(prices[p.id]) }))
              }
            >
              Guardar
            </Button>
          </div>
        ))}
      </div>
    </EditorSection>
  );
}
